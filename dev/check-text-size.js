// Scan every frame for small text. HTML text < 15px or SVG text rendering < 14px is reported.
// Run: node dev/check-text-size.js [width] [height]
const { chromium } = require('playwright');
(async () => {
  const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript(() => { try { localStorage.setItem('iq.v2', JSON.stringify({ track: 'all' })); } catch (e) {} });
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href); await page.waitForTimeout(400);
  const small = {};
  let n = 0;
  for (let g = 0; g < 700; g++) {
    const res = await page.evaluate(() => {
      const out = [];
      const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
      document.querySelectorAll('body *').forEach(el => {
        if (el.closest('svg')) return;
        const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (!own || !vis(el)) return;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 15) out.push([el.tagName.toLowerCase() + '.' + (el.className && el.className.baseVal === undefined ? String(el.className).split(' ').join('.') : ''), fs, el.textContent.trim().slice(0, 30)]);
      });
      document.querySelectorAll('svg.graph text').forEach(t => {
        if (!t.textContent.trim() || !vis(t) || t.closest('.dim,.hide')) return;
        const svg = t.ownerSVGElement; const vb = svg.viewBox.baseVal; const scale = svg.getBoundingClientRect().width / vb.width;
        const fs = parseFloat(getComputedStyle(t).fontSize) * scale;
        if (fs < 14) out.push(['svg.' + t.getAttribute('class'), Math.round(fs * 10) / 10, t.textContent.trim().slice(0, 30)]);
      });
      return { out, label: document.querySelector('#next-label').textContent };
    });
    n++;
    res.out.forEach(([k, fs, t]) => { const key = k + ' @' + fs.toFixed(1); (small[key] = small[key] || { n: 0, ex: t }).n++; });
    if (res.label === 'Finish') break;
    await page.click('#next'); await page.waitForTimeout(25);
  }
  console.log('frames scanned:', n);
  Object.entries(small).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(String(v.n).padStart(4), k, '  e.g.', JSON.stringify(v.ex)));
  if (!Object.keys(small).length) console.log('no text below the thresholds');
  await browser.close();
})();
