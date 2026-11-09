/* Content builders. Chapters are written with these short helpers. */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var B = (LAB.b = {});
  LAB.chapters = [];

  function mk(type, o) { o = o || {}; o.type = type; return o; }
  function items(list) {
    return list.map(function (x) {
      return Array.isArray(x) ? { h: x[0], t: x[1], say: x[2], mood: x[3] } : x;
    });
  }

  B.welcome = function (o) { return mk('welcome', o); };
  B.talk = function (o) { if (o.items) o.items = items(o.items); return mk('talk', o); };
  B.flow = function (o) { return mk('flow', o); };
  B.rows = function (o) { return mk('rows', o); };
  B.code = function (o) { return mk('code', o); };
  B.sql = function (o) { o.lang = 'sql'; return mk('sql', o); };
  B.term = function (o) { return mk('term', o); };
  B.cmp = function (o) { return mk('cmp', o); };
  B.cheat = function (o) { return mk('cheat', o); };
  B.widget = function (o) { return mk('widget', o); };
  B.quiz = function (o) { return mk('quiz', o); };
  B.bug = function (o) { return mk('bug', o); };
  B.order = function (o) { return mk('order', o); };
  B.decide = function (o) { return mk('decide', o); };
  B.challenge = function (o) { return mk('challenge', o); };
  B.incident = function (o) { return mk('incident', o); };
  B.qa = function (o) { return mk('qa', o); };
  B.recap = function (o) { return mk('recap', o); };

  /* Boss round: re-uses Q&A scenes by id */
  B.mockRound = function (ids) {
    var out = ids.map(function (id, k) { return mk('mock', { id: 'mock-' + id, qid: id, k: k + 1, of: ids.length }); });
    out.push(mk('score', { id: 'mock-score', qids: ids }));
    return out;
  };

  LAB.addChapter = function (ch) {
    ch.index = LAB.chapters.length;
    var scenes = ch.scenes.slice();
    if (!ch.noIntro) {
      scenes.unshift(mk('intro', { n: ch.n, title: ch.title, goals: ch.goals, minutes: ch.minutes, focus: ch.focus || [], say: ch.say }));
    }
    scenes.forEach(function (s, k) { if (!s.id) s.id = ch.id + '.' + k; s.ch = ch.index; });
    ch.scenes = scenes;
    LAB.chapters.push(ch);
  };
})();
