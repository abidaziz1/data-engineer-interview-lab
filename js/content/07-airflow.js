/* Mission 8: Airflow and orchestration. The DAG file is parsed by a real Airflow install during development. */
(function () {
  var B = LAB.b;

  var DAGCODE = [
    'from datetime import timedelta',
    '',
    'import pendulum',
    'from airflow import DAG',
    'from airflow.operators.bash import BashOperator',
    'from airflow.operators.python import PythonOperator',
    'from airflow.providers.amazon.aws.sensors.s3 import S3KeySensor',
    '',
    'from tasks.extract import pull_core, pull_payments, pull_ratings',
    'from tasks.checks import run_ge_raw_checks, publish_metrics',
    'from tasks.alerts import notify_failure, page_oncall',
    '',
    'DBT = "cd /opt/dbt/risk_platform && dbt"',
    '',
    'default_args = {',
    '    "owner": "data-eng",',
    '    "retries": 2,',
    '    "retry_delay": timedelta(minutes=5),',
    '    "retry_exponential_backoff": True,',
    '    "max_retry_delay": timedelta(minutes=30),',
    '    "on_failure_callback": notify_failure,',
    '}',
    '',
    'with DAG(',
    '    dag_id="risk_exposure_daily",',
    '    schedule="0 5 * * *",',
    '    start_date=pendulum.datetime(2026, 1, 1, tz="America/New_York"),',
    '    catchup=False,',
    '    max_active_runs=1,',
    '    default_args=default_args,',
    '    tags=["risk", "dbt"],',
    ') as dag:',
    '    extracts = [',
    '        PythonOperator(task_id="pull_core", python_callable=pull_core),',
    '        PythonOperator(task_id="pull_payments", python_callable=pull_payments),',
    '        PythonOperator(task_id="pull_ratings", python_callable=pull_ratings),',
    '    ]',
    '',
    '    wait_pipe = S3KeySensor(',
    '        task_id="wait_pipe",',
    '        bucket_name="bank-risk-landing",',
    '        bucket_key="payments/dt={{ ds }}/*",',
    '        wildcard_match=True,',
    '        mode="reschedule",',
    '        poke_interval=300,',
    '        timeout=3 * 60 * 60,',
    '    )',
    '',
    '    ge_raw = PythonOperator(task_id="ge_raw", python_callable=run_ge_raw_checks)',
    '    dbt_fresh = BashOperator(task_id="dbt_fresh", bash_command=f"{DBT} source freshness --target prod")',
    '    dbt_stg = BashOperator(task_id="dbt_stg", bash_command=f"{DBT} build --select tag:staging --target prod")',
    '    dbt_marts = BashOperator(',
    '        task_id="dbt_marts",',
    '        bash_command=f"{DBT} build --select tag:intermediate tag:marts --target prod",',
    '    )',
    '    publish = PythonOperator(task_id="publish", python_callable=publish_metrics)',
    '    alert = PythonOperator(task_id="alert", python_callable=page_oncall, trigger_rule="one_failed")',
    '',
    '    extracts >> wait_pipe >> ge_raw >> dbt_fresh >> dbt_stg >> dbt_marts >> publish',
    '    [dbt_stg, dbt_marts] >> alert'
  ].join('\n');

  var BUGDAG = [
    'import requests',
    'from datetime import datetime',
    'from airflow import DAG',
    'from airflow.operators.bash import BashOperator',
    '',
    '# fetch the table list from the metadata API when the file is parsed',
    'TABLES = requests.get("https://meta.internal/tables").json()',
    '',
    'with DAG("load_tables", schedule="@daily", start_date=datetime(2024, 1, 1), catchup=False) as dag:',
    '    for t in TABLES:',
    '        BashOperator(task_id=f"load_{t}", bash_command=f"python load.py {t}")'
  ].join('\n');

  /* DAG run simulations. Timestamps are cosmetic. */
  var SRC = {};
  function L(t, c, node, st, d, on) { return { c: c || 'out', t: t, node: node, st: st, d: d == null ? 260 : d, on: on }; }
  function runOk() {
    return [
      { c: 'cmd', t: '05:00:00  scheduler: DAG run risk_exposure_daily scheduled__2026-03-14 started', d: 500 },
      L('05:00:01  pull_core        queued -> running', 'dim', 'pull_core', 'run', 80),
      L('05:00:01  pull_payments    queued -> running', 'dim', 'pull_pay', 'run', 80),
      L('05:00:01  pull_ratings     queued -> running', 'dim', 'pull_rat', 'run', 700),
      L('05:01:52  pull_ratings     success  (111s)', 'ok', 'pull_rat', 'ok', 300),
      L('05:03:07  pull_core        success  (186s)', 'ok', 'pull_core', 'ok', 300),
      L('05:04:21  pull_payments    success  (260s)', 'ok', 'pull_pay', 'ok', 500),
      L('05:04:22  wait_pipe        running  (sensor, reschedule mode)', 'dim', 'wait_pipe', 'run', 700),
      L('05:09:23  wait_pipe        success  (all files loaded)', 'ok', 'wait_pipe', 'ok', 400),
      L('05:09:24  ge_raw           running  (Great Expectations checkpoint)', 'dim', 'ge_raw', 'run', 600),
      L('05:10:05  ge_raw           success  (12 expectations passed)', 'ok', 'ge_raw', 'ok', 400),
      L('05:10:06  dbt_fresh        success  (4 sources fresh)', 'ok', 'dbt_fresh', 'ok', 400),
      L('05:10:07  dbt_stg          running  (dbt build --select tag:staging)', 'dim', 'dbt_stg', 'run', 700),
      L('05:12:14  dbt_stg          success  (3 models, 4 tests)', 'ok', 'dbt_stg', 'ok', 400),
      L('05:12:15  dbt_marts        running  (dbt build intermediate + marts)', 'dim', 'dbt_marts', 'run', 800),
      L('05:17:40  dbt_marts        success  (6 models, 7 tests)', 'ok', 'dbt_marts', 'ok', 400),
      L('05:17:41  alert            skipped  (trigger rule one_failed not met)', 'warn', 'alert', 'skip', 300),
      L('05:17:42  publish          success  (metrics sent to Datadog)', 'ok', 'publish', 'ok', 400),
      { c: 'hl', t: '05:17:42  DAG run success in 17m 42s  (SLA 07:00, finished 05:17)', d: 100 }
    ];
  }
  function runFail() {
    return [
      { c: 'cmd', t: '05:00:00  scheduler: DAG run risk_exposure_daily scheduled__2026-03-14 started', d: 500 },
      L('05:00:01  pull_core, pull_payments, pull_ratings  queued -> running', 'dim', 'pull_core', 'run', 80),
      L('05:00:01  pull_payments    running', 'dim', 'pull_pay', 'run', 80),
      L('05:00:01  pull_ratings     running', 'dim', 'pull_rat', 'run', 600),
      L('05:01:52  pull_ratings     success', 'ok', 'pull_rat', 'ok', 200),
      L('05:03:07  pull_core        success', 'ok', 'pull_core', 'ok', 400),
      L('05:02:40  pull_payments    FAILED attempt 1: HTTP 503 from payments API', 'err', 'pull_pay', 'retry', 500),
      L('05:02:40  pull_payments    up_for_retry (retry in 5 min, backoff)', 'warn', 'pull_pay', 'retry', 900),
      L('05:07:40  pull_payments    running (attempt 2)', 'dim', 'pull_pay', 'run', 700),
      L('05:10:02  pull_payments    success (attempt 2). The retry worked.', 'ok', 'pull_pay', 'ok', 500),
      L('05:10:03  wait_pipe, ge_raw, dbt_fresh  success', 'ok', 'wait_pipe', 'ok', 100),
      L('', 'dim', 'ge_raw', 'ok', 50),
      L('', 'dim', 'dbt_fresh', 'ok', 300),
      L('05:10:05  dbt_stg          running', 'dim', 'dbt_stg', 'run', 700),
      L('05:11:30  dbt_stg          FAILED: unique_stg_core__loans_loan_id (3 failures)', 'err', 'dbt_stg', 'fail', 400),
      L('05:11:31  dbt_marts        upstream_failed (not run)', 'warn', 'dbt_marts', 'skip', 250),
      L('05:11:31  publish          upstream_failed (not run)', 'warn', 'publish', 'skip', 300),
      L('05:11:32  alert            running (trigger rule one_failed met)', 'dim', 'alert', 'run', 500),
      L('05:11:33  alert            success. On-call paged with the log link.', 'ok', 'alert', 'ok', 300),
      { c: 'err', t: '05:11:33  DAG run FAILED. Yesterday\'s marts are untouched. Consumers still see good data.', d: 100 }
    ];
  }

  LAB.addChapter({
    id: 'm8', n: 8, title: 'Airflow and orchestration', short: 'Airflow', blurb: 'DAGs, retries, sensors, dbt integration', minutes: 32,
    focus: ['air', 'ing', 'stg', 'int', 'mart'],
    goals: [
      'Describe the **DAG for this pipeline**: parallel extracts, a sensor, quality gates, dbt, an alert.',
      'Explain **retries, sensors, trigger rules, pools, idempotency and backfills**.',
      'Compare the **ways to run dbt from Airflow**.',
      'Decide **Airflow vs Snowflake Tasks** and defend it.',
      'Triage a **failed run** at 7 AM.'
    ],
    say: 'Mission 8 covers orchestration. Your resume claims 40+ production workflows at Wells Fargo, 200+ DAGs at Bank of America and 150+ pipelines at Citigroup. Expect deep questions here.',
    scenes: [
      B.flow({
        id: 'm8-dag', title: 'The DAG for this pipeline', g: 'airflow', ctl: true,
        steps: [
          { say: 'This is the Airflow DAG for the platform. Each box is a task. Arrows are dependencies. Press Next to see how it is built.', cap: 'A **DAG** is a directed acyclic graph: tasks, order, no loops.' },
          { say: 'Fan-out and fan-in. Three extract tasks run in parallel because they do not depend on each other. The sensor waits for all of them before the pipeline moves on.',
            focus: ['pull_core', 'pull_pay', 'pull_rat', 'wait_pipe'], on: ['pull_core>wait_pipe', 'pull_pay>wait_pipe', 'pull_rat>wait_pipe'], cap: 'Parallel where possible, joined where needed. The DAG runs as fast as its **longest path**.' },
          { say: 'Gates. The sensor confirms files are loaded. Great Expectations checks the raw data. Source freshness checks the timestamps. dbt never starts on missing or broken data.',
            focus: ['wait_pipe', 'ge_raw', 'dbt_fresh'], on: ['wait_pipe>ge_raw', 'ge_raw>dbt_fresh'], cap: '**Quality gates before transformation.** Cheap checks first.' },
          { say: 'dbt runs in two tasks, staging and then intermediate plus marts. Tests are part of the build, so a failed test fails the task and stops everything after it.',
            focus: ['dbt_fresh', 'dbt_stg', 'dbt_marts', 'publish'], on: ['dbt_fresh>dbt_stg', 'dbt_stg>dbt_marts', 'dbt_marts>publish'], cap: 'Splitting by layer makes a failure point to a layer, and a retry cheap.' },
          { say: 'The alert task is wired with a trigger rule: run only if an upstream task failed. That is the dashed red-teal line. A healthy run skips it.',
            focus: ['dbt_stg', 'dbt_marts', 'alert'], on: ['dbt_stg>alert', 'dbt_marts>alert'], cap: '`trigger_rule="one_failed"`. The default rule is `all_success`.' }
        ]
      }),

      B.term({
        id: 'm8-run', title: 'A healthy DAG run', g: 'airflow', initial: {}, lines: runOk,
        say: 'Here is a normal daily run. Watch the graph: yellow is running, green is done. The three extracts overlap, then everything is sequential.',
        doneSay: 'Seventeen minutes, finished at 05:17 against a 7 AM SLA. The alert task was skipped because nothing failed.',
        after: 'Notice **wait_pipe** ran in reschedule mode. It frees its worker slot between checks, so waiting costs almost nothing.'
      }),

      B.term({
        id: 'm8-runfail', title: 'A run with a retry and a failure', g: 'airflow', initial: {}, lines: runFail, afterKind: 'warn',
        say: 'Now a bad morning. A transient API error and a real data problem. Watch the orange retry and the red failure.',
        doneSay: 'Two different failures, two different outcomes. The 503 was retried automatically and succeeded. The duplicate keys failed the dbt task, which blocked everything after it and paged on-call.',
        after: '**Key point:** yesterday\'s marts stayed untouched, so dashboards still show good data. A failed gate protects consumers. Then you fix the duplicates and **clear dbt_stg**, which reruns only the tasks that need it.'
      }),

      B.code({
        id: 'm8-code', title: 'The DAG file', file: 'dags/risk_exposure_daily.py', lang: 'python', code: DAGCODE,
        steps: [
          { say: 'Here is the actual DAG definition. It is plain Python. Press Next and I will mark the parts that matter.', lines: null },
          { say: 'Default arguments apply to every task. Two retries with exponential backoff capped at 30 minutes, and a failure callback that posts to Slack with the log link.', lines: [15, 22] },
          { say: 'Schedule 05:00 Eastern, with a timezone-aware start date. catchup False means no flood of backfill runs on deploy. max_active_runs 1 stops two runs overlapping and fighting over the same tables.', lines: [24, 32] },
          { say: 'Three extract tasks in a list. Lists mean parallel.', lines: [33, 37] },
          { say: 'The sensor. Reschedule mode releases the worker between checks, a timeout of three hours prevents waiting forever, and the templated date means it looks at today\'s folder.', lines: [39, 47] },
          { say: 'The dbt tasks are BashOperators, split by layer. The selectors use tags so the DAG file never lists models.', lines: [50, 55] },
          { say: 'The alert task uses trigger rule one_failed, so it runs only when an upstream task failed.', lines: [57, 57] },
          { say: 'Dependencies in one line each. The right shift operator reads as then. A list on one side means all of them.', lines: [59, 60] }
        ]
      }),

      B.cmp({
        id: 'm8-dbt', title: 'Four ways to run dbt from Airflow',
        say: 'The JD asks for Airflow and dbt together. Know all four options and have a favourite. Press Next.',
        cols: ['', 'BashOperator', 'Cosmos', 'Container (K8s or Docker)', 'dbt Cloud job'],
        hl: 1,
        rows: [
          ['How it works', 'One task runs `dbt build --select ...`', 'Reads the manifest and renders each model as an Airflow task', 'A task launches a container that holds dbt and the project', 'A task triggers a dbt Cloud job through its API'],
          ['Strength', 'Simple. Fewest moving parts', 'Model-level retries and lineage in the Airflow UI', 'Pinned runtime. Isolated. Nothing to install on workers', 'Managed runs and hosted docs'],
          ['Weakness', 'One task hides which model failed. Coarse retries', 'Parsing overhead. Very large projects make heavy DAGs', 'An image to build and a cluster to run', 'Another platform and another bill'],
          ['Pick it when', 'Small and medium projects, tag selectors', 'Large projects that need model-level visibility', 'Dependency conflicts or strict isolation', 'The team already uses dbt Cloud']
        ],
        steps: [
          { upto: 1, say: 'How each works. BashOperator is the simplest. Cosmos turns every model into a task.' },
          { upto: 2, say: 'Strengths. Cosmos gives model-level retries. Containers give a pinned runtime.' },
          { upto: 3, say: 'Weaknesses. A BashOperator hides which model failed inside one task log.' },
          { upto: 4, say: 'When to pick each. Say your default and what would make you change.' }
        ],
        pick: '**BashOperator split by layer** to start: three tasks, simple, easy to debug. Move to **Cosmos** when you need model-level retries and visibility, and to a **container** when dependency isolation matters.'
      }),

      B.talk({
        id: 'm8-concepts', title: 'Airflow concepts you must be able to explain',
        say: 'Eight concepts cover most Airflow questions. One sentence each. Press Next.',
        items: [
          ['Operators, hooks, connections', 'An **operator** is a template for one unit of work. A **hook** wraps a connection to an external system. **Connections** hold credentials, ideally in a secrets backend.', 'Operators do work, hooks connect, connections store credentials.'],
          ['Sensors', 'Wait for a condition such as a file or another DAG. Use **reschedule mode** (or deferrable operators) so waiting does not hold a worker slot, and always set a **timeout**.', 'Sensors wait. Reschedule mode frees the worker.'],
          ['Retries', '`retries`, `retry_delay`, `retry_exponential_backoff`. Retry transient errors. A logic bug fails the same way every time, so more retries only delay the alert.', 'Retry transient failures, not bugs.'],
          ['Trigger rules', 'Decide when a task runs relative to upstream outcomes: `all_success` (default), `all_done`, `one_failed`, `none_failed`. Used for alerts and cleanup.', 'Trigger rules control when a task runs after failures.'],
          ['Pools', 'Limit how many tasks hit a shared resource at once, for example 4 concurrent tasks against the payments API or the Snowflake warehouse.', 'Pools cap concurrency on shared resources.'],
          ['Idempotency and the data interval', 'Tasks must give the same result when rerun. Use the logical date (`{{ ds }}`, `data_interval_start`), never the wall clock.', 'Use the logical date, not the clock.'],
          ['Catchup and backfill', '`catchup=False` avoids running every missed interval on deploy. A deliberate backfill reruns a date range, safe only because tasks are idempotent.', 'Catchup off by default. Backfill on purpose.'],
          ['XCom', 'Passes **small** values between tasks (counts, paths, statuses). Never data. Pass a pointer to the data instead.', 'XCom carries pointers, not data.']
        ],
        cols: 2
      }),

      B.decide({
        id: 'm8-dec', title: 'Architecture decision: Airflow or Snowflake Tasks?',
        scenario: 'The pipeline has **three Python extractors**, waits for files in **S3**, runs **dbt**, needs **retries, alerts and backfills**, and must finish by **07:00**. A colleague suggests: "Snowflake Tasks can schedule SQL. Let us run everything there and drop Airflow."',
        opts: [
          { t: 'Snowflake Tasks only', d: 'Everything scheduled inside Snowflake.', lose: 'Tasks cannot run Python extractors that call outside APIs, wait for S3 files, run dbt Core with tests as gates, or give rich retry, alerting and backfill history.' },
          { t: 'Airflow orchestrates the whole pipeline, dbt runs inside Snowflake', d: 'Airflow for order and operations, Snowflake for the data work.' },
          { t: 'Airflow plus Snowflake Tasks inside it', d: 'Both, with Tasks for in-warehouse micro-batches.', lose: 'Valid as an extension, but not the starting point. Two schedulers means two places to look when something fails.' },
          { t: 'A cron job on a VM', d: 'Simplest possible.', lose: 'No dependency graph, no retries, no history, no alerting. Fine for one script, not for a platform.' }
        ],
        pick: 1,
        why: 'The pipeline **crosses systems**: external APIs, S3, dbt, quality tools and alerts. Airflow gives dependencies, retries, sensors, backfills and one place to see everything. Snowflake does the data work.',
        when: '**Snowflake Tasks win** when the pipeline lives entirely inside Snowflake: SQL transformations triggered by a schedule or a stream, near-real-time micro-batches, a small team and no external infrastructure to run.'
      }),

      B.bug({
        id: 'm8-bug', say: 'This file passes code review and quietly annoys the scheduler. Find it.', q: 'This DAG file works, but the scheduler slows down and the metadata API owner complains about traffic. Which line is the problem?',
        file: 'dags/load_tables.py', lang: 'python', code: BUGDAG, bad: [7],
        why: 'Code at the **top level** of a DAG file runs every time the scheduler parses it, roughly every 30 seconds. This line calls an API on every parse, slows parsing, and removes the DAG from the UI whenever that API is down. Keep top-level code cheap and static.',
        fix: 'import json\n\nTABLES = json.load(open("/opt/airflow/config/tables.json"))   # static config in the repo\n# or: build the task list at run time with dynamic task mapping (.expand)',
        hint: 'Which line does real work when the file is merely read, before any task runs?'
      }),

      B.quiz({
        id: 'm8-q1', q: '40 sensors each wait up to 3 hours for a file. Workers are running out of slots. Which setting fixes it?',
        opts: [
          { t: 'mode="poke" with a 1-second interval', fb: 'Poke mode holds the worker slot for the whole wait. A shorter interval makes it worse.' },
          { t: 'mode="reschedule"', fb: '' },
          { t: 'Increase retries to 10', fb: 'Retries are for failures, not for waiting.' },
          { t: 'Replace the sensor with a PythonOperator that sleeps', fb: 'Sleeping holds the slot too, and is hard to monitor.' }
        ],
        ok: 1, why: 'In **reschedule** mode the sensor releases its worker slot between checks, so 40 sensors cost almost nothing. **Deferrable operators** go further by moving the waiting to a lightweight triggerer process.'
      }),

      B.quiz({
        id: 'm8-q2', q: 'The `alert` task must run only when something upstream failed. Which trigger rule?',
        opts: ['all_success', 'all_done', 'one_failed', 'none_failed'], ok: 2,
        why: '`one_failed` runs the task as soon as any upstream task fails. `all_done` would run it every time, success or not. `all_success` is the default and would never run after a failure.'
      }),

      B.order({
        id: 'm8-ord', q: 'The DAG failed at 05:10. Put the triage steps in order.',
        items: ['Open the failed task log and the Datadog alert', 'Decide: transient (timeout, 503) or a real bug (SQL error, test failure)?', 'Check upstream: did the files arrive, are the row counts right?', 'Fix the cause, or simply retry if it was transient', 'Clear the failed task and its downstream tasks so only needed work reruns', 'Confirm the SLA recovered and write the recovery steps in the runbook'],
        why: 'Read the evidence, classify, check upstream, fix, **rerun the minimum**, then document. The last step is what turns an incident into a runbook.'
      }),

      B.qa({
        id: 'qa-af-dbt', tag: 'Airflow', secs: 60,
        q: 'How do you integrate dbt with Airflow?',
        pts: ['dbt in the repo or a versioned image', 'BashOperator split by layer, tag selectors', 'Cosmos when model-level visibility is needed, container for isolation', 'Post-run task reads run_results.json, pushes metrics, alerts', 'Secrets via connections, key-pair service user'],
        short: 'I run dbt from Airflow with the project in the same repo or a versioned image. For most projects I use BashOperator tasks split by layer: a source freshness task, then dbt build for staging, then for intermediate and marts, with tests acting as gates. A failure points to a layer, and a retry is cheap. If a team needs model-level visibility and retries, I use Astronomer Cosmos, which renders each model as an Airflow task. If dependency conflicts matter, I run dbt in a container with KubernetesPodOperator or DockerOperator.\n\nAfter the run, a Python task reads run_results.json, pushes metrics to Datadog and alerts on failures. Secrets come from Airflow connections or a secrets backend, and Snowflake authentication uses a key-pair service user.',
        fu: [
          ['Why split by layer instead of one dbt build?', 'A failure points straight at a layer, a retry reruns only that layer, and I can put quality gates between layers. One big task gives you one big log and one big retry.'],
          ['How do you pass the run date to dbt?', 'Airflow templating inside bash_command: `--vars \'{run_date: {{ ds }}}\'`. dbt reads it with `var(\'run_date\')`. That keeps backfills reproducible.'],
          ['How do you control load on Snowflake?', 'dbt `--threads` inside a task, Airflow pools across tasks, and a dedicated transform warehouse so dbt cannot slow BI.']
        ],
        trap: 'Saying "I use BashOperator" and stopping. Explain the **split by layer**, the gates, and the **post-run metrics**.'
      }),

      B.qa({
        id: 'qa-af-fail', tag: 'Airflow', secs: 75,
        q: 'How do you handle failures, retries and SLAs for production Airflow pipelines?',
        pts: ['Idempotent tasks so retries are safe', 'Retries with exponential backoff for transient errors only', 'Sensors in reschedule mode with timeouts', 'Failure callbacks to Slack, on-call paging by trigger rule', 'Datadog: duration, missing run, freshness lag', 'Runbooks. Resume: 40+ workflows at Wells Fargo'],
        short: 'Failures are expected, so I design for them. Tasks are idempotent, so a retry is safe. I set two retries with exponential backoff for transient errors such as API 503s or Snowflake timeouts, and none for logic errors that would fail the same way. Sensors use reschedule mode with a timeout.\n\nEach task has a failure callback that posts to Slack with the log link, and a final task pages on-call only when the critical path failed, using the one_failed trigger rule. For SLAs, Airflow sends metrics to Datadog and I alert on DAG duration, on a missing successful run by a deadline, and on freshness lag taken from dbt artifacts.\n\nAt Wells Fargo I keep more than 40 production workflows reliable this way, and I write recovery steps into a runbook so whoever is on call can fix it without asking me.',
        fu: [
          ['What is the difference between a retry and a rerun?', 'A retry is automatic and immediate within the same run for a transient error. A rerun is a human decision after a fix: clear the failed task and its downstream tasks so only needed work repeats.'],
          ['How do you stop a bad dataset from reaching consumers?', 'Quality gates between stages. A failed dbt test fails the task, downstream tasks are not run, and the previous good marts stay in place.'],
          ['How do you measure the SLA?', 'The DAG sends run duration and finish time to Datadog. A monitor fires if the successful run has not completed by the deadline, or if freshness lag exceeds the agreed threshold.']
        ],
        trap: 'Describing retries as the whole answer. Seniors also describe **gates, alerting, SLAs and runbooks**.',
        real: 'Add one real incident from Wells Fargo or Bank of America: what failed, how you found it, how long it took, what you changed afterwards.'
      }),

      B.qa({
        id: 'qa-af-tasks', tag: 'Airflow (JD)', secs: 60,
        q: 'The job mentions Apache Airflow or Snowflake Tasks. How do you decide which to use?',
        pts: ['Airflow for cross-system pipelines and rich operations', 'Tasks for in-Snowflake SQL, schedule or stream driven', 'Retries, backfills, alerts, history favour Airflow', 'Low operational overhead favours Tasks', 'They complement each other'],
        short: 'I use Airflow when the pipeline spans systems or needs rich operations: Python extractors, S3 sensors, dbt, quality tools, alerting, backfills and a visible history. Snowflake Tasks fit pipelines that live entirely inside Snowflake: SQL transformations triggered by a schedule or a stream, near-real-time micro-batches, with no extra infrastructure to run. They are cheap to operate and keep the logic next to the data.\n\nFor this platform Airflow orchestrates the whole day and dbt does the transformations in Snowflake. I would still use a Task with a stream for a self-contained micro-batch, for example refreshing a small table every few minutes, and monitor it from Airflow. So they complement each other.',
        fu: [
          ['What are the limits of Snowflake Tasks?', 'No native way to wait for external events, run Python on external systems, or run dbt Core with its gates. Retry, alerting and backfill tooling is thinner, and the history is only in Snowflake.'],
          ['How would you run dbt on a schedule without Airflow?', 'dbt Cloud jobs, or a container on a scheduler, or Snowflake\'s own support for running dbt projects with a Task. I would still want alerting and gates, so I check what it offers before committing.']
        ],
        trap: 'Declaring one tool the winner. The right answer is **"it depends on where the work lives"**, with a clear rule.'
      }),

      B.qa({
        id: 'qa-backfill', tag: 'Airflow', secs: 45, opt: true,
        q: 'How would you safely backfill a month of data?',
        pts: ['Tasks are idempotent and use the logical date', 'Run the backfill deliberately, not via catchup', 'Limit concurrency: max_active_runs and pools', 'Use a separate warehouse or off-hours', 'Reconcile totals afterwards'],
        short: 'First I confirm the tasks are idempotent and use the logical date, so rerunning a day overwrites instead of duplicating. Then I run the backfill deliberately with the Airflow backfill command for the date range, rather than turning catchup on. I limit concurrency with max_active_runs and pools, so I do not swamp the source API or the Snowflake warehouse, and I often run it off-hours on a separate warehouse. Afterwards I reconcile row counts and key totals per day against the source.',
        fu: [['What if dbt models are incremental?', 'Pass the date range as a variable and either rebuild those partitions or run a full refresh for small tables. A lookback window alone will not reach a month back.']]
      }),

      B.recap({
        id: 'm8-recap', n: 8, badge: 'Airflow Operator', color: '#99F6E4',
        pts: [
          'A DAG is tasks plus dependencies. **Fan-out** parallel work, **fan-in** at a sensor or gate.',
          'Retry **transient** failures with backoff. Sensors: **reschedule** mode plus a timeout.',
          '`trigger_rule="one_failed"` for alerts. Pools cap shared resources. XCom carries pointers.',
          'Use the **logical date**, not the clock, so tasks are idempotent and backfills are safe.',
          'Airflow for cross-system pipelines. Snowflake Tasks for in-warehouse SQL.'
        ],
        lines: [
          'A failed gate stops the chain and yesterday\'s marts stay in place, so consumers keep good data.',
          'I split dbt by layer so a failure points at a layer and a retry is cheap.',
          'Airflow orchestrates, dbt transforms inside Snowflake, Datadog watches the SLA.'
        ]
      })
    ]
  });
})();
