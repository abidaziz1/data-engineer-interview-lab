import test from 'node:test';
import assert from 'node:assert/strict';
import { walkthrough, stages, rehearsal } from '../src/content/walkthrough.js';
import { normalizeWalkthrough, loadWalkthrough, saveWalkthrough, WALKTHROUGH_KEY, accountTotals } from '../src/engine/walkthrough-state.js';
import { snapshot, publicationGate, rawTrades, correctionBatch, repairBatch } from '../src/engine/pipeline.js';
import { readFile } from 'node:fs/promises';

const ids = walkthrough.map(step => step.id);
test('the single route covers the whole project in a 2–3 hour practice budget', () => {
  assert.equal(walkthrough.length, 20);
  assert.equal(new Set(ids).size, 20);
  assert.equal(stages.length, 7);
  assert.equal(ids[0], 'project');
  assert.equal(ids.at(-1), 'rehearsal');
  const minutes = walkthrough.reduce((total, step) => total + step.minutes, 0);
  assert.ok(minutes >= 120 && minutes <= 180, `budget ${minutes}`);
  for (const step of walkthrough) {
    assert.ok(step.stage >= -1 && step.stage < stages.length, step.id);
    assert.equal(step.points.length, 3, step.id);
    assert.ok(step.intro && step.takeaway && step.question && step.answer, step.id);
    assert.ok(step.answer.length > 180, `${step.id} has a useful answer`);
    assert.ok(!/day [1-5]|five.day plan/i.test(JSON.stringify(step)), step.id);
  }
});
test('five rehearsal prompts link back to a real step instead of a second curriculum', () => {
  assert.equal(rehearsal.length, 5);
  for (const item of rehearsal) assert.ok(ids.includes(item.step));
});
test('guided progress is normalized and isolated from the previous study-plan state', () => {
  const normalized = normalizeWalkthrough({ version: 2, step: 'missing', completed: ['project', 'project', 'missing'], notes: '<script>test</script>', largeText: true }, ids);
  assert.equal(normalized.step, 'project');
  assert.deepEqual(normalized.completed, ['project']);
  assert.equal(normalized.notes, '<script>test</script>');
  assert.equal(normalized.largeText, true);
  const memory = new Map([['datacraft-interview-v1', '{"day":5}']]);
  const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  assert.ok(saveWalkthrough(normalized, storage));
  assert.deepEqual(loadWalkthrough(ids, storage), normalized);
  assert.ok(memory.has(WALKTHROUGH_KEY));
  assert.equal(memory.get('datacraft-interview-v1'), '{"day":5}');
});
test('invalid or blocked browser storage still starts the walkthrough', () => {
  assert.equal(loadWalkthrough(ids, { getItem: () => 'bad JSON' }).step, 'project');
  assert.equal(loadWalkthrough(ids, { getItem: () => { throw new Error('blocked'); } }).step, 'project');
  assert.equal(saveWalkthrough({}, { setItem: () => { throw new Error('blocked'); } }), false);
});
test('the account SQL illustration uses calculated facts and reconciles to the published fixture', () => {
  assert.deepEqual(accountTotals(snapshot('repair')), [
    { account_id: 'A01', notional: 2000 }, { account_id: 'A02', notional: 1200 },
    { account_id: 'A03', notional: 750 }, { account_id: 'A04', notional: 100 },
  ]);
  assert.equal(publicationGate(snapshot('correction')), false);
  assert.equal(publicationGate(snapshot('repair')), true);
});
test('the optional Snowflake worksheet uses the exact same source, correction, cancellation, and repair records', async () => {
  const sql = await readFile(new URL('../practice/snowflake-lab.sql', import.meta.url), 'utf8');
  const blocks = [...sql.matchAll(/INSERT INTO RAW\.TRADE_EVENTS VALUES\s*([\s\S]*?);/g)];
  const parsed = blocks.map(([, values]) => [...values.matchAll(/\(([^)]+)\)/g)].map(([, row]) =>
    [...row.matchAll(/'([^']*)'|\bNULL\b|-?\d+/g)].map(match => match[1] ?? (match[0] === 'NULL' ? null : Number(match[0])))));
  const expected = [rawTrades, correctionBatch, snapshot('cancel').raw.slice(-1), repairBatch].map(batch => batch.map(row => [
    row.trade_id, row.account_id, row.symbol, row.quantity, row.price, row.version,
    row.updated_at.replace('T', ' ').replace('Z', ''), row.ingested_at.replace('T', ' ').replace('Z', ''),
    row.ingest_seq, row.batch_id, row.status,
  ]));
  expected[2][0][9] = 'B003_CANCEL';
  assert.deepEqual(parsed, expected);
});
