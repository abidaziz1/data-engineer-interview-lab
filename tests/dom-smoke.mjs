// Optional DOM interaction check (not a visual browser test).
// npm install --no-save happy-dom, then node tests/dom-smoke.mjs
// Or set DATACRAFT_DOM_MODULE to an existing happy-dom/lib/index.js.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { lessons } from '../src/content/curriculum.js';
import { challenges } from '../src/content/coding.js';
const modulePath = process.env.DATACRAFT_DOM_MODULE;
const { Window } = await import(modulePath ? pathToFileURL(modulePath).href : 'happy-dom');
const window = new Window({ url: 'https://example.test/interview-lab/', settings: { disableJavaScriptFileLoading: true, disableJavaScriptEvaluation: true, disableCSSFileLoading: true } });
window.document.body.innerHTML = '<div id="app"></div><div id="toast"></div><div id="modal-root"></div>';
for (const name of ['window', 'document', 'location', 'history', 'localStorage', 'navigator', 'Blob', 'FileReader']) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
globalThis.requestAnimationFrame = cb => setTimeout(cb, 0);
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
const errors = [];
window.addEventListener('error', event => errors.push(event.error));
await import(process.env.DATACRAFT_ENTRYPOINT ? pathToFileURL(process.env.DATACRAFT_ENTRYPOINT).href : '../src/app.js');
const tick = () => new Promise(resolve => setTimeout(resolve, 8));
const route = async value => { window.location.hash = `#/${value}`; await tick(); };
const click = async action => { const el = window.document.querySelector(`[data-action="${action}"]`); assert.ok(el, `missing action ${action}`); el.click(); await tick(); };
const text = () => window.document.querySelector('#main').textContent;

assert.ok(text().includes('A production pipeline.'));
await click('journey:today'); assert.equal(window.document.querySelectorAll('.module-card').length, 2);
await click('journey:all'); assert.equal(window.document.querySelectorAll('.module-card').length, 10);

for (const lesson of lessons) {
  await route(`lab/${lesson.id}`);
  assert.equal(window.document.querySelector('#lesson-title').textContent, lesson.title);
  for (const tab of ['code', 'answer', 'watch']) { await click(`tab:${tab}`); assert.ok(window.document.querySelector('#lesson-panel').textContent.trim()); }
}
await route('lab/advanced-incremental');
await click('simulate:replay'); assert.ok(window.document.querySelector('.stage-metrics').textContent.includes('$3,000'));
await click('simulate:correction'); assert.ok(window.document.querySelector('.stage-metrics').textContent.includes('$3,700'));
await click('simulate:repair'); assert.ok(window.document.querySelector('.stage-metrics').textContent.includes('$4,050'));
await click('inspect-node:2'); assert.ok(window.document.querySelector('[role="dialog"]').textContent.includes('dbt staging'));
await click('close-modal');
await route('lab/story-intro'); await click('next:story-intro:story-grain');
assert.equal(window.document.querySelector('#lesson-title').textContent, lessons[1].title);
assert.ok(JSON.parse(window.localStorage.getItem('datacraft-interview-v1')).completed.includes('story-intro'));
await click('bookmark:story-grain'); await route('home'); assert.ok(window.document.querySelector('.saved-scenes').textContent.includes('Write the contract'));
await route('lab/airflow-dag'); await click('run-workflow');
await new Promise(resolve => setTimeout(resolve, 2800));
assert.ok(window.document.querySelector('.workflow-log').textContent.includes('Publication blocked'));
assert.ok(window.document.querySelector('.task-node.failed'));
await click('simulate:repair'); await click('run-workflow');
await new Promise(resolve => setTimeout(resolve, 4500));
assert.equal(window.document.querySelectorAll('.task-node.success').length, 5);
assert.ok(window.document.querySelector('.workflow-log').textContent.includes('pointer advanced'));

await route('questions/q-advanced-incremental'); assert.ok(window.document.querySelector('.question-answer'));
await click('confidence:q-advanced-incremental:confident');
await click('bookmark:q-advanced-incremental');
await click('question-scope:saved'); assert.equal(window.document.querySelectorAll('.question-card').length, 1);
await click('reset-filters');
const search = window.document.querySelector('#question-search'); search.value = 'DOES_NOT_EXIST_123'; search.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.ok(window.document.querySelector('.empty-state'));
await click('reset-filters');
const topic = window.document.querySelector('#question-topic'); topic.value = 'snowflake'; topic.dispatchEvent(new window.Event('change', { bubbles: true }));
assert.ok([...window.document.querySelectorAll('.question-card .question-tags')].every(el => el.textContent.includes('Snowflake')));

for (const challenge of challenges) {
  await route(`code/${challenge.id}`); await click('code-hint'); await click('code-reveal');
  for (let i = 0; i < challenge.walkthrough.length; i++) await click('code-next');
  assert.ok(window.document.querySelectorAll('.code-line.highlight').length > 0);
  await click(`code-complete:${challenge.id}`);
}
await route('architecture'); await click('decision:0'); assert.ok(window.document.querySelector('.decision-result'));
for (let i = 0; i < 8; i++) { await click('decision:1'); await click('decision-next'); }
await route('resume'); assert.equal(window.document.querySelectorAll('.story-card').length, 3);
const evidence = window.document.querySelector('[data-evidence="citi-accuracy"]'); evidence.value = '<script>unsafe()</script>'; evidence.dispatchEvent(new window.Event('input', { bubbles: true }));
await route('plan'); assert.equal(window.document.querySelectorAll('.day-card').length, 5); await click('set-day:3');
await route('resume'); assert.equal(window.document.querySelector('[data-evidence="citi-accuracy"]').value, '<script>unsafe()</script>');
assert.equal(window.document.querySelectorAll('script').length, 0, 'notes must not become HTML');

await click('search'); const globalSearch = window.document.querySelector('#global-search'); globalSearch.value = 'incremental'; globalSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.ok(window.document.querySelectorAll('.search-result').length > 0); await click('close-modal');
await click('settings'); assert.ok(window.document.querySelector('#pace-setting')); await click('close-modal');
await route('questions'); await click('start-mock:balanced');
await click('mock-timer'); await click('mock-timer');
for (let i = 0; i < 12; i++) { await click('mock-reveal'); await click('mock-rate:confident'); await click('mock-next'); }
assert.ok(text().includes('You’ve made another pass.'));
assert.ok(JSON.parse(window.localStorage.getItem('datacraft-interview-v1')).mockHistory.length === 1);
assert.deepEqual(errors, []);
console.log(`DOM smoke passed: ${lessons.length} scenes × 3 perspectives, ${challenges.length} coding solutions, blocked / repaired workflow playback, fixtures, filters, notes, decisions, search, persistence, and a 12-question mock.`);
window.dispatchEvent(new window.Event('beforeunload'));
await window.happyDOM.close();
