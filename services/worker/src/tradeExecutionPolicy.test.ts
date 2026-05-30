import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFullExitAmountAtomic,
  resolveTradeGateAssessment,
  shouldForceExitExecution,
  type TradeGateAssessment,
} from './tradeExecutionPolicy.js';

const blockedAssessment: TradeGateAssessment = {
  allowed: false,
  reason: 'edge_below_cost_model',
  expectedEdgeBps: 0,
  estimatedCostBps: 247,
  safetyBufferBps: 5,
};

test('shouldForceExitExecution only forces confirmed exit directions', () => {
  assert.equal(shouldForceExitExecution('exit_long_sol', 'stop_loss'), true);
  assert.equal(shouldForceExitExecution('exit_long_sol', 'take_profit'), true);
  assert.equal(shouldForceExitExecution('exit_long_sol', null), false);
  assert.equal(shouldForceExitExecution('enter_long_sol', 'stop_loss'), false);
});

test('resolveTradeGateAssessment allows exit trades even when edge model blocks entries', () => {
  const resolved = resolveTradeGateAssessment({
    direction: 'exit_long_sol',
    exitReason: 'stop_loss',
    assessment: blockedAssessment,
  });

  assert.equal(resolved.allowed, true);
  assert.equal(resolved.reason, 'exit_trigger_stop_loss');
  assert.equal(resolved.estimatedCostBps, 247);
});

test('resolveTradeGateAssessment leaves entry trades unchanged', () => {
  const resolved = resolveTradeGateAssessment({
    direction: 'enter_long_sol',
    exitReason: null,
    assessment: blockedAssessment,
  });

  assert.deepEqual(resolved, blockedAssessment);
});

test('computeFullExitAmountAtomic uses tracked position quantity for exits', () => {
  const amount = computeFullExitAmountAtomic({
    walletBalanceAtomic: 111_134_998,
    reserveAtomic: 1_727_879,
    positionQuantityAtomic: '19817760',
  });

  assert.equal(amount, 19_817_760);
});

test('computeFullExitAmountAtomic caps exit size at tradable balance', () => {
  const amount = computeFullExitAmountAtomic({
    walletBalanceAtomic: 20_000_000,
    reserveAtomic: 5_000_000,
    positionQuantityAtomic: '19817760',
  });

  assert.equal(amount, 15_000_000);
});