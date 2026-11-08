const KEY = 'datacraft-interview-v1';
const blank = () => ({ version: 1, completed: [], bookmarks: [], confidence: {}, notes: {}, drafts: {}, lastLesson: 'story-intro', day: 1, pace: 'balanced', depth: 'plain', completedCode: [], decisions: {}, evidence: {}, mockHistory: [] });
const strings = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string'))].slice(0, 2000) : [];
const stringMap = value => Object.fromEntries(Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {}).filter(([k, v]) => typeof k === 'string' && typeof v === 'string').map(([k, v]) => [k, v.slice(0, 20000)]));
export function normalizeState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) throw new Error('Use a DataCraft version 1 progress file.');
  return { ...blank(), completed: strings(value.completed), bookmarks: strings(value.bookmarks), completedCode: strings(value.completedCode),
    notes: stringMap(value.notes), drafts: stringMap(value.drafts), confidence: stringMap(value.confidence),
    lastLesson: typeof value.lastLesson === 'string' ? value.lastLesson : 'story-intro',
    day: Math.max(1, Math.min(5, Number(value.day) || 1)), pace: ['balanced', 'crash', 'full'].includes(value.pace) ? value.pace : 'balanced',
    depth: value.depth === 'deep' ? 'deep' : 'plain', decisions: stringMap(value.decisions), evidence: stringMap(value.evidence),
    mockHistory: Array.isArray(value.mockHistory) ? value.mockHistory.filter(x => x && typeof x === 'object' && typeof x.date === 'string' && Number.isFinite(x.total) && Number.isFinite(x.confident)).slice(-20).map(x => ({ date: x.date, total: Math.min(200, Math.max(0, x.total)), confident: Math.min(200, Math.max(0, x.confident)) })) : [] };
}
export function loadState(storage) {
  try { storage ??= globalThis.localStorage; const raw = storage?.getItem(KEY); return raw ? normalizeState(JSON.parse(raw)) : blank(); }
  catch { return blank(); }
}
export function saveState(state, storage) {
  try { storage ??= globalThis.localStorage; storage?.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function clearState(storage) {
  try { storage ??= globalThis.localStorage; storage?.removeItem(KEY); } catch { /* The in-memory reset still works. */ }
  return blank();
}
