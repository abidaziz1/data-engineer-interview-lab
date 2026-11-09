/* Scene renderers, part 2: interactive scenes (TRY and SAY). */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var R = LAB.R, H = LAB.H;
  var esc = LAB.esc, md = LAB.md, mdb = LAB.mdBlock;
  var LET = ['A', 'B', 'C', 'D', 'E', 'F'];

  function ansOf(A, id) { return A.state.ans[id] || (A.state.ans[id] = { tries: 0, ok: false }); }
  function optText(o) { return typeof o === 'string' ? o : o.t; }
  function optFb(o) { return typeof o === 'string' ? '' : (o.fb || ''); }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  /* ------------------------------ QUIZ ------------------------------ */
  R.quiz = {
    sec: 35, seg: 'try',
    steps: function () { return 1; },
    say: function (s) { return s.say || 'Pick one answer. You can try again if you miss.'; },
    mood: function () { return 'think'; },
    hint: 'Tap an answer.',
    render: function (box, s, i, A) {
      var a = ansOf(A, s.id);
      var h = '<div class="quiz"><h2 class="qtext">' + md(s.q) + '</h2>';
      if (s.code) h += H.code({ file: s.file || '', lang: s.lang || 'sql', code: s.code });
      h += '<div class="opts">' + s.opts.map(function (o, k) {
        var cls = 'opt' + (a.ok && k === s.ok ? ' right' : '') + (a.wrong && a.wrong.indexOf(k) >= 0 ? ' wrong' : '');
        return '<button type="button" class="' + cls + '" data-k="' + k + '"' + (a.ok ? ' disabled' : '') + '><span class="L">' + LET[k] + '</span><span class="ot">' + md(optText(o)) + '</span></button>';
      }).join('') + '</div><div class="fb">' + (a.ok ? '<div class="callout good"><b>Correct.</b> ' + md(s.why) + '</div>' : (a.last != null ? '<div class="callout bad">' + md(optFb(s.opts[a.last]) || 'Not that one. Read the options again.') + '</div>' : '')) + '</div></div>';
      box.innerHTML = h;
      H.bindCode(box, s.code || '');
      Array.prototype.forEach.call(box.querySelectorAll('.opt'), function (b) {
        b.onclick = function () {
          var k = +b.getAttribute('data-k');
          if (a.ok) return;
          if (k === s.ok) {
            a.ok = true; a.last = null;
            A.award(s.id, a.tries === 0 ? 10 : 5);
            A.save();
            A.say('Correct. ' + (s.cheer || 'That is the answer an interviewer wants to hear.'), 'cheer');
            A.render(true);
          } else {
            a.tries++; a.wrong = (a.wrong || []).concat([k]); a.last = k;
            A.save();
            A.say(s.miss || 'Not quite. Read the feedback under the answers and try another one.', 'oops');
            A.render(true);
            var nb = box.querySelector('.opt[data-k="' + k + '"]'); if (nb) shake(nb);
          }
        };
      });
    }
  };

  /* ------------------------------ BUG HUNT ------------------------------ */
  R.bug = {
    sec: 45, seg: 'try',
    steps: function () { return 1; },
    say: function (s) { return s.say || 'There is a bug in this code. Click the line that causes it.'; },
    mood: function () { return 'think'; },
    hint: 'Click the buggy line.',
    render: function (box, s, i, A) {
      var a = ansOf(A, s.id);
      var bad = [].concat(s.bad);
      var h = '<div class="bug"><h2 class="qtext">' + md(s.q || 'Find the bug.') + '</h2>' +
        H.code({ file: s.file, lang: s.lang, code: s.code, clickable: true }) +
        '<div class="fb">' + (a.ok ? '<div class="callout good"><b>Found it.</b> ' + md(s.why) + '</div>' + (s.fix ? '<div class="fixh">The fix</div>' + H.code({ file: s.file, lang: s.lang, code: s.fix }) : '') :
          (a.tries > 0 ? '<div class="callout bad">Not that line.' + (a.tries >= 2 && s.hint ? ' Hint: ' + md(s.hint) : ' Click again.') + '</div>' : '')) + '</div></div>';
      box.innerHTML = h;
      H.bindCode(box.querySelector('.bug .code') ? box : box, s.code);
      if (a.ok) bad.forEach(function (n) { var el = box.querySelector('.ln[data-n="' + n + '"]'); if (el) el.classList.add('bugline'); });
      Array.prototype.forEach.call(box.querySelectorAll('.code:not(.fixc) .ln.clk'), function (ln) {
        ln.onclick = function () {
          if (a.ok) return;
          var n = +ln.getAttribute('data-n');
          if (bad.indexOf(n) >= 0) {
            a.ok = true; A.award(s.id, a.tries === 0 ? 10 : 5); A.save();
            A.say('Yes, that line. ' + (s.cheer || 'Spotting this in review is exactly what a senior engineer does.'), 'cheer');
            A.render(true);
          } else {
            a.tries++; A.save();
            A.say('Not that line. ' + (a.tries >= 2 && s.hint ? 'Check the hint under the code.' : 'Read each line and ask what could go wrong at 3 AM.'), 'oops');
            A.render(true);
          }
        };
      });
    }
  };

  /* ------------------------------ ORDER ------------------------------ */
  R.order = {
    sec: 40, seg: 'try',
    steps: function () { return 1; },
    say: function (s) { return s.say || 'Tap the steps in the order they happen. Wrong taps do not cost XP, but the first clean run earns the most.'; },
    mood: function () { return 'think'; },
    hint: 'Tap the steps in order.',
    render: function (box, s, i, A) {
      var a = ansOf(A, s.id);
      var items = LAB.shuffle(s.items, s.id);
      var placed = a.placed || (a.placed = []);
      if (a.ok) placed = s.items.map(function (_, k) { return k; });
      var h = '<div class="order"><h2 class="qtext">' + md(s.q) + '</h2><div class="order-cols"><div class="order-pool">' +
        items.map(function (p) {
          var done = placed.indexOf(p[1]) >= 0;
          return '<button type="button" class="chip-btn' + (done ? ' used' : '') + '" data-o="' + p[1] + '"' + (done ? ' disabled' : '') + '>' + md(p[0]) + '</button>';
        }).join('') + '</div><ol class="order-list">' +
        s.items.map(function (it, k) {
          var done = placed.indexOf(k) >= 0;
          return '<li class="' + (done ? 'filled' : 'empty') + '">' + (done ? md(it) : '<span>step ' + (k + 1) + '</span>') + '</li>';
        }).join('') + '</ol></div><div class="fb">' + (a.ok ? '<div class="callout good"><b>Right order.</b> ' + md(s.why) + '</div>' : '') + '</div></div>';
      box.innerHTML = h;
      Array.prototype.forEach.call(box.querySelectorAll('.chip-btn'), function (b) {
        b.onclick = function () {
          var k = +b.getAttribute('data-o');
          if (a.ok) return;
          if (k === placed.length) {
            placed.push(k);
            if (placed.length === s.items.length) {
              a.ok = true; A.award(s.id, a.tries === 0 ? 10 : 5);
              A.say('Perfect order. ' + (s.cheer || 'Say it in this sequence and the interviewer hears a clear mental model.'), 'cheer');
            }
            A.save(); A.render(true);
          } else {
            a.tries++; A.save(); shake(b);
            A.say('That step comes later. What has to exist before it can run?', 'oops');
          }
        };
      });
    }
  };

  /* ------------------------------ DECIDE ------------------------------ */
  R.decide = {
    sec: 55, seg: 'try',
    steps: function () { return 1; },
    say: function (s) { return s.say || 'This is an architecture decision. Pick what you would do, then I will tell you what I would do and why.'; },
    mood: function () { return 'think'; },
    hint: 'Pick an option, then read the reasoning.',
    render: function (box, s, i, A) {
      var a = ansOf(A, s.id);
      var sel = a.sel;
      var h = '<div class="decide"><div class="scenario"><b>The situation</b>' + mdb(s.scenario) + '</div><div class="dopts">' +
        s.opts.map(function (o, k) {
          return '<button type="button" class="dopt' + (sel === k ? ' sel' : '') + (a.done && k === s.pick ? ' best' : '') + '" data-k="' + k + '"><span class="L">' + LET[k] + '</span><span><b>' + md(o.t) + '</b><br>' + md(o.d || '') + '</span></button>';
        }).join('') + '</div>';
      if (sel != null) {
        var ok = sel === s.pick;
        h += '<div class="verdict"><div class="callout ' + (ok ? 'good' : 'warn') + '"><b>' + (ok ? 'Same as my pick.' : 'You picked ' + LET[sel] + '. My pick is ' + LET[s.pick] + '.') + '</b> ' + md(sel === s.pick ? '' : (s.opts[sel].lose || '')) + '</div>' +
          '<div class="pick"><b>Coach\'s pick: ' + LET[s.pick] + '. ' + md(s.opts[s.pick].t) + '</b>' + mdb(s.why) + '</div>' +
          (s.when ? '<div class="when"><b>When another option wins</b>' + mdb(s.when) + '</div>' : '') + '</div>';
      }
      box.innerHTML = h + '</div>';
      Array.prototype.forEach.call(box.querySelectorAll('.dopt'), function (b) {
        b.onclick = function () {
          var k = +b.getAttribute('data-k');
          var first = a.sel == null;
          a.sel = k; a.done = true;
          if (first) A.award(s.id, k === s.pick ? 12 : 6);
          A.save();
          A.say(k === s.pick ? 'Good call. Now read why, so you can defend it out loud.' : 'Fair choice in some teams. Read why I pick differently here and when your choice would win.', k === s.pick ? 'cheer' : 'think');
          A.render(true);
        };
      });
    }
  };

  /* ------------------------------ CHALLENGE (coding problem) ------------------------------ */
  R.challenge = {
    sec: 140, seg: 'try',
    steps: function () { return 1; },
    say: function (s) { return s.say || 'Coding round. Read the problem and sketch your solution on paper or out loud. Use a hint if you are stuck. Then compare.'; },
    mood: function () { return 'think'; },
    hint: 'Try it first. Hints, then solution.',
    render: function (box, s, i, A) {
      var L = A.local, key = s.id;
      var st = L[key] || (L[key] = { hints: 0, sol: false });
      var g = A.state.grades['c:' + s.id];
      var h = '<div class="chal"><div class="prompt">' + mdb(s.q) + '</div>';
      if (s.data) {
        s.data.forEach(function (d) { h += '<div class="layer-h"><span class="lname">' + esc(d.name) + '</span></div>' + H.table(d.cols, d.rows, {}); });
      }
      if (s.starter) h += H.code({ file: 'your answer', lang: s.lang, code: s.starter });
      h += '<div class="chal-tools">';
      if (s.hints && s.hints.length) h += '<button type="button" class="btn-sm" data-c="hint"' + (st.hints >= s.hints.length ? ' disabled' : '') + '>' + (st.hints ? 'Next hint' : 'Show a hint') + '</button>';
      h += '<button type="button" class="btn-sm primary" data-c="sol">' + (st.sol ? 'Hide solution' : 'Show solution') + '</button></div>';
      if (st.hints) h += '<div class="hints">' + s.hints.slice(0, st.hints).map(function (x, k) { return '<div class="callout tip"><b>Hint ' + (k + 1) + '.</b> ' + md(x) + '</div>'; }).join('') + '</div>';
      if (st.sol) {
        h += '<div class="solution"><div class="fixh">Solution</div>' + H.code({ file: s.file || 'solution', lang: s.lang, code: s.sol });
        if (s.res) h += '<div class="result"><div class="result-h">Result <span>' + esc(s.res.msg || '') + '</span></div>' + H.table(s.res.cols, s.res.rows, {}) + '</div>';
        if (s.expl) h += '<ul class="notes">' + s.expl.map(function (x) { return '<li>' + md(x) + '</li>'; }).join('') + '</ul>';
        if (s.cx) h += '<div class="callout tip"><b>Say the complexity.</b> ' + md(s.cx) + '</div>';
        h += '<div class="rate"><span>How did it go?</span><button type="button" class="btn-sm' + (g === 2 ? ' on' : '') + '" data-c="got">I solved it</button><button type="button" class="btn-sm' + (g === 1 ? ' on' : '') + '" data-c="more">Needs more practice</button></div></div>';
      }
      box.innerHTML = h + '</div>';
      if (st.sol) H.bindCode(box.querySelector('.solution'), s.sol);
      Array.prototype.forEach.call(box.querySelectorAll('[data-c]'), function (b) {
        b.onclick = function () {
          var c = b.getAttribute('data-c');
          if (c === 'hint') st.hints++;
          if (c === 'sol') { st.sol = !st.sol; if (st.sol) A.say(s.solSay || 'Compare it with your approach. The point is the pattern, not matching my exact syntax.', 'happy'); }
          if (c === 'got') { A.state.grades['c:' + s.id] = 2; A.award('c:' + s.id, 10); A.save(); A.say('Nice. Move on while it is fresh.', 'cheer'); }
          if (c === 'more') { A.state.grades['c:' + s.id] = 1; A.save(); A.say('Marked for review. Come back to it at the end.', 'happy'); }
          A.render(true);
        };
      });
    }
  };

  /* ------------------------------ INCIDENT DRILL ------------------------------ */
  R.incident = {
    sec: 60, seg: 'say',
    steps: function () { return 3; },
    say: function (s, i) {
      return [s.say || 'Production incident. Read the alert, then choose your first move like you are on call.',
        'These are the checks in the order I would run them. Read each finding. Notice that the first checks are cheap and rule out whole areas.',
        'This is how you tell it in an interview: situation, what you did, result. Then add the prevention. The prevention is what separates seniors from the rest.'][i];
    },
    mood: function (s, i) { return i === 0 ? 'oops' : 'happy'; },
    hint: 'Choose your first move, then press Next.',
    render: function (box, s, i, A) {
      var a = ansOf(A, s.id);
      var h = '<div class="alertbox"><div class="alert-h"><span class="siren">ALERT</span><span>' + esc(s.time || '06:42') + '</span></div><p>' + md(s.alert) + '</p>' +
        (s.clues ? '<ul class="clues">' + s.clues.map(function (c) { return '<li>' + md(c) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      if (i === 0) {
        h += '<h3 class="qh">What do you do first?</h3><div class="opts">' + s.opts.map(function (o, k) {
          var cls = 'opt' + (a.ok && k === s.best ? ' right' : '') + (a.wrong && a.wrong.indexOf(k) >= 0 ? ' wrong' : '');
          return '<button type="button" class="' + cls + '" data-k="' + k + '"' + (a.ok ? ' disabled' : '') + '><span class="L">' + LET[k] + '</span><span class="ot">' + md(optText(o)) + '</span></button>';
        }).join('') + '</div><div class="fb">' + (a.ok ? '<div class="callout good"><b>Good first move.</b> ' + md(s.why) + '</div>' : (a.last != null ? '<div class="callout bad">' + md(optFb(s.opts[a.last])) + '</div>' : '')) + '</div>';
      } else if (i === 1) {
        h += '<h3 class="qh">Triage checklist</h3><ol class="triage">' + s.checks.map(function (c) { return '<li><b>' + md(c[0]) + '</b><span>' + md(c[1]) + '</span></li>'; }).join('') + '</ol>';
      } else {
        h += '<h3 class="qh">Say it like this</h3><div class="say">' + mdb(s.tell) + '</div><h3 class="qh">Then add the prevention</h3><ul class="notes">' + s.prevent.map(function (p) { return '<li>' + md(p) + '</li>'; }).join('') + '</ul>';
      }
      box.innerHTML = h;
      Array.prototype.forEach.call(box.querySelectorAll('.opt'), function (b) {
        b.onclick = function () {
          var k = +b.getAttribute('data-k');
          if (a.ok) return;
          if (k === s.best) { a.ok = true; A.award(s.id, a.tries === 0 ? 12 : 6); A.say('Right call. ' + (s.cheer || 'Cheap, fast checks first. Press Next for the full checklist.'), 'cheer'); }
          else { a.tries++; a.wrong = (a.wrong || []).concat([k]); a.last = k; A.say('Think about blast radius and speed. What rules out the most causes in the least time?', 'oops'); }
          A.save(); A.render(true);
        };
      });
    }
  };

  /* ------------------------------ Q&A (interview question) ------------------------------ */
  function timerBox(box, A, secs) {
    var out = box.querySelector('.timer-out'), bar = box.querySelector('.timer-bar i'), btn = box.querySelector('[data-q="timer"]');
    if (!btn) return;
    btn.onclick = function () {
      clearInterval(A.timerId);
      var left = secs;
      btn.disabled = true;
      function tick() {
        out.textContent = left + 's left';
        if (bar) bar.style.width = ((secs - left) / secs * 100) + '%';
        if (left <= 0) { clearInterval(A.timerId); out.textContent = 'Time. Press Next to see the model answer.'; btn.disabled = false; btn.textContent = 'Restart timer'; }
        left--;
      }
      tick();
      A.timerId = setInterval(tick, 1000);
    };
  }

  R.qa = {
    sec: 60, seg: 'say',
    steps: function () { return 3; },
    say: function (s, i) {
      return [s.say || 'Interview question. Answer out loud before you look at anything. That one habit is worth more than reading ten model answers.',
        'This is the version to aim for. It uses your resume, names the tools, and gives a reason for each choice. Tick the points you covered.',
        'Interviewers love follow-ups. Open each one and say your answer first. The warning box shows the mistake I hear most often.'][i];
    },
    mood: function (s, i) { return i === 0 ? 'think' : 'happy'; },
    hint: function (s) { return 'Say it out loud, then press Next.'; },
    nextLabel: function (s, i) { return i === 0 ? 'Show the model answer' : (i === 1 ? 'Show follow-ups' : null); },
    render: function (box, s, i, A) {
      var h = '';
      var secs = s.secs || 60;
      if (i === 0) {
        h += '<div class="qa-ask"><div class="who"><span class="who-badge">INTERVIEWER</span>' + (s.tag ? '<span class="tagchip">' + esc(s.tag) + '</span>' : '') + '</div>' +
          '<h2 class="qtext big">&ldquo;' + md(s.q) + '&rdquo;</h2>' +
          '<div class="think"><b>Your turn.</b> Say your answer out loud. Aim for about ' + secs + ' seconds.' +
          '<div class="timer"><button type="button" class="btn-sm" data-q="timer">Start ' + secs + '-second timer</button><span class="timer-bar"><i></i></span><span class="timer-out"></span></div></div>' +
          '<div class="expect"><b>Cover ' + s.pts.length + ' things.</b> Coach will list them on the next screen.</div></div>';
      } else if (i === 1) {
        var mode = A.local['qm:' + s.id] || 'short';
        var ticks = A.state.ticks[s.id] || (A.state.ticks[s.id] = {});
        var cnt = Object.keys(ticks).filter(function (k) { return ticks[k]; }).length;
        h += '<div class="qa-mini">&ldquo;' + md(s.q) + '&rdquo;</div>';
        h += '<div class="tabs2"><button type="button" class="tg' + (mode === 'short' ? ' on' : '') + '" data-q="mode" data-v="short">' + (s.shortLabel || '60-second answer') + '</button>' +
          (s.long ? '<button type="button" class="tg' + (mode === 'long' ? ' on' : '') + '" data-q="mode" data-v="long">2-minute answer</button>' : '') + '</div>';
        h += '<div class="answer">' + mdb(mode === 'long' && s.long ? s.long : s.short) + '</div>';
        h += '<div class="honest"><b>Keep it true.</b> This answer mixes facts from your resume with standard practice. Say only what you really did, and swap in your real tools and examples.</div>';
        h += '<div class="pts"><div class="pts-h">Did you cover these? <span class="cnt">' + cnt + ' of ' + s.pts.length + '</span></div>' +
          s.pts.map(function (p, k) { return '<label class="chk' + (ticks[k] ? ' on' : '') + '"><input type="checkbox" data-pt="' + k + '"' + (ticks[k] ? ' checked' : '') + '><span>' + md(p) + '</span></label>'; }).join('') + '</div>';
      } else {
        h += '<div class="qa-mini">&ldquo;' + md(s.q) + '&rdquo;</div>';
        if (s.fu && s.fu.length) {
          h += '<h3 class="qh">Likely follow-ups</h3>';
          s.fu.forEach(function (f) { h += '<details class="fu"><summary>' + md(f[0]) + '</summary><div class="fu-a">' + mdb(f[1]) + '</div></details>'; });
        }
        if (s.trap) h += '<div class="callout warn"><b>Common mistake.</b> ' + md(s.trap) + '</div>';
        if (s.real) h += '<div class="callout tip"><b>Make it yours.</b> ' + md(s.real) + '</div>';
      }
      box.innerHTML = h;
      if (i === 0) timerBox(box, A, secs);
      Array.prototype.forEach.call(box.querySelectorAll('[data-q="mode"]'), function (b) {
        b.onclick = function () { A.local['qm:' + s.id] = b.getAttribute('data-v'); A.render(true); };
      });
      Array.prototype.forEach.call(box.querySelectorAll('[data-pt]'), function (c) {
        c.onchange = function () {
          var ticks = A.state.ticks[s.id] || (A.state.ticks[s.id] = {});
          var k = c.getAttribute('data-pt');
          ticks[k] = c.checked;
          if (c.checked) A.award(s.id + ':pt' + k, 2);
          A.save();
          var cnt = Object.keys(ticks).filter(function (x) { return ticks[x]; }).length;
          var lab = c.closest('.chk'); if (lab) lab.classList.toggle('on', c.checked);
          var ce = box.querySelector('.cnt'); if (ce) ce.textContent = cnt + ' of ' + s.pts.length;
          if (cnt === s.pts.length) A.say('All ' + s.pts.length + ' points. That is a complete answer.', 'cheer');
        };
      });
    }
  };

  /* ------------------------------ MOCK ROUND ------------------------------ */
  R.mock = {
    sec: 90, seg: 'say',
    steps: function () { return 2; },
    say: function (s, i) {
      return i === 0 ? 'Boss round question ' + s.k + ' of ' + s.of + '. No notes. Answer out loud, then flip the card. Nobody is watching, so grade yourself harshly.'
        : 'Check the points you hit, then grade yourself. Honest grades make the final scorecard useful.';
    },
    mood: function (s, i) { return i === 0 ? 'think' : 'happy'; },
    hint: 'Answer out loud. Then press Next.',
    nextLabel: function (s, i) { return i === 0 ? 'Flip the card' : null; },
    render: function (box, s, i, A) {
      var q = A.sceneById(s.qid);
      var g = A.state.grades['m:' + s.qid];
      var h;
      if (i === 0) {
        h = '<div class="qa-ask boss"><div class="who"><span class="who-badge">BOSS ROUND ' + s.k + ' / ' + s.of + '</span><span class="tagchip">' + esc(q.tag || '') + '</span></div>' +
          '<h2 class="qtext big">&ldquo;' + md(q.q) + '&rdquo;</h2><div class="think"><b>No notes.</b> 90 seconds.<div class="timer"><button type="button" class="btn-sm" data-q="timer">Start 90-second timer</button><span class="timer-bar"><i></i></span><span class="timer-out"></span></div></div></div>';
      } else {
        h = '<div class="qa-mini">&ldquo;' + md(q.q) + '&rdquo;</div><div class="answer">' + mdb(q.short) + '</div><div class="pts"><div class="pts-h">Points to hit</div>' +
          q.pts.map(function (p) { return '<div class="chk static"><span>' + md(p) + '</span></div>'; }).join('') + '</div>' +
          '<div class="rate big"><span>Grade yourself:</span><button type="button" class="btn-sm' + (g === 3 ? ' on' : '') + '" data-g="3">Nailed it</button><button type="button" class="btn-sm' + (g === 2 ? ' on' : '') + '" data-g="2">Partly</button><button type="button" class="btn-sm' + (g === 1 ? ' on' : '') + '" data-g="1">Missed</button></div>';
      }
      box.innerHTML = h;
      if (i === 0) timerBox(box, A, 90);
      Array.prototype.forEach.call(box.querySelectorAll('[data-g]'), function (b) {
        b.onclick = function () {
          A.state.grades['m:' + s.qid] = +b.getAttribute('data-g');
          A.award('m:' + s.qid, 8); A.save(); A.render(true);
        };
      });
    }
  };

  /* ------------------------------ SCORECARD ------------------------------ */
  R.score = {
    sec: 60, seg: 'meta',
    steps: function () { return 1; },
    say: function () { return 'This is your honest scorecard. Anything marked Missed or Partly gets a Review button that jumps straight to the lesson.'; },
    mood: function () { return 'happy'; },
    hint: 'Use Review to jump back, then return here with the Map.',
    render: function (box, s, i, A) {
      var rows = [], total = 0, max = 0;
      s.qids.filter(function (id) { return A.hasMock(id); }).forEach(function (id) {
        var q = A.sceneById(id), g = A.state.grades['m:' + id] || 0;
        total += g; max += 3;
        rows.push([q, g]);
      });
      var pct = max ? Math.round(total / max * 100) : 0;
      var label = pct >= 85 ? 'Interview ready' : (pct >= 60 ? 'Close. Fix the red items.' : 'Review the red items, then retry the boss round.');
      var h = '<div class="scorebig"><div class="ring" style="--p:' + pct + '"><span>' + pct + '%</span></div><div><h2>' + label + '</h2><p>' + total + ' of ' + max + ' points from ' + rows.length + ' questions.</p></div></div><div class="scorelist">';
      rows.forEach(function (r) {
        var q = r[0], g = r[1];
        h += '<div class="srow g' + g + '"><span class="sg">' + (g === 3 ? 'Nailed' : g === 2 ? 'Partly' : g === 1 ? 'Missed' : 'Not graded') + '</span><span class="sq">' + md(q.q) + '</span>' +
          (g < 3 ? '<button type="button" class="btn-sm" data-go="' + q.id + '">Review</button>' : '') + '</div>';
      });
      box.innerHTML = h + '</div>';
      Array.prototype.forEach.call(box.querySelectorAll('[data-go]'), function (b) { b.onclick = function () { A.goScene(b.getAttribute('data-go')); }; });
    }
  };

  /* ------------------------------ RECAP (end of mission) ------------------------------ */
  R.recap = {
    sec: 30, seg: 'meta',
    steps: function () { return 1; },
    say: function (s) { return s.say || 'Mission complete. Read the lines below once more. They are the answers in their shortest form.'; },
    mood: function () { return 'cheer'; },
    hint: 'Press Next to start the next mission.',
    render: function (box, s, i, A) {
      var first = A.award('recap:' + s.id, 25);
      var h = '<div class="recap"><div class="badge"><svg viewBox="0 0 120 140" aria-hidden="true"><path d="M60 6 L112 24 V70 C112 100 90 124 60 134 C30 124 8 100 8 70 V24 Z" fill="var(--bc)" stroke="#0B1220" stroke-width="6" stroke-linejoin="round"/><text x="60" y="84" text-anchor="middle" font-size="52" font-weight="800" fill="#0B1220">' + esc(String(s.n)) + '</text></svg>' +
        '<div><div class="badge-t">Badge unlocked</div><div class="badge-n">' + esc(s.badge) + '</div></div></div>' +
        '<h3 class="qh">Remember</h3><ul class="notes big">' + s.pts.map(function (p) { return '<li>' + md(p) + '</li>'; }).join('') + '</ul>' +
        (s.lines ? '<h3 class="qh">Say these in the interview</h3><div class="say">' + s.lines.map(function (l) { return '<p>' + md(l) + '</p>'; }).join('') + '</div>' : '') + '</div>';
      box.innerHTML = h;
      box.querySelector('.badge').style.setProperty('--bc', s.color || '#FDE68A');
      if (first) A.celebrate();
    }
  };
})();
