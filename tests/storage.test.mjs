import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, loadState, saveState, clearState } from '../src/engine/storage.js';
const fakeStorage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('new users start at day one with balanced plain-English defaults', () => {
  const state = loadState(fakeStorage());
  assert.equal(state.day, 1); assert.equal(state.pace, 'balanced'); assert.equal(state.depth, 'plain'); assert.deepEqual(state.completed, []);
});
test('progress, notes, bookmarks, drafts, and confidence survive round trip', () => {
  const storage = fakeStorage(), state = loadState(storage);
  state.completed = ['story-intro']; state.notes = { 'story-intro': 'My actual contribution.' };
  state.bookmarks = ['q-story-intro']; state.confidence = { 'q-story-intro': 'revisit' }; state.drafts = { 'latest-trade': 'select *' };
  assert.equal(saveState(state, storage), true); assert.deepEqual(loadState(storage), state);
});
test('backup normalization limits invalid types and deduplicates IDs', () => {
  const result = normalizeState({ version: 1, day: 500, pace: 'unknown', completed: ['a', 'a', 7], notes: { a: 'real note', b: {} }, mockHistory: [{ date: 'today', total: 12, confident: 4, unknown: 'discard' }] });
  assert.equal(result.day, 5); assert.equal(result.pace, 'balanced'); assert.deepEqual(result.completed, ['a']); assert.deepEqual(result.notes, { a: 'real note' });
  assert.deepEqual(result.mockHistory, [{ date: 'today', total: 12, confident: 4 }]);
});
test('malformed, missing-version, and future-version imports are rejected', () => {
  for (const value of [null, [], {}, { version: 2 }]) assert.throws(() => normalizeState(value));
});
test('corrupt or blocked browser storage has a safe in-memory fallback', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadState(blocked).completed, []); assert.equal(saveState(loadState(blocked), blocked), false);
  assert.deepEqual(loadState({ getItem: () => '{broken' }).completed, []);
});
test('reset clears persisted state', () => {
  const storage = fakeStorage(), state = loadState(storage); state.completed = ['story-intro']; saveState(state, storage);
  assert.deepEqual(clearState(storage).completed, []); assert.deepEqual(loadState(storage).completed, []);
});
