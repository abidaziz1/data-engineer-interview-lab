/* Diagram engine: draws a node/edge graph as SVG and animates data moving along the edges.
   A spec is plain data (see graphs.js). mount() draws it once; ctl.set(state) changes what is lit. */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var NS = 'http://www.w3.org/2000/svg';
  var XL = 'http://www.w3.org/1999/xlink';

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, cls, x, y, s, anchor) {
    var t = el('text', { class: cls, x: x, y: y }, parent);
    if (anchor) t.setAttribute('text-anchor', anchor);
    t.textContent = s;
    return t;
  }
  function marker(defs, id, color) {
    var m = el('marker', { id: id, viewBox: '0 0 16 16', refX: 14, refY: 8, markerWidth: 16, markerHeight: 16, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M2 2 L14 8 L2 14 Z', fill: color }, m);
  }

  /* Path helpers for specs */
  var G = (LAB.Graph = {});
  G.h = function (x1, y1, x2, y2) { var dx = (x2 - x1) * 0.5; return 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2; };
  G.v = function (x1, y1, x2, y2) { var dy = (y2 - y1) * 0.5; return 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + dy) + ' ' + x2 + ' ' + (y2 - dy) + ' ' + x2 + ' ' + y2; };
  G.line = function (x1, y1, x2, y2) { return 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2; };

  function safe(s) { return String(s).replace(/[^A-Za-z0-9_-]/g, '_'); }

  var GLYPH = {
    ok: 'M-5 0 L-1.5 4 L5.5 -4',
    fail: 'M-4.5 -4.5 L4.5 4.5 M4.5 -4.5 L-4.5 4.5',
    skip: 'M-5 0 L5 0',
    retry: 'M-4 -2 A5 5 0 1 1 -4 2 M-4 -6 L-4 -2 L0 -2'
  };

  G.mount = function (host, spec) {
    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + spec.w + ' ' + spec.h, class: 'graph', role: 'img', 'aria-label': spec.label || 'Diagram', preserveAspectRatio: 'xMidYMid meet' });
    var defs = el('defs', null, svg);
    marker(defs, 'arr', '#334155');
    marker(defs, 'arr-on', '#C2410C');
    marker(defs, 'arr-ctl', '#0F766E');
    var lGroups = el('g', { class: 'l-groups' }, svg);
    var lEdges = el('g', { class: 'l-edges' }, svg);
    var lNodes = el('g', { class: 'l-nodes' }, svg);
    var lBadges = el('g', { class: 'l-badges' }, svg);
    var lTags = el('g', { class: 'l-tags' }, svg);
    var lPk = el('g', { class: 'l-pk' }, svg);
    var nodeEl = {}, groupEl = {}, edgeEl = {}, tagEl = {}, badgeEl = {}, pathEl = {};

    (spec.groups || []).forEach(function (g) {
      var ge = el('g', { class: 'grp c-' + g.c + (g.dash ? ' dash' : ''), 'data-id': g.id }, lGroups);
      el('rect', { x: g.x, y: g.y, width: g.w, height: g.h, rx: 18 }, ge);
      if (g.t) {
        var tw = g.t.length * 11 + 28;
        var tx = g.tx !== undefined ? g.tx : g.x + 18;
        var ty = g.tb ? g.y + g.h - 15 : g.y - 14;
        var tabg = el('g', { class: 'tab' }, ge);
        el('rect', { x: tx, y: ty, width: tw, height: 30, rx: 8 }, tabg);
        txt(tabg, 'tabt', tx + 14, ty + 21, g.t);
      }
      groupEl[g.id] = ge;
    });

    (spec.edges || []).forEach(function (e) {
      var ge = el('g', { class: 'edge e-' + (e.k || 'data'), 'data-id': e.id }, lEdges);
      pathEl[e.id] = el('path', { d: e.d, class: 'ep', id: 'ep-' + safe(e.id), fill: 'none' }, ge);
      el('path', { d: e.d, class: 'ef', fill: 'none' }, ge);
      edgeEl[e.id] = ge;
    });

    (spec.nodes || []).forEach(function (n) {
      var cls = 'node c-' + n.c + (n.k ? ' k-' + n.k : '');
      var g = el('g', { class: cls, 'data-id': n.id }, lNodes);
      el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: n.rx || (n.k === 'bar' ? 14 : n.k === 'chip' ? 12 : 16) }, g);
      var left = n.k === 'bar' || n.k === 'checks' || n.align === 'l';
      var tx = left ? n.x + 18 : n.x + n.w / 2;
      var anchor = left ? 'start' : 'middle';
      if (n.inline) {
        var t = txt(g, 'nt', tx, n.y + n.h / 2 + 8, n.t, anchor);
        var ts = el('tspan', { class: 'ns-in', dx: 14 }, t);
        ts.textContent = n.s || '';
      } else if (n.ss) {
        var lineH = 27, blockH = 30 + n.ss.length * lineH;
        var y0 = n.y + Math.max(34, (n.h - blockH) / 2 + 24);
        txt(g, 'nt', tx, y0, n.t, anchor);
        n.ss.forEach(function (line, i) {
          txt(g, 'ns', tx, y0 + 31 + i * lineH, (n.k === 'checks' ? '• ' : '') + line, anchor);
        });
      } else if (n.s) {
        txt(g, 'nt', tx, n.y + n.h * (n.k === 'chip' ? 0.44 : 0.43), n.t, anchor);
        txt(g, 'ns', tx, n.y + n.h * (n.k === 'chip' ? 0.8 : 0.76), n.s, anchor);
      } else {
        txt(g, 'nt', tx, n.y + n.h / 2 + 7, n.t, anchor);
      }
      if (n.k === 'dag') {
        var sb = el('g', { class: 'sb', transform: 'translate(' + (n.x + n.w - 14) + ' ' + (n.y + 4) + ')' }, g);
        el('circle', { r: 11, class: 'sbc' }, sb);
        el('path', { class: 'sbg', d: '', fill: 'none' }, sb);
      }
      nodeEl[n.id] = g;
    });

    host.appendChild(svg);

    /* badges + labels need geometry, so they come after the svg is in the DOM */
    (spec.edges || []).forEach(function (e) {
      var path = pathEl[e.id];
      var len = path.getTotalLength();
      var mid = path.getPointAtLength(len / 2);
      var bx = e.bx !== undefined ? e.bx : mid.x, by = e.by !== undefined ? e.by : mid.y;
      if (e.n && !e.nb) {
        var b = el('g', { class: 'badge', 'data-edge': e.id, transform: 'translate(' + bx + ' ' + by + ')' }, lBadges);
        el('circle', { r: 15 }, b);
        txt(b, 'bt', 0, 6, String(e.n), 'middle');
        badgeEl[e.id] = b;
      }
      if (e.label) {
        var lx = e.lx !== undefined ? e.lx : mid.x, ly = e.ly !== undefined ? e.ly : mid.y - (e.n && !e.nb ? 28 : 12);
        var w = e.label.length * 9.4 + 18;
        var lg = el('g', { class: 'elabel', 'data-edge': e.id }, lBadges);
        el('rect', { x: lx - w / 2, y: ly - 18, width: w, height: 26, rx: 8 }, lg);
        txt(lg, 'elt', lx, ly + 1, e.label, 'middle');
      }
    });

    (spec.tags || []).forEach(function (tg) {
      var w = tg.t.length * 10.4 + 24;
      var g = el('g', { class: 'tag c-' + (tg.c || 'air'), 'data-id': tg.id }, lTags);
      el('rect', { x: tg.x, y: tg.y, width: w, height: 32, rx: 16 }, g);
      txt(g, 'tgt', tg.x + w / 2, tg.y + 22.5, tg.t, 'middle');
      tagEl[tg.id] = g;
    });

    var edgeById = {};
    (spec.edges || []).forEach(function (e) { edgeById[e.id] = e; });

    function clearPk() { while (lPk.firstChild) lPk.removeChild(lPk.firstChild); }

    function addPacket(edgeId, o) {
      var path = pathEl[edgeId];
      if (!path) return;
      var len = path.getTotalLength();
      var dur = o.dur || Math.max(1.6, len / 150);
      var g = el('g', { class: 'pk ' + (o.cls || '') }, lPk);
      if (o.label) {
        var w = o.label.length * 10.5 + 22;
        el('rect', { x: -w / 2, y: -15, width: w, height: 30, rx: 15 }, g);
        txt(g, 'pkt', 0, 6, o.label, 'middle');
      } else {
        el('rect', { x: -9, y: -9, width: 18, height: 18, rx: 4 }, g);
      }
      var am = el('animateMotion', { dur: dur + 's', repeatCount: 'indefinite', begin: '-' + (o.offset || 0).toFixed(2) + 's', rotate: '0' }, g);
      var mp = el('mpath', null, am);
      mp.setAttribute('href', '#ep-' + safe(edgeId));
      mp.setAttributeNS(XL, 'xlink:href', '#ep-' + safe(edgeId));
    }

    var ctl = {
      svg: svg,
      spec: spec,
      set: function (st) {
        st = st || {};
        var on = st.on || [];
        var focus = st.focus || null;
        var inFocus = function (id) { return !focus || focus.indexOf(id) >= 0; };

        Object.keys(nodeEl).forEach(function (id) {
          nodeEl[id].classList.toggle('dim', !inFocus(id));
          nodeEl[id].classList.toggle('focus', !!focus && focus.indexOf(id) >= 0);
        });
        Object.keys(groupEl).forEach(function (id) {
          var hidden = (spec.hidden || []).indexOf(id) >= 0 && !(st.show && st.show.indexOf(id) >= 0);
          groupEl[id].classList.toggle('hide', hidden);
          groupEl[id].classList.toggle('dim', !hidden && !!focus && focus.indexOf(id) < 0 && !(st.keepGroups));
        });
        Object.keys(edgeEl).forEach(function (id) {
          var e = edgeById[id];
          var lit = on.indexOf(id) >= 0;
          var ends = focus && focus.indexOf(e.a) >= 0 && focus.indexOf(e.b) >= 0;
          edgeEl[id].classList.toggle('on', lit);
          edgeEl[id].classList.toggle('dim', !!focus && !lit && !ends);
          if (badgeEl[id]) badgeEl[id].classList.toggle('dim', !!focus && !lit && !ends);
        });
        Object.keys(tagEl).forEach(function (id) {
          tagEl[id].classList.toggle('show', !!(st.tags && st.tags.indexOf(id) >= 0));
        });
        /* statuses for DAG runs */
        Object.keys(nodeEl).forEach(function (id) {
          var s = st.status && st.status[id];
          var g = nodeEl[id];
          ['wait', 'run', 'ok', 'fail', 'skip', 'retry'].forEach(function (k) { g.classList.remove('st-' + k); });
          if (s) g.classList.add('st-' + s);
          var glyph = g.querySelector('.sbg');
          if (glyph) glyph.setAttribute('d', GLYPH[s] || '');
        });
        /* packets */
        clearPk();
        if (!st.still) {
          on.forEach(function (id) {
            var e = edgeById[id];
            if (!e || e.k === 'ref') return;
            var cls = e.k === 'ctl' ? 'ctl' : 'data';
            var n = e.k === 'ctl' ? 1 : (e.pk || spec.pk || 3);
            var path = pathEl[id];
            if (!path) return;
            var len = path.getTotalLength();
            var dur = Math.max(1.6, len / 150);
            for (var i = 0; i < n; i++) addPacket(id, { cls: cls + ' ' + (e.pc || ''), dur: dur, offset: (dur / n) * i });
          });
          (st.pills || []).forEach(function (p) {
            var path = pathEl[p.edge];
            if (!path) return;
            var len = path.getTotalLength();
            addPacket(p.edge, { cls: 'pill ' + (p.cls || ''), label: p.label, dur: Math.max(2.2, len / 120), offset: 0 });
          });
        }
      },
      destroy: function () { host.innerHTML = ''; }
    };
    return ctl;
  };
})();
