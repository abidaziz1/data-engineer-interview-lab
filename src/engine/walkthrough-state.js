export const WALKTHROUGH_KEY = 'datacraft-walkthrough-v2';
const emptyWalkthrough = () => ({ version: 2, step: 'project', completed: [], notes: '', largeText: false });
export function normalizeWalkthrough(value, ids) {
  const valid = new Set(ids);
  if (!value || value.version !== 2) return emptyWalkthrough();
  return { version: 2, step: valid.has(value.step) ? value.step : ids[0],
    completed: [...new Set(Array.isArray(value.completed) ? value.completed.filter(id => valid.has(id)) : [])],
    notes: typeof value.notes === 'string' ? value.notes.slice(0, 20000) : '', largeText: value.largeText === true };
}
export function loadWalkthrough(ids, storage) {
  try { storage ??= globalThis.localStorage; return normalizeWalkthrough(JSON.parse(storage?.getItem(WALKTHROUGH_KEY) || 'null'), ids); }
  catch { return emptyWalkthrough(); }
}
export function saveWalkthrough(value, storage) {
  try { storage ??= globalThis.localStorage; storage?.setItem(WALKTHROUGH_KEY, JSON.stringify(value)); return !!storage; }
  catch { return false; }
}
export function accountTotals(result) {
  const grouped = new Map();
  for (const row of result.mart) grouped.set(row.account_id, (grouped.get(row.account_id) || 0) + row.notional);
  return [...grouped].map(([account_id, notional]) => ({ account_id, notional }))
    .sort((a, b) => b.notional - a.notional || a.account_id.localeCompare(b.account_id));
}
