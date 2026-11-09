// End-to-end behaviour test: every interactive element, with assertions.
// Needs Playwright:  npm install playwright && npx playwright install chromium
// Run: node dev/e2e.js
const { chromium } = require('playwright');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', d => d.accept());
  await page.addInitScript(() => { try { if (!localStorage.getItem('iq.v2')) localStorage.setItem('iq.v2', JSON.stringify({ track: 'all' })); } catch (e) {} });
  const url = require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href;
  await page.goto(url); await page.waitForTimeout(400);
  const go = async (key) => { await page.evaluate(k => { location.hash = k; }, key); await page.waitForTimeout(350); };
  const xp = () => page.evaluate(() => LAB.app.state.xp);
  const $count = (sel) => page.$$eval(sel, e => e.length);
  const text = (sel) => page.$eval(sel, e => e.textContent);

  console.log('welcome + tracks');
  ok(await $count('.track') === 3, 'three track cards shown');
  await page.click('.track[data-t="fast"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => LAB.app.state.track) === 'fast', 'fast track selected');
  const nFast = await page.evaluate(() => { let n = 0; LAB.chapters.forEach(c => c.scenes.forEach(s => { if (s.t <= 1) n++; })); return n; });
  await page.click('.track[data-t="all"]'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => LAB.app.state.track) === 'all', 'everything track selected');

  console.log('quiz'); await go('m1-q1:0');
  const xp0 = await xp();
  await page.click('.opt[data-k="0"]'); await page.waitForTimeout(150);
  ok(await $count('.opt.wrong') === 1 && await $count('.callout.bad') === 1, 'wrong answer marked with feedback');
  await page.click('.opt[data-k="1"]'); await page.waitForTimeout(150);
  ok(await $count('.opt.right') === 1 && await $count('.callout.good') === 1, 'right answer marked');
  ok(await xp() > xp0, 'XP awarded for quiz');

  console.log('bug hunt'); await go('m2-bug:0');
  await page.click('.ln.clk[data-n="3"]'); await page.waitForTimeout(150);
  ok(await $count('.callout.bad') === 1, 'wrong line gives feedback');
  await page.click('.ln.clk[data-n="9"]'); await page.waitForTimeout(150);
  ok(await $count('.callout.good') === 1 && await $count('.ln.bugline') >= 1, 'correct line found, bug shown');
  ok(await $count('.fixh') >= 1, 'fix shown');

  console.log('order game'); await go('m1-order:0');
  const items = await page.evaluate(() => LAB.app.sceneById('m1-order').items);
  for (const it of items) { await page.click('.chip-btn:not(.used):has-text("' + it.replace(/"/g, '\\"') + '")'); await page.waitForTimeout(60); }
  ok(await $count('.order-list li.filled') === items.length && await $count('.callout.good') === 1, 'all steps placed in order');
  await go('m1-order:0');

  console.log('decision'); await go('m8-dec:0');
  await page.click('.dopt[data-k="0"]'); await page.waitForTimeout(150);
  ok(await $count('.verdict .pick') === 1, 'coach pick revealed after choosing');
  ok((await text('.verdict')).includes('Tasks cannot run Python'), 'shows why the chosen option loses');

  console.log('coding challenge'); await go('m6-c1:0');
  await page.click('[data-c="hint"]'); await page.click('[data-c="hint"]'); await page.waitForTimeout(150);
  ok(await $count('.hints .callout') === 2, 'two hints revealed one at a time');
  await page.click('[data-c="sol"]'); await page.waitForTimeout(150);
  ok(await $count('.solution .code') === 1 && await $count('.solution .result .tbl') === 1, 'solution and result table shown');
  await page.click('[data-c="got"]'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => LAB.app.state.grades['c:m6-c1']) === 2, 'self-grade stored');

  console.log('interview Q&A'); await go('qa-wf-project:0');
  await page.click('[data-q="timer"]'); await page.waitForTimeout(1300);
  ok((await text('.timer-out')).includes('s left'), 'timer counts down');
  await page.click('#next'); await page.waitForTimeout(200);
  ok(await $count('.answer') === 1, 'model answer shown on step 2');
  await page.click('[data-q="mode"][data-v="long"]'); await page.waitForTimeout(150);
  ok((await text('.answer')).length > 900, '2-minute answer is longer');
  await page.check('[data-pt="0"]'); await page.waitForTimeout(100);
  ok((await text('.cnt')).startsWith('1 of'), 'key point tick updates counter');
  await page.click('#next'); await page.waitForTimeout(200);
  await page.click('details.fu summary'); await page.waitForTimeout(100);
  ok(await page.$eval('details.fu', d => d.open), 'follow-up opens');
  ok(await $count('.callout.warn') >= 1, 'common mistake box shown');

  console.log('incident'); await go('m11-i1:0');
  await page.click('.opt[data-k="0"]'); await page.waitForTimeout(100);
  ok(await $count('.callout.bad') === 1, 'wrong first move explained');
  await page.click('.opt[data-k="1"]'); await page.waitForTimeout(100);
  ok(await $count('.callout.good') === 1, 'right first move accepted');
  await page.click('#next'); await page.waitForTimeout(200);
  ok(await $count('.triage li') >= 5, 'triage checklist shown');
  await page.click('#next'); await page.waitForTimeout(200);
  ok(await $count('.say') === 1, 'interview script shown');

  console.log('mock round + scorecard'); await go('mock-qa-wf-project:0');
  await page.click('#next'); await page.waitForTimeout(200);
  await page.click('[data-g="3"]'); await page.waitForTimeout(100);
  ok(await page.evaluate(() => LAB.app.state.grades['m:qa-wf-project']) === 3, 'grade saved');
  await go('mock-score:0');
  ok(await $count('.scorebig') === 1 && await $count('.srow') >= 3, 'scorecard lists the questions');
  ok((await text('.scorebig')).includes('%'), 'scorecard shows a percentage');

  console.log('widgets'); await go('m5-prune:0');
  await page.click('[data-act="pr-run"]'); await page.waitForTimeout(150);
  ok((await text('.prune-res')).includes('11 of 12'), 'unclustered table scans 11 of 12 partitions');
  await page.click('[data-act="pr-mode"][data-v="clu"]'); await page.click('[data-act="pr-run"]'); await page.waitForTimeout(150);
  ok((await text('.prune-res')).includes('1 of 12'), 'clustered table scans 1 of 12 partitions');
  await go('m9-mask:0');
  ok((await text('.result')).includes('XXX-XX-5678'), 'analyst sees masked SSN');
  await page.click('[data-act="mk-role"][data-v="PII_READER"]'); await page.waitForTimeout(150);
  ok((await text('.result')).includes('912-34-5678'), 'PII_READER sees clear SSN');

  console.log('sql worksheet'); await go('m5-tt:0');
  ok(await $count('.result') === 0, 'result hidden before Run');
  await page.click('[data-act="run"]'); await page.waitForTimeout(150);
  ok(await $count('.result .tbl') === 1, 'result appears after Run');

  console.log('terminal + lineage'); await go('m3-fail:0'); await page.waitForTimeout(500);
  await page.click('[data-act="skip"]'); await page.waitForTimeout(200);
  ok(await $count('.tl-err') >= 2, 'failure lines printed in red');
  ok(await $count('.graph .node.st-fail') >= 1 && await $count('.graph .node.st-skip') >= 1, 'lineage shows failed and skipped nodes');
  await page.click('[data-act="replay"]'); await page.waitForTimeout(400);
  ok(await $count('.tl') >= 1, 'replay restarts the terminal');
  await go('m8-runfail:0'); await page.waitForTimeout(300); await page.click('[data-act="skip"]'); await page.waitForTimeout(200);
  ok(await $count('.graph .node.st-retry') + await $count('.graph .node.st-ok') >= 5, 'Airflow DAG nodes colored');

  console.log('animated flow'); await go('m1-hops:2'); await page.waitForTimeout(400);
  ok(await $count('.graph .edge.on') >= 1 && await $count('.graph .pk') >= 1, 'active edge has moving packets');
  ok(await $count('.graph .pk.pill') === 1, 'tracked pill is moving');
  const animated = await page.evaluate(() => { const g = document.querySelector('.graph .pk'); return !!g && !!g.querySelector('animateMotion'); });
  ok(animated, 'packets use SMIL motion along the edge path');
  await go('m1-map:0'); await page.click('.btn-play'); await page.waitForTimeout(5200);
  ok((await page.evaluate(() => location.hash)).includes('m1-map:1'), 'Play all advances to the next step');
  await page.click('.btn-play'); 

  console.log('navigation + chrome'); await go('m1-map:0');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
  ok((await page.evaluate(() => location.hash)).includes('m1-map:1'), 'right arrow = next');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(250);
  ok((await page.evaluate(() => location.hash)).includes('m1-map:0'), 'left arrow = back');
  const s0 = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.click('#fs-up'); await page.waitForTimeout(100);
  const s1 = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  ok(parseFloat(s1) > parseFloat(s0), 'A+ makes text bigger (' + s0 + ' to ' + s1 + ')');
  await page.click('#fs-down'); await page.click('#fs-down');
  await page.click('#menu-btn'); await page.waitForTimeout(200);
  ok(await $count('.menu-card .mrow') === 15, 'map lists all 15 missions');
  await page.click('.menu-card [data-m="fast"]'); await page.waitForTimeout(300);
  const fastFrames = await page.evaluate(() => document.querySelectorAll('#segs .seg').length);
  ok(await page.evaluate(() => LAB.app.state.track) === 'fast', 'map switches track to fast');
  await page.click('#menu-btn'); await page.waitForTimeout(150);
  await page.click('.menu-card .mrow:nth-child(6)'); await page.waitForTimeout(300);
  ok((await text('#crumb')).includes('Mission 5'), 'map jumps to a mission');
  await page.click('#menu-btn'); await page.click('.menu-card [data-m="all"]'); await page.waitForTimeout(300);

  console.log('persistence + reset');
  await page.evaluate(() => { location.hash = 'm4-q1:0'; }); await page.waitForTimeout(300);
  await page.reload(); await page.waitForTimeout(400);
  ok((await page.evaluate(() => location.hash)).includes('m4-q1:0'), 'reload returns to the same step');
  ok(await xp() > 0, 'XP persisted');
  await page.click('#menu-btn'); await page.click('[data-m="reset"]'); await page.waitForTimeout(600);
  ok(await xp() <= 2, 'reset clears progress (only the welcome screen XP remains)');

  console.log('last frame'); await page.evaluate(() => { location.hash = 'm14-recap:0'; }); await page.waitForTimeout(300);
  ok((await text('#next-label')) === 'Finish', 'last step says Finish');

  ok(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
