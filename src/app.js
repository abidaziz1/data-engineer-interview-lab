import { modules, lessons, days, getLesson, getModule, sources } from './content/curriculum.js';
import { questions, mockSets } from './content/questions.js';
import { challenges } from './content/coding.js';
import { decisions } from './content/decisions.js';
import { snapshot, pipelineFor, reconciliation, publicationGate } from './engine/pipeline.js';
import { loadState, saveState, normalizeState, clearState } from './engine/storage.js';
import { icon } from './icons.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const percent = (done, total) => total ? Math.round(done / total * 100) : 0;
const link = (route, label, cls = '', extra = '') => `<a href="#/${route}" class="${cls}" ${extra}>${label}</a>`;
const button = (action, label, cls = 'btn', extra = '') => `<button type="button" data-action="${action}" class="${cls}" ${extra}>${label}</button>`;
const tag = (label, tone = '') => `<span class="tag ${tone}">${label}</span>`;
let state = loadState();
const ui = { tab: 'watch', journey: 'all', menu: false, questionSearch: '', questionTopic: 'all', questionType: 'all', questionLevel: 'all', questionScope: 'all', openQuestion: null, codeId: challenges[0].id, codeStep: -1, codeSolution: false, codeHint: 0, codeTopic: 'all', simulation: null, playing: false, animationStep: -1, decision: 0, modalFocus: null };
let mock = null, timer = null, animationTimer = null, workflowTimer = null;
ui.workflowStep = -1;
ui.workflowStatus = 'idle';
const knownLessonIds = new Set(lessons.map(l => l.id));
const knownQuestionIds = new Set(questions.map(q => q.id));
state.completed = state.completed.filter(id => knownLessonIds.has(id));
state.bookmarks = state.bookmarks.filter(id => knownQuestionIds.has(id) || knownLessonIds.has(id));
const persist = () => { if (!saveState(state)) toast('Progress is kept in this tab. Export a backup if browser storage is unavailable.'); };
const doneCount = () => state.completed.length;
const moduleProgress = module => module.lessons.filter(l => state.completed.includes(l.id)).length;
function currentRoute() {
  const [view = 'home', id] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  return { view: ['home', 'lab', 'questions', 'code', 'architecture', 'resume', 'plan', 'mock'].includes(view) ? view : 'home', id: id ? decodeURIComponent(id) : undefined };
}
function nextUnfinished() { return lessons.find(l => !state.completed.includes(l.id)) || lessons[0]; }
function resumeLesson() { return getLesson(state.lastLesson); }
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toast.timeout); toast.timeout = setTimeout(() => el.classList.remove('visible'), 3800);
}
function highlighted(code, focus = []) {
  const pattern = /(--[^\n]*|#[^\n]*|\/\/[^\n]*|'[^'\n]*'|"[^"\n]*"|\b(?:select|from|where|join|left|full|outer|inner|on|as|and|or|not|null|is|with|case|when|then|else|end|group|by|order|over|partition|qualify|row_number|dense_rank|rank|sum|count|distinct|having|limit|create|table|view|merge|into|using|matched|update|set|insert|values|def|return|if|for|in|while|true|false|none|import|try|except|raise|class|yield|from|grant|usage|role|warehouse|database|schema|alter|copy|call|coalesce|dateadd|cast|number|rows|between|unbounded|preceding|current|row)\b|\b\d+(?:\.\d+)?\b|\{[%{][\s\S]*?[}%]\})/gi;
  return `<div class="code-lines">${String(code).split('\n').map((line, i) => {
    let output = '', last = 0;
    for (const match of line.matchAll(pattern)) {
      output += escape(line.slice(last, match.index));
      const token = match[0], type = /^(--|#|\/\/)/.test(token) ? 'comment' : /^['"]/.test(token) ? 'string' : /^\d/.test(token) ? 'number' : /^\{/.test(token) ? 'jinja' : 'keyword';
      output += `<span class="syntax-${type}">${escape(token)}</span>`; last = match.index + token.length;
    }
    output += escape(line.slice(last));
    return `<div class="code-line ${focus.includes(i + 1) ? 'highlight' : ''}"><span class="line-no" aria-hidden="true">${i + 1}</span><code>${output || ' '}</code></div>`;
  }).join('')}</div>`;
}
function codeBlock(code, language = 'sql', file = '', focus = []) {
  return `<div class="code-block"><div class="code-toolbar"><span>${icon('file')}${escape(file || 'Worked solution')}</span>${tag(escape(language))}${button('copy-code', `${icon('file')}<span>Copy</span>`, 'icon-text', 'aria-label="Copy code"')}</div><div class="code-scroll" tabindex="0" aria-label="${escape(language)} code example">${highlighted(code, focus)}</div></div>`;
}
function dataTable(columns, rows, options = {}) {
  return `<div class="table-scroll ${options.dark ? 'dark-table' : ''}" tabindex="0" aria-label="${escape(options.label || 'Teaching data table')}"><table><thead><tr>${columns.map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td class="${i === 0 ? 'key-cell' : ''}">${cell == null || cell === 'NULL' ? '<span class="null">NULL</span>' : escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function miniPipeline(active = 2) {
  const nodes = [{ icon: 'code', title: 'Source', sub: 'Python · APIs' }, { icon: 'snowflake', title: 'Warehouse', sub: 'Snowflake' }, { icon: 'layers', title: 'Transform', sub: 'dbt Core' }, { icon: 'shield', title: 'Trust', sub: 'Tests · publish' }];
  return `<div class="mini-pipeline">${nodes.map((n, i) => `<div class="mini-node ${i === active ? 'active' : ''}"><span class="mini-node-icon">${icon(n.icon)}</span><strong>${n.title}</strong><small>${n.sub}</small></div>${i < nodes.length - 1 ? '<span class="mini-connector"><i></i></span>' : ''}`).join('')}</div>`;
}
function sidebar(view) {
  const nav = [ ['home', 'grid', 'Overview'], ['lab', 'play', 'Learning lab', `${lessons.length}`], ['questions', 'mic', 'Interview room', `${questions.length}`], ['code', 'code', 'Code studio', `${challenges.length}`], ['architecture', 'workflow', 'Architecture'], ['resume', 'book', 'Your project stories'], ['plan', 'calendar', 'Study plan'] ];
  return `<aside class="sidebar ${ui.menu ? 'open' : ''}" aria-label="Main navigation"><a class="brand" href="#/home"><span class="brand-mark"><i></i><i></i><i></i><i></i></span><span>datacraft<span class="brand-label">THE INTERVIEW LAB</span></span></a><div class="workspace-label">YOUR WORKSPACE</div><nav>${nav.map(([id, symbol, title, count]) => link(id === 'lab' ? `lab/${state.lastLesson}` : id, `${icon(symbol)}<span>${title}</span>${count ? `<small>${count}</small>` : ''}`, `nav-item ${view === id || view === 'mock' && id === 'questions' ? 'active' : ''}`)).join('')}</nav><div class="sidebar-divider"></div><div class="workspace-label path-heading">THE LEARNING PATH <span>10</span></div><nav class="path-nav">${modules.map((m, i) => {
    const complete = moduleProgress(m), active = view === 'lab' && getLesson(currentRoute().id || state.lastLesson).moduleId === m.id;
    return link(`lab/${m.lessons[0].id}`, `<span class="path-number ${complete === m.lessons.length ? 'done' : ''}">${complete === m.lessons.length ? icon('check') : String(i + 1).padStart(2, '0')}</span><span>${m.short}</span>${complete > 0 ? `<span class="path-dot ${complete === m.lessons.length ? 'complete' : ''}"></span>` : ''}`, `path-item ${active ? 'active' : ''}`);
  }).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-progress"><div><span>Your journey</span><strong>${percent(doneCount(), lessons.length)}%</strong></div><div class="progress-track"><span style="width:${percent(doneCount(), lessons.length)}%"></span></div><small>${doneCount()} of ${lessons.length} scenes explored</small></div>${link('plan', `${icon('spark')}<span>A little progress, every day.</span>${icon('chevron')}`, 'sidebar-tip')}<div class="sidebar-footer"><span class="status-dot"></span>Local progress · No account needed</div></div></aside>`;
}
function shell(view, content) {
  const names = { home: 'Overview', lab: 'Learning lab', questions: 'Interview room', code: 'Code studio', architecture: 'Architecture', resume: 'Your project stories', plan: 'Study plan', mock: 'Mock interview' };
  return `${sidebar(view)}${ui.menu ? '<button class="sidebar-scrim" data-action="menu" aria-label="Close navigation"></button>' : ''}<div class="app-body"><header class="topbar">${button('menu', icon('menu'), 'icon-btn menu-toggle', 'aria-label="Open navigation" aria-expanded="'+ui.menu+'"')}<div class="topbar-breadcrumb"><span>Workspace</span>${icon('chevron')}<strong>${names[view]}</strong></div>${button('search', `${icon('search')}<span>Find a topic or question</span><kbd>/</kbd>`, 'search-trigger', 'aria-label="Search lessons, questions, and code"')}<div class="topbar-right"><span class="saved-status"><span class="status-dot"></span>Saved on this device</span>${button('settings', icon('filter'), 'icon-btn', 'aria-label="Progress and preferences"')}<span class="avatar" title="Personalized for Mohammad Alam">MA</span></div></header><main id="main" tabindex="-1">${content}</main><footer class="app-footer"><span>Built around your resume. Practiced with synthetic data.</span><span>Learn the reasoning. Make the story your own.</span></footer></div>`;
}
function moduleCard(module, index) {
  const completed = moduleProgress(module), isDone = completed === module.lessons.length;
  const next = module.lessons.find(l => !state.completed.includes(l.id)) || module.lessons[0];
  return `<a class="module-card ${isDone ? 'is-done' : ''}" href="#/lab/${next.id}"><div class="module-card-top"><span class="module-icon ${module.color}">${icon(module.icon)}</span><span class="eyebrow">CHAPTER ${String(index + 1).padStart(2, '0')}</span><span class="module-duration">${icon('clock')}${module.minutes} min</span></div><h3>${module.title}</h3><p>${module.description}</p><div class="module-card-bottom"><span>${isDone ? `${icon('circleCheck')} Explored` : completed ? `${completed} / ${module.lessons.length} scenes explored` : `${module.lessons.length} guided scenes`}</span><span class="module-go">${icon('arrow')}</span></div>${completed ? `<div class="card-progress" style="width:${percent(completed, module.lessons.length)}%"></div>` : ''}</a>`;
}
function savedScenes() {
  const saved = lessons.filter(lesson => state.bookmarks.includes(lesson.id));
  if (!saved.length) return '';
  return `<section class="saved-scenes"><div class="eyebrow">SAVED SCENES · YOUR NEXT REVIEW</div><div>${saved.map(lesson => link(`lab/${lesson.id}`, `${icon('bookmark')}${lesson.title}`, 'chapter-pill')).join('')}</div></section>`;
}
function home() {
  const last = resumeLesson(), started = doneCount() > 0, day = days[state.day - 1];
  const visibleModules = ui.journey === 'today' ? modules.filter(m => day.modules.includes(m.id)) : modules;
  return `<div class="page overview-page"><div class="page-eyebrow"><span class="status-dot"></span>YOUR PERSONAL INTERVIEW WORKSPACE<span class="quiet">Made for Mohammad Alam</span></div><section class="hero-card"><div class="hero-copy"><div class="hero-kicker">LESS MEMORIZING. MORE UNDERSTANDING.</div><h1>A production pipeline.<br><em>A confident interview.</em></h1><p>Follow the data. Make the decisions. Build a story you can explain—from the first raw trade to a trusted application.</p><div class="hero-actions">${link(`lab/${started ? last.id : lessons[0].id}`, `${icon('play')}${started ? 'Continue your journey' : 'Start the first mission'}${icon('arrow')}`, 'btn btn-primary')}${button('roadmap', 'Explore the roadmap', 'text-btn')}</div><div class="hero-footnote"><span class="stack-dots"><i></i><i></i><i></i></span>dbt Core · Snowflake · SQL · Python · Airflow</div></div><div class="hero-visual" aria-label="A simplified data pipeline from source through Snowflake and dbt to validated data"><div class="visual-window"><div class="window-top"><div class="window-dots"><i></i><i></i><i></i></div><span>risk_platform / your next chapter</span>${icon('workflow')}</div><div class="visual-label"><span class="pulse-dot"></span>ONE STORY. THE WHOLE STACK.</div>${miniPipeline(2)}<div class="hero-record"><span class="record-icon">${icon('table')}</span><div><strong>From raw trades to trusted risk</strong><span>Duplicates → corrections → quality → delivery</span></div>${icon('circleCheck')}</div><div class="visual-orchestration"><span></span><p>${icon('workflow')} Orchestrated by Airflow</p><span></span></div></div><div class="floating-tag">${icon('spark')}Learn by watching it happen</div></div></section><section class="overview-stats" aria-label="What is included"><div><span class="stat-icon">${icon('layers')}</span><strong>${lessons.length}</strong><span>guided scenes</span></div><div><span class="stat-icon">${icon('mic')}</span><strong>${questions.length}</strong><span>interview questions</span></div><div><span class="stat-icon">${icon('code')}</span><strong>${challenges.length}</strong><span>coding walkthroughs</span></div><div><span class="stat-icon">${icon('calendar')}</span><strong>5</strong><span>days. One clear plan.</span></div></section>${savedScenes()}<div class="overview-content"><section class="journey-section" id="roadmap"><div class="section-heading"><div><div class="eyebrow">THE FULL JOURNEY</div><h2>One pipeline. Ten chapters.</h2><p>Start simple, then go deeper. Every chapter is open.</p></div></div><div class="segmented roadmap-tabs" role="group" aria-label="Filter learning roadmap">${[['all', 'Full journey'], ['today', 'Today’s focus'], ['crash', 'Crash route']].map(([id, label]) => button(`journey:${id}`, label, ui.journey === id ? 'selected' : '', `aria-pressed="${ui.journey === id}"`)).join('')}</div>${ui.journey === 'crash' ? '<div class="inline-note">'+icon('lightbulb')+'The crash route shows essential scenes only in the player. The full questions and code remain available.</div>' : ''}<div class="module-grid">${visibleModules.map(m => moduleCard(m, modules.indexOf(m))).join('')}</div></section><aside class="overview-aside"><section class="briefing-card"><div class="briefing-top">${tag(`DAY ${state.day} OF 5`, 'mint')}${icon('calendar')}</div><h3>${day.title}</h3><p>${day.focus}</p><div class="briefing-meta">${icon('clock')}About ${day.minutes} minutes, with practice</div>${link(`lab/${getModule(day.modules[0]).lessons[0].id}`, `Open today’s chapter${icon('arrow')}`, 'btn btn-dark')}${link('plan', 'View your five-day plan', 'subtle-link')}</section><section class="note-card"><span class="note-icon">${icon('lightbulb')}</span><h3>Understanding has layers.</h3><p>Start with the plain-English explanation. Inspect the code. Then reveal the deeper tradeoff when you’re ready.</p><div class="three-levels"><span>Understand</span><i></i><span>Explain</span><i></i><span>Defend</span></div></section><section class="quick-practice"><div class="eyebrow">CHANGE THE PACE</div>${link('questions', `${icon('mic')}<span><strong>Answer one good question</strong><small>Reveal, rehearse, revisit.</small></span>${icon('chevron')}`, 'quick-link')}${link('code', `${icon('code')}<span><strong>Read the code like an engineer</strong><small>One decision at a time.</small></span>${icon('chevron')}`, 'quick-link')}${link('architecture', `${icon('workflow')}<span><strong>Draw the bigger picture</strong><small>Make the tradeoffs visible.</small></span>${icon('chevron')}`, 'quick-link')}</section></aside></div></div>`;
}

function scenarioFor(lesson) {
  if (ui.simulation) return ui.simulation;
  if (lesson.id === 'quality-publish' || ['incident-partial', 'snowflake-recovery', 'airflow-retry'].includes(lesson.id)) return 'repair';
  return ['replay', 'correction', 'cancel'].includes(lesson.phase) ? lesson.phase : 'initial';
}
function flowDiagram(lesson) {
  return `<div class="pipeline-diagram">${pipelineFor(lesson.phase).map((node, i) => `<button class="pipeline-node ${node.active ? 'active' : node.complete ? 'complete' : ''}" data-action="inspect-node:${i}" aria-label="Inspect ${node.name}"><span>${icon(['code', 'snowflake', 'layers', 'table', 'eye'][i])}</span><strong>${node.name}</strong><small>${['Python · files · APIs', 'Immutable evidence', 'Clean · type · dedupe', 'Facts · dimensions', 'API · analytics'][i]}</small></button>${i < 4 ? '<div class="pipeline-edge"><i></i>'+icon('chevron')+'</div>' : ''}`).join('')}</div>`;
}
function orchestrationVisual(lesson, result) {
  const isCi = lesson.phase === 'ci';
  const names = isCi ? ['Review', 'Compile', 'Build', 'Validate', 'Promote'] : ['Extract', 'Load raw', 'dbt build', 'Reconcile', 'Publish'];
  const messages = isCi ? ['Reviewed revision selected in an isolated target.', 'Project compiled; execution checks still required.', 'Teaching models built from the selected input.', publicationGate(result) ? 'Fixture controls pass; critical rejects = 0.' : `Publication blocked: ${result.rejected.length} critical rejects.`, 'Validated teaching release promoted.'] : ['Expected teaching batch identified.', `${result.raw.length} raw deliveries preserved.`, `${result.mart.length} accepted active facts; ${money(result.notional)} notional.`, publicationGate(result) ? 'Fixture controls pass; critical rejects = 0.' : `Publication blocked: ${result.rejected.length} critical rejects.`, 'Published teaching-version pointer advanced.'];
  const status = ui.workflowStatus;
  return `<div class="orchestration-visual"><div class="visual-section-title"><span>${isCi ? 'CONTROLLED DELIVERY' : 'EXPLICIT DEPENDENCIES'}</span>${tag('Local teaching sequence', 'dark')}</div><div class="task-chain">${names.map((name, i) => {
    const failed = status === 'blocked' && i === 3;
    const complete = status === 'done' || i < ui.workflowStep;
    const running = status === 'running' && i === ui.workflowStep;
    return `<div class="task-node ${failed ? 'failed' : complete ? 'success' : running ? 'running' : 'waiting'}"><span>${icon(failed ? 'alert' : complete ? 'check' : running ? 'activity' : 'clock')}</span><strong>${name}</strong><small>${failed ? 'Blocked' : complete ? 'Complete' : running ? 'Running' : 'Waiting'}</small></div>${i < 4 ? '<span class="task-line"></span>' : ''}`;
  }).join('')}</div><div class="workflow-actions">${button('run-workflow', `${icon(status === 'running' ? 'activity' : 'play')}${status === 'running' ? 'Running locally…' : status === 'idle' ? 'Run the sequence' : 'Replay the sequence'}`, 'btn', status === 'running' ? 'disabled' : '')}<span>${status === 'blocked' ? 'Try “Repair rejects” below, then replay.' : status === 'done' ? 'Fixture release complete. No external system changed.' : 'Watch each task finish before its dependent task starts.'}</span></div>${ui.workflowStep >= 0 ? `<div class="workflow-log" aria-live="polite">${messages.slice(0, Math.min(ui.workflowStep + 1, 5)).map((message, i) => `<div class="${status === 'blocked' && i === 3 ? 'error' : ''}"><span>0${i + 1}</span>${message}</div>`).join('')}</div>` : ''}<p class="dark-caption">A finished build is not permission to publish. Critical rejects keep the new version blocked.</p></div>`;
}
function specialVisual(lesson, result) {
  if (lesson.phase === 'partition') return `<div class="partition-visual"><div class="visual-section-title"><span>MICRO-PARTITION PRUNING</span>${tag('Illustrative', 'dark')}</div><div class="partition-grid">${Array.from({ length: 8 }, (_, i) => `<div class="partition ${i === 2 || i === 3 ? 'scanned' : ''}">${icon('database')}<strong>P${i + 1}</strong><small>${i === 2 || i === 3 ? 'SCAN' : 'SKIP'}</small></div>`).join('')}</div><div class="visual-caption"><span><i class="legend-dot lime"></i>2 scanned</span><span><i class="legend-dot"></i>6 pruned</span><span>Example filter: valuation_date = Jan 7</span></div></div>`;
  if (lesson.phase === 'cache') return `<div class="cache-visual"><div class="visual-section-title"><span>READ THE BOTTLENECK</span>${tag('Teaching timings', 'dark')}</div>${[['Compute-bound query', 75, 8, 'Tune SQL / evaluate capacity'], ['Concurrency-bound query', 8, 75, 'Isolate work / evaluate scale-out']].map(([name, exec, queue, label]) => `<div class="timing-row"><strong>${name}</strong><div class="timing-track"><span class="queue-time" style="width:${queue}%">Queue</span><span class="execution-time" style="width:${exec}%">Execute</span></div><small>${label}</small></div>`).join('')}</div>`;
  if (lesson.phase === 'security') return `<div class="security-visual"><div class="visual-section-title"><span>SAME DATA. DIFFERENT AUTHORIZED VIEWS.</span>${tag('Synthetic identities', 'dark')}</div><div class="role-grid"><div><span class="role-pill">APP_ROLE</span><strong>account_id · exposure · as_of</strong><span class="masked-field">email: ***MASKED***</span><small>Approved serving contract only</small></div><div><span class="role-pill">PII_READER</span><strong>Governed sensitive access</strong><span class="visible-field">email: person@example.test</span><small>Policy and grants both apply</small></div></div></div>`;
  if (lesson.phase === 'scd') return `<div class="scd-visual"><div class="visual-section-title"><span>A01 · ACCOUNT HISTORY</span>${tag('SCD Type 2', 'dark')}</div><div class="scd-timeline"><div><span>account_sk = 101</span><strong>Retail desk</strong><small>00:00 ≤ time &lt; 10:00</small></div><div><span>account_sk = 205</span><strong>Institutional desk</strong><small>10:00 ≤ time</small></div></div><div class="scd-facts"><span>T100 at 09:00 → Retail</span><span>T101 at 10:00 → Institutional</span></div></div>`;
  if (lesson.phase === 'airflow' || lesson.phase === 'ci') return orchestrationVisual(lesson, result);
  if (lesson.phase === 'quality' || lesson.phase === 'recovery') {
    const checks = reconciliation(result), gate = publicationGate(result);
    return `<div class="quality-visual"><div class="visual-section-title"><span>VALIDATION RESULTS</span>${tag(gate ? 'Repair fixture' : 'Accepted scope', 'dark')}</div><div class="quality-checks">${checks.map(c => `<div>${icon('circleCheck')}<span><strong>${c.name}</strong><small>${c.detail}</small></span><span>PASS</span></div>`).join('')}<div class="${gate ? '' : 'gate-blocked'}">${icon(gate ? 'circleCheck' : 'alert')}<span><strong>Critical rejects resolved</strong><small>${result.rejected.length} invalid current records · full publication ${gate ? 'eligible in this fixture' : 'blocked'}</small></span><span>${gate ? 'PASS' : 'BLOCK'}</span></div></div><p class="dark-caption">Fixture checks illustrate the policy. A real release also needs verified source controls, freshness, and authorization.</p></div>`;
  }
  if (lesson.phase === 'api') return `<div class="api-visual"><div class="visual-section-title"><span>APPLICATION DATA CONTRACT</span>${tag('Illustrative response', 'dark')}</div><div class="api-response"><div><span>GET</span> /api/accounts/A01/risk</div><pre>{\n  "account_id": "A01",\n  "exposure_usd": "700.00",\n  "dataset_version": "B001",\n  "as_of": "2026-01-07T09:01:00Z"\n}</pre></div><p class="dark-caption">Response shape preview only. B001 is blocked by the lab’s full-coverage policy; this is not a published endpoint.</p></div>`;
  if (lesson.phase === 'architecture') return `<div class="architecture-summary"><div class="visual-section-title"><span>A RECORD’S JOURNEY</span>${tag('Traceable by design', 'dark')}</div><div class="architecture-promises">${[['file', 'Preserve the evidence', 'Raw payload + batch metadata'], ['layers', 'Define the meaning', 'Grain + version + business rules'], ['shield', 'Prove the result', 'Tests + reconciliation + lineage']].map(([symbol, title, sub]) => `<div>${icon(symbol)}<strong>${title}</strong><small>${sub}</small></div>`).join('')}</div></div>`;
  return '';
}
function watchPanel(lesson) {
  const scenario = scenarioFor(lesson), result = snapshot(scenario), phase = lesson.phase;
  const special = specialVisual(lesson, result);
  const raw = ['source', 'raw', 'python'].includes(phase), staged = ['staging', 'sql', 'valid'].includes(phase);
  const rows = raw ? result.raw : staged ? result.staged : result.mart;
  const columns = raw ? ['trade_id', 'qty (raw)', 'price (raw)', 'version', 'batch'] : staged ? ['trade_id', 'quantity', 'price', 'version', 'validation'] : ['trade_id', 'quantity', 'notional', 'exposure', 'version'];
  const data = raw ? rows.map(r => [r.trade_id, r.quantity, r.price, r.version, r.batch_id]) : staged ? rows.map(r => [r.trade_id, Number.isFinite(r.quantity) ? r.quantity : null, Number.isFinite(r.price) ? r.price : null, r.version, r.valid ? 'Accepted' : r.reasons.join(', ')]) : rows.map(r => [r.trade_id, r.quantity, money(r.notional), money(r.exposure), r.version]);
  return `<div class="simulation-stage"><div class="stage-top"><div><span class="live-dot"></span><strong>risk_platform</strong><span class="stage-slash">/</span><span>${escape(lesson.tech)}</span></div><span class="simulation-label">BROWSER SIMULATION</span></div>${flowDiagram(lesson)}${special || `<div class="data-artifact"><div class="visual-section-title"><span>${raw ? 'RAW DELIVERIES · ALL RECORDS PRESERVED' : staged ? 'CURRENT STAGING · LATEST VERSION PER KEY' : 'ACCEPTED ACTIVE FACTS · CURRENT STATE'}</span><span>${rows.length} rows</span></div>${dataTable(columns, data, { dark: true, label: 'Synthetic trade data after this transformation' })}</div>`}<div class="stage-metrics"><div><small>Raw deliveries</small><strong>${result.raw.length}</strong></div><div><small>Current keys</small><strong>${result.staged.length}</strong></div><div><small>Accepted active</small><strong>${result.mart.length}</strong></div><div><small>Accepted-scope notional</small><strong>${money(result.notional)}</strong></div></div><div class="simulation-controls"><span>Try a different input</span><div>${[['initial', 'Initial batch'], ['replay', 'Replay'], ['correction', 'Correction'], ['cancel', 'Cancel'], ['repair', 'Repair rejects']].map(([id, label]) => button(`simulate:${id}`, label, `sim-btn ${scenario === id ? 'selected' : ''}`, `aria-pressed="${scenario === id}"`)).join('')}</div></div></div><div class="simulation-disclosure">${icon('eye')}JavaScript teaching model · No Snowflake, dbt, or Airflow connection · Amounts show accepted scope only</div><div class="step-trace"><div class="trace-heading"><h3>${icon('workflow')}Watch the sequence</h3>${button('animate', `${icon(ui.playing ? 'pause' : 'play')}${ui.playing ? 'Pause' : 'Replay sequence'}`, 'icon-text')}</div><ol>${lesson.steps.map((step, i) => `<li class="${ui.animationStep === i ? 'current' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><p>${escape(step)}</p>${ui.animationStep > i ? icon('check') : ''}</li>`).join('')}</ol></div>`;
}
function lessonPlayer(id) {
  const lesson = getLesson(id || state.lastLesson), module = getModule(lesson.moduleId), all = lessons.filter(l => state.pace !== 'crash' || l.essential), pos = all.findIndex(l => l.id === lesson.id);
  const globalPosition = lessons.findIndex(l => l.id === lesson.id);
  const next = pos >= 0 ? all[pos + 1] : lessons.slice(globalPosition + 1).find(l => state.pace !== 'crash' || l.essential);
  const previous = pos >= 0 ? all[pos - 1] : lessons.slice(0, globalPosition).reverse().find(l => state.pace !== 'crash' || l.essential);
  state.lastLesson = lesson.id; persist();
  const selectedLessons = module.lessons.filter(l => state.pace !== 'crash' || l.essential);
  const bookmarked = state.bookmarks.includes(lesson.id);
  return `<div class="page lab-page"><div class="lesson-breadcrumb">${link('home', 'The journey')}${icon('chevron')}<span>Chapter ${String(lesson.moduleIndex + 1).padStart(2, '0')}</span>${icon('chevron')}<strong>${module.short}</strong></div><div class="lesson-heading"><div><div class="eyebrow">SCENE ${String(lesson.index + 1).padStart(2, '0')} / ${String(module.lessons.length).padStart(2, '0')}<span class="eyebrow-divider">·</span>${escape(lesson.tech)}</div><h1 id="lesson-title" tabindex="-1">${lesson.title}</h1></div><div class="lesson-heading-actions">${tag(state.pace === 'crash' ? 'Crash route' : 'Go at your own pace', 'mint')}${button(`bookmark:${lesson.id}`, icon('bookmark'), `icon-btn bookmark-btn ${bookmarked ? 'bookmarked' : ''}`, `aria-label="${bookmarked ? 'Remove saved lesson' : 'Save lesson for review'}" aria-pressed="${bookmarked}"`)}</div></div><div class="chapter-strip">${selectedLessons.map(l => link(`lab/${l.id}`, `<span>${state.completed.includes(l.id) ? icon('check') : module.lessons.indexOf(l) + 1}</span><small>${l.title}</small>`, `chapter-stop ${l.id === lesson.id ? 'active' : ''} ${state.completed.includes(l.id) ? 'complete' : ''}`, l.id === lesson.id ? 'aria-current="step"' : '')).join('')}</div><div class="lesson-layout"><section class="lesson-workspace"><div class="lesson-tabs" role="tablist" aria-label="Lesson perspective">${[['watch', 'eye', 'Watch the flow'], ['code', 'code', 'Under the hood'], ['answer', 'mic', 'Say it in the interview']].map(([id, symbol, label]) => button(`tab:${id}`, `${icon(symbol)}<span>${label}</span>`, ui.tab === id ? 'active' : '', `role="tab" aria-selected="${ui.tab === id}" aria-controls="lesson-panel" id="tab-${id}" tabindex="${ui.tab === id ? 0 : -1}"`)).join('')}</div><div id="lesson-panel" role="tabpanel" aria-labelledby="tab-${ui.tab}">${ui.tab === 'watch' ? watchPanel(lesson) : ui.tab === 'code' ? `<div class="under-hood"><div class="panel-intro"><div class="eyebrow">THE IMPLEMENTATION</div><h2>${lesson.code ? 'Connect the idea to the code.' : 'Start with a clear contract.'}</h2><p>${lesson.why}</p></div>${codeBlock(lesson.code || lesson.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), lesson.language || 'text', lesson.file || 'design notes')}<div class="under-hood-note">${icon('lightbulb')}<p>Worked example for learning. Adapt object names, credentials, platform versions, and operational controls before real use.</p></div>${link(`code/${challenges.find(c => c.topic === lesson.moduleId)?.id || 'latest-trade'}`, `Explore a related coding problem${icon('arrow')}`, 'btn btn-secondary')}</div>` : `<div class="answer-panel"><div class="answer-banner">${icon('mic')}<div><span class="eyebrow">BUILD YOUR ANSWER</span><h2>Understand it. Then say it your way.</h2></div>${tag('45–90 seconds', 'mint')}</div><blockquote>${escape(lesson.answer)}</blockquote><h3>Be ready to defend it</h3><p>${lesson.deep}</p><div class="pitfall">${icon('alert')}<div><strong>Avoid this trap</strong><p>${lesson.trap}</p></div></div><label class="field-label" for="lesson-note">Your real example or personal phrasing <span>Optional · stays on this device</span></label><textarea id="lesson-note" data-note="${lesson.id}" rows="4" placeholder="What did you actually build? Which tradeoff can you explain?">${escape(state.notes[lesson.id] || '')}</textarea>${link(`questions/q-${lesson.id}`, `Practice this question${icon('arrow')}`, 'btn btn-secondary')}</div>`}</div></section><aside class="lesson-guide"><section class="guide-card"><div class="guide-icon">${icon('lightbulb')}</div><span class="eyebrow">WHAT’S HAPPENING</span><h2>The plain-English version</h2><p>${lesson.explain}</p><div class="guide-rule"></div><h3>Why this decision matters</h3><p>${lesson.why}</p><details class="deeper-note" ${state.depth === 'deep' ? 'open' : ''}><summary>${icon('layers')}Go one level deeper${icon('down')}</summary><p>${lesson.deep}</p></details></section><div class="guide-tip"><span>${icon('mic')}</span><p>After this scene, try explaining <strong>what changed, why it worked, and what could go wrong.</strong></p></div><div class="chapter-outcome"><span class="eyebrow">BY THE END OF THIS CHAPTER</span><p>${module.outcome}</p></div></aside></div><div class="lesson-navigation"><div>${previous ? link(`lab/${previous.id}`, `${icon('back')}<span>Previous scene</span>`, 'btn btn-quiet') : link('home', `${icon('back')}Back to the journey`, 'btn btn-quiet')}</div><div class="lesson-nav-center"><span>${state.completed.includes(lesson.id) ? `${icon('circleCheck')} Scene explored` : 'Take the idea with you.'}</span><small>${state.pace === 'crash' ? 'Essential scenes only' : 'No quizzes required to continue'}</small></div>${button(`next:${lesson.id}:${next?.id || ''}`, `<span>${next ? (next.moduleId === lesson.moduleId ? 'Next scene' : 'Next chapter') : 'Finish the journey'}</span>${icon('arrow')}`, 'btn btn-primary')}</div></div>`;
}

function questionAnswer(question) {
  const confidence = state.confidence[question.id], bookmarked = state.bookmarks.includes(question.id);
  return `<div class="question-answer"><div class="answer-label">${icon('mic')}A strong starting answer</div><p class="spoken-answer">${escape(question.answer)}</p><details class="deeper-note"><summary>${icon('layers')}If they go deeper${icon('down')}</summary><p>${escape(question.deep)}</p></details><div class="answer-checklist"><h4>Cover these points</h4>${question.criteria.map(c => `<div>${icon('check')}<span>${escape(c)}</span></div>`).join('')}</div><div class="pitfall compact">${icon('alert')}<div><strong>Watch the trap</strong><p>${escape(question.pitfall)}</p></div></div><div class="followup"><span class="eyebrow">LIKELY FOLLOW-UP</span><p>${escape(question.followup)}</p></div><div class="confidence-row"><span>How does this feel?</span><div>${button(`confidence:${question.id}:revisit`, `${icon('reset')}Revisit`, `btn btn-small ${confidence === 'revisit' ? 'btn-amber' : 'btn-quiet'}`, `aria-pressed="${confidence === 'revisit'}"`)}${button(`confidence:${question.id}:confident`, `${icon('check')}I can explain it`, `btn btn-small ${confidence === 'confident' ? 'btn-green' : 'btn-secondary'}`, `aria-pressed="${confidence === 'confident'}"`)}</div></div><div class="question-answer-footer">${question.lessonId ? link(`lab/${question.lessonId}`, `${icon('play')}See it in the learning lab`, 'subtle-link') : `<span class="small-text">Practice guidance · Use verified experience</span>`}${button(`bookmark:${question.id}`, `${icon('bookmark')}${bookmarked ? 'Saved for review' : 'Save for review'}`, `icon-text ${bookmarked ? 'bookmarked' : ''}`, `aria-pressed="${bookmarked}"`)}</div></div>`;
}
function filteredQuestions() {
  const term = ui.questionSearch.toLowerCase().trim();
  return questions.filter(q => (ui.questionTopic === 'all' || q.topic === ui.questionTopic) && (ui.questionType === 'all' || q.type === ui.questionType) && (ui.questionLevel === 'all' || q.level === ui.questionLevel) && (ui.questionScope !== 'saved' || state.bookmarks.includes(q.id)) && (ui.questionScope !== 'revisit' || state.confidence[q.id] === 'revisit') && (!term || `${q.prompt} ${q.answer} ${getModule(q.topic).title}`.toLowerCase().includes(term)));
}
function questionList() {
  const filtered = filteredQuestions();
  return `<div class="results-heading"><span><strong>${filtered.length}</strong> questions${ui.questionScope === 'saved' ? ' saved for review' : ui.questionScope === 'revisit' ? ' to revisit' : ' to make your own'}</span>${button('reset-filters', 'Clear filters', 'text-btn')}</div><div class="question-list">${filtered.map((q, i) => `<article class="question-card ${ui.openQuestion === q.id ? 'expanded' : ''}" id="${q.id}"><button class="question-trigger" data-action="open-question:${q.id}" aria-expanded="${ui.openQuestion === q.id}" aria-controls="answer-${q.id}"><span class="question-index">${state.confidence[q.id] === 'confident' ? icon('check') : String(i + 1).padStart(2, '0')}</span><span class="question-content"><span class="question-tags">${tag(getModule(q.topic).short, getModule(q.topic).color)}${tag(q.type)}${tag(q.level)}</span><strong>${escape(q.prompt)}</strong></span><span class="question-chevron">${icon(ui.openQuestion === q.id ? 'down' : 'chevron')}</span></button>${ui.openQuestion === q.id ? `<div id="answer-${q.id}">${questionAnswer(q)}</div>` : ''}</article>`).join('') || `<div class="empty-state">${icon('search')}<h3>No questions here yet.</h3><p>Try a broader filter, or save a question from the full collection.</p>${button('reset-filters', 'Show all questions', 'btn btn-secondary')}</div>`}</div>`;
}
function interviewRoom(id) {
  const confident = questions.filter(q => state.confidence[q.id] === 'confident').length;
  return `<div class="page questions-page"><div class="page-title-row"><div><div class="eyebrow">THINK IT THROUGH. SAY IT OUT LOUD.</div><h1>The interview room</h1><p>Good answers connect the idea, the implementation, and the evidence.</p></div>${button('start-mock:balanced', `${icon('mic')}Start a mock interview${icon('arrow')}`, 'btn btn-dark')}</div><section class="interview-banner"><span class="interview-banner-icon">${icon('headphones')}</span><div><h2>You already have the story. Practice telling it.</h2><p>Reveal an answer, put it in your own words, and mark what needs another pass.</p></div><div class="confidence-stat"><strong>${confident}<span> / ${questions.length}</span></strong><small>self-rated confident</small></div></section><div class="question-controls"><label class="search-field">${icon('search')}<input id="question-search" type="search" placeholder="Search a concept, scenario, or technology…" value="${escape(ui.questionSearch)}" aria-label="Search interview questions" /></label><div class="filter-row"><label>Topic<select id="question-topic"><option value="all">All ten chapters</option>${modules.map(m => `<option value="${m.id}" ${ui.questionTopic === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select></label><label>Question type<select id="question-type">${[['all', 'All types'], ['theory', 'Theory'], ['scenario', 'Scenario'], ['behavioral', 'Experience & behavioral']].map(([value, title]) => `<option value="${value}" ${ui.questionType === value ? 'selected' : ''}>${title}</option>`).join('')}</select></label><label>Depth<select id="question-level">${[['all', 'All depths'], ['Core', 'Core understanding'], ['Deeper', 'Deeper follow-ups']].map(([value, title]) => `<option value="${value}" ${ui.questionLevel === value ? 'selected' : ''}>${title}</option>`).join('')}</select></label><div class="segmented question-scope" role="group" aria-label="Question collection">${[['all', 'All questions'], ['saved', 'Saved'], ['revisit', 'Revisit']].map(([id, label]) => button(`question-scope:${id}`, label, ui.questionScope === id ? 'selected' : '', `aria-pressed="${ui.questionScope === id}"`)).join('')}</div></div></div><div id="question-results">${questionList()}</div><div class="room-bottom"><span>${icon('lightbulb')}Confidence ratings are your own assessment. No AI grading or recording.</span>${button('start-mock:technical', 'Try the technical follow-up mock'+icon('arrow'), 'text-btn')}</div></div>`;
}

function codeStudio(id) {
  const selected = challenges.find(c => c.id === (id || ui.codeId)) || challenges[0];
  ui.codeId = selected.id;
  const visible = challenges.filter(c => ui.codeTopic === 'all' || c.topic === ui.codeTopic);
  const step = selected.walkthrough[ui.codeStep];
  return `<div class="page code-page"><div class="page-title-row"><div><div class="eyebrow">MAKE THE CODE MAKE SENSE</div><h1>The code studio</h1><p>Read the problem. Trace the solution. Explain the edge cases.</p></div><span class="code-completion">${icon('circleCheck')}${state.completedCode.length} / ${challenges.length} explored</span></div><div class="code-layout"><aside class="challenge-sidebar"><div class="challenge-list-heading"><strong>THE PROBLEM SET</strong><label class="sr-only" for="code-topic">Filter coding topic</label><select id="code-topic"><option value="all">All topics</option>${modules.filter(m => challenges.some(c => c.topic === m.id)).map(m => `<option value="${m.id}" ${ui.codeTopic === m.id ? 'selected' : ''}>${m.short}</option>`).join('')}</select></div><nav aria-label="Coding problems">${visible.map(c => link(`code/${c.id}`, `<span class="challenge-status ${state.completedCode.includes(c.id) ? 'done' : ''}">${state.completedCode.includes(c.id) ? icon('check') : String(challenges.indexOf(c) + 1).padStart(2, '0')}</span><span><strong>${c.title}</strong><small>${c.language.toUpperCase()} <i>·</i> ${c.level} <i>·</i> ${c.minutes} min</small></span>`, `challenge-item ${selected.id === c.id ? 'active' : ''}`, selected.id === c.id ? 'aria-current="page"' : '')).join('')}</nav><div class="challenge-sidebar-note">${icon('eye')}Worked examples, not a live SQL or Python runtime. No setup required.</div></aside><section class="challenge-detail"><div class="challenge-header"><div class="question-tags">${tag(getModule(selected.topic).short, getModule(selected.topic).color)}${tag(selected.level)}${tag(selected.language)}</div><h2 tabindex="-1" id="challenge-title">${selected.title}</h2><p>${selected.prompt}</p></div><div class="example-grid"><section><div class="example-heading">${icon('table')}Example input</div>${dataTable(selected.input.columns, selected.input.rows)}</section><section><div class="example-heading">${icon('target')}Expected output</div>${dataTable(selected.expected.columns, selected.expected.rows)}</section></div><details class="scratchpad"><summary>${icon('code')}Try your own approach <span>Optional</span>${icon('down')}</summary><label for="code-draft" class="sr-only">Your code draft, saved locally</label><textarea id="code-draft" data-draft="${selected.id}" rows="7" spellcheck="false" placeholder="Sketch a solution. This editor stores notes; it does not execute code.">${escape(state.drafts[selected.id] || '')}</textarea></details><div class="challenge-actions">${button('code-hint', `${icon('lightbulb')}${ui.codeHint ? 'Another hint' : 'Give me a hint'}`, 'btn btn-quiet', ui.codeHint >= selected.hints.length ? 'disabled' : '')}${button('code-reveal', `${icon(ui.codeSolution ? 'eye' : 'play')}${ui.codeSolution ? 'Hide the solution' : 'Walk through the solution'}`, 'btn btn-primary')}</div>${ui.codeHint ? `<div class="hints">${selected.hints.slice(0, ui.codeHint).map((hint, i) => `<div><span>${i + 1}</span><p>${hint}</p></div>`).join('')}</div>` : ''}${ui.codeSolution ? `<div class="solution-workspace"><div class="solution-label"><span class="eyebrow">A WORKED SOLUTION</span><span>Review the reasoning before memorizing syntax.</span></div>${codeBlock(selected.solution, selected.language, `${selected.id}.${({ sql: 'sql', jinja: 'sql', python: 'py', yaml: 'yml' })[selected.language] || 'txt'}`, step?.lines || [])}<div class="code-walkthrough"><div class="walkthrough-top"><span class="eyebrow">${ui.codeStep < 0 ? 'STEP THROUGH THE LOGIC' : `PART ${ui.codeStep + 1} / ${selected.walkthrough.length}`}</span><div>${button('code-prev', icon('back'), 'icon-btn', `aria-label="Previous solution step" ${ui.codeStep <= 0 ? 'disabled' : ''}`)}${button('code-next', `${ui.codeStep < 0 ? 'Start the walkthrough' : ui.codeStep === selected.walkthrough.length - 1 ? 'Replay walkthrough' : 'Next part'}${icon('arrow')}`, 'btn btn-small btn-dark')}</div></div><h3>${step?.title || 'The important part is why it works.'}</h3><p>${step?.explain || 'Advance through the explanation. The related code lines will be highlighted so you can connect each choice to its effect.'}</p><div class="walkthrough-dots">${selected.walkthrough.map((_, i) => button(`code-step:${i}`, `<span class="sr-only">Solution part ${i + 1}</span>`, i === ui.codeStep ? 'active' : '', `aria-label="Solution part ${i + 1}" aria-pressed="${i === ui.codeStep}"`)).join('')}</div></div><div class="edge-case-card"><h3>${icon('shield')}Now defend it</h3><ul>${selected.edges.map(e => `<li>${e}</li>`).join('')}</ul><div><span class="eyebrow">PERFORMANCE & COMPLEXITY</span><p>${selected.cost}</p></div></div>${button(`code-complete:${selected.id}`, `${icon('check')}${state.completedCode.includes(selected.id) ? 'Explored — review whenever you like' : 'Mark this problem explored'}`, 'btn btn-secondary')}</div>` : ''}</section></div></div>`;
}

const nodeDetails = [
  { name: 'Sources & ingestion', icon: 'code', owner: 'Python / upstream systems', content: 'APIs, files, databases, and reference feeds produce the source data. Capture immutable payloads, source event identity, ingestion time, and a completion manifest. Retry transient requests safely; checkpoint only durable progress.', contract: 'One delivered event with a traceable source identity. A completed extraction is distinct from a completed warehouse load.', lesson: 'python-extract' },
  { name: 'Snowflake raw', icon: 'snowflake', owner: 'Ingestion runtime + Snowflake', content: 'Preserve raw records and metadata so you can replay and investigate. Use an appropriate batch or continuous load path. Restrict sensitive raw data and verify expected deliveries before transformation.', contract: 'Traceable source payload plus batch, load status, and arrival metadata. Raw may legitimately contain repeated deliveries.', lesson: 'story-ingest' },
  { name: 'dbt staging', icon: 'layers', owner: 'dbt Core + Snowflake compute', content: 'Normalize names and types, preserve lineage fields, and resolve source versions at the agreed key. Separate invalid records visibly and use explicit policies for equal-version conflicts and missing references.', contract: 'Source-aligned typed records with a clear grain. Invalid values remain visible rather than becoming silent defaults.', lesson: 'dbt-stage' },
  { name: 'dbt marts', icon: 'table', owner: 'Data engineering + business owners', content: 'Build tested facts and dimensions with reusable business definitions. Handle updates, late arrivals, history, and cancellations explicitly. Validate completeness and control totals before a coherent release.', contract: 'One current fact or documented historical grain, with a stable metric definition, owner, tests, and data version.', lesson: 'advanced-incremental' },
  { name: 'Application & analytics', icon: 'eye', owner: 'Backend / frontend / analytics', content: 'Serve approved data through a restricted contract. Expose keys, types, authorization, an as-of timestamp, and dataset version. A failed new build preserves the last validated release with visible freshness.', contract: 'A predictable consumer response, approved access scope, and explicit freshness and failure behavior.', lesson: 'python-api-contract' },
];
function architecturePage() {
  const decision = decisions[ui.decision];
  const selected = Number(state.decisions[decision.id] ?? -1);
  return `<div class="page architecture-page"><div class="page-title-row"><div><div class="eyebrow">SEE THE SYSTEM. DEFEND THE CHOICES.</div><h1>The architecture room</h1><p>Every box has a job. Every arrow has a contract.</p></div>${tag('Click any stage to inspect it', 'mint')}</div><section class="architecture-canvas"><div class="canvas-heading"><span><span class="live-dot"></span>FINANCIAL RISK PLATFORM</span><span>Synthetic reference architecture</span></div>${flowDiagram({ phase: 'architecture' })}<div class="canvas-layers"><div>${icon('workflow')}<strong>Airflow</strong><span>Schedule · dependencies · retries · monitoring</span></div><div>${icon('shield')}<strong>Quality & governance</strong><span>Completeness · tests · reconciliation · RBAC · masking</span></div><div>${icon('git')}<strong>Delivery</strong><span>Git · review · isolated CI · controlled deployment</span></div></div></section><div class="architecture-bottom"><section class="decision-room"><div class="section-heading"><div><div class="eyebrow">THE TRADEOFF TABLE</div><h2>What would you choose?</h2><p>Choose a design, then inspect the reasoning. No score required.</p></div><span class="scene-counter">${ui.decision + 1} / ${decisions.length}</span></div><div class="decision-card"><div class="decision-scenario"><span class="module-icon purple">${icon('workflow')}</span><h3>${decision.title}</h3><p>${decision.context}</p></div><div class="decision-options">${decision.options.map((option, i) => button(`decision:${i}`, `<span class="option-letter">${String.fromCharCode(65 + i)}</span><span>${option.label}</span>${selected === i ? icon('check') : ''}`, `decision-option ${selected === i ? 'selected' : ''}`, `aria-pressed="${selected === i}"`)).join('')}</div>${selected >= 0 ? `<div class="decision-result ${decision.options[selected].preferred ? 'good' : 'consider'}"><h4>${icon(decision.options[selected].preferred ? 'circleCheck' : 'lightbulb')}${decision.options[selected].preferred ? 'A sound choice for these requirements.' : 'Look at the tradeoff.'}</h4><p>${decision.options[selected].result}</p><div><strong>When the answer could change</strong><p>${decision.tradeoff}</p></div></div>` : ''}<div class="decision-nav">${button('decision-prev', `${icon('back')}Previous`, 'btn btn-quiet', ui.decision === 0 ? 'disabled' : '')}${button('decision-next', `${ui.decision === decisions.length - 1 ? 'Back to the first choice' : 'Next decision'}${icon('arrow')}`, 'btn btn-dark')}</div></div></section><aside class="design-talk-card"><div class="eyebrow">YOUR SEVEN-MINUTE DESIGN TALK</div><h3>Start with the questions.</h3><ol><li><span>01</span><div><strong>Clarify</strong><p>Freshness, volume, grain, updates, access, and recovery.</p></div></li><li><span>02</span><div><strong>Trace a record</strong><p>Source → raw → staging → mart → consumer.</p></div></li><li><span>03</span><div><strong>Break it on purpose</strong><p>Duplicate, late correction, invalid input, and partial failure.</p></div></li><li><span>04</span><div><strong>Defend a choice</strong><p>Explain the benefit, cost, and evidence that would change your mind.</p></div></li></ol>${link('lab/incident-design', `Practice the design talk${icon('arrow')}`, 'btn btn-secondary')}</aside></div></div>`;
}

const evidenceItems = [
  ['wf-sources', 'Wells Fargo: actual source systems and ingestion tools', 'The resume does not name the exact source connectors. Fill this from your own work.'],
  ['wf-model', 'Wells Fargo: one dbt model you personally built', 'Record its grain, dependencies, materialization, tests, and one difficult edge case.'],
  ['wf-incident', 'Wells Fargo: a real recovery example', 'What failed, what you changed, how you verified recovery, and your exact contribution.'],
  ['boa-scale', 'Bank of America: 15+ sources and 200+ DAGs', 'Be ready to distinguish the warehouse source count from the scope of DAG ownership.'],
  ['citi-accuracy', 'Citigroup: the definition behind 99.8% accuracy', 'Actual denominator, measurement period, quality rule, and treatment of rejects.'],
  ['citi-automation', 'Citigroup: 50% less manual intervention', 'The baseline workflow, what Jenkins/Terraform automated, and how effort was compared.'],
  ['citi-query', 'Citigroup: 40% query improvement', 'Actual workload, query profile, data volume, warehouse, cache conditions, and measured result.'],
  ['education', 'Verified education details', 'The summary mentions an MCA; the pasted resume does not include institution or dates.'],
];
function resumePage() {
  const stories = [
    { company: 'Wells Fargo', date: 'Mar 2025 – Present', role: 'Senior Data Engineer', tone: 'mint', focus: 'Current project · Highest priority', facts: ['dbt models and Python / SQL ELT for financial-risk definitions.', 'Reusable facts and dimensions on Snowflake.', '40+ production Airflow workflows and Datadog SLA monitoring.', 'Governed datasets through internal REST APIs for application teams.', 'Liquibase versioning, access controls, lineage, and stakeholder reviews.'], answer: 'In my current Wells Fargo role, I build reusable dbt transformations and Snowflake datasets for financial-risk use cases. I support 40+ Airflow workflows with monitoring and quality checks, and work with application and risk stakeholders on the definitions and consumption contracts. I would then describe one actual model and trace its inputs, validation, deployment, and recovery behavior.', caution: 'Exact source systems, connector names, model counts, and freshness targets are not given in the resume. Use your real details.' },
    { company: 'Bank of America', date: 'Nov 2022 – Feb 2025', role: 'Senior Data Engineer', tone: 'blue', focus: 'Warehouse design · Modeling & governance', facts: ['Kimball-style enterprise Snowflake warehouse across 15+ source systems.', 'Risk, finance, and regulatory reporting requirements.', 'Clustering, query tuning, workload management, and PII controls.', 'Ownership of 200+ production Airflow DAGs with quality and monitoring.', 'Distributed Python / PySpark / Pandas on AWS EMR and Databricks.'], answer: 'At Bank of America I architected a Kimball-modeled Snowflake warehouse integrating more than 15 sources for risk, finance, and regulatory reporting. I worked on source mappings, reconciliation, query performance, workload management, and governance. I would explain one fact grain, its dimensions, and one measured optimization or control I personally implemented.', caution: 'The resume does not quantify the Snowflake cost reduction. Keep the “zero compliance incidents” claim scoped to its actual period and control evidence.' },
    { company: 'Citigroup', date: 'Nov 2019 – Nov 2022', role: 'Senior Data Engineer', tone: 'purple', focus: 'dbt & Airflow · Automation & scale', facts: ['dbt layers inside 150+ Airflow-orchestrated pipelines.', '99.8% accuracy claim validated with Great Expectations.', 'Terraform and Jenkins automation: 50% less manual intervention.', 'Storage optimization: 40% query performance improvement.', 'API ingestion, internal application APIs, Databricks, and Delta Lake.'], answer: 'At Citigroup I maintained more than 150 Airflow-orchestrated pipelines with dbt transformation layers and quality controls. I built Terraform and Jenkins automation and worked on performance optimization and analytics-ready models for investment reporting. I would support the resume metrics with the actual baseline, measurement period, and my own contribution.', caution: '99.8% is a data-accuracy claim, not an uptime SLA. Verify how each reported percentage was measured.' },
  ];
  return `<div class="page resume-page"><div class="page-title-row"><div><div class="eyebrow">YOUR EXPERIENCE, CLEARLY EXPLAINED</div><h1>Three projects. Your own story.</h1><p>Use the resume as evidence. Use this lab to understand the engineering.</p></div>${link('questions/q-story-intro', `${icon('mic')}Rehearse your introduction`, 'btn btn-dark')}</div><div class="resume-principle">${icon('shield')}<p><strong>Keep the story accurate.</strong> These cards use only the resume you provided. Synthetic trades and practice incidents are labeled examples; they are not additional employment claims.</p></div><div class="story-grid">${stories.map((s, i) => `<article class="story-card"><div class="story-card-header"><span class="company-monogram ${s.tone}">${['WF', 'BA', 'C'][i]}</span><span class="eyebrow">PROJECT ${String(i + 1).padStart(2, '0')}</span></div><h2>${s.company}</h2><span class="story-role">${s.role} · ${s.date}</span><p class="story-focus">${s.focus}</p><h3>What your resume supports</h3><ul>${s.facts.map(f => `<li>${f}</li>`).join('')}</ul><details class="story-script"><summary>${icon('mic')}A concise way to frame it${icon('down')}</summary><p>${s.answer}</p></details><div class="story-caution">${icon('lightbulb')}<p>${s.caution}</p></div></article>`).join('')}</div><section class="evidence-section"><div class="section-heading"><div><div class="eyebrow">BEFORE YOU WALK INTO THE INTERVIEW</div><h2>Close the evidence gaps.</h2><p>Record only details you can verify. Your notes stay on this device.</p></div><span class="scene-counter">${evidenceItems.filter(([id]) => state.evidence[id]?.trim()).length} / ${evidenceItems.length} noted</span></div><div class="evidence-grid">${evidenceItems.map(([id, title, detail]) => `<details class="evidence-item"><summary><span class="evidence-check ${state.evidence[id]?.trim() ? 'done' : ''}">${icon(state.evidence[id]?.trim() ? 'check' : 'file')}</span><span>${title}</span>${icon('down')}</summary><div><p>${detail}</p><label class="sr-only" for="evidence-${id}">Your verified details: ${title}</label><textarea id="evidence-${id}" data-evidence="${id}" rows="4" placeholder="Add your actual details, or note what you still need to verify…">${escape(state.evidence[id] || '')}</textarea></div></details>`).join('')}</div></section><section class="fit-card"><div><div class="eyebrow">JD FIT, WITHOUT OVERSTATING IT</div><h2>Lead with the work you want to do.</h2><p>The JD asks for 3–5 years; your resume has 13+ overall. Explain why hands-on dbt, Snowflake, and application collaboration fit your interests. Your resume names Tableau and Looker; describe their transferable patterns when asked about Sigma, Qlik, or Power BI.</p></div>${link('questions/q-overqualified', `Practice the fit question${icon('arrow')}`, 'btn btn-secondary')}</section></div>`;
}

function studyPlan() {
  const essential = lessons.filter(l => l.essential);
  const lastHour = ['story-intro', 'story-ownership', 'advanced-incremental', 'advanced-replay', 'advanced-correction', 'snowflake-warehouses', 'sql-joins', 'airflow-retry', 'quality-publish', 'delivery-ci', 'incident-behavior'];
  return `<div class="page plan-page"><div class="page-title-row"><div><div class="eyebrow">BUILT FOR YOUR 3–7 DAY WINDOW</div><h1>A plan you can actually finish.</h1><p>Five focused sessions, with time for practice and a final rehearsal.</p></div>${button('export', `${icon('download')}Back up my progress`, 'btn btn-secondary')}</div><div class="plan-summary"><div><span class="eyebrow">THE FIVE-DAY PATH</span><h2>About 10 hours, at your pace.</h2><p>All chapters are available from day one. Move your current-day marker whenever it suits you. Reading a scene marks exposure, not proven mastery.</p></div><div class="plan-ring" style="--progress:${percent(doneCount(), lessons.length)}%"><div><strong>${percent(doneCount(), lessons.length)}%</strong><span>explored</span></div></div></div><section class="day-list">${days.map(day => {
    const ls = lessons.filter(l => day.modules.includes(l.moduleId)), complete = ls.filter(l => state.completed.includes(l.id)).length;
    return `<article class="day-card ${state.day === day.day ? 'current' : ''}"><div class="day-number"><span>DAY</span><strong>0${day.day}</strong></div><div class="day-body"><div class="day-title"><h2>${day.title}</h2>${state.day === day.day ? tag('Your current focus', 'mint') : ''}</div><p>${day.focus}</p><div class="day-chapters">${day.modules.map(id => link(`lab/${getModule(id).lessons[0].id}`, `${icon(getModule(id).icon)}${getModule(id).short}`, 'chapter-pill')).join('')}</div><div class="day-practice"><strong>Practice checkpoint</strong><p>${day.practice}</p></div><div class="day-meta"><span>${icon('clock')}${day.minutes} min including practice</span><span>${complete} / ${ls.length} scenes explored</span></div></div><div class="day-actions">${button(`set-day:${day.day}`, state.day === day.day ? `${icon('check')}Current focus` : 'Make this my focus', `btn btn-small ${state.day === day.day ? 'btn-green' : 'btn-quiet'}`)}${link(`lab/${getModule(day.modules[0]).lessons[0].id}`, `Open day ${day.day}${icon('arrow')}`, 'btn btn-small btn-secondary')}</div></article>`;
  }).join('')}</section><section class="last-hour"><div><div class="eyebrow">IF THE INTERVIEW IS VERY CLOSE</div><h2>The last-hour brief.</h2><p>Revisit these high-value explanations, then check the evidence behind your resume metrics. This is a review path, not a replacement for the full preparation.</p>${button('start-mock:balanced', `${icon('mic')}Finish with a mock`, 'btn btn-dark')}</div><div class="last-hour-links">${lastHour.map((id, i) => link(`lab/${id}`, `<span>${String(i + 1).padStart(2, '0')}</span>${getLesson(id).title}${icon('chevron')}`, '')).join('')}</div></section><section class="reference-section"><div class="section-heading"><div><div class="eyebrow">GO TO THE SOURCE</div><h2>Official references</h2><p>Examples explain concepts. Check syntax and features against your deployed versions.</p></div></div><div class="reference-grid">${sources.map(s => `<a href="${s.url}" target="_blank" rel="noreferrer" class="reference-card"><strong>${s.name}${icon('external')}</strong><p>${s.note}</p></a>`).join('')}</div></section><div class="plan-bottom"><span>${essential.length} essential scenes are available in the crash route.</span>${button('set-pace:crash', 'Use the crash route'+icon('arrow'), 'text-btn')}</div></div>`;
}

function mockPage() {
  if (!mock) return `<div class="page mock-welcome"><span class="large-orb">${icon('mic')}</span><div class="eyebrow">YOUR PRACTICE INTERVIEW</div><h1>Take a breath. Tell the story.</h1><p>12 questions. Optional timer and notes. Compare your answer to a rubric, then rate your own confidence. No microphone or external service required.</p><div>${button('start-mock:balanced', 'Start a balanced mock'+icon('arrow'), 'btn btn-primary')}${button('start-mock:technical', 'Try deeper technical follow-ups', 'btn btn-secondary')}</div></div>`;
  if (mock.index >= mock.ids.length) {
    const confident = Object.values(mock.ratings).filter(x => x === 'confident').length;
    return `<div class="page mock-summary"><span class="large-orb">${icon('circleCheck')}</span><div class="eyebrow">REHEARSAL COMPLETE</div><h1>You’ve made another pass.</h1><p>You rated ${confident} of ${mock.ids.length} answers confident. Use the remaining questions as your next review list. These are self-assessments, not an interview score.</p><div class="mock-review-list">${mock.ids.map(id => {
      const q = questions.find(q => q.id === id);
      return link(`questions/${id}`, `${icon(mock.ratings[id] === 'confident' ? 'check' : 'reset')}<span>${q.prompt}</span>${tag(mock.ratings[id] === 'confident' ? 'Confident' : 'Revisit', mock.ratings[id] === 'confident' ? 'mint' : 'amber')}`, '');
    }).join('')}</div><div class="mock-summary-actions">${button(`start-mock:${mock.set}`, 'Try another pass', 'btn btn-primary')}${link('plan', 'Return to your study plan'+icon('arrow'), 'btn btn-secondary')}</div></div>`;
  }
  const q = questions.find(q => q.id === mock.ids[mock.index]);
  return `<div class="page mock-page"><div class="mock-top">${link('questions', `${icon('back')}Interview room`, 'subtle-link')}${tag(mock.set === 'technical' ? 'Technical follow-ups' : 'Balanced interview', 'mint')}<span>QUESTION ${mock.index + 1} / ${mock.ids.length}</span></div><div class="mock-progress"><span style="width:${mock.index / mock.ids.length * 100}%"></span></div><div class="mock-stage"><div class="mock-interviewer"><span class="interviewer-avatar">${icon('mic')}</span><div><strong>Your interviewer</strong><span>Take a moment. Think aloud.</span></div>${tag(q.level)}</div><div class="question-tags">${tag(getModule(q.topic).short, getModule(q.topic).color)}${tag(q.type)}</div><h1 id="mock-prompt" tabindex="-1">${q.prompt}</h1><div class="mock-timer-bar"><div class="timer-readout"><span class="timer-face ${mock.remaining <= 10 ? 'low' : ''}" id="mock-clock" aria-label="Time remaining">${formatTime(mock.remaining)}</span><span id="mock-timer-label">${mock.remaining === 0 ? 'Time is up. Finish your thought.' : mock.running ? 'A guide, not a deadline.' : 'Timer is optional.'}</span></div><div>${button('mock-timer', `${icon(mock.running ? 'pause' : 'play')}${mock.running ? 'Pause' : 'Start timer'}`, 'btn btn-small btn-secondary')}${button('mock-reset-time', icon('reset'), 'icon-btn', 'aria-label="Reset the timer to 90 seconds"')}</div></div><label class="field-label" for="mock-notes">Your answer outline <span>Optional · not graded or sent anywhere</span></label><textarea id="mock-notes" data-note="mock:${q.id}" rows="5" placeholder="Problem → decision → implementation → validation → your real evidence…">${escape(state.notes[`mock:${q.id}`] || '')}</textarea><div class="mock-reveal-row">${button('mock-reveal', `${icon('eye')}${mock.revealed ? 'Hide the guide' : 'Compare with the answer guide'}`, 'btn btn-dark')}<span>Speak first if you can. Reading is useful too.</span></div>${mock.revealed ? `<div class="mock-rubric"><div class="eyebrow">YOUR SELF-REVIEW GUIDE</div><p class="spoken-answer">${q.answer}</p><h3>Did your answer cover these?</h3><ul>${q.criteria.map(c => `<li>${c}</li>`).join('')}</ul><details class="deeper-note"><summary>Deeper follow-up${icon('down')}</summary><p>${q.deep}</p></details><div class="pitfall compact">${icon('alert')}<p>${q.pitfall}</p></div><div class="mock-rating"><span>How did this answer feel?</span>${button('mock-rate:revisit', `${icon('reset')}Needs another pass`, `btn btn-small ${mock.ratings[q.id] === 'revisit' ? 'btn-amber' : 'btn-secondary'}`)}${button('mock-rate:confident', `${icon('check')}I can explain it`, `btn btn-small ${mock.ratings[q.id] === 'confident' ? 'btn-green' : 'btn-secondary'}`)}</div></div>` : ''}</div><div class="mock-navigation">${button('mock-prev', `${icon('back')}Previous question`, 'btn btn-quiet', mock.index === 0 ? 'disabled' : '')}<span>Progress here reflects practice, not production experience.</span>${button('mock-next', `${mock.index === mock.ids.length - 1 ? 'Finish rehearsal' : 'Next question'}${icon('arrow')}`, 'btn btn-primary')}</div></div>`;
}
function formatTime(value) { return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }
function startMock(set) {
  clearInterval(timer); mock = { set, ids: [...mockSets[set]], index: 0, remaining: 90, running: false, revealed: false, ratings: {} };
  if (currentRoute().view === 'mock') render(); else location.hash = '/mock';
}
function pauseMock() { clearInterval(timer); if (mock) mock.running = false; }
function runTimer() {
  if (!mock) return;
  if (mock.running) { pauseMock(); render(); return; }
  if (mock.remaining <= 0) mock.remaining = 90;
  mock.running = true; render();
  let lastTime = Date.now();
  timer = setInterval(() => {
    if (!mock || currentRoute().view !== 'mock') { pauseMock(); return; }
    const elapsed = Math.floor((Date.now() - lastTime) / 1000);
    if (!elapsed) return;
    lastTime += elapsed * 1000;
    mock.remaining = Math.max(0, mock.remaining - elapsed);
    if ($('#mock-clock')) { $('#mock-clock').textContent = formatTime(mock.remaining); $('#mock-clock').classList.toggle('low', mock.remaining <= 10); }
    if (!mock.remaining) { pauseMock(); render(); toast('Time is up. Finish your thought, then review at your pace.'); }
  }, 250);
}
function navigateMock(delta) {
  pauseMock();
  if (delta > 0 && !mock.ratings[mock.ids[mock.index]]) {
    mock.ratings[mock.ids[mock.index]] = 'revisit';
    state.confidence[mock.ids[mock.index]] = 'revisit';
  }
  mock.index = Math.max(0, mock.index + delta); mock.revealed = false; mock.remaining = 90;
  if (mock.index === mock.ids.length && !mock.recorded) {
    state.mockHistory.push({ date: new Date().toISOString(), total: mock.ids.length, confident: Object.values(mock.ratings).filter(x => x === 'confident').length });
    mock.recorded = true;
  }
  persist(); render(); window.scrollTo({ top: 0, behavior: 'instant' });
}

function render(options = {}) {
  const route = currentRoute();
  if (route.view !== 'mock') pauseMock();
  let content = '';
  switch (route.view) {
    case 'lab': content = lessonPlayer(route.id); break;
    case 'questions': content = interviewRoom(route.id); break;
    case 'code': content = codeStudio(route.id); break;
    case 'architecture': content = architecturePage(); break;
    case 'resume': content = resumePage(); break;
    case 'plan': content = studyPlan(); break;
    case 'mock': content = mockPage(); break;
    default: content = home();
  }
  $('#app').innerHTML = shell(route.view, content);
  document.title = `${({ home: 'Your journey', lab: getLesson(route.id || state.lastLesson).title, questions: 'Interview room', code: 'Code studio', architecture: 'Architecture room', resume: 'Your project stories', plan: 'Five-day study plan', mock: 'Mock interview' })[route.view]} — DataCraft`;
  if (options.focus) $(`#${options.focus}`)?.focus({ preventScroll: true });
}
function routeChanged() {
  ui.menu = false; ui.simulation = null; stopAnimation(); stopWorkflow();
  const route = currentRoute();
  if (route.view === 'questions' && route.id) { ui.openQuestion = route.id; ui.questionSearch = ''; ui.questionTopic = 'all'; ui.questionType = 'all'; ui.questionLevel = 'all'; ui.questionScope = 'all'; }
  if (route.view === 'code') { ui.codeStep = -1; ui.codeSolution = false; ui.codeHint = 0; }
  render(); window.scrollTo({ top: 0, behavior: 'instant' });
  const target = route.view === 'lab' ? $('#lesson-title') : route.view === 'code' ? $('#challenge-title') : $('#main');
  target?.focus({ preventScroll: true });
}
function stopAnimation() { clearInterval(animationTimer); ui.playing = false; ui.animationStep = -1; }
function stopWorkflow() { clearInterval(workflowTimer); ui.workflowStatus = 'idle'; ui.workflowStep = -1; }
function startWorkflow() {
  stopWorkflow();
  const lesson = getLesson(currentRoute().id || state.lastLesson);
  const result = snapshot(scenarioFor(lesson));
  ui.workflowStatus = 'running'; ui.workflowStep = 0; render();
  workflowTimer = setInterval(() => {
    ui.workflowStep++;
    if (ui.workflowStep === 3 && !publicationGate(result)) { ui.workflowStatus = 'blocked'; clearInterval(workflowTimer); }
    else if (ui.workflowStep >= 5) { ui.workflowStatus = 'done'; clearInterval(workflowTimer); }
    render();
  }, 850);
}
function animateLesson() {
  if (ui.playing) { stopAnimation(); render(); return; }
  const lesson = getLesson(currentRoute().id || state.lastLesson);
  ui.playing = true; ui.animationStep = 0; render();
  animationTimer = setInterval(() => {
    ui.animationStep++;
    if (ui.animationStep >= lesson.steps.length) { clearInterval(animationTimer); ui.playing = false; }
    render();
  }, 2100);
}
function modal(title, content, wide = false) {
  ui.modalFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-overlay"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">${title}</h2>${button('close-modal', icon('close'), 'icon-btn', 'aria-label="Close dialog"')}</header>${content}</section></div>`;
  requestAnimationFrame(() => ($('#global-search') || $('#modal-root button') || $('#modal-title'))?.focus());
}
function closeModal() { $('#modal-root').innerHTML = ''; ui.modalFocus?.focus?.({ preventScroll: true }); }
function settings() {
  modal('Make this your workspace', `<div class="settings-body"><div class="setting-row"><div><h3>Explanation depth</h3><p>Start in plain English, or open deeper notes by default.</p></div><select id="depth-setting" aria-label="Default explanation depth"><option value="plain" ${state.depth === 'plain' ? 'selected' : ''}>Plain English first</option><option value="deep" ${state.depth === 'deep' ? 'selected' : ''}>Open deeper notes</option></select></div><div class="setting-row"><div><h3>Your study route</h3><p>The crash route skips optional scenes. All content stays available.</p></div><select id="pace-setting" aria-label="Study route"><option value="balanced" ${state.pace === 'balanced' ? 'selected' : ''}>Balanced · five days</option><option value="crash" ${state.pace === 'crash' ? 'selected' : ''}>Essential scenes</option><option value="full" ${state.pace === 'full' ? 'selected' : ''}>Full deep dive</option></select></div><div class="settings-storage"><h3>${icon('shield')}Your progress belongs to you.</h3><p>Completed scenes, notes, code drafts, saved questions, and confidence ratings stay in this browser. Export a backup to move them to another device. No account, tracking, or cloud sync.</p><div>${button('export', `${icon('download')}Export progress`, 'btn btn-secondary')}${button('import', `${icon('upload')}Import backup`, 'btn btn-quiet')}</div><input type="file" accept="application/json,.json" id="import-file" hidden /></div><div class="settings-reset"><p>Start fresh on this device. Export first if you want to keep your notes.</p>${button('reset-dialog', 'Reset local progress', 'text-btn danger')}</div><div class="version-note">DataCraft v1.0 · ${lessons.length} scenes · ${questions.length} questions · ${challenges.length} code walkthroughs</div></div>`);
}
function exportProgress() {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `datacraft-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Progress backup downloaded. It includes your local notes and drafts.');
}
function openSearch() {
  modal('Find your next idea', `<div class="global-search-box"><label class="search-field">${icon('search')}<input id="global-search" type="search" placeholder="Try “incremental”, “SCD”, or “recovery”…" autocomplete="off" aria-label="Search all learning content" /></label><div id="global-search-results"><div class="search-suggestions"><span class="eyebrow">A GOOD PLACE TO START</span>${['Incremental', 'Airflow', 'Snowflake', 'reconciliation', 'Python'].map(term => button(`search-term:${term}`, term, 'chapter-pill')).join('')}</div></div></div>`, true);
}
function searchResults(term) {
  if (!term.trim()) return '<p class="search-empty">Search lessons, interview questions, and coding problems.</p>';
  const needle = term.trim().toLowerCase();
  const groups = [
    ['Guided scenes', lessons.filter(l => `${l.title} ${l.tech} ${l.explain}`.toLowerCase().includes(needle)).slice(0, 6).map(l => ({ route: `lab/${l.id}`, label: l.title, topic: l.moduleTitle, symbol: 'play' }))],
    ['Interview questions', questions.filter(q => `${q.prompt} ${q.answer}`.toLowerCase().includes(needle)).slice(0, 6).map(q => ({ route: `questions/${q.id}`, label: q.prompt, topic: getModule(q.topic).short, symbol: 'mic' }))],
    ['Coding problems', challenges.filter(c => `${c.title} ${c.prompt} ${c.language}`.toLowerCase().includes(needle)).slice(0, 4).map(c => ({ route: `code/${c.id}`, label: c.title, topic: c.language, symbol: 'code' }))],
  ];
  if (!groups.some(([, items]) => items.length)) return '<div class="search-empty">No results. Try a technology or a broader concept.</div>';
  return groups.filter(([, items]) => items.length).map(([title, items]) => `<section class="search-group"><h3>${title}</h3>${items.map(item => link(item.route, `${icon(item.symbol)}<span><strong>${escape(item.label)}</strong><small>${escape(item.topic)}</small></span>${icon('chevron')}`, 'search-result', 'data-close-modal="true"')).join('')}</section>`).join('');
}
function inspectNode(index) {
  const node = nodeDetails[index];
  modal(`${icon(node.icon)}${node.name}`, `<div class="node-detail"><div class="eyebrow">${node.owner}</div><p>${node.content}</p><div class="node-contract"><h3>The contract at this boundary</h3><p>${node.contract}</p></div>${link(`lab/${node.lesson}`, 'See this stage in the lab'+icon('arrow'), 'btn btn-primary', 'data-close-modal="true"')}</div>`);
}
function updateQuestions() { $('#question-results').innerHTML = questionList(); }

document.addEventListener('click', async event => {
  const modalLink = event.target.closest('[data-close-modal]'); if (modalLink) closeModal();
  if (event.target.classList.contains('modal-overlay')) { closeModal(); return; }
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return;
  const [action, ...args] = el.dataset.action.split(':');
  switch (action) {
    case 'menu': ui.menu = !ui.menu; render(); break;
    case 'search': openSearch(); break;
    case 'search-term': $('#global-search').value = args[0]; $('#global-search-results').innerHTML = searchResults(args[0]); $('#global-search').focus(); break;
    case 'settings': settings(); break;
    case 'close-modal': closeModal(); break;
    case 'roadmap': $('#roadmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'journey': ui.journey = args[0]; if (args[0] === 'crash') { state.pace = 'crash'; persist(); } else if (state.pace === 'crash') { state.pace = 'balanced'; persist(); } render(); $('#roadmap')?.scrollIntoView({ block: 'start' }); break;
    case 'tab': ui.tab = args[0]; stopAnimation(); stopWorkflow(); render({ focus: `tab-${args[0]}` }); break;
    case 'next': {
      if (!state.completed.includes(args[0])) state.completed.push(args[0]);
      if (args[1]) state.lastLesson = args[1]; persist();
      if (args[1]) location.hash = `/lab/${args[1]}`;
      else { location.hash = '/plan'; toast('You’ve finished this study route. Revisit questions and rehearse your own examples.'); }
      break;
    }
    case 'bookmark': state.bookmarks = state.bookmarks.includes(args[0]) ? state.bookmarks.filter(id => id !== args[0]) : [...state.bookmarks, args[0]]; persist(); render(); toast(state.bookmarks.includes(args[0]) ? 'Saved for review.' : 'Removed from saved items.'); break;
    case 'simulate': stopWorkflow(); ui.simulation = args[0]; render(); break;
    case 'run-workflow': startWorkflow(); break;
    case 'animate': animateLesson(); break;
    case 'inspect-node': inspectNode(Number(args[0])); break;
    case 'copy-code': {
      const code = [...el.closest('.code-block').querySelectorAll('code')].map(n => n.textContent).join('\n');
      try { await navigator.clipboard.writeText(code); toast('Code copied. Review the example notes before using it.'); }
      catch { toast('Clipboard unavailable. Select the code text to copy it.'); }
      break;
    }
    case 'open-question': ui.openQuestion = ui.openQuestion === args[0] ? null : args[0]; history.replaceState(null, '', `#/${ui.openQuestion ? `questions/${ui.openQuestion}` : 'questions'}`); updateQuestions(); break;
    case 'question-scope': ui.questionScope = args[0]; render(); break;
    case 'reset-filters': ui.questionSearch = ''; ui.questionTopic = 'all'; ui.questionType = 'all'; ui.questionLevel = 'all'; ui.questionScope = 'all'; render(); break;
    case 'confidence': state.confidence[args[0]] = args[1]; persist(); render(); break;
    case 'code-hint': ui.codeHint++; render(); break;
    case 'code-reveal': ui.codeSolution = !ui.codeSolution; ui.codeStep = -1; render(); break;
    case 'code-next': { const c = challenges.find(c => c.id === ui.codeId); ui.codeStep = (ui.codeStep + 1) % c.walkthrough.length; render(); break; }
    case 'code-prev': ui.codeStep = Math.max(0, ui.codeStep - 1); render(); break;
    case 'code-step': ui.codeStep = Number(args[0]); render(); break;
    case 'code-complete': if (!state.completedCode.includes(args[0])) state.completedCode.push(args[0]); persist(); render(); toast('Problem marked explored. Try explaining its edge cases without notes.'); break;
    case 'decision': state.decisions[decisions[ui.decision].id] = args[0]; persist(); render(); break;
    case 'decision-prev': ui.decision = Math.max(0, ui.decision - 1); render(); break;
    case 'decision-next': ui.decision = (ui.decision + 1) % decisions.length; render(); break;
    case 'set-day': state.day = Number(args[0]); persist(); render(); toast(`Day ${state.day} is your current focus.`); break;
    case 'set-pace': state.pace = args[0]; persist(); location.hash = '/lab/'+nextUnfinished().id; toast('Essential scenes are prioritized. All chapters remain open.'); break;
    case 'start-mock': startMock(args[0]); break;
    case 'mock-timer': runTimer(); break;
    case 'mock-reset-time': pauseMock(); mock.remaining = 90; render(); break;
    case 'mock-reveal': pauseMock(); mock.revealed = !mock.revealed; render(); break;
    case 'mock-rate': { const id = mock.ids[mock.index]; mock.ratings[id] = args[0]; state.confidence[id] = args[0]; persist(); render(); break; }
    case 'mock-prev': navigateMock(-1); break;
    case 'mock-next': navigateMock(1); break;
    case 'export': exportProgress(); break;
    case 'import': $('#import-file').click(); break;
    case 'reset-dialog': modal('Reset this device’s progress?', `<div class="node-detail"><p>This clears completed scenes, notes, code drafts, saved items, and self-ratings in this browser. Export a backup first if you want to retain them.</p><div class="modal-actions">${button('close-modal', 'Keep my progress', 'btn btn-secondary')}${button('reset-confirm', 'Clear local progress', 'btn btn-danger')}</div></div>`); break;
    case 'reset-confirm': state = clearState(); pauseMock(); mock = null; ui.openQuestion = null; ui.simulation = null; closeModal(); location.hash = '/home'; render(); toast('Local progress cleared. You can start again.'); break;
  }
});
document.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'question-search') { ui.questionSearch = el.value; updateQuestions(); }
  if (el.id === 'global-search') $('#global-search-results').innerHTML = searchResults(el.value);
  if (el.dataset.note) { state.notes[el.dataset.note] = el.value; persist(); }
  if (el.dataset.draft) { state.drafts[el.dataset.draft] = el.value; persist(); }
  if (el.dataset.evidence) { state.evidence[el.dataset.evidence] = el.value; persist(); }
});
document.addEventListener('change', async event => {
  const el = event.target;
  const filters = { 'question-topic': 'questionTopic', 'question-type': 'questionType', 'question-level': 'questionLevel' };
  if (filters[el.id]) { ui[filters[el.id]] = el.value; updateQuestions(); }
  if (el.id === 'code-topic') { ui.codeTopic = el.value; render(); }
  if (el.id === 'depth-setting') { state.depth = el.value; persist(); render(); }
  if (el.id === 'pace-setting') { state.pace = el.value; persist(); render(); }
  if (el.id === 'import-file' && el.files[0]) {
    try {
      if (el.files[0].size > 2_000_000) throw new Error('Choose a progress backup smaller than 2 MB.');
      const imported = normalizeState(JSON.parse(await el.files[0].text()));
      imported.completed = imported.completed.filter(id => knownLessonIds.has(id));
      imported.completedCode = imported.completedCode.filter(id => challenges.some(c => c.id === id));
      imported.bookmarks = imported.bookmarks.filter(id => knownLessonIds.has(id) || knownQuestionIds.has(id));
      state = imported; persist(); closeModal(); render(); toast('Progress restored on this device.');
    } catch (error) { toast(error instanceof SyntaxError ? 'That file is not valid JSON. Choose a DataCraft progress backup.' : error.message); }
  }
});
document.addEventListener('keydown', event => {
  const editing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === 'Escape') { if ($('#modal-root').children.length) closeModal(); else if (ui.menu) { ui.menu = false; render(); } }
  if ((event.key === '/' && !editing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) { event.preventDefault(); openSearch(); }
  if ($('#modal-root').children.length && event.key === 'Tab') {
    const elements = [...$('#modal-root').querySelectorAll('button:not(:disabled), a, input:not([hidden]), select, textarea, [tabindex="0"]')].filter(n => n.offsetParent !== null);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (event.target.getAttribute('role') === 'tab' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault(); const tabs = ['watch', 'code', 'answer'];
    const index = tabs.indexOf(ui.tab);
    ui.tab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3];
    render({ focus: `tab-${ui.tab}` });
  }
});
window.addEventListener('hashchange', routeChanged);
window.addEventListener('beforeunload', () => { persist(); pauseMock(); stopAnimation(); stopWorkflow(); });
if (currentRoute().view === 'questions' && currentRoute().id) ui.openQuestion = currentRoute().id;
render();
