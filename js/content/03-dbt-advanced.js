/* Mission 4: advanced dbt (Jinja, macros, incremental, snapshots, hooks, Python). All snippets compiled in a real dbt project. */
(function () {
  var B = LAB.b;

  var JINJA = [
    "{% set statuses = ['ACTIVE', 'CLOSED', 'DEFAULTED'] %}",
    '',
    'select',
    '    customer_id,',
    '    {%- for s in statuses %}',
    "    count_if(loan_status = '{{ s }}') as {{ s | lower }}_loans{{ \",\" if not loop.last }}",
    '    {%- endfor %}',
    "from {{ ref('stg_core__loans') }}",
    'group by customer_id'
  ].join('\n');
  var JINJA_OUT = [
    'select',
    '    customer_id,',
    "    count_if(loan_status = 'ACTIVE') as active_loans,",
    "    count_if(loan_status = 'CLOSED') as closed_loans,",
    "    count_if(loan_status = 'DEFAULTED') as defaulted_loans",
    'from risk_db.staging.stg_core__loans',
    'group by customer_id'
  ].join('\n');

  var MACROS = [
    '{% macro cents_to_dollars(column_name, scale=2) -%}',
    '    ({{ column_name }} / 100.0)::number(18, {{ scale }})',
    '{%- endmacro %}',
    '',
    '{% macro risk_tier(pd_column) -%}',
    '    case',
    "        when {{ pd_column }} >= 0.10 then 'HIGH'",
    "        when {{ pd_column }} >= 0.03 then 'MEDIUM'",
    "        else 'LOW'",
    '    end',
    '{%- endmacro %}',
    '',
    '{% macro dedupe_latest(relation, key, order_by) -%}',
    '    select *',
    '    from {{ relation }}',
    '    qualify row_number() over (',
    '        partition by {{ key }} order by {{ order_by }} desc',
    '    ) = 1',
    '{%- endmacro %}'
  ].join('\n');

  var USE = [
    'select',
    '    loan_id,',
    "    {{ cents_to_dollars('principal_cents') }} as principal_usd,",
    "    {{ risk_tier('pd_score') }} as risk_tier",
    "from ({{ dedupe_latest(source('core', 'loans'), 'loan_id', 'upd_ts') }})"
  ].join('\n');
  var USE_OUT = [
    'select',
    '    loan_id,',
    '    (principal_cents / 100.0)::number(18, 2) as principal_usd,',
    '    case',
    "        when pd_score >= 0.10 then 'HIGH'",
    "        when pd_score >= 0.03 then 'MEDIUM'",
    "        else 'LOW'",
    '    end as risk_tier',
    'from (select *',
    '    from risk_db.raw.core_loans',
    '    qualify row_number() over (',
    '        partition by loan_id order by upd_ts desc',
    '    ) = 1)'
  ].join('\n');

  var INCR = [
    '{{ config(',
    "    materialized='incremental',",
    "    incremental_strategy='merge',",
    "    unique_key='loan_key',",
    "    on_schema_change='append_new_columns',",
    "    cluster_by=['as_of_date']",
    ') }}',
    '',
    'select',
    "    {{ dbt_utils.generate_surrogate_key(['loan_id', 'as_of_date']) }} as loan_key,",
    '    loan_id,',
    '    customer_id,',
    '    as_of_date,',
    '    outstanding_usd,',
    '    expected_loss_usd,',
    "    {{ risk_tier('pd_score') }} as risk_tier,",
    '    updated_at',
    "from {{ ref('int_loan_exposure') }}",
    '',
    '{% if is_incremental() %}',
    'where updated_at >= (',
    "    select dateadd('day', -{{ var('lookback_days') }}, max(updated_at)) from {{ this }}",
    ')',
    '{% endif %}'
  ].join('\n');
  var INCR_OUT = [
    'create or replace temporary table risk_db.marts.fct_loan_exposure__dbt_tmp as (',
    '    -- the model SELECT, with the incremental filter applied',
    '    select ... from risk_db.intermediate.int_loan_exposure',
    "    where updated_at >= (select dateadd('day', -3, max(updated_at))",
    '                         from risk_db.marts.fct_loan_exposure)',
    ');',
    '',
    'merge into risk_db.marts.fct_loan_exposure as dest',
    'using risk_db.marts.fct_loan_exposure__dbt_tmp as src',
    '    on src.loan_key = dest.loan_key',
    'when matched then update set',
    '    outstanding_usd = src.outstanding_usd,',
    '    expected_loss_usd = src.expected_loss_usd,',
    '    updated_at = src.updated_at          -- and every other column',
    'when not matched then insert',
    '    (loan_key, loan_id, outstanding_usd, ...)',
    '    values (src.loan_key, src.loan_id, src.outstanding_usd, ...);'
  ].join('\n');

  var SNAP = [
    '{% snapshot snap_customers %}',
    '',
    '{{',
    '    config(',
    "        target_schema='snapshots',",
    "        unique_key='cust_id',",
    "        strategy='timestamp',",
    "        updated_at='upd_ts'",
    '    )',
    '}}',
    '',
    "select * from {{ source('core', 'customers') }}",
    '',
    '{% endsnapshot %}'
  ].join('\n');

  var GTEST = [
    '{% test positive_value(model, column_name) %}',
    '',
    'select *',
    'from {{ model }}',
    'where {{ column_name }} < 0',
    '',
    '{% endtest %}'
  ].join('\n');

  var PROJ = [
    'name: risk_platform',
    'profile: risk_platform',
    '',
    'vars:',
    '  lookback_days: 3',
    '',
    'models:',
    '  risk_platform:',
    '    staging:',
    '      +materialized: view',
    '    intermediate:',
    '      +materialized: table',
    '    marts:',
    '      +materialized: table',
    '      +grants:',
    "        select: ['ANALYST', 'API_READER']",
    '      dim_customer:',
    '        +post-hook: "alter table {{ this }} modify column ssn set masking policy governance.ssn_mask"',
    '',
    'on-run-end:',
    '  - "{{ audit_run_results(results) }}"'
  ].join('\n');

  var PYMODEL = [
    'import snowflake.snowpark.functions as F',
    '',
    '',
    'def model(dbt, session):',
    '    dbt.config(materialized="table")',
    '',
    '    exposure = dbt.ref("int_loan_exposure")   # a Snowpark DataFrame',
    '',
    '    return exposure.with_column(',
    '        "risk_tier",',
    '        F.when(F.col("PD_SCORE") >= 0.10, F.lit("HIGH"))',
    '         .when(F.col("PD_SCORE") >= 0.03, F.lit("MEDIUM"))',
    '         .otherwise(F.lit("LOW")),',
    '    )'
  ].join('\n');

  var RUNNER = [
    'from dbt.cli.main import dbtRunner',
    '',
    '',
    'def run_dbt(select: str) -> dict:',
    '    res = dbtRunner().invoke(["build", "--select", select, "--target", "prod"])',
    '    if not res.success:',
    '        raise RuntimeError(f"dbt build failed for {select}")',
    '    return {r.node.name: r.status.value for r in res.result.results}'
  ].join('\n');

  var BUGINC = [
    "{{ config(materialized='incremental', unique_key='loan_key') }}",
    '',
    'select',
    '    loan_key,',
    '    loan_id,',
    '    outstanding_usd,',
    '    created_at,',
    '    updated_at',
    "from {{ ref('int_loan_exposure') }}",
    '',
    '{% if is_incremental() %}',
    'where created_at > (select max(created_at) from {{ this }})',
    '{% endif %}'
  ].join('\n');

  var STATUS_MACRO = [
    '{% macro status_counts(column_name, values) -%}',
    '    {%- for v in values %}',
    "    count_if({{ column_name }} = '{{ v }}') as {{ v | lower }}_count{{ \",\" if not loop.last }}",
    '    {%- endfor %}',
    '{%- endmacro %}'
  ].join('\n');
  var DEV_MACRO = [
    "{% macro limit_in_dev(date_column, days=3) -%}",
    "    {%- if target.name == 'dev' %}",
    "    where {{ date_column }} >= dateadd('day', -{{ days }}, current_date)",
    '    {%- endif %}',
    '{%- endmacro %}'
  ].join('\n');

  LAB.addChapter({
    id: 'm4', n: 4, title: 'Advanced dbt', short: 'Advanced dbt', blurb: 'Jinja, macros, incremental, snapshots, Python', minutes: 34,
    focus: ['stg', 'int', 'mart'],
    goals: [
      'Write a **macro from scratch** and explain Jinja in 30 seconds.',
      'Build an **incremental model** with a merge key and a lookback window.',
      'Explain **snapshots, custom tests, hooks, grants and packages**.',
      'Answer the trap question: **"Python operators in the dbt flow"**.'
    ],
    say: 'Mission 4 is where senior candidates separate from the rest. The job description names Jinja, macros, seeds and Python operators. All the code you see here compiled in a real dbt project.',
    scenes: [
      B.code({
        id: 'm4-jinja', title: 'Jinja in 90 seconds', file: 'models/marts/loans_by_status.sql', lang: 'jinja', code: JINJA,
        compiled: { file: 'target/compiled/.../loans_by_status.sql', lang: 'sql', code: JINJA_OUT },
        steps: [
          { say: 'Jinja is a templating language. dbt runs it first and sends only the plain SQL to Snowflake. There are three brackets to remember: double curly prints a value, curly percent runs logic, curly hash is a comment.', lines: null },
          { say: 'A statement tag sets a variable. Here it is a list of statuses. Statement tags produce no output by themselves.', lines: [1, 1] },
          { say: 'A for loop writes one count_if column per status. loop.last stops a trailing comma on the final item. The minus in curly-percent-minus trims whitespace so the SQL stays tidy.', lines: [5, 7] },
          { say: 'ref() is also just Jinja. It resolves to the real table name and registers the dependency.', lines: [8, 8] },
          { say: 'Here is the result. Three columns generated from one list. Add a fourth status to the list and the SQL grows by itself.', lines: [5, 7], compiled: true, clines: [3, 5] }
        ]
      }),

      B.code({
        id: 'm4-macros', title: 'Macros: reusable SQL functions', file: 'macros/risk_macros.sql', lang: 'jinja', code: MACROS,
        steps: [
          { say: 'A macro is a function that returns text, usually SQL. These three are real examples from the project. Press Next.', lines: null },
          { say: 'cents_to_dollars. Arguments in brackets, a default value for scale. The dash before the closing percent trims whitespace so the result stays on one line.', lines: [1, 3] },
          { say: 'risk_tier returns a CASE expression. The thresholds live in one place. Change 0.03 once and every model follows.', lines: [5, 11] },
          { say: 'dedupe_latest returns a whole query. It takes a relation, a key and an ordering column. QUALIFY with ROW_NUMBER is the Snowflake way to keep the latest row per key.', lines: [13, 19] }
        ]
      }),

      B.code({
        id: 'm4-usage', title: 'Using the macros', file: 'models/staging/stg_loans_latest.sql', lang: 'jinja', code: USE,
        compiled: { file: 'target/compiled/.../stg_loans_latest.sql', lang: 'sql', code: USE_OUT },
        steps: [
          { say: 'This is how a model uses the three macros. Short, readable, and the logic is defined once.', lines: null },
          { say: 'Unit conversion in one call. The compiled panel shows the division and cast.', lines: [3, 3], compiled: true, clines: [3, 3] },
          { say: 'The risk tier. Notice the compiled CASE statement. The macro disappears completely.', lines: [4, 4], compiled: true, clines: [4, 8] },
          { say: 'The deduplication macro takes a source and returns a subquery. Notice how source() resolved to a real table name inside the macro.', lines: [5, 5], compiled: true, clines: [9, 13] }
        ]
      }),

      B.code({
        id: 'm4-incr', title: 'An incremental model', file: 'models/marts/fct_loan_exposure.sql', lang: 'jinja', code: INCR,
        compiled: { file: 'what dbt runs on Snowflake (simplified)', lang: 'sql', code: INCR_OUT },
        steps: [
          { say: 'This is the fact table from the pipeline map. It has millions of rows, so rebuilding it daily is wasteful. Incremental means only new and changed rows are processed. Press Next.', lines: null },
          { say: 'The config. Strategy merge, a unique key, and what to do when columns are added. cluster_by sets a Snowflake clustering key.', lines: [1, 7] },
          { say: 'The unique key is a surrogate key made from loan and date. That is the grain: one row per loan per day. dbt uses it to decide whether a row is an update or an insert.', lines: [10, 10] },
          { say: 'The incremental filter. is_incremental is true only when the table already exists and you are not doing a full refresh. The first run loads everything. Later runs read only recent rows.', lines: [20, 24] },
          { say: 'Note the lookback. We reread the last three days, not just rows newer than the maximum. Late or corrected rows get merged in, and the unique key prevents duplicates.', lines: [21, 23] },
          { say: 'And this is what dbt really runs: a temporary table with the filtered rows, then a MERGE on the key. You write a SELECT. dbt writes the MERGE.', lines: null, compiled: true, clines: [8, 15] }
        ]
      }),

      B.rows({
        id: 'm4-incr-rows', title: 'What an incremental run touches',
        steps: [
          { say: 'The target table already has two rows from earlier runs. The largest updated_at is 13 March 02:00.',
            tabs: [{ layer: 'MARTS', c: 'mart', name: 'fct_loan_exposure (target, before)', cols: ['loan_key', 'loan_id', 'outstanding_usd', 'updated_at'], rows: [['a1f3', 'L-1001', '215000.00', '2026-03-13 02:00'], ['c9e2', 'L-1005', '30000.00', '2026-03-08 08:00']] }],
            notes: ['Lookback limit = max(updated_at) minus 3 days = **2026-03-10 02:00**.'] },
          { say: 'The source has four rows today. The filter keeps rows updated after the limit. L-1005 is older, so it is skipped. The other three are picked up.',
            tabs: [{ layer: 'INTERMEDIATE', c: 'int', name: 'int_loan_exposure (source)', cols: ['loan_key', 'loan_id', 'outstanding_usd', 'updated_at'], rows: [['a1f3', 'L-1001', '210000.00', '2026-03-14 02:10'], ['d4b7', 'L-1003', '85000.00', '2026-03-14 02:12'], ['e5c8', 'L-1004', '40000.00', '2026-03-14 02:15'], ['c9e2', 'L-1005', '30000.00', '2026-03-08 08:00']], chg: [[0, 3], [1, 3], [2, 3]] }],
            notes: ['Yellow = passes the filter and is merged. L-1005 is **not** read again, which is the whole saving.'] },
          { say: 'After the merge. L-1001 was matched on the key and updated. L-1003 and L-1004 were inserted. L-1005 was never touched.',
            tabs: [{ layer: 'MARTS', c: 'mart', name: 'fct_loan_exposure (target, after)', cols: ['loan_key', 'loan_id', 'outstanding_usd', 'updated_at'], rows: [['a1f3', 'L-1001', '210000.00', '2026-03-14 02:10'], ['c9e2', 'L-1005', '30000.00', '2026-03-08 08:00'], ['d4b7', 'L-1003', '85000.00', '2026-03-14 02:12'], ['e5c8', 'L-1004', '40000.00', '2026-03-14 02:15']], chg: [[0, 2], [0, 3], [2, 0], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]] }],
            notes: ['One update, two inserts, zero duplicates. Run it again and the result is identical. That is the point of the unique key.'] }
        ]
      }),

      B.cmp({
        id: 'm4-strat', title: 'Incremental strategies on Snowflake',
        say: 'Which strategy to use is a favourite follow-up. Four exist on Snowflake. Press Next for each.',
        cols: ['', 'merge', 'delete+insert', 'append', 'microbatch'],
        hl: 1,
        rows: [
          ['How it works', 'MERGE on unique_key: update matches, insert new', 'DELETE rows with matching keys, then INSERT', 'INSERT only. No key, no update', 'Processes time slices (batches) by event time and replaces each slice'],
          ['Best for', 'General purpose. Rows get updated', 'Big batches with many updates. Can beat merge on speed', 'Immutable events and logs', 'Big time-series tables. Easy to backfill one day'],
          ['Watch out for', 'Duplicate keys in the new rows cause an error or an unpredictable result', 'Needs a unique key. Two statements instead of one', 'Duplicates on rerun or late data', 'Newer feature (dbt 1.9 and later). Needs an event time column']
        ],
        steps: [
          { upto: 1, say: 'First, how each one works. merge is the default on Snowflake. append never updates. microbatch treats time slices as the unit.' },
          { upto: 2, say: 'When to use each. If rows get corrected after they land, you need merge or delete plus insert.' },
          { upto: 3, say: 'And the trap for each one. The merge trap is the one interviewers ask about: duplicate keys in the new rows.' }
        ],
        pick: '**merge** by default, **append** for immutable event logs, **microbatch** for very large time-series facts where you want to reprocess a single day cleanly. insert_overwrite exists for other warehouses, not Snowflake.'
      }),

      B.rows({
        id: 'm4-scd', title: 'Snapshots: keep the history (SCD Type 2)',
        steps: [
          { say: 'Customer C-42 is a retail customer. The first snapshot run copies the row and adds two columns: when this version became valid, and when it stopped being valid. NULL means it is still current.',
            tabs: [{ layer: 'SNAPSHOT', c: 'int', name: 'snapshots.snap_customers', cols: ['cust_id', 'segment', 'upd_ts', 'dbt_valid_from', 'dbt_valid_to'], rows: [['C-42', 'RETAIL', '2024-01-01', '2024-01-01', 'NULL']], trk: 0 }] },
          { say: 'On 1 July 2025 the customer becomes a small business. The source table is simply overwritten. Without a snapshot the history is gone.',
            tabs: [{ layer: 'SOURCE', c: 'src', name: 'raw.core_customers (overwritten)', cols: ['cust_id', 'segment', 'upd_ts'], rows: [['C-42', 'SMALL_BUSINESS', '2025-07-01']], chg: [[0, 1], [0, 2]] }],
            notes: ['The old RETAIL value no longer exists anywhere in the source.'] },
          { say: 'The next dbt snapshot run notices the newer timestamp. It closes the old row and adds a new one. Now you can answer: what segment was this customer in on any given date?',
            tabs: [{ layer: 'SNAPSHOT', c: 'int', name: 'snapshots.snap_customers', cols: ['cust_id', 'segment', 'upd_ts', 'dbt_valid_from', 'dbt_valid_to'], rows: [['C-42', 'RETAIL', '2024-01-01', '2024-01-01', '2025-07-01'], ['C-42', 'SMALL_BUSINESS', '2025-07-01', '2025-07-01', 'NULL']], chg: [[0, 4], [1, 1], [1, 3]], trk: 1 }],
            notes: ['Limit to remember: a snapshot only sees what exists **when it runs**. If a value changes twice between runs, the middle version is lost. Run snapshots often.'] }
        ]
      }),

      B.code({
        id: 'm4-snap', title: 'The snapshot definition', file: 'snapshots/snap_customers.sql', lang: 'jinja', code: SNAP, opt: true,
        steps: [
          { say: 'The definition is small. A snapshot block wraps a SELECT, and the config says how to detect change.', lines: null },
          { say: 'The config. Where to store it, the unique key, and the strategy. timestamp trusts an updated-at column. The other strategy, check, compares chosen columns.', lines: [3, 10] },
          { say: 'The query itself. Best practice is to snapshot the raw source with little or no logic, so a later change to cleaning rules cannot rewrite history. Newer dbt versions also allow YAML-based snapshot definitions.', lines: [12, 12] }
        ]
      }),

      B.code({
        id: 'm4-test', title: 'A custom generic test', file: 'tests/generic/positive_value.sql', lang: 'jinja', code: GTEST,
        steps: [
          { say: 'Built-in tests cover unique, not_null, accepted_values and relationships. For your own rules, write a generic test. It is a macro with the special name test.', lines: [1, 1] },
          { say: 'It returns the rows that break the rule. Zero rows means pass. Any rows mean fail. That is the entire contract of a dbt test.', lines: [3, 5] },
          { say: 'Use it in YAML under any column. You can set severity to warn, a where filter, or store_failures to keep the bad rows in a table. For one-off checks, write a singular test: a SQL file in tests/ that returns failing rows.', lines: null }
        ]
      }),

      B.code({
        id: 'm4-proj', title: 'Project config, grants and hooks', file: 'dbt_project.yml', lang: 'yaml', code: PROJ,
        steps: [
          { say: 'dbt_project.yml sets defaults for whole folders, so you do not repeat config in every model. Press Next.', lines: null },
          { say: 'Variables. vars are project-wide settings you can override on the command line, such as the lookback days we used in the incremental model.', lines: [4, 5] },
          { say: 'Materialization by folder. Staging views, intermediate and marts tables. One place, not forty.', lines: [7, 13] },
          { say: 'Grants. dbt applies these after every build. Plain GRANT statements are lost when dbt replaces a table, so use this config.', lines: [14, 15] },
          { say: 'A post-hook runs SQL after a model builds. This one re-attaches the masking policy to the customer table, because a rebuilt table loses it. {{ this }} is the model\'s own table.', lines: [16, 17] },
          { say: 'on-run-end runs after the whole job. A common use is calling a macro that writes run results to an audit table, which feeds monitoring.', lines: [19, 20] }
        ]
      }),

      B.talk({
        id: 'm4-pk', title: 'Packages worth naming', opt: true,
        say: 'Packages are dbt projects you install with dbt deps. Name two or three and say what you used them for.',
        items: [
          ['`dbt_utils`', 'Utility macros: `generate_surrogate_key`, `date_spine`, `pivot`, `star`, `deduplicate`, and extra tests like `expression_is_true`.', 'dbt_utils is in nearly every project.'],
          ['`dbt_expectations`', 'Great Expectations style tests inside dbt: row counts, value ranges, regex matches, distribution checks.', 'Good bridge between dbt tests and Great Expectations.'],
          ['`audit_helper`', 'Compares two relations column by column. Perfect for proving a refactored model returns the same data.', 'Use it when you rewrite a model.'],
          ['`elementary`', 'Data observability: anomaly detection on row counts and freshness, and a history of dbt runs.', 'Observability on top of dbt.'],
          ['`automate_dv`', 'Macros that generate Data Vault 2.0 hubs, links and satellites.', 'The Data Vault package.'],
          ['`codegen`', 'Generates source YAML and base staging models from the warehouse. Saves hours on onboarding a new source.', 'Codegen speeds up the boring parts.']
        ],
        cols: 2,
        call: { k: 'tip', h: 'Rule.', t: 'Pin package versions in packages.yml (for example `>=1.1.0, <2.0.0`) and commit the lock file, so a CI build today equals a build next month.' }
      }),

      B.talk({
        id: 'm4-trap', title: 'The trap: "Python operators in the dbt flow"',
        say: 'Read this slowly. The job description says Python operators in the dbt flow. dbt has no operators. Press Next and I will show where Python really lives in a dbt flow.',
        items: [
          ['First, clarify', '"Operator" is an **Airflow** word. dbt itself has models, macros, tests and hooks. There is no PythonOperator inside dbt. Saying this calmly shows you know where dbt ends and Airflow begins.', 'First rule: do not pretend dbt has operators. Politely clarify the term.', 'think'],
          ['Place 1: dbt Python models', 'A `.py` file in `models/` with `def model(dbt, session)`. dbt runs it **inside Snowflake** as Snowpark code and materializes the returned DataFrame as a table. Use it when SQL is awkward: scoring, parsing, applying a Python function.', 'Place one: a dbt Python model. It runs inside Snowflake with Snowpark.', 'happy'],
          ['Place 2: Airflow Python tasks around dbt', 'A `PythonOperator` or `@task` runs before and after dbt: ingestion, pre-checks, calling dbt from Python with `dbtRunner`, reading `run_results.json`, pushing metrics to Datadog, sending alerts.', 'Place two: Python tasks in Airflow that wrap dbt. This is the likely meaning of the sentence.'],
          ['Place 3: Jinja and macros', 'Compile-time logic only: loops, conditions, `run_query()`. Jinja can use a few Python modules (`modules.datetime`, `modules.re`). Do **not** do data processing here.', 'Place three: Jinja. Small compile-time logic. Not data processing.']
        ]
      }),

      B.code({
        id: 'm4-py', title: 'Place 1: a dbt Python model', file: 'models/marts/py_risk_tier.py', lang: 'python', code: PYMODEL,
        steps: [
          { say: 'A Python model is a file with one function. It runs inside Snowflake through Snowpark, so the data never leaves the warehouse. Press Next.', lines: null },
          { say: 'The entry point. dbt passes in dbt, which has ref, source and config, and a Snowpark session. dbt.config works like config in SQL models. Python models support table and incremental only.', lines: [4, 5] },
          { say: 'dbt.ref returns a Snowpark DataFrame. It is lazy: nothing runs until the result is materialized, and then Snowflake does the work on its own compute.', lines: [7, 7] },
          { say: 'Transform with DataFrame methods and return a DataFrame. dbt creates the table from it. This example could be SQL, which is exactly the point to make: use Python when SQL gets awkward.', lines: [9, 14] }
        ]
      }),

      B.code({
        id: 'm4-runner', title: 'Place 2: Python around dbt in Airflow', file: 'dags/tasks/run_dbt.py', lang: 'python', code: RUNNER,
        steps: [
          { say: 'This is the Python that wraps dbt in an Airflow task. dbtRunner lets you call dbt from Python and get a structured result, instead of parsing text output.', lines: null },
          { say: 'invoke takes the same arguments as the command line. Here it runs dbt build for a selector against production.', lines: [5, 5] },
          { say: 'If dbt reports failure, raise an exception. That marks the Airflow task failed, so retries and alerts trigger.', lines: [6, 7] },
          { say: 'Return a map of model name to status. The task can push it to Datadog or XCom, so dashboards show which models failed.', lines: [8, 8] }
        ]
      }),

      B.bug({
        id: 'm4-bug', say: 'Green pipeline, wrong numbers. Find the bug before finance does.', q: 'This incremental model runs green every night, yet finance says old loans show stale balances. Which line is the bug?',
        file: 'models/marts/fct_loan_exposure.sql', lang: 'jinja', code: BUGINC, bad: [12],
        why: 'The filter uses **created_at**. A loan that was corrected today still has its old created_at, so it never passes the filter and the merge never sees the change. New loans arrive, updates do not.',
        fix: BUGINC.replace('where created_at > (select max(created_at) from {{ this }})', "where updated_at >= (\n    select dateadd('day', -3, max(updated_at)) from {{ this }}\n)"),
        hint: 'Which timestamp changes when a row is corrected, and which one stays the same?'
      }),

      B.challenge({
        id: 'm4-ch1', title: 'Coding round: write a macro',
        q: 'Write a macro `status_counts(column_name, values)` that returns **one count_if column per value**, with no trailing comma. For `status_counts(\'loan_status\', [\'ACTIVE\', \'CLOSED\'])` it should produce `count_if(loan_status = \'ACTIVE\') as active_count,` and `count_if(loan_status = \'CLOSED\') as closed_count`.',
        lang: 'jinja', starter: '{% macro status_counts(column_name, values) -%}\n    -- your code here\n{%- endmacro %}',
        hints: ['Loop over the list with a `for` tag.', 'Use `{{ v | lower }}` for the alias and `loop.last` to skip the final comma.'],
        file: 'macros/status_counts.sql', sol: STATUS_MACRO,
        expl: ['`{%- for ... %}` and `{%- endfor %}` trim whitespace so each column starts on its own line.', '`{{ "," if not loop.last }}` prints a comma after every item except the last one.', 'Use it in a model: `select customer_id, {{ status_counts(\'loan_status\', [\'ACTIVE\',\'CLOSED\']) }} from ... group by 1`.'],
        cx: 'Compile-time work only. The loop runs once while dbt renders the model, not per row in Snowflake.'
      }),

      B.challenge({
        id: 'm4-ch2', title: 'Coding round: limit data in dev', opt: true,
        q: 'Write a macro `limit_in_dev(date_column, days=3)` that adds a `where` clause limiting rows to the last N days **only when the target is dev**. In production it must add nothing.',
        lang: 'jinja', hints: ['`target.name` holds the current target, such as dev or prod.', 'Wrap the where clause in an `if` tag.'],
        file: 'macros/limit_in_dev.sql', sol: DEV_MACRO,
        expl: ['`target.name` comes from your profile. In CI and prod the macro outputs nothing.', 'Developers build in seconds on three days of data instead of waiting on a full table.', 'Call it right after the FROM clause: `from {{ ref(\'stg_core__loans\') }} {{ limit_in_dev(\'updated_at\') }}`.']
      }),

      B.quiz({
        id: 'm4-q1', q: 'Which Jinja delimiter prints a value into the compiled SQL?',
        opts: [
          { t: '{% ... %}', fb: 'Statements run logic such as set, if and for. They do not print.' },
          { t: '{{ ... }}', fb: '' },
          { t: '{# ... #}', fb: 'That is a comment. It is removed from the output.' },
          { t: '[[ ... ]]', fb: 'That is not Jinja syntax.' }
        ],
        ok: 1, why: 'Double curly **prints**. Curly-percent **runs logic**. Curly-hash is a **comment**. Say that triplet in an interview and you sound fluent.'
      }),

      B.quiz({
        id: 'm4-q2', q: 'A merge-based incremental model fails with a "nondeterministic merge" error. What is the most likely cause?',
        opts: [
          { t: 'The warehouse is too small', fb: 'Size does not change correctness. The error is about the data.' },
          { t: 'The new rows contain the same unique_key more than once', fb: '' },
          { t: 'The table has too many columns', fb: 'Column count is unrelated to this error.' },
          { t: 'A seed file is missing', fb: 'Seeds are not involved in a merge on this model.' }
        ],
        ok: 1, why: 'If two source rows match the same target row, Snowflake cannot know which one to apply. **Deduplicate the new rows on the unique key** inside the model, for example with a QUALIFY row_number.'
      }),

      B.quiz({
        id: 'm4-q3', q: 'Which incremental strategy suits an append-only table of immutable web events that is never corrected?',
        opts: ['merge', 'delete+insert', 'append', 'a full refresh every night'], ok: 2,
        why: '`append` simply inserts. No key, no matching, the cheapest option. Use it only when rows **never change**, because a rerun would duplicate them.'
      }),

      B.qa({
        id: 'qa-late', tag: 'dbt', secs: 60,
        q: 'How do you handle late-arriving data in an incremental model?',
        pts: ['Lookback window on updated_at, not a strict high-water mark', 'Merge on the unique key makes reprocessing safe', 'Window sized from measured lateness', 'Backfill with a date range variable or full refresh for old corrections', 'Reconciliation catches gaps'],
        short: 'I design incremental models around a lookback window instead of a strict high-water mark. The filter selects rows updated within the last few days of the target\'s latest timestamp, and a merge on the unique key updates rows that were already loaded. So a record that arrives two days late lands correctly and nothing is duplicated.\n\nI size the window from how late data really arrives in that source, which I measure. For corrections older than the window I run a targeted backfill with a date range variable, or a full refresh when the table is small. And I reconcile counts and totals against RAW daily, so a gap appears as a failed check instead of a surprise on a dashboard.',
        fu: [
          ['Why not full refresh every night?', 'For small tables I do. For a fact with billions of rows it costs hours of warehouse time and breaks the SLA. Incremental with a lookback gives the same result for a fraction of the cost.'],
          ['What if the source has no updated_at?', 'Use the RAW load timestamp, `_loaded_at`. It records when a row arrived, which is exactly what late data needs. For hard deletes, add a periodic full compare.'],
          ['How do you prove incremental equals full refresh?', 'In CI I build once incrementally and once as a full refresh in separate schemas and compare with audit_helper, or compare row counts and key totals.']
        ],
        trap: 'Using a strict `> max(updated_at)` filter. Any row that arrives late with an older timestamp is lost, and nobody notices until finance asks.'
      }),

      B.qa({
        id: 'qa-pyops', tag: 'dbt (JD trap)', secs: 60,
        q: 'The role mentions writing Python operators in the dbt flow. What experience do you have with that?',
        pts: ['Clarify: dbt has no operators, Airflow does', 'dbt Python models run in Snowflake with Snowpark', 'Airflow Python tasks around dbt: ingestion, pre-checks, dbtRunner, run_results.json', 'Jinja and macros for compile-time logic only', 'SQL first, Python only when needed'],
        short: 'dbt itself has no operators. Operators are an Airflow concept. So I read that as Python in and around the dbt flow, and I have used it in three places.\n\nFirst, dbt Python models, which run as Snowpark code inside Snowflake, for transformations that are awkward in SQL. Second, Airflow tasks, a PythonOperator or the TaskFlow decorator, before and after dbt: ingestion, pre-checks, calling dbt with dbtRunner or the CLI, then reading run_results.json to push metrics to Datadog and alert on failures. Third, Jinja macros for compile-time logic, though I keep data processing out of macros.\n\nI default to SQL, use a Python model only when SQL gets awkward, and use Airflow Python for anything that talks to systems outside Snowflake.',
        fu: [
          ['When would you choose a Python model over SQL?', 'When the logic needs a library or loops that SQL expresses badly: statistical scoring, parsing messy semi-structured payloads, applying a Python function. For joins and aggregations SQL is faster to write, easier to review and cheaper.'],
          ['What are the limits of Python models on Snowflake?', 'They run as Snowpark code inside Snowflake, so only Snowflake Anaconda packages and uploaded files are available, and network calls need an external access integration. Only table and incremental materializations. So I keep API ingestion outside dbt.'],
          ['How do you run dbt from Airflow?', 'Three options. BashOperator running dbt build. The Cosmos package, which renders each model as an Airflow task. Or a containerized dbt image launched with KubernetesPodOperator or DockerOperator. I choose by how much task-level visibility and isolation I need.']
        ],
        trap: 'Pretending dbt has a PythonOperator. The interviewer is checking whether you know where dbt ends and Airflow begins.'
      }),

      B.qa({
        id: 'qa-incr', tag: 'dbt', secs: 60,
        q: 'Explain how incremental models work, which strategy you use on Snowflake, and what can go wrong.',
        pts: ['First run builds the whole table, later runs process only new and changed rows', 'is_incremental() guard and a unique_key', 'merge by default, append for immutable events, microbatch for big time-series', 'Pitfalls: duplicate keys, late data, schema change, strict watermark', 'Safety nets: lookback, on_schema_change, full-refresh plan, reconciliation'],
        short: 'An incremental model builds the whole table on the first run. After that, an is_incremental block filters the source to new and changed rows, and dbt merges them into the existing table using a unique key. On Snowflake merge is my default. I use append for immutable event tables and microbatch for very large time-series facts.\n\nWhat goes wrong: duplicate keys in the new rows make the merge fail or give unpredictable results, late data is lost if the filter is a strict high-water mark, and schema changes need on_schema_change or a planned full refresh. My safeguards are a lookback window, a unique test on the key, a documented full-refresh procedure, and a daily reconciliation against the source.',
        fu: [
          ['What does --full-refresh do?', 'It drops and rebuilds the incremental table from scratch, ignoring is_incremental. I protect very large tables with `full_refresh: false` so no one triggers it by accident.'],
          ['What does on_schema_change do?', 'It controls what happens when the model gains or loses columns: ignore (default), fail, append_new_columns, or sync_all_columns. I use append_new_columns for facts and fail when I want a human to decide.']
        ],
        trap: 'Saying incremental is "just faster". It is faster **and** a source of subtle bugs: late data, duplicates, schema drift. Show you know the risks.'
      }),

      B.qa({
        id: 'qa-macro', tag: 'dbt', secs: 45, opt: true,
        q: 'What is a macro? Give an example you wrote and explain when you would not use one.',
        pts: ['Definition: reusable Jinja function that generates SQL at compile time', 'Real example: cents_to_dollars or risk_tier', 'Benefit: one definition, many models', 'Careful: execute flag, readability', 'When not to use: simple SQL that is clearer inline'],
        short: 'A macro is a reusable Jinja function that generates SQL at compile time. For example, my cents_to_dollars macro takes a column name and returns the division and cast, so every staging model converts units the same way and a precision change is one edit. Another is a risk_tier macro that maps default probability to HIGH, MEDIUM or LOW, used in the fact table and in a test.\n\nMacros can loop, branch on the target, and call run_query. For run_query I guard with the execute flag so it does not run at parse time. I keep macros small, because one that hides too much SQL makes models hard to read, and if the SQL is simple I leave it inline.',
        fu: [['What is the execute flag?', '`execute` is false while dbt parses the project and true when it runs the models. Code that calls `run_query` must be guarded with `{% if execute %}`, otherwise it fails or returns nothing during parsing.']]
      }),

      B.recap({
        id: 'm4-recap', n: 4, badge: 'Macro Wizard', color: '#E9D5FF',
        pts: [
          'Jinja: `{{ }}` prints, `{% %}` runs logic, `{# #}` is a comment. dbt renders it before Snowflake sees SQL.',
          'Incremental = first run full, later runs filter and **merge** on a unique key. Use a **lookback window**.',
          'Snapshots keep history (SCD2) but only see what exists when they run.',
          'Use `+grants` and post-hooks to survive table rebuilds.',
          'dbt has **no operators**. Python lives in Python models, in Airflow tasks, and in tiny Jinja logic.'
        ],
        lines: [
          'I use a lookback window and a merge key, so late data is safe and reruns do not duplicate.',
          'dbt has no operators. Python runs in Snowpark models inside Snowflake and in Airflow tasks around dbt.',
          'SQL first. Python only when SQL gets awkward.'
        ]
      })
    ]
  });
})();
