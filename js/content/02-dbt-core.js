/* Mission 3: dbt Core essentials. */
(function () {
  var B = LAB.b;

  var TREE = [
    'risk_platform/',
    '  dbt_project.yml',
    '  packages.yml',
    '  models/',
    '    staging/',
    '      core/',
    '        _core.yml',
    '        stg_core__loans.sql',
    '      payments/',
    '        stg_payments__txns.sql',
    '    intermediate/',
    '      int_loan_payments.sql',
    '      int_loan_exposure.sql',
    '    marts/',
    '      _marts.yml',
    '      dim_customer.sql',
    '      fct_loan_exposure.sql',
    '      mart_risk_summary.sql',
    '  macros/',
    '    cents_to_dollars.sql',
    '  seeds/',
    '    loan_status_codes.csv',
    '    lgd_by_collateral.csv',
    '  snapshots/',
    '    snap_customers.sql',
    '  tests/',
    '    assert_no_negative_exposure.sql'
  ].join('\n');

  var STG = [
    "{{ config(materialized='view') }}",
    '',
    'with source as (',
    '',
    "    select * from {{ source('core', 'loans') }}",
    '',
    '),',
    '',
    'renamed as (',
    '',
    '    select',
    '        loan_id,',
    '        cust_id                                    as customer_id,',
    "        {{ cents_to_dollars('principal_cents') }}  as principal_usd,",
    '        status_cd,',
    '        collateral_cd                              as collateral_code,',
    "        to_date(orig_dt, 'YYYYMMDD')               as originated_on,",
    '        upd_ts                                     as updated_at',
    '    from source',
    '',
    ')',
    '',
    'select',
    '    r.loan_id,',
    '    r.customer_id,',
    '    r.principal_usd,',
    '    s.loan_status,',
    '    r.collateral_code,',
    '    r.originated_on,',
    '    r.updated_at',
    'from renamed r',
    "left join {{ ref('loan_status_codes') }} s",
    '    on r.status_cd = s.status_cd'
  ].join('\n');

  var STG_COMPILED = [
    'create or replace view risk_db.staging.stg_core__loans as (',
    '',
    'with source as (',
    '',
    '    select * from risk_db.raw.core_loans',
    '',
    '),',
    '',
    'renamed as (',
    '',
    '    select',
    '        loan_id,',
    '        cust_id                                    as customer_id,',
    '        (principal_cents / 100.0)::number(18, 2)  as principal_usd,',
    '        status_cd,',
    '        collateral_cd                              as collateral_code,',
    "        to_date(orig_dt, 'YYYYMMDD')               as originated_on,",
    '        upd_ts                                     as updated_at',
    '    from source',
    '',
    ')',
    '',
    'select',
    '    r.loan_id,',
    '    r.customer_id,',
    '    r.principal_usd,',
    '    s.loan_status,',
    '    r.collateral_code,',
    '    r.originated_on,',
    '    r.updated_at',
    'from renamed r',
    'left join risk_db.seeds.loan_status_codes s',
    '    on r.status_cd = s.status_cd',
    ');'
  ].join('\n');

  var YML = [
    'version: 2',
    '',
    'sources:',
    '  - name: core',
    '    database: risk_db',
    '    schema: raw',
    '    loaded_at_field: _loaded_at',
    '    freshness:',
    '      warn_after: {count: 12, period: hour}',
    '      error_after: {count: 24, period: hour}',
    '    tables:',
    '      - name: loans',
    '        identifier: core_loans',
    '      - name: customers',
    '        identifier: core_customers',
    '',
    'models:',
    '  - name: stg_core__loans',
    '    columns:',
    '      - name: loan_id',
    '        data_tests:',
    '          - unique',
    '          - not_null',
    '      - name: customer_id',
    '        data_tests:',
    '          - relationships:',
    "              to: source('core', 'customers')",
    '              field: cust_id',
    '      - name: loan_status',
    '        data_tests:',
    '          - accepted_values:',
    "              values: ['ACTIVE', 'CLOSED', 'DEFAULTED']"
  ].join('\n');

  var BUGMODEL = [
    "{{ config(materialized='view') }}",
    '',
    'select',
    '    payload:txn_id::string                  as txn_id,',
    '    payload:loan_id::string                 as loan_id,',
    '    payload:amount::number(18, 2)           as amount_usd,',
    '    upper(payload:currency::string)         as currency,',
    '    payload:posted_at::timestamp_ntz        as posted_at,',
    '    payload:status::string                  as status',
    'from risk_db.raw.payments_txns'
  ].join('\n');

  /* dbt build script items. node = lineage node id */
  function items(fail) {
    var L = [
      { kind: 'seed', name: 'loan_status_codes', schema: 'seeds', ms: 800, n: 3, node: 'seed_status' },
      { kind: 'seed', name: 'lgd_by_collateral', schema: 'seeds', ms: 700, n: 3, node: 'seed_lgd' },
      { kind: 'snapshot', name: 'snap_customers', schema: 'snapshots', ms: 1400, node: 'snap_cust', res: 'ok' },
      { kind: 'view', name: 'stg_core__loans', schema: 'staging', ms: 640, node: 'stg_loans', res: 'ok' },
      { kind: 'test', name: 'unique_stg_core__loans_loan_id', ms: 450, res: 'ok' },
      { kind: 'test', name: 'not_null_stg_core__loans_loan_id', ms: 420, res: 'ok' },
      { kind: 'view', name: 'stg_payments__txns', schema: 'staging', ms: 700, node: 'stg_txns', res: 'ok' },
      { kind: 'test', name: 'unique_stg_payments__txns_txn_id', ms: 510, res: 'ok' },
      { kind: 'view', name: 'stg_risk__ratings', schema: 'staging', ms: 580, node: 'stg_ratings', res: 'ok' },
      { kind: 'table', name: 'int_loan_payments', schema: 'intermediate', ms: 2100, node: 'int_pay', res: 'ok' },
      { kind: 'table', name: 'int_loan_exposure', schema: 'intermediate', ms: 3400, node: 'int_exp', res: 'ok' },
      { kind: 'test', name: 'not_null_int_loan_exposure_expected_loss_usd', ms: 480, res: 'ok' },
      { kind: 'table', name: 'dim_customer', schema: 'marts', ms: 1200, node: 'dim_cust', res: 'ok' },
      { kind: 'test', name: 'unique_dim_customer_customer_key', ms: 400, res: 'ok' },
      { kind: 'incremental', name: 'fct_loan_exposure', schema: 'marts', ms: 4100, node: 'fct_exp', res: 'ok' },
      fail ? { kind: 'test', name: 'unique_fct_loan_exposure_loan_key', ms: 610, res: 'fail', n: 3, node: 'fct_exp' }
           : { kind: 'test', name: 'unique_fct_loan_exposure_loan_key', ms: 610, res: 'ok' },
      { kind: 'test', name: 'not_null_fct_loan_exposure_risk_tier', ms: 380, res: 'ok' },
      { kind: 'table', name: 'fct_payments', schema: 'marts', ms: 1900, node: 'fct_pay', res: 'ok' },
      { kind: 'table', name: 'mart_risk_summary', schema: 'marts', ms: 1500, node: 'mart_sum', res: fail ? 'skip' : 'ok' },
      { kind: 'test', name: 'not_null_mart_risk_summary_segment', ms: 390, res: fail ? 'skip' : 'ok' }
    ];
    return L;
  }
  var FOUND = 'Found 9 models, 2 seeds, 1 snapshot, 8 data tests, 4 sources, 2 exposures, 612 macros';
  function okLines() { return LAB.Term.dbt('dbt build --target prod', items(false), { found: FOUND, total: '19.40' }); }
  function failLines() {
    var ls = LAB.Term.dbt('dbt build --target prod', items(true), {
      found: FOUND, total: '17.90',
      errorBlock: ['', '  Failure in test unique_fct_loan_exposure_loan_key (models/marts/_marts.yml)', '    Got 3 results, configured to fail if != 0', '', '  compiled code at target/compiled/risk_platform/models/marts/_marts.yml/unique_fct_loan_exposure_loan_key.sql']
    });
    ls.splice(ls.length - 2, 0, { c: 'warn', t: '(exposure risk_dashboard is now stale: its parent mart_risk_summary was skipped)', d: 100, node: 'x_dash', st: 'skip' });
    return ls;
  }
  var INITIAL_SRC = { core_loans: 'ok', core_customers: 'ok', pay_txns: 'ok', risk_ratings: 'ok' };

  LAB.addChapter({
    id: 'm3', n: 3, title: 'dbt Core essentials', short: 'dbt Core', blurb: 'Project, lineage, ref, build, tests', minutes: 28,
    focus: ['stg', 'int', 'mart'],
    goals: [
      'Say in one sentence **what dbt does and does not do**.',
      'Draw the **project structure** and the lineage graph.',
      'Explain **ref() vs source()**, materializations, seeds, snapshots and tests.',
      'Read a **dbt build log** and explain what happens when a test fails.'
    ],
    say: 'Mission 3 is the foundation for the whole job description. Anything advanced in Mission 4 builds on these ideas, so take the time to say each answer out loud.',
    scenes: [
      B.talk({
        id: 'm3-what', title: 'What dbt does',
        say: 'Four sentences describe dbt. Press Next to reveal them one at a time. If you can say all four, you can answer any opening dbt question.',
        items: [
          ['dbt is the T in ELT', 'You load raw data into Snowflake first. dbt turns it into clean models **inside the warehouse** using SELECT statements. Extraction and loading happen somewhere else.', 'One: dbt is the transform step. Extract and load happen before it.'],
          ['It sends SQL. Snowflake runs it', 'dbt Core is a Python command line tool. It compiles your SQL and Jinja and **sends** the result to Snowflake. It does no data processing itself.', 'Two: dbt compiles and sends SQL. Snowflake does the data work. Interviewers listen for this exact point.'],
          ['It builds in dependency order', 'Every `ref()` and `source()` is a dependency. dbt builds a graph (a DAG) and runs models in the right order, in parallel where it can.', 'Three: the dependency graph. You never write the run order by hand.'],
          ['It adds software habits to SQL', 'Git, code review, tests, generated documentation, separate environments, CI. The same discipline application code already has.', 'Four: engineering discipline for SQL. That is why teams adopt it.']
        ],
        cols: 2
      }),

      B.code({
        id: 'm3-tree', title: 'The project structure', file: 'risk_platform/ (your dbt project)', lang: 'text', code: TREE,
        steps: [
          { say: 'This is a dbt project folder. It is plain files in Git. Press Next and I will mark each part and say what it does.', lines: null },
          { say: 'Two config files. dbt_project.yml names the project and sets defaults, such as models in staging are views. packages.yml lists packages such as dbt_utils. The Snowflake connection lives in profiles.yml, outside the repo, so no secrets are committed.', lines: [2, 3] },
          { say: 'Staging. One folder per source system, one model per source table, named stg_source__table. The yml file declares sources and their tests.', lines: [5, 10] },
          { say: 'Intermediate. Business logic and joins. These models are not exposed to consumers.', lines: [11, 13] },
          { say: 'Marts. The final facts and dimensions. fct_ means fact, dim_ means dimension. These are the only models consumers are allowed to read.', lines: [14, 18] },
          { say: 'Macros are reusable Jinja functions. Seeds are small CSV files that dbt loads as tables, good for lookups like status codes. Never use seeds for large data. A seed with two million rows is a mistake.', lines: [19, 23] },
          { say: 'Snapshots track history of changing records (SCD Type 2). Singular tests are SQL files that must return zero rows.', lines: [24, 27] }
        ]
      }),

      B.flow({
        id: 'm3-dag', title: 'The lineage graph dbt builds for you', g: 'lineage',
        steps: [
          { say: 'dbt reads every ref and source call and draws this graph automatically. Five columns: sources and seeds, staging, intermediate, marts, and the consumers. Press Next to follow the arrows.', cap: 'You **never** write the build order. The graph is the build order.' },
          { say: 'Sources and seeds feed staging. source() points at a raw table. A seed is a CSV that dbt loads. The customers table goes through a snapshot, so history is kept.',
            focus: ['L0', 'L1', 'core_loans', 'core_customers', 'pay_txns', 'risk_ratings', 'seed_status', 'stg_loans', 'snap_cust', 'stg_txns', 'stg_ratings'],
            on: ['core_loans>stg_loans', 'seed_status>stg_loans', 'core_customers>snap_cust', 'pay_txns>stg_txns', 'risk_ratings>stg_ratings'],
            cap: '`source()` for raw tables. `ref()` for everything else dbt builds, seeds and snapshots included.' },
          { say: 'Intermediate models join staging models together. int_loan_exposure depends on five things: loans, customers, ratings, payments and the loss-rate seed.',
            focus: ['L1', 'L2', 'stg_loans', 'snap_cust', 'stg_txns', 'stg_ratings', 'seed_lgd', 'int_pay', 'int_exp'],
            on: ['stg_txns>int_pay', 'stg_loans>int_exp', 'snap_cust>int_exp', 'stg_ratings>int_exp', 'seed_lgd>int_exp', 'int_pay>int_exp'],
            cap: 'This is where **joins and business rules** live. Staging stays simple.' },
          { say: 'Marts publish facts and dimensions. The summary mart is built on the fact and the dimension.',
            focus: ['L2', 'L3', 'int_exp', 'int_pay', 'snap_cust', 'dim_cust', 'fct_pay', 'fct_exp', 'mart_sum'],
            on: ['int_exp>fct_exp', 'int_pay>fct_pay', 'snap_cust>dim_cust', 'fct_exp>mart_sum', 'dim_cust>mart_sum'], cap: 'Only these tables are granted to consumers.' },
          { say: 'The last column is exposures. You declare who uses a model, such as the API and a dashboard. Change a mart and dbt can list exactly which consumers are affected.',
            focus: ['L3', 'L4', 'fct_exp', 'mart_sum', 'x_api', 'x_dash'], on: ['fct_exp>x_api', 'mart_sum>x_dash'], cap: '**Exposures** answer the question "who breaks if I change this?"' }
        ]
      }),

      B.code({
        id: 'm3-stg', title: 'A staging model, line by line', file: 'models/staging/core/stg_core__loans.sql', lang: 'jinja', code: STG,
        compiled: { file: 'target/compiled/.../stg_core__loans.sql', lang: 'sql', code: STG_COMPILED },
        steps: [
          { say: 'This is the model behind hop 5 of the pipeline. It is a SELECT statement and a few Jinja calls. Press Next to walk through it.', lines: null },
          { say: 'The config block. Staging models are views: no storage, always fresh, cheap to run.', lines: [1, 1] },
          { say: 'source() points at the raw table. dbt turns it into RISK_DB.RAW.CORE_LOANS and also adds an arrow in the lineage graph.', lines: [3, 7] },
          { say: 'Rename and cast. Source column names become one naming standard, the date text becomes a real date, and cents become dollars through a macro. We write that macro in the next mission.', lines: [9, 21] },
          { say: 'ref() points at a model or seed that dbt manages, here the status code seed. This join turns A into ACTIVE.', lines: [23, 33] },
          { say: 'The panel below is what Snowflake actually receives. Jinja is gone. Source and ref became full table names. The macro became plain SQL. This is the compile step.', lines: null, compiled: true, clines: [14, 14] },
          { say: 'Compare the two panels. Same structure, but plain SQL with real names. When something fails, read the compiled SQL in target/compiled. It is the exact text Snowflake ran.', lines: [5, 5], compiled: true, clines: [5, 5] }
        ]
      }),

      B.code({
        id: 'm3-yml', title: 'Sources, freshness and tests in YAML', file: 'models/staging/core/_core.yml', lang: 'yaml', code: YML,
        note: 'dbt 1.10 and later prefer test arguments under an `arguments:` key and warn about the layout shown here. Older projects use this layout, so know both.',
        steps: [
          { say: 'YAML sits next to the models. It declares sources, adds freshness checks, and attaches tests to columns. Press Next to go through it.', lines: null },
          { say: 'A source is a raw table that someone else loads. Naming it lets staging use source(core, loans).', lines: [3, 6] },
          { say: 'Freshness. If the newest _loaded_at is older than 12 hours, dbt warns. Older than 24 hours, it errors. Run it with dbt source freshness before building.', lines: [7, 10] },
          { say: 'The identifier maps a friendly dbt name to the real table name. Rename the physical table later and you change one line.', lines: [11, 15] },
          { say: 'Two basic tests on the primary key. unique and not_null. Snowflake does not enforce primary keys on normal tables, so dbt tests are what actually protect uniqueness.', lines: [17, 23] },
          { say: 'The relationships test is a foreign key check. Every customer_id on a loan must exist in the customers table. It finds orphans.', lines: [24, 28] },
          { say: 'accepted_values catches surprises. If the source starts sending a new status code, this test fails and tells you.', lines: [29, 32] }
        ]
      }),

      B.term({
        id: 'm3-build', title: 'dbt build (everything passes)', g: 'lineage', initial: INITIAL_SRC, lines: okLines,
        say: 'Here is dbt build running on the project, and the lineage graph filling in as it goes. Watch the lines: seeds, then the snapshot, then each model followed by its tests. Yellow is running, green is done.',
        doneSay: 'Done. 20 nodes passed. Notice the order: every model finished before its children started, and each test ran right after its model.',
        after: 'Read the final line: **PASS=20** counts models, seeds, snapshots and tests together. In real life you also read the number of rows and the timing of each model.'
      }),

      B.term({
        id: 'm3-fail', title: 'dbt build (a test fails)', g: 'lineage', initial: INITIAL_SRC, lines: failLines, afterKind: 'warn',
        say: 'Same build, but a duplicate loan key sneaks in. Watch what happens after the red line.',
        doneSay: 'The unique test failed with 3 duplicate rows. dbt skipped everything downstream of that model, so the summary mart and the dashboard never saw bad data. Notice the independent fct_payments still built. That is the gate working.',
        after: '**What to do:** open the compiled test SQL, run it to see the 3 duplicate keys, trace them upstream to the staging model, fix, rebuild. The rows are the evidence, so keep them with `store_failures`.'
      }),

      B.cmp({
        id: 'm3-mat', title: 'Materializations: how a model is built',
        say: 'One config line decides what dbt creates in Snowflake. Four options matter for the interview. Press Next for each.',
        cols: ['', 'view', 'table', 'incremental', 'ephemeral'],
        rows: [
          ['dbt creates', 'a view', 'a table, rebuilt on every run', 'a table; only new and changed rows are merged in', 'nothing. The SQL is pasted into child models as a CTE'],
          ['Use it for', 'staging models', 'marts of modest size, intermediate models reused a lot', 'large facts and event data', 'tiny reusable snippets'],
          ['Watch out for', 'slow if stacked on heavy logic', 'rebuild cost grows with data. Replace drops grants and masking policies', 'late data, schema changes, needs a unique key and a refresh plan', 'cannot be queried, harder to debug']
        ],
        steps: [
          { upto: 1, say: 'First row: what actually gets created. A view stores a query. A table stores rows. Incremental keeps the table and updates it. Ephemeral creates nothing.' },
          { upto: 2, say: 'Where I use each. Staging as views. Marts as tables. Big facts as incremental. Ephemeral almost never.' },
          { upto: 3, say: 'And the traps. Mention the replace-drops-policies point in an interview. It shows you have run this in production.' }
        ],
        pick: '**Staging = view. Intermediate = table (or view if cheap). Marts = table, and incremental when a fact is large.** Set it once per folder in dbt_project.yml instead of per model.'
      }),

      B.order({
        id: 'm3-life', q: 'Put what happens during dbt build in order.',
        items: ['dbt parses SQL, YAML and macros', 'dbt builds the dependency graph from ref() and source()', 'dbt selects the nodes you asked for', 'dbt compiles each model\'s Jinja into plain SQL', 'dbt sends the SQL to Snowflake in dependency order, in parallel', 'each model\'s tests run right after it', 'dbt writes manifest.json and run_results.json'],
        why: 'Parse, graph, select, compile, run in order with threads, test after each model, write artifacts. The two JSON files power docs, slim CI and monitoring.'
      }),

      B.talk({
        id: 'm3-art', title: 'The files dbt leaves behind',
        say: 'Three files you should be able to name. They come up when you talk about CI and monitoring.',
        items: [
          ['`manifest.json`', 'The whole project in one file: every model, test, source, dependency, and compiled SQL. CI compares two manifests to find **what changed** (`state:modified+`).', 'The manifest is the map of the project.'],
          ['`run_results.json`', 'What happened in the last run: status and timing of every node. Pipelines read it to push metrics and alerts, for example row counts and run time to Datadog.', 'Run results are the report card of the last run.'],
          ['`catalog.json` and the docs site', '`dbt docs generate` queries Snowflake for column info and writes the catalog. The docs site shows lineage, descriptions and tests for every model.', 'The catalog feeds the documentation site.'],
          ['`profiles.yml` (not in Git)', 'Account, role, warehouse, database, schema and auth. Targets such as `dev`, `ci` and `prod` switch these. Secrets come from environment variables or a secrets manager, never from the repo.', 'Connection details stay outside the repo, always.']
        ],
        cols: 2
      }),

      B.quiz({
        id: 'm3-q1', q: 'A staging model must read the table RISK_DB.RAW.CORE_LOANS, which Snowpipe loads. Which should it use?',
        opts: [
          { t: 'ref(\'core_loans\')', fb: 'ref() is for things dbt builds. Snowpipe loads this table, so dbt does not manage it.' },
          { t: 'source(\'core\', \'loans\')', fb: '' },
          { t: 'The full name RISK_DB.RAW.CORE_LOANS typed directly', fb: 'That works but hard-codes the database. Dev builds would read production RAW and lineage and freshness checks are lost.' },
          { t: 'A seed', fb: 'Seeds are small CSV files in the repo, not large loaded tables.' }
        ],
        ok: 1,
        why: '`source()` is for tables **loaded by something other than dbt**. It gives you lineage, freshness checks and one place to change the database name. `ref()` is for everything dbt itself builds.'
      }),

      B.quiz({
        id: 'm3-q2', q: 'During dbt build, the unique test on model A fails (error severity). What happens to model B, which depends on A?',
        opts: [
          { t: 'B is built normally, and the test failure is only logged', fb: 'That is what dbt run plus dbt test as separate steps would allow. dbt build stops the chain.' },
          { t: 'B is skipped', fb: '' },
          { t: 'dbt deletes A', fb: 'dbt never deletes a model because a test failed.' },
          { t: 'dbt retries A until the test passes', fb: 'dbt does not retry. Retrying is the orchestrator\'s job.' }
        ],
        ok: 1,
        why: 'This is the main reason to use **dbt build** instead of run followed by test. A failed test **blocks everything downstream**, so bad data never moves forward.'
      }),

      B.bug({
        id: 'm3-bug', q: 'This staging model works in production but causes three problems for the team. Which line causes them?',
        file: 'models/staging/payments/stg_payments__txns.sql', lang: 'jinja', code: BUGMODEL, bad: [10],
        why: 'The table is **hard-coded**. A developer\'s dev build reads production RAW, dbt has no lineage edge to this table, and `dbt source freshness` cannot check it. Switching the database later means editing every model.',
        fix: BUGMODEL.replace('from risk_db.raw.payments_txns', "from {{ source('payments', 'txns') }}"),
        hint: 'Look at how the model names its input table. Which dbt function should it use instead?'
      }),

      B.qa({
        id: 'qa-dbt-arch', tag: 'dbt', secs: 60,
        q: 'How is your dbt project structured, and why?',
        pts: ['Staging, intermediate, marts, and what each layer may do', 'Sources with freshness, tests in YAML next to models', 'Macros for shared logic, seeds for small reference data', 'Folders map to schemas and permissions', 'Git and CI'],
        short: 'I use the staging, intermediate, marts pattern. Staging has one model per source table, built as views: rename, cast, deduplicate, standardize units, nothing else. Intermediate holds business logic and joins, for example combining loans, payments and ratings and calculating exposure. Marts are what consumers read, fact and dimension tables on a star schema, incremental where the data is large.\n\nSources are declared in YAML with freshness checks, tests sit next to the models, and shared logic lives in macros. Small reference data such as status codes and loss rates comes from seeds.\n\nFolders map to schemas, so permissions are simple: consumers get read access on marts only. Everything is in Git and CI builds changed models in an isolated schema before merge.',
        fu: [
          ['Why keep staging so simple?', 'Every downstream model sees the same cleaned data, and a source change touches one model instead of twenty. Joins and business rules in staging make that impossible.'],
          ['How do you name things?', '`stg_<source>__<table>`, `int_<what it does>`, `fct_` and `dim_` for marts. Predictable names make the lineage graph readable without opening files.'],
          ['When does one project become too big?', 'No fixed number. I split when ownership or deploy cadence differs. Before splitting I use model groups and access levels (public, protected, private) so teams only depend on contracted public models.']
        ],
        trap: 'Putting joins and business rules in staging, or reading raw tables directly from marts. That breaks the layering and the lineage.'
      }),

      B.qa({
        id: 'qa-dbt-build', tag: 'dbt', secs: 60,
        q: 'What happens when you run dbt build?',
        pts: ['Parses the project and builds the DAG from ref() and source()', 'Compiles Jinja into plain SQL', 'Runs seeds, snapshots, models in dependency order on threads', 'Runs each model\'s tests right after it, failures skip downstream', 'Writes manifest and run_results', 'dbt sends SQL, Snowflake executes it'],
        short: 'dbt build runs seeds, snapshots, models and tests in dependency order. First it parses the project, reading SQL, YAML and macros, and builds a graph from the ref and source calls. Then it selects the nodes I asked for, compiles each model\'s Jinja into plain SQL, and runs it against Snowflake on several threads while respecting dependencies.\n\nEach model\'s tests run right after it. If a test with error severity fails, everything downstream is skipped, so bad data does not move forward. At the end dbt writes manifest.json and run_results.json, which I use for slim CI, docs and alerting.\n\ndbt itself does no data processing. It sends SQL, and Snowflake does the work.',
        fu: [
          ['dbt run versus dbt build?', '`dbt run` only builds models. `dbt build` also runs seeds, snapshots and tests in DAG order and skips downstream nodes when an upstream test fails. In CI and production I use build because it enforces the quality gate.'],
          ['How do you rebuild only what changed?', '`--select state:modified+` with `--state` pointing at the production manifest, plus `--defer` so unchanged parents resolve to production tables. That is slim CI, and it turns a 40-minute build into a few minutes.'],
          ['How do you build one model and its parents?', '`dbt build --select +fct_loan_exposure`. A plus before the name adds parents, after it adds children.']
        ],
        trap: 'Describing dbt as if it runs the transformation itself. It compiles and sends SQL. Snowflake executes it.'
      }),

      B.qa({
        id: 'qa-core-cloud', tag: 'dbt', secs: 60,
        q: 'What is the difference between dbt Core and dbt Cloud, and why would you pick Core?',
        pts: ['Core is the open-source CLI, Cloud is the hosted platform', 'Same models, tests and macros in both', 'With Core you own orchestration, CI, hosting and secrets', 'Cloud adds IDE, scheduler, managed CI, docs hosting', 'Reason for Core: Airflow and CI already exist'],
        short: 'dbt Core is the open-source command line tool. I run it myself, so I own orchestration, CI, hosting and secrets. dbt Cloud is the hosted platform around it, with an IDE, a job scheduler, CI that builds only changed models, hosted docs and the semantic layer. The models, tests and macros are identical, so the skills transfer.\n\nI have run Core orchestrated by Airflow, with CI in Jenkins and GitHub Actions. I pick Core when the team already runs Airflow and CI, wants one orchestrator and one alerting path, and wants the pipeline definition fully in code.',
        fu: [
          ['What do you give up without Cloud?', 'The IDE, managed CI and scheduler UI. I replace them with pre-commit hooks and SQLFluff, a CI workflow that does slim builds with state and defer, and artifact storage for the production manifest.'],
          ['Would you ever choose Cloud?', 'Yes, for a small team with no platform engineer, or when analysts need a browser IDE and managed scheduling quickly. The migration path from Core is easy because the project is the same.']
        ],
        trap: 'Treating Core as the inferior option or a complicated one. Both run the same project, and the trade-off is **who runs the platform**.'
      }),

      B.recap({
        id: 'm3-recap', n: 3, badge: 'dbt Developer', color: '#BFDBFE',
        pts: [
          'dbt compiles and **sends** SQL. Snowflake executes it.',
          '`source()` for tables loaded by others. `ref()` for everything dbt builds.',
          'Staging = views, simple. Intermediate = joins and rules. Marts = facts and dimensions.',
          '`dbt build` = seeds, snapshots, models and tests in order. A failed test skips the children.',
          'Artifacts: manifest.json (the map), run_results.json (the report card).'
        ],
        lines: [
          'dbt writes the instructions. Snowflake runs them.',
          'I use source for loaded tables and ref for everything dbt builds, so lineage is always complete.',
          'In CI and production I run dbt build, so a failed test stops the chain.'
        ]
      })
    ]
  });
})();
