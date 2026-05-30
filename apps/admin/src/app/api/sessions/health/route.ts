import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

type SessionHealthRow = {
  id: string;
  user_id: string;
  username: string;
  status: string;
  requested_at: Date | string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  stop_reason: string | null;
  last_trade_attempted_at: string | null;
  last_trade_submitted_at: string | null;
  last_sizing_at: string | null;
  last_sizing_decision: 'traded' | 'skipped' | null;
  last_sizing_reason: string | null;
  last_sizing_balance_lamports: string | null;
  last_sizing_reserve_lamports: string | null;
  last_sizing_tradable_lamports: string | null;
  last_sizing_fraction_bps: number | null;
  last_sizing_target_lamports: string | null;
  last_sizing_min_trade_lamports: string | null;
  last_sizing_max_trade_lamports: string | null;
  last_sizing_amount_lamports: string | null;
  last_sizing_remaining_risk_budget_usd: number | null;
  last_sizing_quoted_out_amount_atomic: string | null;
  last_sizing_minimum_output_atomic: string | null;
  last_sizing_price_impact_pct: string | null;
  last_sizing_estimated_network_cost_lamports: string | null;
  last_sizing_estimated_network_cost_output_atomic: string | null;
  last_sizing_worst_case_slippage_output_atomic: string | null;
  last_sizing_total_worst_case_cost_output_atomic: string | null;
  last_sizing_risk_adjusted_amount_lamports: string | null;
  realized_pnl_usd: number | null;
  unrealized_pnl_usd: number | null;
  last_sizing_trade_context: {
    inputMint: string;
    inputSymbol: 'SOL' | 'USDC' | 'USDT';
    outputMint: string;
    outputSymbol: 'SOL' | 'USDC' | 'USDT';
    balanceAtomic: string;
    reserveAtomic: string;
    tradableAtomic: string;
    targetAtomic: string;
    minTradeAtomic: string;
    maxTradeAtomic: string;
    amountAtomic: string | null;
    riskAdjustedAmountAtomic: string | null;
  } | null;
};

type SessionHealthIssue = {
  sessionId: string;
  username: string;
  status: string;
  ageMinutes: number;
  reason: string;
  stopReason: string | null;
  lastTradeSubmittedAt: string | null;
};

type SessionSizingSnapshot = {
  sessionId: string;
  username: string;
  status: string;
  at: string;
  decision: 'traded' | 'skipped';
  reason: string | null;
  balanceLamports: string;
  reserveLamports: string;
  tradableLamports: string;
  fractionBps: number;
  targetLamports: string;
  minTradeLamports: string;
  maxTradeLamports: string;
  amountLamports: string | null;
  remainingRiskBudgetUsd: number | null;
  quotedOutAmountAtomic: string | null;
  minimumOutputAtomic: string | null;
  priceImpactPct: string | null;
  estimatedNetworkCostLamports: string | null;
  estimatedNetworkCostOutputAtomic: string | null;
  worstCaseSlippageOutputAtomic: string | null;
  totalWorstCaseCostOutputAtomic: string | null;
  riskAdjustedAmountLamports: string | null;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  totalPnlUsd: number | null;
  tradeContext: SessionHealthRow['last_sizing_trade_context'];
};

const ACTIVE_STALE_MINUTES = 5;
const STOPPING_STALE_MINUTES = 3;
const AWAITING_FUNDING_WARN_MINUTES = 15;
const ISSUE_LIMIT = 8;
const SIZING_LIMIT = 10;

const parseTimestamp = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const minutesSince = (value: Date | string | null | undefined) => {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
};

const getMostRecentTimestamp = (...values: Array<Date | string | null | undefined>) => {
  const timestamps = values
    .map((value) => parseTimestamp(value))
    .filter((value): value is number => value !== null);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
};

const sortIssues = (issues: SessionHealthIssue[]) =>
  [...issues].sort((a, b) => b.ageMinutes - a.ageMinutes).slice(0, ISSUE_LIMIT);

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query<SessionHealthRow>(
      `SELECT
         s.id,
         s.user_id,
         COALESCE(u.username, s.user_id) AS username,
         s.status,
         s.requested_at,
         s.started_at,
         s.ended_at,
         s.stop_reason,
         s.service_control -> 'schedulingState' ->> 'lastTradeAttemptedAt' AS last_trade_attempted_at,
         s.service_control -> 'schedulingState' ->> 'lastTradeSubmittedAt' AS last_trade_submitted_at,
         s.service_control -> 'lastSizing' ->> 'at' AS last_sizing_at,
         s.service_control -> 'lastSizing' ->> 'decision' AS last_sizing_decision,
         s.service_control -> 'lastSizing' ->> 'reason' AS last_sizing_reason,
         s.service_control -> 'lastSizing' ->> 'balanceLamports' AS last_sizing_balance_lamports,
         s.service_control -> 'lastSizing' ->> 'reserveLamports' AS last_sizing_reserve_lamports,
         s.service_control -> 'lastSizing' ->> 'tradableLamports' AS last_sizing_tradable_lamports,
         (s.service_control -> 'lastSizing' ->> 'fractionBps')::integer AS last_sizing_fraction_bps,
         s.service_control -> 'lastSizing' ->> 'targetLamports' AS last_sizing_target_lamports,
         s.service_control -> 'lastSizing' ->> 'minTradeLamports' AS last_sizing_min_trade_lamports,
         s.service_control -> 'lastSizing' ->> 'maxTradeLamports' AS last_sizing_max_trade_lamports,
         s.service_control -> 'lastSizing' ->> 'amountLamports' AS last_sizing_amount_lamports,
         (s.service_control -> 'lastSizing' ->> 'remainingRiskBudgetUsd')::double precision AS last_sizing_remaining_risk_budget_usd,
         s.service_control -> 'lastSizing' ->> 'quotedOutAmountAtomic' AS last_sizing_quoted_out_amount_atomic,
         s.service_control -> 'lastSizing' ->> 'minimumOutputAtomic' AS last_sizing_minimum_output_atomic,
         s.service_control -> 'lastSizing' ->> 'priceImpactPct' AS last_sizing_price_impact_pct,
         s.service_control -> 'lastSizing' ->> 'estimatedNetworkCostLamports' AS last_sizing_estimated_network_cost_lamports,
         s.service_control -> 'lastSizing' ->> 'estimatedNetworkCostOutputAtomic' AS last_sizing_estimated_network_cost_output_atomic,
         s.service_control -> 'lastSizing' ->> 'worstCaseSlippageOutputAtomic' AS last_sizing_worst_case_slippage_output_atomic,
         s.service_control -> 'lastSizing' ->> 'totalWorstCaseCostOutputAtomic' AS last_sizing_total_worst_case_cost_output_atomic,
         s.service_control -> 'lastSizing' ->> 'riskAdjustedAmountLamports' AS last_sizing_risk_adjusted_amount_lamports,
         (s.funding ->> 'realizedPnlUsd')::double precision AS realized_pnl_usd,
         (s.funding ->> 'unrealizedPnlUsd')::double precision AS unrealized_pnl_usd,
         s.service_control -> 'lastSizing' -> 'tradeContext' AS last_sizing_trade_context
       FROM sessions s
       LEFT JOIN rz_users u ON u.id::text = s.user_id
       ORDER BY s.requested_at DESC
       LIMIT 500`,
    );

    const countsByStatus: Record<string, number> = {
      awaiting_funding: 0,
      ready: 0,
      starting: 0,
      active: 0,
      paused: 0,
      stopping: 0,
      stopped: 0,
      settling: 0,
      error: 0,
    };

    const staleActive: SessionHealthIssue[] = [];
    const staleStopping: SessionHealthIssue[] = [];
    const awaitingFunding: SessionHealthIssue[] = [];
    const errors: SessionHealthIssue[] = [];
    const recentSizing: SessionSizingSnapshot[] = [];
    const liveUserIds = new Set<string>();

    for (const row of result.rows) {
      countsByStatus[row.status] = (countsByStatus[row.status] ?? 0) + 1;

      if (row.status === 'active' || row.status === 'starting') {
        liveUserIds.add(row.user_id);
      }

      if (row.status === 'active') {
        const ageMinutes = minutesSince(getMostRecentTimestamp(
          row.last_trade_submitted_at,
          row.last_trade_attempted_at,
          row.last_sizing_at,
          row.started_at,
          row.requested_at,
        ));

        if (ageMinutes !== null && ageMinutes >= ACTIVE_STALE_MINUTES) {
          staleActive.push({
            sessionId: row.id,
            username: row.username,
            status: row.status,
            ageMinutes,
            reason: 'No worker activity recorded recently',
            stopReason: row.stop_reason,
            lastTradeSubmittedAt: row.last_trade_submitted_at,
          });
        }
      }

      if (row.status === 'stopping') {
        const ageMinutes = minutesSince(
          row.ended_at
          ?? row.last_trade_submitted_at
          ?? row.started_at
          ?? row.requested_at,
        );

        if (ageMinutes !== null && ageMinutes >= STOPPING_STALE_MINUTES) {
          staleStopping.push({
            sessionId: row.id,
            username: row.username,
            status: row.status,
            ageMinutes,
            reason: 'Stop/return flow has been pending too long',
            stopReason: row.stop_reason,
            lastTradeSubmittedAt: row.last_trade_submitted_at,
          });
        }
      }

      if (row.status === 'awaiting_funding') {
        const ageMinutes = minutesSince(row.requested_at);
        if (ageMinutes !== null && ageMinutes >= AWAITING_FUNDING_WARN_MINUTES) {
          awaitingFunding.push({
            sessionId: row.id,
            username: row.username,
            status: row.status,
            ageMinutes,
            reason: 'Session has been waiting on user funding for a while',
            stopReason: row.stop_reason,
            lastTradeSubmittedAt: row.last_trade_submitted_at,
          });
        }
      }

      if (row.status === 'error') {
        const ageMinutes = minutesSince(row.ended_at ?? row.started_at ?? row.requested_at) ?? 0;
        errors.push({
          sessionId: row.id,
          username: row.username,
          status: row.status,
          ageMinutes,
          reason: 'Session is in error state',
          stopReason: row.stop_reason,
          lastTradeSubmittedAt: row.last_trade_submitted_at,
        });
      }

      if (
        row.last_sizing_at
        && row.last_sizing_decision
        && row.last_sizing_balance_lamports
        && row.last_sizing_reserve_lamports
        && row.last_sizing_tradable_lamports
        && row.last_sizing_fraction_bps !== null
        && row.last_sizing_target_lamports
        && row.last_sizing_min_trade_lamports
        && row.last_sizing_max_trade_lamports
      ) {
        recentSizing.push({
          sessionId: row.id,
          username: row.username,
          status: row.status,
          at: row.last_sizing_at,
          decision: row.last_sizing_decision,
          reason: row.last_sizing_reason,
          balanceLamports: row.last_sizing_balance_lamports,
          reserveLamports: row.last_sizing_reserve_lamports,
          tradableLamports: row.last_sizing_tradable_lamports,
          fractionBps: row.last_sizing_fraction_bps,
          targetLamports: row.last_sizing_target_lamports,
          minTradeLamports: row.last_sizing_min_trade_lamports,
          maxTradeLamports: row.last_sizing_max_trade_lamports,
          amountLamports: row.last_sizing_amount_lamports,
          remainingRiskBudgetUsd: row.last_sizing_remaining_risk_budget_usd,
          quotedOutAmountAtomic: row.last_sizing_quoted_out_amount_atomic,
          minimumOutputAtomic: row.last_sizing_minimum_output_atomic,
          priceImpactPct: row.last_sizing_price_impact_pct,
          estimatedNetworkCostLamports: row.last_sizing_estimated_network_cost_lamports,
          estimatedNetworkCostOutputAtomic: row.last_sizing_estimated_network_cost_output_atomic,
          worstCaseSlippageOutputAtomic: row.last_sizing_worst_case_slippage_output_atomic,
          totalWorstCaseCostOutputAtomic: row.last_sizing_total_worst_case_cost_output_atomic,
          riskAdjustedAmountLamports: row.last_sizing_risk_adjusted_amount_lamports,
          realizedPnlUsd: row.realized_pnl_usd,
          unrealizedPnlUsd: row.unrealized_pnl_usd,
          totalPnlUsd: (row.realized_pnl_usd ?? 0) + (row.unrealized_pnl_usd ?? 0),
          tradeContext: row.last_sizing_trade_context,
        });
      }
    }

    const staleActiveIssues = sortIssues(staleActive);
    const staleStoppingIssues = sortIssues(staleStopping);
    const awaitingFundingIssues = sortIssues(awaitingFunding);
    const errorIssues = sortIssues(errors);
    const recentSizingSnapshots = [...recentSizing]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, SIZING_LIMIT);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      thresholds: {
        activeStaleMinutes: ACTIVE_STALE_MINUTES,
        stoppingStaleMinutes: STOPPING_STALE_MINUTES,
        awaitingFundingWarnMinutes: AWAITING_FUNDING_WARN_MINUTES,
      },
      summary: {
        totalSessions: result.rows.length,
        liveUsers: liveUserIds.size,
        activeSessions: countsByStatus.active,
        readyOrStartingSessions: (countsByStatus.ready ?? 0) + (countsByStatus.starting ?? 0),
        stoppingSessions: countsByStatus.stopping,
        attentionCount: staleActive.length + staleStopping.length + errors.length,
      },
      countsByStatus,
      issues: {
        staleActive: staleActiveIssues,
        stopping: staleStoppingIssues,
        errors: errorIssues,
        awaitingFunding: awaitingFundingIssues,
      },
      recentSizing: recentSizingSnapshots,
    });
  } catch {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      thresholds: {
        activeStaleMinutes: ACTIVE_STALE_MINUTES,
        stoppingStaleMinutes: STOPPING_STALE_MINUTES,
        awaitingFundingWarnMinutes: AWAITING_FUNDING_WARN_MINUTES,
      },
      summary: {
        totalSessions: 0,
        liveUsers: 0,
        activeSessions: 0,
        readyOrStartingSessions: 0,
        stoppingSessions: 0,
        attentionCount: 0,
      },
      countsByStatus: {
        awaiting_funding: 0,
        ready: 0,
        starting: 0,
        active: 0,
        paused: 0,
        stopping: 0,
        stopped: 0,
        settling: 0,
        error: 0,
      },
      issues: {
        staleActive: [],
        stopping: [],
        errors: [],
        awaitingFunding: [],
      },
      recentSizing: [],
    });
  }
}