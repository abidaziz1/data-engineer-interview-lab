/* Engine: builds the frame list, draws the chrome, handles Next/Back, XP, progress, menu. Boots last. */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var R = LAB.R, esc = LAB.esc, md = LAB.md, $ = LAB.$;
  var KEY = 'iq.v2';

  var DEFAULTS = { frame: null, xp: 0, seen: {}, ans: {}, ticks: {}, grades: {}, awarded: {}, track: 'standard', scale: 1, chosen: false };
  var saved = LAB.store.get(KEY, null) || {};
  var state = {};
  Object.keys(DEFAULTS).forEach(function (k) { state[k] = saved[k] !== undefined ? saved[k] : JSON.parse(JSON.stringify(DEFAULTS[k])); });

  var LEVEL = { fast: 1, standard: 2, all: 3 };
  if (state.track === 'full') state.track = 'standard';
  if (!LEVEL[state.track]) state.track = 'standard';
  function lvl() { return LEVEL[state.track] || 2; }

  var A = (LAB.app = {
    state: state,
    local: {},
    gctl: null,
    gctlScene: null,
    save: function () { LAB.store.set(KEY, state); },
    say: function (text, mood) {
      var b = $('#bubble');
      b.innerHTML = md(text);
      LAB.coach.mood(mood || 'happy');
      LAB.coach.talk(Math.min(3200, 600 + text.length * 22));
    },
    sceneById: function (id) { return byId[id]; },
    award: function (key, pts) {
      if (state.awarded[key]) return false;
      state.awarded[key] = 1;
      state.xp += pts;
      A.save();
      updateStats();
      var p = $('#xp-pop');
      p.textContent = '+' + pts + ' XP';
      p.classList.remove('go'); void p.offsetWidth; p.classList.add('go');
      return true;
    },
    celebrate: function () {
      var cols = ['#F59E0B', '#2563EB', '#16A34A', '#DB2777', '#7C3AED', '#0EA5E9'];
      for (var i = 0; i < 46; i++) {
        var d = document.createElement('i');
        d.className = 'confetti';
        d.style.left = Math.random() * 100 + 'vw';
        d.style.background = cols[i % cols.length];
        d.style.animationDelay = (Math.random() * 0.5) + 's';
        d.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
        document.body.appendChild(d);
        (function (el) { setTimeout(function () { el.remove(); }, 2600); })(d);
      }
    },
    render: function (refresh) { renderFrame(!!refresh); },
    goScene: function (id) {
      for (var i = 0; i < frames.length; i++) if (frames[i].sc.id === id) { go(i); return; }
      /* not in this track: open the full course, then jump */
      state.track = 'all'; A.save(); buildFrames();
      for (var j = 0; j < frames.length; j++) if (frames[j].sc.id === id) { go(j); return; }
    },
    hasMock: function (qid) {
      for (var i = 0; i < frames.length; i++) if (frames[i].sc.type === 'mock' && frames[i].sc.qid === qid) return true;
      return false;
    },
    missionMinutes: function (ci) {
      var t = 0;
      for (var i = 0; i < frames.length; i++) if (frames[i].ch === ci) t += frames[i].sec;
      return Math.max(1, Math.round(t / 60));
    },
    setTrack: function (t) {
      var key = frames[idx] ? frames[idx].key : null;
      state.track = t; state.chosen = true; A.save();
      buildFrames();
      var j = key ? findKey(key) : 0;
      idx = j >= 0 ? j : nearestAfter(key);
      renderFrame(false);
    },
    bindWidget: null,
    termCtl: null,
    timerId: null
  });

  var frames = [], idx = 0, byId = {}, lastScene = null, autoTimer = null;

  /* ---------- frames ---------- */
  function secOf(sc, i) {
    var r = R[sc.type];
    if (sc.type === 'qa') return [70, 45, 25][i];
    if (sc.type === 'mock') return [95, 35][i];
    if (sc.type === 'incident') return [50, 40, 45][i];
    return r.sec || 25;
  }
  function buildFrames() {
    frames = [];
    byId = {};
    LAB.chapters.forEach(function (ch) {
      ch.scenes.forEach(function (sc) {
        byId[sc.id] = sc;
        if ((sc.t || 3) > lvl()) return;
        var r = R[sc.type];
        var n = r.steps(sc);
        for (var i = 0; i < n; i++) frames.push({ ch: ch.index, sc: sc, i: i, n: n, key: sc.id + ':' + i, sec: secOf(sc, i) });
      });
    });
  }
  function findKey(key) {
    for (var i = 0; i < frames.length; i++) if (frames[i].key === key) return i;
    return -1;
  }
  function nearestAfter(key) {
    if (!key) return 0;
    var sid = key.split(':')[0], found = false;
    /* walk all scenes in order; return first included frame at or after the scene */
    for (var c = 0; c < LAB.chapters.length; c++) {
      var sc = LAB.chapters[c].scenes;
      for (var s = 0; s < sc.length; s++) {
        if (sc[s].id === sid) found = true;
        if (found) { var j = frames.findIndex(function (f) { return f.sc.id === sc[s].id; }); if (j >= 0) return j; }
      }
    }
    return frames.length - 1;
  }

  /* ---------- welcome screen (track choice) ---------- */
  R.welcome = {
    sec: 40,
    steps: function () { return 1; },
    say: function () { return 'Hi, I am Coach Sam. I will walk you through one project, start to finish, so you can explain every part of it in the interview. You only need the Next button. First, tell me how much time you have.'; },
    mood: function () { return 'cheer'; },
    hint: 'Pick a track. Then press Next.',
    render: function (box) {
      var c = trackCounts();
      function tr(key, mins, name, text, rec) {
        return '<button type="button" class="track' + (state.track === key ? ' on' : '') + '" data-t="' + key + '"><b>About ' + mins + '</b><span class="tname">' + name + (rec ? ' <i>recommended</i>' : '') + '</span><span>' + text + '</span></button>';
      }
      box.innerHTML = '<div class="welcome"><div class="w-title">Senior Data Engineer<br><span>Interview Quest</span></div>' +
        '<p class="w-sub">dbt Core &middot; Snowflake &middot; Airflow &middot; Python &middot; SQL &middot; CI/CD</p>' +
        '<div class="rhythm"><div class="rh see"><b>SEE</b><span>Watch the data move through the pipeline</span></div><div class="rh try"><b>TRY</b><span>Quizzes, bug hunts, coding problems</span></div><div class="rh say"><b>SAY</b><span>Answer interview questions out loud</span></div></div>' +
        '<h3 class="qh">How much time do you have?</h3><div class="tracks">' +
        tr('fast', c.fast, 'Fast track', 'The map, the key ideas, 3 mock questions.') +
        tr('standard', c.standard, 'Standard track', 'Core topics, coding problems, decisions, mock round.', true) +
        tr('all', c.all, 'Everything', 'Every lesson, drill and follow-up.') + '</div>' +
        '<p class="w-note">Switch any time from the Map button. Progress saves in this browser.</p></div>';
      Array.prototype.forEach.call(box.querySelectorAll('.track'), function (b) {
        b.onclick = function () { A.setTrack(b.getAttribute('data-t')); };
      });
    }
  };
  function trackCounts() {
    var tot = { 1: 0, 2: 0, 3: 0 };
    LAB.chapters.forEach(function (ch) {
      ch.scenes.forEach(function (sc) {
        var r = R[sc.type], n = r.steps(sc), t = sc.t || 3;
        for (var i = 0; i < n; i++) { var sx = secOf(sc, i); for (var k = t; k <= 3; k++) tot[k] += sx; }
      });
    });
    function fmt(sec) { var m = Math.round(sec / 60 / 5) * 5; return m >= 120 ? (Math.round(m / 30) / 2) + ' hours' : m + ' minutes'; }
    return { fast: fmt(tot[1]), standard: fmt(tot[2]), all: fmt(tot[3]), fastMin: Math.round(tot[1] / 60), standardMin: Math.round(tot[2] / 60), allMin: Math.round(tot[3] / 60) };
  }

  /* ---------- chrome ---------- */
  var SEG = { see: ['SEE', 'Watch'], try: ['TRY', 'Practice'], say: ['SAY', 'Interview'], meta: ['MISSION', ''] };
  var DEFAULT_TITLE = { quiz: 'Quick check', bug: 'Bug hunt', order: 'Put it in order', decide: 'Architecture decision', challenge: 'Coding round', incident: 'Incident drill', qa: 'Interview question', mock: 'Boss round', score: 'Your scorecard', recap: 'Mission recap', cheat: 'Cheat sheet', welcome: 'Welcome' };
  var LEVELS = ['Rookie', 'Pipeline Intern', 'Ingestion Engineer', 'dbt Developer', 'Macro Wizard', 'Snowflake Tuner', 'Data Modeler', 'SQL Slayer', 'Python Plumber', 'Airflow Operator', 'Quality Guardian', 'Release Captain', 'Incident Commander', 'Architect', 'Senior Data Engineer'];

  function completedMissions() {
    var n = 0;
    LAB.chapters.forEach(function (ch) {
      ch.scenes.forEach(function (sc) { if (sc.type === 'recap' && state.awarded['recap:' + sc.id]) n++; });
    });
    return n;
  }
  function minutesLeft() {
    var s = 0;
    for (var i = idx; i < frames.length; i++) s += frames[i].sec;
    return Math.max(1, Math.round(s / 60));
  }
  function updateStats() {
    $('#xp').textContent = state.xp;
    var done = completedMissions();
    $('#lvl').textContent = LEVELS[Math.min(done, LEVELS.length - 1)];
    if (frames.length) {
      $('#left').textContent = idx >= frames.length - 1 ? 'Done' : '~' + minutesLeft() + ' min left';
    }
  }
  function drawSegments() {
    var seen = state.seen, total = frames.length;
    var perCh = {};
    frames.forEach(function (f, i) { var c = perCh[f.ch] || (perCh[f.ch] = { n: 0, seen: 0, first: i }); c.n++; if (seen[f.key]) c.seen++; });
    var h = '';
    LAB.chapters.forEach(function (ch) {
      var c = perCh[ch.index]; if (!c) return;
      var cur = frames[idx] && frames[idx].ch === ch.index;
      h += '<button type="button" class="seg' + (cur ? ' cur' : '') + '" style="flex:' + c.n + '" data-first="' + c.first + '" title="' + esc((ch.n ? 'Mission ' + ch.n + ': ' : '') + ch.title) + '"><i style="width:' + Math.round(c.seen / c.n * 100) + '%"></i></button>';
    });
    $('#segs').innerHTML = h;
    Array.prototype.forEach.call($('#segs').querySelectorAll('.seg'), function (b) { b.onclick = function () { go(+b.getAttribute('data-first')); }; });
  }

  /* ---------- render a frame ---------- */
  function renderFrame(refresh) {
    var f = frames[idx];
    if (!f) return;
    var sc = f.sc, r = R[sc.type];
    var sameScene = lastScene === sc.id;
    if (!refresh) {
      stopAuto(!sameScene);
      clearInterval(A.timerId);
      if (A.termCtl) { A.termCtl.destroy(); A.termCtl = null; }
      A.bindWidget = null;
      Array.prototype.forEach.call(document.querySelectorAll('.confetti'), function (c) { c.remove(); });
    }
    var body = $('#stage-body');
    var keepDom = r.keep && sameScene;
    if (!refresh && !keepDom) { body.innerHTML = ''; body.classList.remove('dual'); A.gctl = null; A.gctlScene = null; }

    /* header of the stage */
    var segKey = sc.type === 'intro' ? 'meta' : (r.seg || 'see');
    var ch = LAB.chapters[f.ch];
    var chip = $('#seg-chip');
    chip.className = 'seg-chip s-' + segKey;
    chip.textContent = SEG[segKey][0];
    var title = sc.title || (sc.type === 'intro' ? 'Mission ' + sc.n + ': ' + sc.title : DEFAULT_TITLE[sc.type] || '');
    if (sc.type === 'intro') title = ch.n ? 'Mission ' + ch.n + ': ' + ch.title : ch.title;
    $('#stage-title').textContent = title;
    $('#crumb').textContent = ch.n ? 'Mission ' + ch.n + ' of ' + LAB.chapters.filter(function (c) { return c.n; }).length + '  ·  ' + ch.short : ch.short;

    r.render(body, sc, f.i, A, { same: keepDom || (refresh && r.keep) });

    if (!refresh) {
      var said = r.say(sc, f.i);
      if (said) A.say(said, r.mood ? (r.mood(sc, f.i) || 'happy') : 'happy');
      var hint = typeof r.hint === 'function' ? r.hint(sc, f.i) : r.hint;
      $('#hint').textContent = hint || 'Press Next.';
      state.frame = f.key;
      if (!state.seen[f.key]) { state.seen[f.key] = 1; A.award('seen:' + f.key, 1); }
      A.save();
      lastScene = sc.id;
      try { history.replaceState(null, '', '#' + f.key); } catch (e) { /* file:// in some browsers */ }
      window.scrollTo(0, 0);
    }

    /* footer */
    var last = idx >= frames.length - 1;
    var nl = r.nextLabel ? r.nextLabel(sc, f.i) : null;
    $('#next-label').textContent = last ? 'Finish' : (nl || 'Next');
    $('#back').disabled = idx === 0;
    var inCh = frames.filter(function (x) { return x.ch === f.ch; });
    var posIn = inCh.indexOf(f) + 1;
    $('#pos').textContent = 'Step ' + posIn + ' of ' + inCh.length;
    updateStats();
    drawSegments();
  }

  /* ---------- navigation ---------- */
  function go(i) {
    if (i < 0 || i >= frames.length) return;
    idx = i;
    renderFrame(false);
  }
  function next() {
    if (idx < frames.length - 1) go(idx + 1);
    else { A.celebrate(); openMenu(); }
  }
  function back() { if (idx > 0) go(idx - 1); }

  function stopAuto(force) {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    var b = document.querySelector('.btn-play'); if (b) b.textContent = 'Play all steps';
  }
  function toggleAuto() {
    if (autoTimer) { stopAuto(); return; }
    var b = document.querySelector('.btn-play'); if (b) b.textContent = 'Pause';
    autoTimer = setInterval(function () {
      var cur = frames[idx], nx = frames[idx + 1];
      if (!nx || nx.sc.id !== cur.sc.id) { stopAuto(); return; }
      idx++;
      var keep = autoTimer; /* renderFrame(false) calls stopAuto; restore it */
      renderFrame(false);
      autoTimer = keep;
      var pb = document.querySelector('.btn-play'); if (pb) pb.textContent = 'Pause';
    }, 4600);
  }

  /* ---------- menu ---------- */
  function openMenu() {
    var perCh = {};
    frames.forEach(function (f, i) { var c = perCh[f.ch] || (perCh[f.ch] = { n: 0, seen: 0, first: i }); c.n++; if (state.seen[f.key]) c.seen++; });
    var tcounts = trackCounts();
    var h = '<div class="menu-card" role="dialog" aria-label="Mission map"><div class="menu-h"><h2>Mission map</h2><button type="button" class="btn-sm" data-m="close">Close</button></div>' +
      '<div class="menu-tools"><span>Track:</span><button type="button" class="tg' + (state.track === 'fast' ? ' on' : '') + '" data-m="fast">Fast (' + tcounts.fast + ')</button><button type="button" class="tg' + (state.track === 'standard' ? ' on' : '') + '" data-m="standard">Standard (' + tcounts.standard + ')</button><button type="button" class="tg' + (state.track === 'all' ? ' on' : '') + '" data-m="all">Everything (' + tcounts.all + ')</button></div><div class="mlist">';
    LAB.chapters.forEach(function (ch) {
      var c = perCh[ch.index]; if (!c) return;
      var pct = Math.round(c.seen / c.n * 100);
      h += '<button type="button" class="mrow' + (frames[idx] && frames[idx].ch === ch.index ? ' cur' : '') + '" data-first="' + c.first + '"><span class="mn">' + (ch.n || 'Go') + '</span><span class="mt"><b>' + esc(ch.title) + '</b><small>' + esc(ch.blurb || '') + '</small></span><span class="mmin">' + A.missionMinutes(ch.index) + ' min</span><span class="mp"><i style="width:' + pct + '%"></i></span><span class="mpc">' + pct + '%</span></button>';
    });
    h += '</div><div class="menu-foot"><button type="button" class="btn-sm" data-m="reset">Reset all progress</button></div></div>';
    var o = $('#overlay');
    o.innerHTML = h;
    o.classList.add('open');
    Array.prototype.forEach.call(o.querySelectorAll('.mrow'), function (b) { b.onclick = function () { closeMenu(); go(+b.getAttribute('data-first')); }; });
    o.onclick = function (e) {
      var m = e.target.getAttribute && e.target.getAttribute('data-m');
      if (e.target === o || m === 'close') closeMenu();
      if (m === 'fast' || m === 'standard' || m === 'all') { closeMenu(); A.setTrack(m); }
      if (m === 'reset') {
        if (confirm('Erase all progress, XP and answers in this browser?')) { LAB.store.del(KEY); location.hash = ''; location.reload(); }
      }
    };
  }
  function closeMenu() { var o = $('#overlay'); o.classList.remove('open'); o.innerHTML = ''; }

  /* ---------- text size ---------- */
  function applyScale() {
    document.documentElement.style.setProperty('--scale', state.scale);
  }
  function bump(d) {
    state.scale = Math.max(0.85, Math.min(1.4, Math.round((state.scale + d) * 100) / 100));
    applyScale(); A.save();
  }

  /* ---------- global events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act');
    var f = frames[idx];
    if (act === 'run' && f) { A.local[f.sc.id + ':ran'] = true; renderFrame(true); }
    else if (act === 'replay' && A.termCtl) A.termCtl.replay();
    else if (act === 'skip' && A.termCtl) A.termCtl.skip();
    else if (act === 'auto') toggleAuto();
    else if (A.bindWidget) A.bindWidget(act, t);
  });
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ($('#overlay').classList.contains('open')) { if (e.key === 'Escape') closeMenu(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  });
  window.addEventListener('hashchange', function () {
    var k = decodeURIComponent(location.hash.slice(1));
    var j = findKey(k);
    if (j >= 0 && j !== idx) go(j);
  });

  /* ---------- boot ---------- */
  function boot() {
    LAB.coach.mount($('#coach-photo'));
    buildFrames();
    var start = decodeURIComponent((location.hash || '').slice(1)) || state.frame;
    var j = start ? findKey(start) : -1;
    idx = j >= 0 ? j : 0;
    applyScale();
    $('#next').onclick = next;
    $('#back').onclick = back;
    $('#menu-btn').onclick = openMenu;
    $('#fs-down').onclick = function () { bump(-0.08); };
    $('#fs-up').onclick = function () { bump(0.08); };
    renderFrame(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
