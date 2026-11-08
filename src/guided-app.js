import { stages, walkthrough, rehearsal } from './content/walkthrough.js';
import { rawTrades, riskWeights, snapshot, publicationGate, reconciliation } from './engine/pipeline.js';
import { loadWalkthrough, saveWalkthrough, accountTotals } from './engine/walkthrough-state.js';
import { icon } from './icons.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const usd = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const button = (action, label, cls = 'button', attrs = '') => `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const ids = walkthrough.map(step => step.id);
const progress = loadWalkthrough(ids);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ui = { cancel: false, pruned: false, role: 'SUPPORT_READER', quantity: 50, repaired: false };
let flowTimer, workflowTimer, toastTimer, modalFocus;
let currentIndex = 0;
const stageSteps = ['dataset', 'snowflake-setup', 'staging', 'incremental', 'modeling', 'quality', 'publish'];

function routeStep() {
  const match = location.hash.match(/^#\/walkthrough\/([^/]+)$/);
  return match && ids.includes(match[1]) ? match[1] : progress.step;
}
function persist() { return saveWalkthrough(progress); }
function notify(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
}
function rowClass(row) {
  if (row.some(v => v == null || Number.isNaN(v) || v === -5 || v === '-5' || String(v).includes('quantity = -5'))) return 'attention-row';
  return row.includes('T101') ? 'tracked-row' : '';
}
function table(headers, rows, caption = '') {
  return `<div class="table-wrap" tabindex="0" aria-label="${esc(caption || 'Teaching dataset')}"><table>${caption ? `<caption>${esc(caption)}</caption>` : ''}<thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr class="${rowClass(row)}">${row.map(cell => `<td>${cell === null || Number.isNaN(cell) ? '<span class="null-value">NULL</span>' : esc(cell)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}">No rows yet</td></tr>`}</tbody></table></div>`;
}
const tradeRows = rows => rows.map(t => [t.trade_id, t.quantity, Number.isFinite(Number(t.price)) && t.price != null ? usd(Number(t.price)) : null, `v${t.version}`]);
const factRows = rows => rows.map(t => [t.trade_id, t.account_id, usd(t.notional)]);
function factTable(result) { return table(['Trade', 'Account', 'Notional'], factRows(result.mart), `${result.mart.length} accepted active facts`); }
function stat(label, value, detail = '') { return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</div>`; }
function flow({ input, inputBody, output, outputBody, operation, caption, metrics = '', record = 'T101' }) {
  return `<section class="flow-workspace flow-ready" aria-label="Input, transformation, and calculated output">
    <div class="flow-status"><span class="status-indicator"></span><strong id="flow-status">Result calculated in your browser</strong>${button('replay-flow', `${icon('reset')}Replay flow`, 'text-button')}</div>
    <div class="data-transfer"><div class="data-panel input-panel"><div class="panel-title"><span class="panel-number">IN</span><h3>${esc(input)}</h3></div>${inputBody}</div>
    <div class="transfer-operation"><span>${esc(operation)}</span><div class="transfer-track">${icon('arrow')}<i class="moving-record">${esc(record)}</i></div></div>
    <div class="data-panel output-panel"><div class="panel-title"><span class="panel-number">OUT</span><h3>${esc(output)}</h3></div><div class="result-body">${outputBody}</div><div class="waiting-result">${icon('activity')}Watch the transformation</div></div></div>
    <p class="flow-caption">${icon('lightbulb')}${esc(caption)}</p>${metrics ? `<div class="metric-strip">${metrics}</div>` : ''}
  </section>`;
}
function projectMap(step) {
  const isAll = step.stage < 0;
  return `<section class="project-map ${step.id === 'project' ? '' : 'compact-map'}" aria-label="Full project data flow"><div class="map-heading"><span>${icon('map')}THE FULL PROJECT</span><span>${isAll ? 'Follow the arrows. Select any stage to inspect it.' : `YOU ARE HERE · ${esc(stages[step.stage].name)}`}</span></div>
    <div class="map-nodes ${isAll ? 'map-overview' : ''}">${stages.map((stage, index) => `<div class="map-cell"><button type="button" class="map-node ${step.stage === index ? 'is-current' : ''}" data-action="goto:${stageSteps[index]}" ${step.stage === index ? 'aria-current="step"' : ''}><span class="node-icon">${icon(stage.icon)}<small>${index + 1}</small></span><strong>${esc(stage.name)}</strong><span>${esc(stage.sub)}</span></button>${index < stages.length - 1 ? `<span class="map-edge ${step.stage === index || isAll ? 'edge-active' : ''}" aria-hidden="true">${icon('arrow')}<i style="--delay:${index * 180}ms"></i></span>` : ''}</div>`).join('')}</div>
    <div class="map-support"><span>${icon('workflow')}Airflow coordinates the sequence</span><span>${icon('git')}Git + CI review the changes</span><span>${icon('shield')}Tests + monitoring protect the release</span></div></section>`;
}
function overviewVisual() {
  const result = snapshot();
  return `<div class="case-file"><div class="case-label">CASE FILE 001 <span>Financial-risk teaching project</span></div><h2>Can the application trust the trade total?</h2><p>Follow trade <strong class="tracked-label">T101</strong> through the system. Every orange row in the walkthrough is this same trade.</p><div class="case-route"><div>${icon('file')}<strong>Delivered twice</strong><span>2 copies of T101</span></div><b aria-hidden="true">→</b><div>${icon('layers')}<strong>Counted once</strong><span>1 current version</span></div><b aria-hidden="true">→</b><div>${icon('table')}<strong>Worth $1,000</strong><span>50 units × $20</span></div></div><div class="case-question"><span>${icon('shield')}</span><p>Other trades still contain errors. We can calculate a candidate total, but we must check the full delivery before releasing it.</p></div><div class="metric-strip">${stat('Raw deliveries', result.raw.length)}${stat('Current trade keys', result.staged.length)}${stat('Initial candidate', usd(result.notional))}</div></div>`;
}
function datasetVisual() {
  return `<div class="dataset-view"><div class="visual-heading"><span class="chip">B001 · source delivery</span><span>All six rows. Nothing hidden.</span></div>${table(['Trade', 'Qty', 'Price', 'What to notice'], rawTrades.map((t, i) => [t.trade_id, t.quantity, t.price == null ? null : usd(Number(t.price)), i === 2 ? 'T101 delivered again' : i === 4 ? 'Negative quantity' : i === 5 ? 'Missing price' : 'Active trade']), 'trade_events.csv · source values before cleaning')}<div class="dataset-legend"><span><i class="orange-dot"></i>T101 is our tracked record</span><span><i class="red-dot"></i>T103 + T104 need investigation</span></div><div class="contract-strip"><strong>The contract</strong><p>Current key: <code>trade_id</code> · currency: USD · latest version wins · invalid values stay visible</p></div></div>`;
}
function warehouseVisual() {
  return `<div class="warehouse-view"><div class="compute-card">${icon('snowflake')}<div><span>COMPUTE</span><h3>LAB_WH</h3><p>Runs SQL · X-Small · auto-suspend</p></div><strong>Executes ↓</strong></div><div class="database-card"><div class="database-title">${icon('database')}<strong>INTERVIEW_LAB</strong><span>Database · stored objects</span></div><div class="schema-list">${[['RAW', 'Original event history', '6 deliveries'], ['STAGING', 'Typed current source', '5 trade keys'], ['MARTS', 'Facts + consumer views', '3 initial active facts']].map(([name, label, value]) => `<div><span class="schema-icon">${icon('table')}</span><div><h3>${name}</h3><p>${label}</p></div><strong>${value}</strong></div>`).join('')}</div></div><p class="visual-note">These are logical layers. The staging and mart objects are built after loading, not by creating the empty schemas.</p></div>`;
}
function dbtVisual() {
  return `<div class="instruction-flow"><div class="instruction-step">${icon('git')}<div><span>01 · PROJECT IN GIT</span><h3>SQL models + Jinja + YAML</h3><p>Definitions, dependencies, and tests.</p></div></div><div class="wide-arrow">${icon('down')} dbt parses and compiles</div><div class="instruction-step">${icon('code')}<div><span>02 · COMPILED SQL</span><h3>CREATE VIEW / CREATE TABLE / MERGE</h3><p>Core CLI or Cloud jobs submit the work.</p></div></div><div class="wide-arrow">${icon('down')} Snowflake executes</div><div class="instruction-step executed">${icon('snowflake')}<div><span>03 · DATA IN SNOWFLAKE</span><h3>stg_trades → int_current_trades → fct_trades</h3><p>dbt organizes the work; Snowflake computes the result.</p></div></div></div>`;
}
function sourcesVisual() {
  return `<div class="sources-view"><div class="source-links"><div>${icon('database')}<span>External table</span><strong>RAW.TRADE_EVENTS</strong><code>source('trading', 'trade_events')</code></div><div>${icon('file')}<span>Small CSV seed</span><strong>risk_weights.csv</strong><code>ref('risk_weights')</code></div></div>${table(['Symbol', 'Risk weight', 'Meaning in this example'], Object.entries(riskWeights).map(([symbol, weight]) => [symbol, weight, { BND: 'Bond', EQT: 'Equity', FX: 'Foreign exchange' }[symbol]]), 'Reference data joined by symbol')}<div class="dependency-ribbon">${icon('workflow')}source → stg_trades → int_current_trades → fct_trades<br><span>risk_weights joins fct_trades by symbol</span></div></div>`;
}
function stagingVisual() {
  const result = snapshot();
  return flow({ input: 'RAW.TRADE_EVENTS · 6 deliveries', inputBody: table(['Trade', 'Qty', 'Price', 'Version'], tradeRows(result.raw)), output: 'stg_trades · 5 current keys', outputBody: table(['Trade', 'Qty', 'Price', 'Version'], tradeRows(result.staged)), operation: 'TYPE + ROW_NUMBER', caption: 'Two T101 deliveries become one current T101. The negative quantity and missing price remain visible for business checks.', metrics: stat('Raw evidence preserved', '6 rows') + stat('Current records', '5 keys') + stat('Rows needing repair', '2') });
}
function macroVisual() {
  return `<div class="formula-view"><span class="chip">Follow T101 · EQT</span><h2>A calculation you can inspect.</h2><div class="formula-inputs"><label>Quantity<input id="quantity-input" type="number" min="1" max="1000000" step="1" value="${ui.quantity}"></label><span>×</span><div><span>Price</span><strong>$20</strong></div><span>×</span><div><span>Risk weight</span><strong>1.0</strong></div></div><div class="formula-result"><span>Weighted exposure</span><output id="calculation-result" for="quantity-input">${usd(ui.quantity * 20)}</output></div><div class="compiled-line"><span>COMPILED SQL</span><code>(quantity * price) * risk_weight</code></div><p class="visual-note">Change the quantity to test the formula. This scratch calculation leaves the main teaching dataset unchanged.</p></div>`;
}
function modelingVisual() {
  const result = snapshot();
  return `<div class="model-view"><div class="dimension-row"><div class="dimension-box"><span>DIMENSION · one row per account</span><h3>dim_accounts</h3><p>account_id · desk · account attributes</p></div><div class="dimension-box"><span>REFERENCE · one row per symbol</span><h3>risk_weights</h3><p>BND 0.2 · EQT 1.0 · FX 0.5</p></div></div><div class="join-arrows"><span>1 : many ↓ account_id</span><span>1 : many ↓ symbol</span></div><div class="fact-box"><div class="visual-heading"><h3>fct_trades</h3><span class="chip">One row per active valid trade</span></div>${table(['Trade', 'Account', 'Notional', 'Exposure'], result.mart.map(t => [t.trade_id, t.account_id, usd(t.notional), usd(t.exposure)]))}</div><div class="rejected-summary">${icon('alert')}T103 + T104 are quarantined, not forgotten. Their two rejects will block full publication.</div><div class="metric-strip">${stat('Accepted scope', usd(result.notional))}${stat('Weighted exposure', usd(result.exposure))}</div></div>`;
}
function incrementalVisual() {
  const result = snapshot();
  return flow({ input: 'stg_trades · authoritative current rows', inputBody: table(['Trade', 'Qty', 'Price', 'Version'], tradeRows(result.staged)), output: 'int_current_trades · persisted table', outputBody: table(['Trade', 'Qty', 'Price', 'Version'], tradeRows(result.staged)), operation: 'BUILD / MERGE ON trade_id', caption: 'First build creates five current rows. Later builds match the same key to update a row instead of blindly appending it.', metrics: stat('Merge key', 'trade_id') + stat('Unique current keys', '5') });
}
function replayVisual() {
  const result = snapshot('replay');
  return flow({ input: 'B001 + retry · 12 raw deliveries', inputBody: table(['Trade', 'Qty', 'Price', 'Version'], tradeRows(result.raw)), output: 'Current business result · unchanged', outputBody: factTable(result), operation: 'RESOLVE + MERGE AGAIN', caption: 'Raw deliveries: 6 → 12. Current keys: 5 → 5. Accepted notional: $3,000 → $3,000. This is idempotent business state.', metrics: stat('Current keys', result.staged.length) + stat('Accepted notional', usd(result.notional)) + stat('Weighted exposure', usd(result.exposure)) });
}
function correctionVisual() {
  const result = snapshot(ui.cancel ? 'cancel' : 'correction');
  const incoming = ui.cancel ? [['T102', 'ACTIVE v1', 'CANCELLED v2']] : [['T101', '50 units · v1', '60 units · v2'], ['T105', 'Not present', '20 × $25 · v1']];
  return `<div class="scenario-switch" role="group" aria-label="Choose a versioned change">${button('scenario:correction', 'B002 · correction + new trade', ui.cancel ? 'choice' : 'choice selected', `aria-pressed="${!ui.cancel}"`)}${button('scenario:cancel', 'Then cancel T102', ui.cancel ? 'choice selected' : 'choice', `aria-pressed="${ui.cancel}"`)}</div>${flow({ input: ui.cancel ? 'New cancellation after B002' : 'New B002 events', inputBody: table(['Trade', 'Previous state', 'Incoming state'], incoming), output: 'Accepted active facts', outputBody: factTable(result), operation: ui.cancel ? 'KEEP TOMBSTONE · EXCLUDE ACTIVE FACT' : 'LATEST VERSION WINS', record: ui.cancel ? 'T102' : 'T101', caption: ui.cancel ? 'T102 remains in the six-key current model as CANCELLED. It leaves active facts, so notional falls from $3,700 to $2,700. An older ACTIVE event cannot resurrect it.' : 'T101 updates in place and T105 is inserted. $3,000 + $200 correction + $500 new trade = $3,700.', metrics: stat('Current keys', result.staged.length) + stat('Active facts', result.mart.length) + stat('Accepted notional', usd(result.notional)) })}`;
}
function qualityVisual() {
  const result = snapshot('correction');
  return `<div class="quality-view"><div class="quality-reconcile"><strong>6 current keys</strong><span>=</span><strong>4 accepted</strong><span>+</span><strong class="error-text">2 rejected</strong></div>${table(['Trade', 'Rejected value', 'Reason'], [['T103', 'quantity = -5', 'Must be positive in this long-only lab'], ['T104', 'price = NULL', 'Missing price']], 'int_trade_rejects · after B002')}<div class="check-list">${reconciliation(result).map(check => `<div class="check-passed">${icon('circleCheck')}<span>${esc(check.name)}</span><strong>PASS</strong></div>`).join('')}<div class="check-failed">${icon('alert')}<span>No unresolved critical rejects</span><strong>FAIL · 2</strong></div></div><div class="release-gate blocked">${icon('shield')}<div><strong>Publication blocked</strong><p>$3,700 is a candidate for accepted scope, not an approved full release.</p></div></div>${button('try-publish', 'Try to publish this delivery', 'button secondary')}<p id="publish-feedback" class="inline-feedback" role="status"></p></div>`;
}
function publishVisual() {
  const result = snapshot('repair');
  return flow({ input: 'B003 · source corrections', inputBody: table(['Trade', 'Before', 'Versioned fix'], [['T103', 'quantity = -5', 'quantity = 5 · v2'], ['T104', 'price = NULL', 'price = $10 · v2']]), output: 'Approved teaching release', outputBody: `<div class="release-gate ${publicationGate(result) ? 'approved' : 'blocked'}">${icon('circleCheck')}<div><strong>Gate passed · 0 critical rejects</strong><p>All six current trades are valid and active.</p></div></div><div class="api-output"><span>Application reads published_risk</span><pre>${esc(JSON.stringify({ release: 'B003', currency: 'USD', active_trades: result.mart.length, notional: result.notional, weighted_exposure: result.exposure, status: 'approved' }, null, 2))}</pre></div>`, operation: 'REBUILD → CHECK → RELEASE', record: 'B003', caption: 'The repair follows B002, without the optional cancellation. Versioned fixes add $250 + $100 to the $3,700 accepted scope.', metrics: stat('Accepted notional', usd(result.notional)) + stat('Weighted exposure', usd(result.exposure)) + stat('Critical rejects', result.rejected.length) });
}
function sqlVisual() {
  const result = snapshot('repair');
  return flow({ input: 'fct_trades · 6 trade rows', inputBody: factTable(result), output: 'Account totals · 4 account rows', outputBody: table(['Account', 'Notional', 'Rank'], accountTotals(result).map((r, i) => [r.account_id, usd(r.notional), i + 1])), operation: 'GROUP BY → DENSE_RANK', caption: 'The grain changes from one active trade to one account. Account totals still reconcile to the same $4,050.', metrics: stat('Before', '6 trade rows') + stat('After', '4 account rows') + stat('Reconciled total', usd(result.notional)) });
}
function performanceVisual() {
  return `<div class="performance-view"><div class="visual-heading"><span class="chip">Query profile · teaching illustration</span><strong>${ui.pruned ? '2' : '8'} / 8 blocks scanned</strong></div><div class="partition-grid">${Array.from({ length: 8 }, (_, i) => `<div class="partition ${!ui.pruned || i > 5 ? 'scanned' : 'pruned'}"><span>P${i + 1}</span>${icon('database')}<strong>${i < 6 ? `Jan ${String(i + 1).padStart(2, '0')}` : 'Jan 07'}</strong><small>${!ui.pruned || i > 5 ? 'Scanned' : 'Skipped'}</small></div>`).join('')}</div>${button('toggle-pruning', ui.pruned ? 'Remove the date predicate' : 'Apply the Jan 07 date predicate', 'button secondary', `aria-pressed="${ui.pruned}"`)}<p class="visual-note">${ui.pruned ? 'Metadata says only P7 and P8 may contain Jan 07. Other blocks can be pruned in this illustration.' : 'Without a selective date predicate, all eight hypothetical blocks are candidates for scanning.'} This is a concept diagram, not a benchmark of the six-row fixture.</p><div class="performance-choices"><div><strong>Too much scanned?</strong><span>Inspect predicates + pruning.</span></div><div><strong>Queued behind other work?</strong><span>Inspect concurrency + workload isolation.</span></div></div></div>`;
}
function securityVisual() {
  const permitted = ui.role === 'RISK_ANALYST';
  return `<div class="security-view"><div class="role-picker" role="group" aria-label="Query as a role">${button('role:SUPPORT_READER', `${icon('eye')}Support reader`, `choice ${!permitted ? 'selected' : ''}`, `aria-pressed="${!permitted}"`)}${button('role:RISK_ANALYST', `${icon('shield')}Risk analyst`, `choice ${permitted ? 'selected' : ''}`, `aria-pressed="${permitted}"`)}</div><div class="role-context"><span>CURRENT_ROLE()</span><strong>${ui.role}</strong></div>${table(['Account', 'Desk', 'owner_email'], [['A01', 'Rates', permitted ? 'owner-a01@example.test' : '***@***'], ['A02', 'Equities', permitted ? 'owner-a02@example.test' : '***@***']], 'Same synthetic dimension · policy changes returned values')}<div class="role-result">${icon(permitted ? 'eye' : 'shield')}<p>${permitted ? 'This exact role is allowed to see the synthetic email values by the example policy.' : 'The role can read the permitted object, but private contact values are masked.'}</p></div><p class="visual-note">Role switching here is simulated. No Snowflake grants or policies are changed.</p></div>`;
}
function orchestrationVisual() {
  const names = ['Load raw', 'Build models', 'Validate', 'Publish', 'App reads'];
  return `<div class="orchestration-view"><div class="visual-heading"><span class="chip">Airflow-style task sequence</span><span>Browser simulation</span></div><ol class="task-sequence">${names.map((name, i) => `<li data-task="${i}"><span class="task-marker">${i + 1}</span><div><strong>${name}</strong><span class="task-status">Waiting for dependency</span></div>${i < names.length - 1 ? icon('down') : ''}</li>`).join('')}</ol><div class="workflow-message" id="workflow-message" role="status">Preparing B002’s candidate delivery…</div>${button('repair-workflow', `${icon('reset')}Retry after versioned source repair`, 'button secondary')}<div class="python-distinction"><span>Python ingestion → source integration</span><span>dbt Python model → warehouse transformation</span><span>Airflow operator → task execution</span></div></div>`;
}
function deliveryVisual() {
  return `<div class="delivery-view"><div class="delivery-request"><span>JIRA ACCEPTANCE CRITERION</span><p>“A correction updates the current trade once. A repeated batch must not increase total notional.”</p></div><ol class="delivery-sequence">${[['Branch', 'Change the model + add a replay test.'], ['Pull request', 'Review business definition and data impact.'], ['Isolated CI target', 'Build dependencies. Test keys, rejects, and measures.'], ['Approved release', 'Deploy, validate, publish, then monitor.']].map(([label, text], i) => `<li><span>${i + 1}</span><div><h3>${label}</h3><p>${text}</p></div></li>`).join('')}</ol><div class="contract-strip"><strong>Recovery has two parts</strong><p>Code rollback restores definitions. Data recovery restores or rebuilds the affected records. Verify both.</p></div></div>`;
}
function storyVisual() {
  return `<div class="story-view"><span class="chip">Your 90-second project story</span><ol class="story-prompts"><li><strong>Purpose</strong> Who needed the data, and for what?</li><li><strong>Flow</strong> Where did data enter, change, and leave?</li><li><strong>Ownership</strong> What did you personally build or operate?</li><li><strong>Failure</strong> What went wrong, and how did you investigate?</li><li><strong>Evidence</strong> How did you verify the result?</li></ol><label class="notes-label" for="story-notes">Draft your own explanation</label><textarea id="story-notes" rows="7" maxlength="20000" placeholder="Use your real project details. Keep confidential source names and employer data out of the notes.">${esc(progress.notes)}</textarea><div class="note-actions"><span>Saved only in this browser</span>${button('export-notes', `${icon('download')}Export my notes`, 'text-button')}</div></div>`;
}
function rehearsalVisual() {
  return `<div class="rehearsal-view"><div class="rehearsal-intro">${icon('mic')}<p>Speak for 60–90 seconds per prompt. Open the guide after answering, then check whether you explained the mechanism and a failure case.</p></div>${rehearsal.map((item, i) => `<details class="rehearsal-question"><summary><span>${String(i + 1).padStart(2, '0')}</span>${esc(item.question)}${icon('down')}</summary><div><p>${esc(item.answer)}</p>${button(`goto:${item.step}`, 'Revisit this part of the project', 'text-button')}</div></details>`).join('')}<div class="finish-note"><strong>You have seen the full project.</strong><p>Rehearse the path without the guides. If one step is unclear, jump directly to it using the project map.</p></div></div>`;
}
const visualizers = { overview: overviewVisual, dataset: datasetVisual, warehouse: warehouseVisual, dbt: dbtVisual, sources: sourcesVisual, staging: stagingVisual, macro: macroVisual, modeling: modelingVisual, merge: incrementalVisual, replay: replayVisual, correction: correctionVisual, quality: qualityVisual, publish: publishVisual, sql: sqlVisual, performance: performanceVisual, security: securityVisual, orchestration: orchestrationVisual, delivery: deliveryVisual, story: storyVisual, rehearsal: rehearsalVisual };

function highlightCode(source) {
  const tokens = /(--[^\n]*|#[^\n]*|'[^'\n]*'|"[^"\n]*"|\b(?:select|from|where|join|on|as|and|or|not|null|is|with|case|when|then|else|end|group|by|order|over|partition|qualify|row_number|dense_rank|sum|create|if|exists|warehouse|database|schema|use|alter|table|view|def|return|import|true|false)\b|\b\d+(?:\.\d+)?\b)/gi;
  return source.split('\n').map(line => {
    let html = '', offset = 0;
    for (const match of line.matchAll(tokens)) {
      html += esc(line.slice(offset, match.index));
      const kind = /^(--|#)/.test(match[0]) ? 'comment' : /^['"]/.test(match[0]) ? 'string' : /^\d/.test(match[0]) ? 'number' : 'keyword';
      html += `<span class="syntax-${kind}">${esc(match[0])}</span>`; offset = match.index + match[0].length;
    }
    return `<span class="code-line">${html + esc(line.slice(offset)) || ' '}</span>`;
  }).join('');
}
function codeCard(code, extra = false) {
  return `<section class="code-card ${extra ? 'extra-code' : ''}" aria-label="${esc(code.file)}"><header><div>${icon('code')}<strong>${esc(code.file)}</strong></div><span>${esc(code.language)}</span>${button(extra ? 'copy-extra' : 'copy-code', 'Copy', 'code-copy')}</header><pre tabindex="0"><code>${highlightCode(code.text)}</code></pre><p>${esc(code.note)}</p>${code.download ? '<a class="worksheet-download" href="./practice/snowflake-lab.sql" download>Download the full optional Snowflake worksheet ↓</a>' : ''}</section>`;
}
function render() {
  clearTimeout(flowTimer); clearInterval(workflowTimer);
  currentIndex = Math.max(0, ids.indexOf(routeStep()));
  const step = walkthrough[currentIndex]; progress.step = step.id; persist();
  document.documentElement.classList.toggle('large-text', progress.largeText);
  document.title = `${currentIndex + 1}. ${step.title} · DataCraft`;
  $('#app').innerHTML = `<header class="topbar"><a class="brand" href="#/walkthrough/project" aria-label="DataCraft first step"><span class="brand-mark">${icon('workflow')}</span><strong>datacraft<span>THE PIPELINE WALKTHROUGH</span></strong></a><div class="session-label">One project <span>·</span> About 2–3 hours <span>·</span> Go at your pace</div><div class="header-actions">${button('text-size', 'Aa', 'text-size-button', `aria-label="${progress.largeText ? 'Use standard large text' : 'Use extra large text'}" aria-pressed="${progress.largeText}"`)}${button('open-map', `${icon('map')}<span>Project map</span>`, 'button secondary compact', 'aria-label="Project map"')}</div></header>
    <div class="session-progress" role="progressbar" aria-label="Steps explored" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${progress.completed.length}">${walkthrough.map(item => `<span class="${progress.completed.includes(item.id) ? 'explored' : ''} ${item.id === step.id ? 'current' : ''}"></span>`).join('')}</div>
    <main id="main" class="walkthrough"><section class="scene-heading"><div><p class="eyebrow">STEP ${String(currentIndex + 1).padStart(2, '0')} / 20 <span>·</span> ${esc(step.topic)}</p><h1 id="scene-title" tabindex="-1">${esc(step.title)}</h1><p class="scene-intro">${esc(step.intro)}</p></div><div class="scene-index" aria-hidden="true">${String(currentIndex + 1).padStart(2, '0')}<span>/20</span></div></section>
      ${projectMap(step)}
      <div class="scene-layout"><section class="visual-workspace" aria-label="Visual project explanation">${visualizers[step.visual]()}</section><aside class="teaching-panel"><div class="teaching-title">${icon('compass')}MAKE SENSE OF THE STEP</div><div class="teaching-points">${step.points.map(([label, text], i) => `<div><span class="point-index">${i + 1}</span><div><h2>${esc(label)}</h2><p>${esc(text)}</p></div></div>`).join('')}</div><details class="interview-question"><summary>${icon('mic')}<span>Interviewer asks<strong>${esc(step.question)}</strong></span>${icon('down')}</summary><div><p>${esc(step.answer)}</p><span class="rehearse-tip">Now hide the guide and explain it in your own words.</span></div></details></aside></div>
      ${step.code ? codeCard(step.code) : ''}${step.extraCode ? `<details class="optional-code"><summary>See the small dbt Python model, too ${icon('down')}</summary>${codeCard(step.extraCode, true)}</details>` : ''}
      <div class="remember-strip">${icon('lightbulb')}<p><strong>Keep this in mind</strong>${esc(step.takeaway)}</p></div>${step.caution ? `<p class="context-note">${icon('book')}${esc(step.caution)}</p>` : ''}
      <div class="page-source"><span>Synthetic data · calculated in this browser · no cloud connection needed</span>${step.reference ? `<a href="${esc(step.reference[1])}" target="_blank" rel="noopener noreferrer">${esc(step.reference[0])}${icon('external')}</a>` : ''}</div>
    </main><footer class="step-navigation"><div>${button('previous', `${icon('back')}Back`, 'button secondary', currentIndex === 0 ? 'disabled' : '')}<span class="navigation-position">${currentIndex + 1} of 20</span></div><div class="next-preview"><span>${currentIndex === walkthrough.length - 1 ? 'THE WHOLE PROJECT, IN VIEW' : 'UP NEXT'}</span><strong>${esc(walkthrough[currentIndex + 1]?.topic || 'Rehearse without the guides')}</strong></div>${button('next', `${currentIndex === walkthrough.length - 1 ? 'Finish walkthrough' : 'Next'}${icon('arrow')}`, 'button primary')}</footer>`;
  beginFlow();
  if (innerWidth <= 600 && step.id !== 'project') {
    const map = $('.map-nodes');
    map.scrollLeft = Math.max(0, (step.stage < 0 ? 0 : step.stage) * 150 - 30);
  }
  if (step.visual === 'orchestration') runWorkflow();
}
function beginFlow() {
  const workspace = $('.flow-workspace'); if (!workspace) return;
  clearTimeout(flowTimer);
  workspace.classList.toggle('flow-ready', reducedMotion);
  workspace.classList.toggle('flow-inflight', !reducedMotion);
  $('#flow-status').textContent = reducedMotion ? 'Result calculated in your browser' : 'Following the data…';
  if (!reducedMotion) flowTimer = setTimeout(() => {
    workspace.classList.replace('flow-inflight', 'flow-ready');
    $('#flow-status').textContent = 'Result calculated in your browser';
  }, 2200);
}
function runWorkflow() {
  clearInterval(workflowTimer);
  const result = snapshot(ui.repaired ? 'repair' : 'correction');
  let task = -1;
  const advance = () => {
    task++;
    document.querySelectorAll('[data-task]').forEach((el, i) => {
      el.classList.toggle('task-complete', i < task);
      el.classList.toggle('task-running', i === task);
      el.classList.remove('task-failed');
      el.querySelector('.task-status').textContent = i < task ? 'Completed' : i === task ? 'Running in this simulation' : 'Waiting for dependency';
    });
    if (task === 2 && !publicationGate(result)) {
      const failed = $('[data-task="2"]'); failed.classList.replace('task-running', 'task-failed'); failed.querySelector('.task-status').textContent = 'Blocked: 2 unresolved critical rejects';
      $('#workflow-message').textContent = 'Validation failed. Publish and application-read tasks remain blocked.';
      clearInterval(workflowTimer);
    } else if (task >= 5) {
      $('#workflow-message').textContent = 'Repair validated: 6 active trades, $4,050 notional. The approved teaching release is available.';
      clearInterval(workflowTimer);
    } else $('#workflow-message').textContent = `${['Loading the source delivery', 'Building current state and facts', 'Checking the complete delivery', 'Publishing the approved version', 'Reading the governed release'][task]}…`;
  };
  advance(); workflowTimer = setInterval(advance, reducedMotion ? 100 : 650);
}
function navigate(id, mark = false) {
  if (!ids.includes(id)) return;
  if (mark && !progress.completed.includes(progress.step)) progress.completed.push(progress.step);
  progress.step = id; persist(); closeMap(false);
  ui.cancel = false; ui.pruned = false; ui.repaired = false; ui.role = 'SUPPORT_READER';
  if (location.hash === `#/walkthrough/${id}`) render(); else location.hash = `/walkthrough/${id}`;
}
function openMap(finished = false) {
  modalFocus = document.activeElement;
  $('#modal-root').innerHTML = `<dialog class="map-dialog" aria-labelledby="map-dialog-title"><div class="dialog-heading"><div><p class="eyebrow">${finished ? 'WALKTHROUGH COMPLETE' : 'ONE ROUTE THROUGH THE PROJECT'}</p><h2 id="map-dialog-title">${finished ? 'Now practise explaining it.' : 'The whole project, at a glance.'}</h2></div>${button('close-map', icon('close'), 'close-button', 'aria-label="Close project map"')}</div><p class="dialog-intro">${finished ? 'You can revisit any step. Start with the question you found hardest to answer without the guide.' : 'Press Next to follow the route, or jump directly to a step. Every step is available.'}</p><div class="step-index">${walkthrough.map((step, i) => `<button type="button" data-action="goto:${step.id}" class="${step.id === progress.step ? 'current' : ''}" ${step.id === progress.step ? 'aria-current="step"' : ''}><span>${progress.completed.includes(step.id) ? icon('check') : String(i + 1).padStart(2, '0')}</span><div><strong>${esc(step.topic)}</strong><small>${esc(step.title)}</small></div>${icon('chevron')}</button>`).join('')}</div><p class="dialog-footnote">Progress measures exploration. Interview readiness comes from explaining the design and handling follow-up questions.</p></dialog>`;
  $('.dialog-intro').insertAdjacentHTML('afterend', projectMap(walkthrough[0]));
  $('.map-dialog').showModal(); $('.map-dialog').addEventListener('close', () => { $('#modal-root').innerHTML = ''; if (modalFocus?.isConnected) modalFocus.focus(); }, { once: true });
}
function closeMap(restore = true) {
  const dialog = $('.map-dialog'); if (dialog?.open) dialog.close();
  $('#modal-root').innerHTML = '';
  if (restore && modalFocus?.isConnected) modalFocus.focus();
}
async function copyCode(extra = false) {
  const code = walkthrough[currentIndex][extra ? 'extraCode' : 'code']; if (!code) return;
  try { await navigator.clipboard.writeText(code.text); notify('Code copied.'); }
  catch {
    const text = document.createElement('textarea'); text.value = code.text; text.style.position = 'fixed'; text.style.opacity = '0'; document.body.append(text); text.select();
    const copied = document.execCommand('copy'); text.remove(); notify(copied ? 'Code copied.' : 'Select the code and copy it with your keyboard.');
  }
}
function rerenderControl(action) { render(); document.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true }); }
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const [action, value] = target.dataset.action.split(':');
  if (action === 'next') {
    if (currentIndex < walkthrough.length - 1) navigate(ids[currentIndex + 1], true);
    else { if (!progress.completed.includes(progress.step)) progress.completed.push(progress.step); persist(); render(); openMap(true); }
  } else if (action === 'previous') navigate(ids[currentIndex - 1]);
  else if (action === 'goto') navigate(value);
  else if (action === 'open-map') openMap();
  else if (action === 'close-map') closeMap();
  else if (action === 'text-size') { progress.largeText = !progress.largeText; persist(); document.documentElement.classList.toggle('large-text', progress.largeText); target.setAttribute('aria-pressed', String(progress.largeText)); target.setAttribute('aria-label', progress.largeText ? 'Use standard large text' : 'Use extra large text'); }
  else if (action === 'replay-flow') beginFlow();
  else if (action === 'scenario') { ui.cancel = value === 'cancel'; rerenderControl(target.dataset.action); }
  else if (action === 'toggle-pruning') { ui.pruned = !ui.pruned; rerenderControl(target.dataset.action); }
  else if (action === 'role') { ui.role = value; rerenderControl(target.dataset.action); }
  else if (action === 'try-publish') $('#publish-feedback').textContent = publicationGate(snapshot('correction')) ? 'Gate passed.' : 'Release denied: T103 and T104 remain unresolved. Keep the previous approved release, notify the source owner, and apply versioned fixes.';
  else if (action === 'repair-workflow') { ui.repaired = true; runWorkflow(); }
  else if (action === 'copy-code') copyCode();
  else if (action === 'copy-extra') copyCode(true);
  else if (action === 'export-notes') {
    const url = URL.createObjectURL(new Blob([progress.notes || 'My project story\n\nPurpose:\nFlow:\nOwnership:\nFailure:\nEvidence:\n'], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'my-interview-project-story.txt'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'story-notes') { progress.notes = event.target.value; if (!persist()) notify('Browser storage is unavailable. Export your notes to keep them.'); }
  if (event.target.id === 'quantity-input') {
    const quantity = Number(event.target.value);
    const valid = Number.isFinite(quantity) && quantity >= 1 && quantity <= 1000000 && Number.isInteger(quantity);
    event.target.setCustomValidity(valid ? '' : 'Enter a whole quantity between 1 and 1,000,000.');
    if (valid) ui.quantity = quantity;
    $('#calculation-result').textContent = valid ? usd(quantity * 20) : 'Enter a positive whole quantity';
  }
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || $('.map-dialog') || ['INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY', 'BUTTON'].includes(document.activeElement?.tagName)) return;
  if (event.key === 'ArrowRight' && currentIndex < walkthrough.length - 1) { event.preventDefault(); navigate(ids[currentIndex + 1], true); }
  if (event.key === 'ArrowLeft' && currentIndex > 0) { event.preventDefault(); navigate(ids[currentIndex - 1]); }
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#main') return;
  render(); $('#scene-title').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('beforeunload', persist);
render();
