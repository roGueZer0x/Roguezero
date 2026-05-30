export type TradeDirection = 'exit_long_sol' | 'enter_long_sol';
export type ExitReason = 'take_profit' | 'stop_loss' | 'trailing_stop' | 'signal_reversal' | null;

export type TradeGateAssessment = {
  allowed: boolean;
  reason: string;
  expectedEdgeBps: number;
  estimatedCostBps: number;
  safetyBufferBps: number;
};

export const shouldForceExitExecution = (
  direction: TradeDirection,
  exitReason: ExitReason,
) => direction === 'exit_long_sol' && exitReason !== null;

export const resolveTradeGateAssessment = (params: {
  direction: TradeDirection;
  exitReason: ExitReason;
  assessment: TradeGateAssessment;
}): TradeGateAssessment => {
  if (!shouldForceExitExecution(params.direction, params.exitReason)) {
    return params.assessment;
  }

  return {
    ...params.assessment,
    allowed: true,
    reason: `exit_trigger_${params.exitReason}`,
  };
};

export const computeFullExitAmountAtomic = (params: {
  walletBalanceAtomic: number;
  reserveAtomic: number;
  positionQuantityAtomic: string | null;
}) => {
  const tradableAtomic = Math.max(0, Math.floor(params.walletBalanceAtomic - params.reserveAtomic));
  if (!params.positionQuantityAtomic || !/^\d+$/.test(params.positionQuantityAtomic)) {
    return tradableAtomic;
  }

  const positionQuantityAtomic = Number(params.positionQuantityAtomic);
  if (!Number.isFinite(positionQuantityAtomic) || positionQuantityAtomic <= 0) {
    return tradableAtomic;
  }

  return Math.max(0, Math.min(tradableAtomic, Math.floor(positionQuantityAtomic)));
};