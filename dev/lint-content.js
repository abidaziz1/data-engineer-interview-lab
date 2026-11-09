// Content lint: code highlight ranges, ids, quiz indexes, answer lengths, and style rules.
// Run: node dev/lint-content.js   (add -v to print every highlighted line range)
const fs = require('fs'), path = require('path');
global.window = global; global.LAB = {};
const root = require('path').join(__dirname, '..', 'js') + '/';
const load = f => { (0, eval)(fs.readFileSync(root + f, 'utf8')); };
load('build.js');
const files = fs.readdirSync(root + 'content').filter(f => f.endsWith('.js')).sort();
files.forEach(f => load('content/' + f));
const verbose = process.argv.includes('-v');
let problems = 0;
const bad = (m) => { problems++; console.log('PROBLEM:', m); };

const BANNED = /\b(elevate[sd]?|hustle|revolutioniz\w*|fostering|reimagin\w*|subsequently|showcas\w*|profound\w*|groundbreaking|delve[sd]?|synerg\w*|insights?|whisper\w*|enablement|meanwhile|game[- ]?changer|deep[- ]dive|leverag\w*|unleash\w*|harness\w*|paradigm\w*|ecosystem\w*|cross-functional|think outside the box|touch ?points?|across different|human oversight|to bridge|highlight\w*)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}]/u;
const strings = [];
(function walk(o, p) {
  if (typeof o === 'string') strings.push([p, o]);
  else if (Array.isArray(o)) o.forEach((x, i) => walk(x, p + '[' + i + ']'));
  else if (o && typeof o === 'object') Object.keys(o).forEach(k => walk(o[k], p + '.' + k));
})(LAB.chapters, 'ch');
strings.forEach(([p, s]) => {
  // code blocks legitimately contain anything; only lint prose fields
  if (/\.(code|sol|starter|fix|compiled\.code)$/.test(p) || /\.compiled$/.test(p)) { if (/—/.test(s)) bad('em dash in code ' + p); return; }
  let m;
  if ((m = s.match(BANNED))) bad('banned word "' + m[0] + '" at ' + p + ': ' + s.slice(0, 80));
  if (/—| – | -- /.test(s)) bad('dash at ' + p + ': ' + s.slice(0, 80));
  if (EMOJI.test(s)) bad('emoji at ' + p);
  if (/\bnot only\b/i.test(s)) bad('"not only" at ' + p);
  if (/\bThat's not\b|\bThat is not\b.*\bIt's\b/.test(s)) bad('"That is not X. It is Y" at ' + p + ': ' + s.slice(0, 80));
  if (/(^|[.!?] )From [^.,]{1,50} to /.test(s)) bad('"From X to Y" at ' + p + ': ' + s.slice(0, 80));
  if (/Why it matters/i.test(s)) bad('Why it matters at ' + p);
});

const ids = new Set();
let frames = 0, perType = {};
LAB.chapters.forEach(ch => {
  ch.scenes.forEach(sc => {
    if (ids.has(sc.id)) bad('duplicate id ' + sc.id); ids.add(sc.id);
    perType[sc.type] = (perType[sc.type] || 0) + 1;
    const where = ch.id + '/' + sc.id;
    if ((sc.type === 'code' || sc.type === 'sql') && sc.steps) {
      const n = sc.code.split('\n').length;
      sc.steps.forEach((st, i) => {
        if (st.lines) {
          if (st.lines[0] < 1 || st.lines[1] > n || st.lines[0] > st.lines[1]) bad(where + ' step ' + i + ' lines out of range ' + st.lines + ' of ' + n);
          else if (verbose) console.log(where, 'step', i, st.lines, '=>', JSON.stringify(sc.code.split('\n')[st.lines[0] - 1]), '...', JSON.stringify(sc.code.split('\n')[st.lines[1] - 1]));
        }
        if (st.clines && sc.compiled) { const m = sc.compiled.code.split('\n').length; if (st.clines[1] > m) bad(where + ' clines out of range'); }
      });
      if (sc.type === 'sql' && sc.result && !sc.steps.some(s => s.run)) bad(where + ' sql result but no run step');
    }
    if (sc.type === 'bug') {
      const n = sc.code.split('\n').length;
      [].concat(sc.bad).forEach(b => { if (b < 1 || b > n) bad(where + ' bug line out of range'); else if (verbose) console.log(where, 'bug line', b, JSON.stringify(sc.code.split('\n')[b - 1])); });
    }
    if (sc.type === 'quiz') { if (sc.ok == null || sc.ok >= sc.opts.length) bad(where + ' quiz ok index'); if (!sc.why) bad(where + ' quiz needs why'); }
    if (sc.type === 'decide') { if (sc.pick == null || sc.pick >= sc.opts.length) bad(where + ' decide pick'); }
    if (sc.type === 'incident') { if (sc.best == null || sc.best >= sc.opts.length) bad(where + ' incident best'); }
    if (sc.type === 'qa') {
      if (!sc.pts || !sc.pts.length) bad(where + ' qa needs pts'); if (!sc.short) bad(where + ' qa needs short');
      const wc = s => s.trim().split(/\s+/).length;
      const w = wc(sc.short); if (w > 190) bad(where + ' short answer too long for 60s: ' + w + ' words'); if (verbose) console.log(where, 'short words', w, 'long words', sc.long ? wc(sc.long) : '-');
      if (sc.long && wc(sc.long) > 380) bad(where + ' long answer too long for 2 min: ' + wc(sc.long));
    }
    if (sc.type === 'order') { if (!sc.items || sc.items.length < 3) bad(where + ' order items'); }
    if (sc.type === 'flow' && !require('fs').existsSync) {}
  });
});
console.log('chapters:', LAB.chapters.length, 'scenes:', ids.size, JSON.stringify(perType));
console.log(problems ? problems + ' problem(s)' : 'lint clean');
process.exit(problems ? 1 : 0);
