import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBucketState, getExponentialBackoffDelayMs } from './index.js';

test('computeBucketState grants token when capacity is available', () => {
  const state = computeBucketState({
    availableTokens: 5,
    elapsedMs: 0,
    maxTokens: 10,
    refillRatePerSec: 5,
  });

  assert.equal(state.granted, true);
  assert.equal(state.availableTokens, 4);
  assert.equal(state.waitMs, 0);
});

test('computeBucketState refills tokens over elapsed time', () => {
  const state = computeBucketState({
    availableTokens: 0,
    elapsedMs: 500,
    maxTokens: 10,
    refillRatePerSec: 4,
  });

  assert.equal(state.granted, true);
  assert.equal(state.availableTokens, 1);
  assert.equal(state.waitMs, 0);
});

test('computeBucketState returns wait time when bucket is empty', () => {
  const state = computeBucketState({
    availableTokens: 0.25,
    elapsedMs: 0,
    maxTokens: 10,
    refillRatePerSec: 2,
  });

  assert.equal(state.granted, false);
  assert.equal(state.availableTokens, 0.25);
  assert.equal(state.waitMs, 375);
});

test('getExponentialBackoffDelayMs applies bounded jitter', () => {
  const delay = getExponentialBackoffDelayMs(3, {
    initialDelayMs: 1000,
    maxDelayMs: 30_000,
    jitterRatio: 0.25,
    random: () => 1,
  });

  assert.equal(delay, 5000);
});
