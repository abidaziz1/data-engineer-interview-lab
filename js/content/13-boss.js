/* Mission 14: boss round, scorecard and the one-page cheat sheet. */
(function () {
  var B = LAB.b;

  var mocks = B.mockRound([
    'qa-wf-project', 'qa-dbt-build', 'qa-pyops', 'qa-late', 'qa-perf',
    'qa-model', 'qa-af-tasks', 'qa-dq', 'qa-deploy', 'qa-design', 'qa-incident'
  ]);

  LAB.addChapter({
    id: 'm14', n: 14, title: 'Boss round and cheat sheet', short: 'Boss round', blurb: 'Mock interview, scorecard, one-page review', minutes: 30,
    focus: ['src', 'ing', 'raw', 'stg', 'int', 'mart', 'con', 'air', 'qual', 'ci', 'mon'],
    goals: [
      'Answer **eleven real interview questions** out loud with no notes.',
      'Grade yourself honestly and see your **weak spots**.',
      'Jump straight back to the lessons that need a second pass.',
      'Leave with a **one-page cheat sheet** for the last hour before the interview.'
    ],
    say: 'This is the boss round. Eleven questions from everything you have learned, with no notes. You answer out loud, flip the card, and grade yourself honestly. Then you get a scorecard.',
    scenes: [].concat(
      [B.talk({
        id: 'm14-rules', title: 'Boss round rules',
        say: 'Four rules. Following them is what makes the practice work. Press Next.',
        items: [
          ['1. Out loud, every time', 'Speaking is a different skill from knowing. Say the answer to an empty room. Your mouth needs the practice, not just your head.', 'Rule one: speak, do not just think.'],
          ['2. Ninety seconds, then stop', 'Real answers are 60 to 90 seconds. If you go on longer, the interviewer will cut you off, so practise ending cleanly.', 'Rule two: time yourself.'],
          ['3. Grade honestly', 'Nailed means you hit most of the points and used specifics. Partly and Missed are information, not failure.', 'Rule three: honest grades give you a useful scorecard.'],
          ['4. Review, then retry', 'The scorecard will link back to the lessons for weak answers. Review them, then run the boss round once more tomorrow.', 'Rule four: review weak spots, then repeat.']
        ],
        cols: 2
      })],
      mocks,
      [B.cheat({
        id: 'm14-cheat', title: 'The one-page cheat sheet',
        say: 'This is your last-hour review. Take a screenshot or print it with your browser. Everything on it appeared in a lesson.',
        sections: [
          { h: 'Say this in the first two minutes', items: ['13+ years, 5+ on dbt Core and Snowflake in financial services and healthcare.', 'Wells Fargo: dbt models, Snowflake star schemas, 40+ Airflow workflows, REST APIs for app teams.', 'Bank of America: Kimball Snowflake warehouse, 15+ sources, 200+ DAGs, zero compliance incidents.', 'Citigroup: 150+ pipelines, 99.8% accuracy, Terraform and Jenkins cut manual work 50%.'] },
          { h: 'The pipeline in one line', items: ['Sources, Python, S3, Snowpipe, RAW, staging, intermediate, marts, API and BI.', 'Python moves. Snowflake stores and computes. dbt defines. Airflow schedules. CI/CD ships. Datadog watches.', 'dbt writes the instructions. Snowflake runs them.'] },
          { h: 'dbt in one screen', items: ['`ref()` for what dbt builds, `source()` for what others load.', '`dbt build` = seeds, snapshots, models, tests. A failed test skips children.', '`--select state:modified+ --defer --state path` for slim CI.', 'Incremental: unique_key, lookback on `updated_at`, merge. Never a strict watermark.', 'dbt has **no operators**. Python runs in Python models, Airflow tasks, `dbtRunner`.'] },
          { h: 'Snowflake in one screen', items: ['Storage, compute, cloud services. Micro-partitions plus min/max metadata give pruning.', 'Scale **up** for one big query, **out** for concurrency. Diagnose with the Query Profile first.', 'XS = 1 credit per hour, doubling per size. Auto-suspend 60 seconds.', 'Time Travel 1 to 90 days. Clones are zero-copy. New tasks start suspended.', 'Snowflake only enforces NOT NULL, so test uniqueness in dbt.'] },
          { h: 'Airflow in one screen', items: ['Fan-out parallel tasks, fan-in at a sensor or gate.', 'Sensors in **reschedule** mode with a timeout. `trigger_rule="one_failed"` for alerts.', 'Idempotent tasks use the **logical date**, never the clock. `catchup=False`.', 'XCom carries pointers, not data. Pools cap shared resources.', 'Airflow for cross-system work. Snowflake Tasks for in-warehouse SQL.'] },
          { h: 'Modeling and SQL in one screen', items: ['**Grain first.** One row per loan per day.', 'Kimball for marts, Inmon for enterprise integration, Data Vault for audit and many changing sources.', 'SCD2: join as of with `valid_from <= d < valid_to`.', '`QUALIFY ROW_NUMBER()` for latest per key. `DENSE_RANK` keeps ties. `NOT IN` with NULL returns nothing.'] },
          { h: 'Security in one screen', items: ['Privileges to roles, roles to users. Future grants. ACCOUNTADMIN almost never.', 'Masking: `IS_ROLE_IN_SESSION`, not `CURRENT_ROLE()`. dbt rebuilds drop policies, so re-attach.', 'Key-pair for services, SSO and MFA for people, ACCESS_HISTORY for audit.'] },
          { h: 'Numbers from your resume', items: ['13+ years. 5+ years dbt and Snowflake. 8+ years AWS.', '40+ workflows (Wells Fargo). 200+ DAGs, 15+ sources, 500+ users (Bank of America).', '150+ pipelines, 99.8%, 50% less manual work, 40% faster queries (Citigroup).', '50+ source systems (UnitedHealth Group). 100M+ events per day, 100TB+ data.'] },
          { h: 'Traps to avoid', items: ['Do not say dbt has a PythonOperator.', 'Do not say a bigger warehouse fixes queueing.', 'Do not skip the prevention in incident stories.', 'Do not claim a 99.8% definition you cannot back up.'] }
        ]
      }),
      B.recap({
        id: 'm14-recap', n: 14, badge: 'Senior Data Engineer', color: '#FDE68A',
        say: 'You made it through every mission. The last step is not more reading. It is saying the answers out loud once more.',
        pts: [
          'Re-run the **boss round** tomorrow morning and aim to improve your grades.',
          'Use the **Review** buttons on the scorecard for anything marked Partly or Missed.',
          'Read the **cheat sheet** once in the last hour before the interview.',
          'Prepare **one real story** for each of the six story slots.',
          'Sleep. A rested engineer explains better than a tired one who read one more page.'
        ],
        lines: [
          'I design for failure: gates, retries, reconciliation, and a runbook.',
          'I explain trade-offs, not just tools.',
          'I keep the data layer a product that other teams can rely on.'
        ]
      })]
    )
  });
})();
