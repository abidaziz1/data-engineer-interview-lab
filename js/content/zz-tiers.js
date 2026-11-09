/* Study tracks. Every scene belongs to one tier:
   1 = Fast track (about 100 minutes), 2 = added in Standard (about 3 hours), 3 = Everything.
   Scenes not listed are tier 3. Intros, recaps, the welcome and the scorecard are always tier 1. */
(function () {
  var T1 = [
    'm0.0', 'm0.1',
    'm1-map', 'm1-hops', 'qa-wf-project', 'qa-intro',
    'm2-flow', 'qa-ingest',
    'm3-what', 'm3-dag', 'm3-build', 'm3-fail', 'qa-dbt-build',
    'm4-macros', 'm4-incr', 'm4-trap', 'qa-pyops', 'qa-late',
    'm5-arch', 'm5-prune', 'qa-perf',
    'm6-star', 'm6-cmp', 'm6-c1', 'qa-model',
    'm7-c1', 'qa-python',
    'm8-dag', 'm8-runfail', 'qa-af-dbt', 'qa-af-tasks',
    'm9-gates', 'm9-mask', 'qa-dq', 'qa-accuracy',
    'm10-flow', 'm10-ci', 'qa-deploy',
    'm11-i1', 'qa-incident',
    'm12-board', 'qa-design',
    'qa-senior', 'qa-mistake',
    'mock-qa-wf-project', 'mock-qa-dbt-build', 'm14-cheat'
  ];
  var T2 = [
    'm0.2',
    'm1-row', 'm1-airflow',
    'm2-py', 'm2-cmp', 'm2-bug', 'qa-drift',
    'm3-stg', 'm3-mat', 'qa-dbt-arch',
    'm4-strat', 'm4-scd', 'm4-py', 'm4-bug', 'm4-ch1',
    'm5-wh', 'm5-tt', 'qa-cost',
    'm6-asof', 'm6-c5', 'qa-fact',
    'm7-c2', 'qa-api-ingest',
    'm8-code', 'm8-dec', 'qa-af-fail',
    'm9-tests', 'm9-rbac', 'qa-pii',
    'm10-slim', 'qa-agile', 'qa-ai',
    'm11-i2',
    'm12-frame', 'm12-d1', 'm12-d5',
    'm13-star', 'qa-conflict', 'qa-own', 'm13-ask', 'mock-qa-late',
  ];
  var tier = {};
  T1.forEach(function (id) { tier[id] = 1; });
  T2.forEach(function (id) { if (!tier[id]) tier[id] = 2; });
  LAB.chapters.forEach(function (ch) {
    ch.scenes.forEach(function (sc) {
      var always = sc.type === 'intro' || sc.type === 'recap' || sc.type === 'welcome' || sc.type === 'score';
      sc.t = always ? 1 : (tier[sc.id] || 3);
    });
  });
})();
