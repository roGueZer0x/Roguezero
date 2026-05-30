import type pg from 'pg';

const DEFAULT_TABLE_NAME = 'provider_rate_limits';
const TABLE_READY = new WeakMap<pg.Pool, Map<string, Promise<void>>>();

export type BucketComputation = {
  granted: boolean;
  availableTokens: number;
  waitMs: number;
};

export type ExponentialBackoffOptions = {
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
};

export type SharedTokenBucketOptions = {
  pool: pg.Pool;
  key: string;
  maxTokens: number;
  refillRatePerSec: number;
  tableName?: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const computeBucketState = (params: {
  availableTokens: number;
  elapsedMs: number;
  maxTokens: number;
  refillRatePerSec: number;
  requestedTokens?: number;
}): BucketComputation => {
  const requestedTokens = params.requestedTokens ?? 1;
  const refilledTokens = Math.min(
    params.maxTokens,
    params.availableTokens + (params.elapsedMs / 1000) * params.refillRatePerSec,
  );

  if (refilledTokens >= requestedTokens) {
    return {
      granted: true,
      availableTokens: refilledTokens - requestedTokens,
      waitMs: 0,
    };
  }

  const missingTokens = requestedTokens - refilledTokens;
  const waitMs = Math.ceil((missingTokens / params.refillRatePerSec) * 1000);

  return {
    granted: false,
    availableTokens: refilledTokens,
    waitMs,
  };
};

export const getExponentialBackoffDelayMs = (
  attempt: number,
  options: ExponentialBackoffOptions = {},
) => {
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const jitterRatio = options.jitterRatio ?? 0.25;
  const random = options.random ?? Math.random;
  const baseDelay = Math.min(initialDelayMs * 2 ** Math.max(0, attempt - 1), maxDelayMs);
  const jitterFactor = 1 - jitterRatio + random() * jitterRatio * 2;
  return Math.max(0, Math.round(baseDelay * jitterFactor));
};

const getTableReadyMap = (pool: pg.Pool) => {
  let tableMap = TABLE_READY.get(pool);

  if (!tableMap) {
    tableMap = new Map<string, Promise<void>>();
    TABLE_READY.set(pool, tableMap);
  }

  return tableMap;
};

const ensureTableReady = async (pool: pg.Pool, tableName: string) => {
  const tableMap = getTableReadyMap(pool);
  let ready = tableMap.get(tableName);

  if (!ready) {
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        bucket_key TEXT PRIMARY KEY,
        available_tokens DOUBLE PRECISION NOT NULL,
        max_tokens DOUBLE PRECISION NOT NULL,
        refill_rate_per_sec DOUBLE PRECISION NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `).then(() => undefined);
    tableMap.set(tableName, ready);
  }

  return ready;
};

export class SharedTokenBucket {
  private readonly tableName: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;

  constructor(private readonly options: SharedTokenBucketOptions) {
    this.tableName = options.tableName ?? DEFAULT_TABLE_NAME;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => new Date());
  }

  async acquire(requestedTokens = 1): Promise<void> {
    for (;;) {
      const waitMs = await this.reserve(requestedTokens);
      if (waitMs === 0) {
        return;
      }

      await this.sleep(waitMs);
    }
  }

  private async reserve(requestedTokens: number): Promise<number> {
    await ensureTableReady(this.options.pool, this.tableName);
    const client = await this.options.pool.connect();
    const now = this.now();

    try {
      await client.query('BEGIN');
      await client.query(
        `
          INSERT INTO ${this.tableName} (
            bucket_key,
            available_tokens,
            max_tokens,
            refill_rate_per_sec,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (bucket_key) DO NOTHING
        `,
        [
          this.options.key,
          this.options.maxTokens,
          this.options.maxTokens,
          this.options.refillRatePerSec,
          now.toISOString(),
        ],
      );

      const result = await client.query<{
        available_tokens: number;
        updated_at: Date;
      }>(
        `
          SELECT available_tokens, updated_at
          FROM ${this.tableName}
          WHERE bucket_key = $1
          FOR UPDATE
        `,
        [this.options.key],
      );

      if (result.rowCount === 0) {
        throw new Error(`Rate limit bucket ${this.options.key} could not be loaded`);
      }

      const row = result.rows[0];
      const elapsedMs = Math.max(0, now.getTime() - new Date(row.updated_at).getTime());
      const nextState = computeBucketState({
        availableTokens: Number(row.available_tokens),
        elapsedMs,
        maxTokens: this.options.maxTokens,
        refillRatePerSec: this.options.refillRatePerSec,
        requestedTokens,
      });

      await client.query(
        `
          UPDATE ${this.tableName}
          SET
            available_tokens = $2,
            max_tokens = $3,
            refill_rate_per_sec = $4,
            updated_at = $5
          WHERE bucket_key = $1
        `,
        [
          this.options.key,
          nextState.availableTokens,
          this.options.maxTokens,
          this.options.refillRatePerSec,
          now.toISOString(),
        ],
      );

      await client.query('COMMIT');
      return nextState.waitMs;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const createSharedTokenBucket = (options: SharedTokenBucketOptions) =>
  new SharedTokenBucket(options);
