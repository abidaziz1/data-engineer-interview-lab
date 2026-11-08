// A deliberately small, deterministic teaching engine. No cloud calls or SQL execution.
export const rawTrades = [
  { trade_id: 'T100', account_id: 'A01', symbol: 'BND', quantity: '100', price: '10.00', version: 1, updated_at: '2026-01-07T09:00:00Z', ingested_at: '2026-01-07T09:01:00Z', ingest_seq: 1, batch_id: 'B001', status: 'ACTIVE' },
  { trade_id: 'T101', account_id: 'A02', symbol: 'EQT', quantity: '50', price: '20.00', version: 1, updated_at: '2026-01-07T09:00:00Z', ingested_at: '2026-01-07T09:01:00Z', ingest_seq: 2, batch_id: 'B001', status: 'ACTIVE' },
  { trade_id: 'T101', account_id: 'A02', symbol: 'EQT', quantity: '50', price: '20.00', version: 1, updated_at: '2026-01-07T09:00:00Z', ingested_at: '2026-01-07T09:01:01Z', ingest_seq: 3, batch_id: 'B001', status: 'ACTIVE' },
  { trade_id: 'T102', account_id: 'A01', symbol: 'FX', quantity: '25', price: '40.00', version: 1, updated_at: '2026-01-07T09:00:00Z', ingested_at: '2026-01-07T09:01:00Z', ingest_seq: 4, batch_id: 'B001', status: 'ACTIVE' },
  { trade_id: 'T103', account_id: 'A03', symbol: 'EQT', quantity: '-5', price: '50.00', version: 1, updated_at: '2026-01-07T09:00:00Z', ingested_at: '2026-01-07T09:01:00Z', ingest_seq: 5, batch_id: 'B001', status: 'ACTIVE' },
  { trade_id: 'T104', account_id: 'A04', symbol: 'BND', quantity: '10', price: null, version: 1, updated_at: '2026-01-07T09:00:00Z', ingested_at: '2026-01-07T09:01:00Z', ingest_seq: 6, batch_id: 'B001', status: 'ACTIVE' },
];
export const correctionBatch = [
  { ...rawTrades[1], quantity: '60', version: 2, updated_at: '2026-01-07T09:05:00Z', ingested_at: '2026-01-07T09:31:00Z', ingest_seq: 7, batch_id: 'B002' },
  { ...rawTrades[0], trade_id: 'T105', account_id: 'A03', symbol: 'EQT', quantity: '20', price: '25.00', version: 1, updated_at: '2026-01-07T09:30:00Z', ingested_at: '2026-01-07T09:31:00Z', ingest_seq: 8, batch_id: 'B002' },
];
export const riskWeights = { BND: 0.2, EQT: 1, FX: 0.5 };
export const repairBatch = [
  { ...rawTrades[4], quantity: '5', version: 2, ingest_seq: 9, batch_id: 'B003', updated_at: '2026-01-07T10:00:00Z', ingested_at: '2026-01-07T10:01:00Z' },
  { ...rawTrades[5], price: '10.00', version: 2, ingest_seq: 10, batch_id: 'B003', updated_at: '2026-01-07T10:00:00Z', ingested_at: '2026-01-07T10:01:00Z' },
];

const rank = row => [row.version, Date.parse(row.updated_at), Date.parse(row.ingested_at), row.ingest_seq];
const compare = (a, b) => {
  const x = rank(a), y = rank(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
export function deduplicate(rows) {
  const latest = new Map();
  for (const row of rows) {
    const old = latest.get(row.trade_id);
    if (!old || compare(row, old) > 0) latest.set(row.trade_id, { ...row });
  }
  return [...latest.values()].sort((a, b) => a.trade_id.localeCompare(b.trade_id));
}
export function validateTrade(row) {
  const reasons = [];
  const quantity = row.quantity == null || String(row.quantity).trim() === '' ? NaN : Number(row.quantity);
  const price = row.price == null || String(row.price).trim() === '' ? NaN : Number(row.price);
  if (!row.trade_id) reasons.push('missing trade ID');
  if (!Number.isFinite(quantity) || quantity <= 0) reasons.push('quantity must be positive');
  if (!Number.isFinite(price) || price <= 0) reasons.push('missing or invalid price');
  if (!(row.symbol in riskWeights)) reasons.push('unknown risk weight');
  return { ...row, quantity, price, valid: reasons.length === 0, reasons };
}
export function transform(rows) {
  const staged = deduplicate(rows).map(validateTrade);
  const accepted = staged.filter(row => row.valid);
  const rejected = staged.filter(row => !row.valid);
  const mart = accepted.filter(row => row.status === 'ACTIVE').map(row => ({
    ...row, notional: Math.round(row.quantity * row.price * 100) / 100,
    risk_weight: riskWeights[row.symbol],
    exposure: Math.round(row.quantity * row.price * riskWeights[row.symbol] * 100) / 100,
  }));
  return { raw: rows.map(row => ({ ...row })), staged, accepted, rejected, mart,
    notional: mart.reduce((sum, row) => sum + row.notional, 0),
    exposure: mart.reduce((sum, row) => sum + row.exposure, 0) };
}
export function mergeTrades(target, batch) {
  // The complete source history is represented here; version ordering prevents regression.
  return deduplicate([...target, ...batch]);
}
export function snapshot(scenario = 'initial') {
  if (scenario === 'repair') return transform([...rawTrades, ...correctionBatch, ...repairBatch]);
  if (scenario === 'correction') return transform([...rawTrades, ...correctionBatch]);
  if (scenario === 'replay') return transform([...rawTrades, ...rawTrades.map(r => ({ ...r, batch_id: 'REPLAY' }))]);
  if (scenario === 'cancel') return transform([...rawTrades, ...correctionBatch, {
    ...rawTrades[3], status: 'CANCELLED', version: 2, ingest_seq: 9,
    updated_at: '2026-01-07T09:40:00Z', ingested_at: '2026-01-07T09:41:00Z', batch_id: 'B003',
  }]);
  return transform(rawTrades);
}
export function reconciliation(result) {
  return [
    { name: 'Latest records accounted for', passed: result.staged.length === result.accepted.length + result.rejected.length, detail: `${result.staged.length} = ${result.accepted.length} accepted + ${result.rejected.length} quarantined` },
    { name: 'Unique fact grain', passed: new Set(result.mart.map(r => r.trade_id)).size === result.mart.length, detail: `${result.mart.length} active facts; one per trade ID` },
    { name: 'Positive trade values', passed: result.mart.every(r => r.quantity > 0 && r.price > 0), detail: 'Invalid trades cannot enter the mart' },
    { name: 'Risk weights present', passed: result.mart.every(r => Number.isFinite(r.risk_weight)), detail: 'Every accepted symbol has a reference weight' },
  ];
}
export function publicationGate(result, deliveryComplete = true) {
  // This particular teaching delivery is expected to be nonempty.
  return deliveryComplete && result.staged.length > 0 && result.rejected.length === 0 && reconciliation(result).every(check => check.passed);
}
export function pipelineFor(phase) {
  const nodes = ['Sources', 'Snowflake raw', 'dbt staging', 'dbt marts', 'Application'];
  const indices = { source: 0, python: 0, raw: 1, partition: 1, cache: 1, security: 1, staging: 2, valid: 2, quality: 2, sql: 2, incremental: 3, replay: 3, correction: 3, cancel: 3, scd: 3, mart: 3, api: 4, architecture: -1, airflow: -1, ci: -1, recovery: -1 };
  return nodes.map((name, i) => ({ name, active: indices[phase] === i, complete: indices[phase] > i }));
}
