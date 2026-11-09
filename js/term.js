/* Terminal simulator: prints scripted lines one by one and tells the diagram which node changed.
   Also builds realistic dbt build log lines from a short list of models/tests. */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var T = (LAB.Term = {});

  /* line: { c: 'cmd'|'ok'|'warn'|'err'|'dim'|'out'|'hl', t: 'text', d: delay ms, node: id, st: 'run'|'ok'|'fail'|'skip'|'retry'|'wait' } */
  T.mount = function (host) {
    host.innerHTML = '<div class="term-body" role="log" aria-live="off" tabindex="0"></div>';
    var body = host.firstChild;
    var timer = null, idx = 0, lines = [], onStep = null, done = false, speed = 1;

    function addLine(l) {
      var d = document.createElement('div');
      d.className = 'tl tl-' + (l.c || 'out');
      d.textContent = l.t;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    }
    function step() {
      if (idx >= lines.length) { done = true; if (ctl.onDone) ctl.onDone(); return; }
      var l = lines[idx++];
      addLine(l);
      if (onStep) onStep(l, idx - 1);
      timer = setTimeout(step, (l.d != null ? l.d : 150) * speed);
    }
    var ctl = {
      play: function (ls, cb) {
        ctl.reset();
        lines = ls; onStep = cb; done = false; idx = 0;
        step();
      },
      skip: function () {
        clearTimeout(timer);
        while (idx < lines.length) {
          var l = lines[idx++];
          addLine(l);
          if (onStep) onStep(l, idx - 1);
        }
        done = true;
        if (ctl.onDone) ctl.onDone();
      },
      reset: function () { clearTimeout(timer); body.innerHTML = ''; idx = 0; done = false; },
      destroy: function () { clearTimeout(timer); },
      isDone: function () { return done; },
      onDone: null
    };
    return ctl;
  };

  function dots(label, tail, width) {
    var n = Math.max(3, width - label.length - 1);
    return label + ' ' + new Array(n + 1).join('.') + ' ' + tail;
  }
  function sec(ms) { return (ms / 1000).toFixed(2) + 's'; }

  /* items: [{ kind: 'seed'|'view'|'table'|'incremental'|'snapshot'|'test', name, schema, ms, res: 'ok'|'fail'|'warn'|'skip', n, node }] */
  T.dbt = function (cmd, items, opts) {
    opts = opts || {};
    var W = opts.width || 74;
    var out = [];
    out.push({ c: 'cmd', t: '$ ' + cmd, d: 350 });
    out.push({ c: 'dim', t: 'Running with dbt=1.10.0', d: 120 });
    out.push({ c: 'dim', t: 'Registered adapter: snowflake=1.10.0', d: 120 });
    out.push({ c: 'dim', t: opts.found || 'Found 12 models, 2 seeds, 1 snapshot, 26 data tests, 4 sources', d: 120 });
    out.push({ c: 'dim', t: "Concurrency: 4 threads (target='" + (opts.target || 'prod') + "')", d: 300 });
    out.push({ c: 'dim', t: '', d: 100 });
    var total = items.length, i = 0, pass = 0, warn = 0, err = 0, skip = 0;
    items.forEach(function (it) {
      i++;
      var prefix = i + ' of ' + total + ' ';
      var name = (it.schema ? it.schema + '.' : '') + it.name;
      var startLabel, okLabel, kindWord;
      if (it.kind === 'test') {
        startLabel = prefix + 'START test ' + it.name;
      } else if (it.kind === 'seed') {
        startLabel = prefix + 'START seed file ' + name;
      } else if (it.kind === 'snapshot') {
        startLabel = prefix + 'START snapshot ' + name;
      } else {
        startLabel = prefix + 'START sql ' + it.kind + ' model ' + name;
      }
      if (it.res === 'skip') {
        out.push({ c: 'warn', t: dots(prefix + (it.kind === 'test' ? 'SKIP test ' + it.name : 'SKIP relation ' + name), '[SKIP]', W), d: 60, node: it.node, st: 'skip' });
        skip++;
        return;
      }
      out.push({ c: 'dim', t: dots(startLabel, '[RUN]', W), d: 160, node: it.node, st: 'run' });
      var secs = sec(it.ms || 900);
      if (it.kind === 'test') {
        if (it.res === 'ok') { out.push({ c: 'ok', t: dots(prefix + 'PASS ' + it.name, '[PASS in ' + secs + ']', W), d: 140, node: it.node, st: 'ok' }); pass++; }
        else if (it.res === 'warn') { out.push({ c: 'warn', t: dots(prefix + 'WARN ' + it.n + ' ' + it.name, '[WARN ' + it.n + ' in ' + secs + ']', W), d: 140, node: it.node, st: 'ok' }); warn++; }
        else { out.push({ c: 'err', t: dots(prefix + 'FAIL ' + it.n + ' ' + it.name, '[FAIL ' + it.n + ' in ' + secs + ']', W), d: 300, node: it.node, st: 'fail' }); err++; }
      } else if (it.kind === 'seed') {
        out.push({ c: 'ok', t: dots(prefix + 'OK loaded seed file ' + name, '[INSERT ' + (it.n || 3) + ' in ' + secs + ']', W), d: 140, node: it.node, st: 'ok' }); pass++;
      } else if (it.kind === 'snapshot') {
        out.push({ c: 'ok', t: dots(prefix + 'OK snapshotted ' + name, '[SUCCESS 1 in ' + secs + ']', W), d: 140, node: it.node, st: 'ok' }); pass++;
      } else {
        if (it.res === 'fail') { out.push({ c: 'err', t: dots(prefix + 'ERROR creating sql ' + it.kind + ' model ' + name, '[ERROR in ' + secs + ']', W), d: 300, node: it.node, st: 'fail' }); err++; }
        else { out.push({ c: 'ok', t: dots(prefix + 'OK created sql ' + it.kind + ' model ' + name, '[SUCCESS 1 in ' + secs + ']', W), d: 140, node: it.node, st: 'ok' }); pass++; }
      }
    });
    out.push({ c: 'dim', t: '', d: 150 });
    out.push({ c: 'dim', t: 'Finished running in 0 hours 0 minutes and ' + (opts.total || '34.80') + ' seconds.', d: 200 });
    out.push({ c: 'dim', t: '', d: 100 });
    out.push({ c: err ? 'err' : 'ok', t: err ? 'Completed with ' + err + ' error' + (err > 1 ? 's' : '') + ' and ' + warn + ' warnings:' : 'Completed successfully', d: 200 });
    if (err && opts.errorBlock) opts.errorBlock.forEach(function (t) { out.push({ c: 'err', t: t, d: 80 }); });
    out.push({ c: 'dim', t: '', d: 80 });
    out.push({ c: err ? 'err' : 'hl', t: 'Done. PASS=' + pass + ' WARN=' + warn + ' ERROR=' + err + ' SKIP=' + skip + ' NO-OP=0 TOTAL=' + total, d: 100 });
    return out;
  };
})();
