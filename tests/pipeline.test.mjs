import test from 'node:test';
import assert from 'node:assert/strict';
import { rawTrades, correctionBatch, repairBatch, deduplicate, validateTrade, transform, mergeTrades, snapshot, reconciliation, publicationGate } from '../src/engine/pipeline.js';

test('initial batch preserves six deliveries, resolves five keys, and quarantines two', () => {
  const r = snapshot();
  assert.equal(r.raw.length, 6); assert.equal(r.staged.length, 5);
  assert.equal(r.mart.length, 3); assert.equal(r.rejected.length, 2);
  assert.equal(r.notional, 3000); assert.equal(r.exposure, 1700);
  assert.deepEqual(r.rejected.map(x => x.trade_id), ['T103', 'T104']);
});
test('duplicate replay changes raw delivery count without changing the business result', () => {
  const initial = snapshot(), replay = snapshot('replay');
  assert.equal(replay.raw.length, 12); assert.equal(replay.staged.length, 5);
  assert.equal(replay.notional, initial.notional); assert.equal(replay.exposure, initial.exposure);
  assert.deepEqual(replay.mart.map(x => [x.trade_id, x.version, x.quantity]), initial.mart.map(x => [x.trade_id, x.version, x.quantity]));
});
test('late correction updates one key and inserts one key', () => {
  const r = snapshot('correction');
  assert.equal(r.raw.length, 8); assert.equal(r.staged.length, 6); assert.equal(r.mart.length, 4);
  assert.equal(r.notional, 3700); assert.equal(r.exposure, 2400);
  assert.equal(r.mart.find(x => x.trade_id === 'T101').quantity, 60);
});
test('cancellation retains state and removes the active fact', () => {
  const r = snapshot('cancel');
  assert.equal(r.staged.find(x => x.trade_id === 'T102').status, 'CANCELLED');
  assert.equal(r.mart.some(x => x.trade_id === 'T102'), false);
  assert.equal(r.notional, 2700); assert.equal(r.exposure, 1900);
});
test('stale replay cannot overwrite a correction or resurrect a cancellation', () => {
  const corrected = mergeTrades(rawTrades, correctionBatch);
  const staleReplay = mergeTrades(corrected, rawTrades);
  assert.equal(staleReplay.find(x => x.trade_id === 'T101').version, 2);
  const cancelled = snapshot('cancel').staged;
  const afterReplay = transform(mergeTrades(cancelled, rawTrades));
  assert.equal(afterReplay.mart.some(x => x.trade_id === 'T102'), false);
});
test('version wins over arrival order and deduplication is deterministic under permutations', () => {
  const rows = [...rawTrades, ...correctionBatch];
  const expected = deduplicate(rows).map(x => [x.trade_id, x.version, x.ingest_seq]);
  for (let i = 0; i < rows.length; i++) {
    const permuted = [...rows.slice(i), ...rows.slice(0, i)].reverse();
    assert.deepEqual(deduplicate(permuted).map(x => [x.trade_id, x.version, x.ingest_seq]), expected);
  }
});
test('merging the same logical batch repeatedly is idempotent', () => {
  let target = [];
  for (let i = 0; i < 10; i++) target = mergeTrades(target, [...rawTrades, ...correctionBatch]);
  const result = transform(target);
  assert.equal(result.staged.length, 6); assert.equal(result.notional, 3700);
});
test('critical rejects block publication even when accepted-scope structural checks pass', () => {
  const result = snapshot();
  assert.ok(reconciliation(result).every(c => c.passed));
  assert.equal(publicationGate(result), false);
});
test('versioned repairs remove critical rejects and make the fixture gate eligible', () => {
  const result = snapshot('repair');
  assert.equal(result.raw.length, 10); assert.equal(result.mart.length, 6);
  assert.equal(result.rejected.length, 0); assert.equal(result.notional, 4050); assert.equal(result.exposure, 2670);
  assert.equal(publicationGate(result), true);
  assert.equal(publicationGate(result, false), false, 'incomplete delivery still blocks publication');
  assert.equal(publicationGate(transform([])), false, 'this teaching delivery is expected to be nonempty');
});
test('invalid numeric values remain invalid instead of becoming successful zeros', () => {
  for (const value of [null, '', ' ', 'not-a-number', 'Infinity', '-5', '0']) {
    assert.equal(validateTrade({ ...rawTrades[0], quantity: value }).valid, false);
    assert.equal(validateTrade({ ...rawTrades[0], price: value }).valid, false);
  }
  assert.equal(validateTrade({ ...rawTrades[0], symbol: 'UNKNOWN' }).valid, false);
});
test('teaching operations do not mutate the original fixtures', () => {
  const original = JSON.stringify({ rawTrades, correctionBatch, repairBatch });
  for (const scenario of ['initial', 'replay', 'correction', 'cancel', 'repair']) snapshot(scenario);
  assert.equal(JSON.stringify({ rawTrades, correctionBatch, repairBatch }), original);
});
