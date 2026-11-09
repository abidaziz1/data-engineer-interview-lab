/* Scene renderers, part 1: explain-type scenes (SEE). Each renderer: steps(), say(), render(). */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var esc = LAB.esc, md = LAB.md, mdb = LAB.mdBlock;
  var R = (LAB.R = {});
  var H = (LAB.H = {});
  LAB.W = {};

  /* ---------- small HTML helpers ---------- */
  H.table = function (cols, rows, o) {
    o = o || {};
    var chg = {};
    (o.chg || []).forEach(function (p) { chg[p[0] + ',' + p[1]] = 1; });
    var h = '<div class="tbl-wrap"><table class="tbl' + (o.mono === false ? '' : ' mono') + '"><thead><tr>' +
      cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r, ri) {
      h += '<tr class="' + (o.trk === ri ? 'trk' : '') + '">' + r.map(function (c, ci) {
        var cls = (chg[ri + ',' + ci] ? 'chg ' : '') + (String(c) === 'NULL' ? 'nul' : '');
        return '<td class="' + cls + '">' + md(c) + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  };

  var LANG_LABEL = { sql: 'Snowflake SQL', jinja: 'dbt model (SQL + Jinja)', python: 'Python', py: 'Python', yaml: 'YAML', yml: 'YAML', bash: 'Terminal', sh: 'Terminal', docker: 'Dockerfile', dockerfile: 'Dockerfile', groovy: 'Jenkinsfile', json: 'JSON', text: 'Text' };

  H.code = function (o) {
    var lines = LAB.hl(o.code, o.lang);
    var on = o.hl;
    var h = '<div class="code' + (o.cls ? ' ' + o.cls : '') + '"><div class="code-head"><span class="file">' + esc(o.file || '') + '</span>' +
      '<span class="lang">' + esc(LANG_LABEL[o.lang] || o.lang) + '</span><button type="button" class="copy" data-act="copy">Copy</button></div>' +
      '<div class="code-body" tabindex="0">';
    lines.forEach(function (l, i) {
      var isOn = on && i + 1 >= on[0] && i + 1 <= on[1];
      h += '<div class="ln' + (isOn ? ' on' : '') + (o.clickable ? ' clk' : '') + '" data-n="' + (i + 1) + '"><span class="no">' + (i + 1) + '</span><span class="tx">' + (l || ' ') + '</span></div>';
    });
    return h + '</div></div>';
  };
  H.bindCode = function (box, code) {
    var b = box.querySelector('.copy');
    if (b) b.onclick = function () {
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1400); };
      try { navigator.clipboard.writeText(code).then(done, done); } catch (e) { done(); }
    };
    var on = box.querySelector('.ln.on'), body = box.querySelector('.code-body');
    if (on && body && body.scrollHeight > body.clientHeight) {
      body.scrollTop = Math.max(0, on.offsetTop - 70);
    }
  };

  var MAP1 = [['src', 'Sources'], ['ing', 'Python + S3 + Snowpipe'], ['raw', 'RAW'], ['stg', 'STAGING'], ['int', 'INTERMEDIATE'], ['mart', 'MARTS'], ['con', 'API + BI']];
  var MAP2 = [['air', 'Airflow'], ['qual', 'Quality + security'], ['ci', 'Git + CI/CD'], ['mon', 'Monitoring']];
  H.miniMap = function (focus) {
    var f = focus || [];
    function chip(p) { return '<span class="mm c-' + p[0] + (f.indexOf(p[0]) >= 0 ? ' on' : '') + '">' + esc(p[1]) + '</span>'; }
    return '<div class="minimap"><div class="mm-row">' + MAP1.map(chip).join('<i class="mm-arrow">&rarr;</i>') + '</div><div class="mm-row mm-ctl">' + MAP2.map(chip).join('') + '</div></div>';
  };

  /* ---------- intro (auto-built for every mission) ---------- */
  R.intro = {
    sec: 30,
    steps: function () { return 1; },
    say: function (s) { return s.say; },
    mood: function () { return 'happy'; },
    hint: 'Press Next to start the mission.',
    render: function (box, s, i, A) {
      var mins = A && A.missionMinutes ? A.missionMinutes(s.ch) : s.minutes;
      box.innerHTML = '<div class="intro"><div class="intro-top"><span class="intro-n">MISSION ' + s.n + '</span><span class="intro-t">about ' + mins + ' min on this track</span></div>' +
        '<p class="intro-sub">You are here in the project:</p>' + H.miniMap(s.focus) +
        '<h3 class="goals-h">After this mission you can answer:</h3><ul class="goals">' +
        s.goals.map(function (g) { return '<li>' + md(g) + '</li>'; }).join('') + '</ul></div>';
    }
  };

  /* ---------- talk: cards revealed one by one ---------- */
  R.talk = {
    sec: 22,
    steps: function (s) { return s.items ? s.items.length : 1; },
    say: function (s, i) { var it = s.items && s.items[i]; return (it && it.say) || (i === 0 ? s.say : null); },
    mood: function (s, i) { var it = s.items && s.items[i]; return (it && it.mood) || s.mood || 'happy'; },
    hint: 'Press Next for the next point.',
    render: function (box, s, i) {
      var h = '';
      if (s.lead) h += '<div class="lead">' + mdb(s.lead) + '</div>';
      if (s.items) {
        h += '<div class="cards' + (s.cols ? ' cols' + s.cols : '') + '">';
        s.items.slice(0, i + 1).forEach(function (it, k) {
          h += '<div class="card' + (k === i ? ' fresh' : '') + (it.c ? ' tone-' + it.c : '') + '">' +
            '<h3>' + (it.n ? '<span class="num">' + it.n + '</span>' : '') + md(it.h) + '</h3><div class="ct">' + mdb(it.t) + '</div></div>';
        });
        h += '</div>';
      }
      if (s.body) h += '<div class="bodytext">' + mdb(s.body) + '</div>';
      if (s.call) h += '<div class="callout ' + (s.call.k || 'tip') + '"><b>' + esc(s.call.h) + '</b> ' + md(s.call.t) + '</div>';
      box.innerHTML = h;
    }
  };

  /* ---------- flow: animated diagram, one hop per step ---------- */
  R.flow = {
    sec: 18, keep: true,
    steps: function (s) { return s.steps.length; },
    say: function (s, i) { return s.steps[i].say; },
    mood: function (s, i) { return s.steps[i].mood; },
    hint: 'Watch the orange blocks move. Press Next for the next hop.',
    render: function (box, s, i, A, o) {
      var st = s.steps[i];
      if (!o.same || !A.gctl || A.gctlScene !== s.id) {
        var legend = (s.legend === false) ? '' :
          '<div class="legend"><span><i class="lg lg-data"></i>moving orange blocks = data</span>' +
          (s.ctl ? '<span><i class="lg lg-ctl"></i>teal dashes = Airflow signal</span>' : '') +
          '<span><i class="lg lg-num">1</i>step number</span></div>';
        box.innerHTML = '<div class="graph-wrap"></div><div class="cap"></div>' + legend +
          (s.steps.length > 2 ? '<button type="button" class="btn-play" data-act="auto">Play all steps</button>' : '');
        A.gctl = LAB.Graph.mount(box.querySelector('.graph-wrap'), LAB.graphs[s.g || 'master']);
        A.gctlScene = s.id;
      }
      var ids = st.pill ? [{ edge: st.pill.edge, label: st.pill.label }] : [];
      A.gctl.set({ on: st.on || [], focus: st.focus || null, pills: ids, tags: st.tags || [], show: st.show || [], status: st.status || null, keepGroups: !!st.keepGroups });
      box.querySelector('.cap').innerHTML = st.cap ? mdb(st.cap) : '';
    }
  };

  /* ---------- rows: follow one record through the layers ---------- */
  R.rows = {
    sec: 24,
    steps: function (s) { return s.steps.length; },
    say: function (s, i) { return s.steps[i].say; },
    mood: function (s, i) { return s.steps[i].mood; },
    hint: 'Look at the yellow cells. They changed. Press Next.',
    render: function (box, s, i) {
      var st = s.steps[i], h = '';
      (st.tabs || []).forEach(function (t, k) {
        if (k > 0 && st.ops && st.ops[k - 1]) h += '<div class="op"><span class="op-arrow">&darr;</span><span class="op-t">' + md(st.ops[k - 1]) + '</span></div>';
        h += '<div class="layer-tbl"><div class="layer-h"><span class="lchip c-' + (t.c || 'raw') + '">' + esc(t.layer) + '</span><span class="lname">' + esc(t.name) + '</span></div>' +
          H.table(t.cols, t.rows, { chg: t.chg, trk: t.trk }) + '</div>';
      });
      if (st.code) h += H.code({ file: st.code.file, lang: st.code.lang, code: st.code.code });
      if (st.notes && st.notes.length) {
        h += '<ul class="notes">' + st.notes.map(function (n) { return '<li>' + md(n) + '</li>'; }).join('') + '</ul>';
      }
      box.innerHTML = h;
      if (st.code) H.bindCode(box, st.code.code);
    }
  };

  /* ---------- code / sql: highlight a few lines at a time ---------- */
  function codeScene(kind) {
    return {
      sec: 26, keep: true,
      steps: function (s) { return s.steps ? s.steps.length : 1; },
      say: function (s, i) { return s.steps ? s.steps[i].say : s.say; },
      mood: function (s, i) { return s.steps ? s.steps[i].mood : s.mood; },
      hint: function (s) { return kind === 'sql' ? 'Press Run to see the result, or Next to walk through the code.' : 'The yellow lines are what Coach is explaining. Press Next.'; },
      render: function (box, s, i, A, o) {
        var st = s.steps ? s.steps[i] : {};
        var key = s.id;
        var ran = A.local[key + ':ran'] || !!st.run;
        var showC = !!st.compiled || (s.compiled && s.compiledAlways);
        if (!o.same) {
          var h = '';
          if (kind === 'sql') {
            var c = s.ctx || {};
            h += '<div class="wsbar"><span><b>Role</b> ' + esc(c.role || 'TRANSFORMER') + '</span><span><b>Warehouse</b> ' + esc(c.wh || 'WH_TRANSFORM') + '</span><span><b>Context</b> ' + esc(c.db || 'RISK_DB.MARTS') + '</span>' +
              (s.result ? '<button type="button" class="btn-run" data-act="run">Run</button>' : '') + '</div>';
          }
          h += '<div class="code-slot"></div>';
          h += '<div class="compiled-slot"></div>';
          if (kind === 'sql') h += '<div class="result-slot"></div>';
          if (s.note) h += '<div class="callout tip">' + md(s.note) + '</div>';
          box.innerHTML = h;
        }
        var slot = box.querySelector('.code-slot');
        slot.innerHTML = H.code({ file: s.file, lang: s.lang || (kind === 'sql' ? 'sql' : 'text'), code: s.code, hl: st.lines || null });
        H.bindCode(slot, s.code);
        var cs = box.querySelector('.compiled-slot');
        box.classList.toggle('dual', !!(s.compiled && showC));
        if (s.compiled && showC) {
          cs.innerHTML = '<div class="compiled-h">What Snowflake actually receives after dbt compiles it</div>' +
            H.code({ file: s.compiled.file || 'target/compiled/...', lang: s.compiled.lang || 'sql', code: s.compiled.code, hl: st.clines || null, cls: 'compiled' });
          H.bindCode(cs, s.compiled.code);
        } else cs.innerHTML = '';
        if (kind === 'sql' && s.result) {
          var rs = box.querySelector('.result-slot');
          if (ran) {
            rs.innerHTML = '<div class="result"><div class="result-h">Results <span>' + esc(s.result.msg || (s.result.rows.length + ' rows')) + '</span></div>' + H.table(s.result.cols, s.result.rows, { chg: s.result.chg, trk: s.result.trk }) + '</div>';
          } else rs.innerHTML = '';
        }
      }
    };
  }
  R.code = codeScene('code');
  R.sql = codeScene('sql');

  /* ---------- term: scripted terminal + live diagram ---------- */
  R.term = {
    sec: 40,
    steps: function () { return 1; },
    say: function (s) { return s.say; },
    mood: function (s) { return s.mood; },
    hint: 'It runs by itself. Press Replay to watch again.',
    render: function (box, s, i, A) {
      var g = s.g ? LAB.graphs[s.g] : null;
      box.innerHTML = (g ? '<div class="graph-wrap small"></div>' : '') +
        '<div class="term-tools"><span class="term-title">' + esc(s.title || 'Terminal') + '</span><span><button type="button" class="btn-sm" data-act="replay">Replay</button><button type="button" class="btn-sm" data-act="skip">Skip to end</button></span></div>' +
        '<div class="term-slot"></div>' + (s.after ? '<div class="after"></div>' : '');
      var gc = g ? LAB.Graph.mount(box.querySelector('.graph-wrap'), g) : null;
      var status = {};
      if (gc) gc.set({ status: s.initial || {} });
      var tm = LAB.Term.mount(box.querySelector('.term-slot'));
      var lines = typeof s.lines === 'function' ? s.lines() : s.lines;
      function start() {
        status = Object.assign({}, s.initial || {});
        if (gc) gc.set({ status: status, on: [] });
        var after = box.querySelector('.after');
        if (after) after.innerHTML = '';
        tm.onDone = function () { if (after && s.after) after.innerHTML = '<div class="callout ' + (s.afterKind || 'tip') + '">' + mdb(s.after) + '</div>'; if (s.doneSay) A.say(s.doneSay, s.doneMood || 'happy'); };
        tm.play(lines, function (l) {
          if (gc && l.node) { status[l.node] = l.st; gc.set({ status: status, on: l.on || [] }); }
        });
      }
      A.termCtl = { replay: start, skip: function () { tm.skip(); }, destroy: function () { tm.destroy(); } };
      start();
    }
  };

  /* ---------- cmp: comparison table, rows appear one by one ---------- */
  R.cmp = {
    sec: 24,
    steps: function (s) { return s.steps ? s.steps.length : 1; },
    say: function (s, i) { return s.steps ? s.steps[i].say : s.say; },
    mood: function (s, i) { return s.steps ? s.steps[i].mood : s.mood; },
    hint: 'Press Next to reveal the next row.',
    render: function (box, s, i) {
      var upto = s.steps ? (s.steps[i].upto || s.rows.length) : s.rows.length;
      var h = '<div class="tbl-wrap"><table class="tbl cmp"><thead><tr>' + s.cols.map(function (c, k) { return '<th class="' + (s.hl === k ? 'hlc' : '') + '">' + md(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      s.rows.slice(0, upto).forEach(function (r, ri) {
        h += '<tr class="' + (ri === upto - 1 && s.steps ? 'fresh' : '') + '">' + r.map(function (c, ci) {
          return '<td class="' + (ci === 0 ? 'rowh ' : '') + (s.hl === ci ? 'hlc' : '') + '">' + md(c) + '</td>';
        }).join('') + '</tr>';
      });
      h += '</tbody></table></div>';
      if (s.pick && upto >= s.rows.length) h += '<div class="pick"><b>Coach\'s pick for this project</b>' + mdb(s.pick) + '</div>';
      box.innerHTML = h;
    }
  };

  /* ---------- cheat: static reference blocks ---------- */
  R.cheat = {
    sec: 45,
    steps: function () { return 1; },
    say: function (s) { return s.say; },
    mood: function () { return 'happy'; },
    hint: 'Screenshot or print this page. It is your last-minute review.',
    render: function (box, s) {
      var h = '<div class="cheat">';
      s.sections.forEach(function (sec) {
        h += '<div class="cheat-card"><h3>' + md(sec.h) + '</h3><ul>' + sec.items.map(function (x) { return '<li>' + md(x) + '</li>'; }).join('') + '</ul></div>';
      });
      box.innerHTML = h + '</div>';
    }
  };

  /* ---------- widget dispatcher ---------- */
  R.widget = {
    sec: 40,
    steps: function (s) { var w = LAB.W[s.kind]; return w.steps ? w.steps(s) : 1; },
    say: function (s, i) { return LAB.W[s.kind].say(s, i); },
    mood: function (s, i) { var w = LAB.W[s.kind]; return w.mood ? w.mood(s, i) : 'happy'; },
    hint: function (s) { return LAB.W[s.kind].hint || 'Try the buttons, then press Next.'; },
    render: function (box, s, i, A, o) { LAB.W[s.kind].render(box, s, i, A, o); }
  };

  /* ====================== widget: partition pruning ====================== */
  var RAWP = [[1, 28], [2, 30], [1, 31], [3, 29], [1, 26], [5, 31], [2, 27], [4, 30], [1, 31], [6, 29], [10, 18], [20, 31]];
  var CLUP = [[1, 3], [3, 5], [5, 8], [8, 10], [10, 13], [13, 15], [15, 18], [18, 20], [20, 23], [23, 25], [25, 28], [28, 31]];
  function d2(n) { return (n < 10 ? '0' : '') + n; }
  LAB.W.prune = {
    steps: function () { return 3; },
    hint: 'Press Run query for each layout, then Next.',
    say: function (s, i) {
      return [
        'Snowflake stores a table as micro-partitions and remembers the minimum and maximum of every column for each one. Run the query on the table as loaded and count how many partitions it must read.',
        'Now switch to the clustered layout and run the same query. The data is the same. Only the physical order changed. Fewer partitions overlap the date, so the rest are skipped.',
        'That skipping is called pruning. Clustering helps only when the table is big and queries filter on the clustering column. On small tables you pay for reclustering and gain nothing.'
      ][i];
    },
    mood: function (s, i) { return i === 1 ? 'wow' : 'happy'; },
    render: function (box, s, i, A, o) {
      var st = A.local.prune || (A.local.prune = { clustered: false, ran: false, ranC: false });
      var ranks = st.clustered ? CLUP : RAWP;
      var scanned = ranks.filter(function (r) { return r[0] <= 14 && 14 <= r[1]; }).length;
      var show = st.ran;
      var h = '<div class="prune-q"><div class="prune-sql">' + LAB.hl("SELECT SUM(amount_usd) FROM fct_payments WHERE txn_date = '2026-03-14';", 'sql').join('') + '</div>' +
        '<div class="seg2"><button type="button" class="tg' + (!st.clustered ? ' on' : '') + '" data-act="pr-mode" data-v="raw">Table as loaded</button><button type="button" class="tg' + (st.clustered ? ' on' : '') + '" data-act="pr-mode" data-v="clu">Clustered by txn_date</button>' +
        '<button type="button" class="btn-run" data-act="pr-run">Run query</button></div></div>';
      h += '<div class="parts">' + ranks.map(function (r, k) {
        var hit = r[0] <= 14 && 14 <= r[1];
        return '<div class="part' + (show ? (hit ? ' scan' : ' skip') : '') + '" style="--d:' + (k * 70) + 'ms"><b>P' + (k + 1) + '</b><span>Mar ' + d2(r[0]) + ' to ' + d2(r[1]) + '</span><em>' + (show ? (hit ? 'READ' : 'skipped') : '&nbsp;') + '</em></div>';
      }).join('') + '</div>';
      h += '<div class="prune-res' + (show ? ' on' : '') + '">' + (show ? 'Partitions scanned: <b>' + scanned + ' of 12</b> (' + Math.round(scanned / 12 * 100) + '%)' + (st.clustered ? '. Pruning works.' : '. Almost everything is read.') : 'Press Run query.') + '</div>';
      if (i === 2) h += '<div class="callout tip"><b>Rule of thumb.</b> Cluster big tables (multi-TB, thousands of partitions) on the column most queries filter by, usually a date. Check <code>SYSTEM$CLUSTERING_INFORMATION</code> first. Automatic Clustering uses credits in the background.</div>';
      box.innerHTML = h;
      A.bindWidget = function (act, el) {
        if (act === 'pr-mode') { st.clustered = el.getAttribute('data-v') === 'clu'; st.ran = false; A.render(true); }
        if (act === 'pr-run') { st.ran = true; A.render(true); }
      };
    }
  };

  /* ====================== widget: masking by role ====================== */
  var MASK_SQL = "CREATE OR REPLACE MASKING POLICY governance.ssn_mask AS (val STRING)\n  RETURNS STRING ->\n  CASE\n    WHEN IS_ROLE_IN_SESSION('PII_READER') THEN val\n    ELSE 'XXX-XX-' || RIGHT(val, 4)\n  END;\n\nALTER TABLE marts.dim_customer\n  MODIFY COLUMN ssn SET MASKING POLICY governance.ssn_mask;";
  LAB.W.mask = {
    steps: function () { return 3; },
    hint: 'Switch the role, watch the same query return different values.',
    say: function (s, i) {
      return [
        'Same table, same query, two roles. Pick a role and compare the SSN and email columns. The data in storage never changes. Snowflake applies the policy when the query runs.',
        'Here is the policy. It lives on the column, not in the query, so every tool that reads the table (BI, API, notebooks) gets the same protection. Use IS_ROLE_IN_SESSION so inherited roles are handled.',
        'Senior-level catch: dbt rebuilds tables with CREATE OR REPLACE, and a replaced table loses its masking policy. Re-attach the policy in a post-hook, or manage it in code that runs after every build.'
      ][i];
    },
    mood: function (s, i) { return i === 2 ? 'oops' : 'happy'; },
    render: function (box, s, i, A) {
      var role = A.local.maskRole || 'ANALYST';
      var clear = role === 'PII_READER';
      var rows = [
        ['C-42', 'Ava Martin', clear ? '912-34-5678' : 'XXX-XX-5678', clear ? 'ava.martin@mail.test' : '***@mail.test'],
        ['C-77', 'Noah Singh', clear ? '987-65-4321' : 'XXX-XX-4321', clear ? 'noah.singh@mail.test' : '***@mail.test']
      ];
      var h = '';
      if (i === 0) {
        h += '<div class="wsbar"><span><b>Role</b> <span class="rolebtns"><button type="button" class="tg' + (role === 'ANALYST' ? ' on' : '') + '" data-act="mk-role" data-v="ANALYST">ANALYST</button><button type="button" class="tg' + (role === 'PII_READER' ? ' on' : '') + '" data-act="mk-role" data-v="PII_READER">PII_READER</button></span></span></div>';
        h += '<div class="prune-sql">' + LAB.hl('SELECT customer_id, full_name, ssn, email FROM marts.dim_customer;', 'sql').join('') + '</div>';
        h += '<div class="result"><div class="result-h">Results as ' + esc(role) + '</div>' + H.table(['customer_id', 'full_name', 'ssn', 'email'], rows, { chg: clear ? [[0, 2], [0, 3], [1, 2], [1, 3]] : [] }) + '</div>';
      } else if (i === 1) {
        h += H.code({ file: 'governance/masking_policies.sql', lang: 'sql', code: MASK_SQL, hl: [3, 6] });
      } else {
        h += H.code({ file: 'dbt_project.yml', lang: 'yaml', code: "models:\n  risk_platform:\n    marts:\n      +materialized: table\n      +post-hook:\n        - \"alter table {{ this }} modify column ssn set masking policy governance.ssn_mask\"", hl: [5, 6] });
        h += '<div class="callout warn"><b>Why:</b> a <code>table</code> model is rebuilt with CREATE OR REPLACE. Policies, tags and grants set by hand are gone after the next run unless a hook or a <code>grants</code> config puts them back.</div>';
      }
      box.innerHTML = h;
      if (i === 1) H.bindCode(box, MASK_SQL);
      A.bindWidget = function (act, el) { if (act === 'mk-role') { A.local.maskRole = el.getAttribute('data-v'); A.render(true); } };
    }
  };
})();
