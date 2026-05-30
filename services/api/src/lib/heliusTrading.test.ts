import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  buildPriorityFeeEstimateRequest,
  composePreparedSwapInstructions,
  getHeliusTradingConfig,
  parsePriorityFeeEstimateResponse,
} from './heliusTrading.js';

const payer = new PublicKey('So11111111111111111111111111111111111111112');
const feeAccount = new PublicKey('AYE7gjGL2GrPHmQXieipTfT66CPvzWYu2onkGPWByJmo');
const recipient = new PublicKey('8B3zcBMcjpAJeR7ksEeJMiiNrW6dEf1oL3YK2GnQwGGK');

const coreSwapInstructions: TransactionInstruction[] = [
  SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: feeAccount,
    lamports: 1,
  }),
  SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: recipient,
    lamports: 2,
  }),
];

test('composePreparedSwapInstructions preserves core fee-collection instructions when Sender is enabled', () => {
  const instructions = composePreparedSwapInstructions({
    senderEnabled: true,
    payer,
    computeUnitLimit: 123_456,
    priorityFeeMicroLamports: 77_000,
    senderTipLamports: 200_000,
    baseComputeBudgetInstructions: [],
    coreSwapInstructions,
    random: () => 0,
  });

  assert.equal(instructions.length, 5);
  assert.equal(instructions[2].keys.some((key) => key.pubkey.equals(feeAccount)), true);
});

test('composePreparedSwapInstructions keeps Jupiter compute budget instructions on standard RPC path', () => {
  const computeBudgetInstruction = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: recipient,
    lamports: 3,
  });

  const instructions = composePreparedSwapInstructions({
    senderEnabled: false,
    payer,
    computeUnitLimit: 123_456,
    baseComputeBudgetInstructions: [computeBudgetInstruction],
    coreSwapInstructions,
  });

  assert.equal(instructions.length, 4);
  assert.equal(instructions[1], computeBudgetInstruction);
});

test('priority fee config defaults to trading-safe settings', () => {
  const config = getHeliusTradingConfig({});
  assert.equal(config.senderEnabled, true);
  assert.equal(config.gatekeeperEnabled, true);
  assert.equal(config.priorityFeeLevel, 'Medium');
  assert.equal(config.senderMinTipLamports, 200_000);
});

test('buildPriorityFeeEstimateRequest uses recommended pricing', () => {
  const payload = buildPriorityFeeEstimateRequest({
    payer,
    blockhash: '11111111111111111111111111111111',
    instructions: coreSwapInstructions,
    priorityLevel: 'High',
  });

  assert.equal(payload.method, 'getPriorityFeeEstimate');
  assert.equal(payload.params[0].options.priorityLevel, 'High');
  assert.equal(payload.params[0].options.recommended, true);
});

test('parsePriorityFeeEstimateResponse applies multiplier and fallback', () => {
  assert.equal(
    parsePriorityFeeEstimateResponse({ result: { priorityFeeEstimate: 40_000 } }, 50_000, 1.2),
    48_000,
  );
  assert.equal(parsePriorityFeeEstimateResponse({}, 50_000, 1.2), 60_000);
});
