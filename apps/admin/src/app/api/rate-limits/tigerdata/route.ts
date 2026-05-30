// GET /api/rate-limits/tigerdata
// Live TigerData (TimescaleDB) connection test + pool + table stats.
// Every query is logged to the server console as a confirmed datapoint.

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  const pool  = getPool();
  const start = Date.now();

  try {
    // 1 — Latency probe
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;

    // 2 — Active connections in this database
    const connRes = await pool.query<{ active: number }>(
      `SELECT count(*)::int AS active
       FROM pg_stat_activity
       WHERE datname = current_database() AND state IS NOT NULL`,
    );

    // 3 — Max connections setting
    const maxRes = await pool.query<{ max: number }>(
      `SELECT current_setting('max_connections')::int AS max`,
    );

    // 4 — Human-readable database size
    const sizeRes = await pool.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
    );

    // 5 — rz_users row count
    const usersRes = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM rz_users`,
    );

    const result = {
      connected:         true,
      latencyMs,
      activeConnections: connRes.rows[0].active,
      maxConnections:    maxRes.rows[0].max,
      dbSize:            sizeRes.rows[0].size,
      tables: [
        { name: 'rz_users', rows: usersRes.rows[0].count },
      ],
      pool: {
        total:   pool.totalCount,
        idle:    pool.idleCount,
        waiting: pool.waitingCount,
      },
    };

    console.log(
      '[tigerdata] ✓ connected — latency=%dms  connections=%d/%d  size=%s  rz_users=%d rows  pool(tot/idle/wait)=%d/%d/%d',
      latencyMs,
      result.activeConnections,
      result.maxConnections,
      result.dbSize,
      usersRes.rows[0].count,
      pool.totalCount,
      pool.idleCount,
      pool.waitingCount,
    );

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tigerdata] ✗ connection test FAILED:', msg);
    return NextResponse.json(
      { connected: false, latencyMs: Date.now() - start, error: msg },
      { status: 500 },
    );
  }
}
