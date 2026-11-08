// One deliberately short route. Platform examples are teaching snippets, not live connections.
export const stages = [
  { name: 'Source data', sub: 'Trade events', icon: 'file', artifact: 'trade_events.csv' },
  { name: 'Snowflake raw', sub: 'Keep every delivery', icon: 'snowflake', artifact: 'RAW.TRADE_EVENTS' },
  { name: 'dbt staging', sub: 'Type + deduplicate', icon: 'layers', artifact: 'stg_trades' },
  { name: 'Business models', sub: 'Rules + current state', icon: 'braces', artifact: 'int_current_trades' },
  { name: 'Facts + dimensions', sub: 'Calculate + join', icon: 'table', artifact: 'fct_trades' },
  { name: 'Quality gate', sub: 'Check before release', icon: 'shield', artifact: 'release_checks' },
  { name: 'Application', sub: 'Read approved data', icon: 'activity', artifact: 'published_risk' },
];

export const walkthrough = [
  {
    id: 'project', topic: 'The whole project', title: 'One project. Every moving part.', stage: -1, visual: 'overview', minutes: 6,
    intro: 'Build a trustworthy trade-risk dataset for an application team. Follow one small batch all the way through, then explain the design in an interview.',
    points: [
      ['The business problem', 'Trades can arrive twice, change later, or contain bad values. The application needs one current, valid record per active trade.'],
      ['Your responsibility', 'Preserve the evidence, resolve the latest version, apply agreed rules, test the result, and release it safely.'],
      ['How to use this', 'Watch the data move. Read the small explanation. Try the interview question. Press Next. Allow 2–3 hours including speaking practice.'],
    ],
    takeaway: 'Python loads. Snowflake stores and computes. dbt defines transformations. Airflow coordinates. The application consumes approved results.',
    question: 'Walk me through your data pipeline, starting with the business need.',
    answer: 'In this example, a risk application needs reliable current trade data. I preserve incoming events in Snowflake raw, use dbt staging to standardize and deduplicate them, build current-state business models and facts, and block publication when critical checks fail. Airflow coordinates ingestion and dbt builds. Consumers read a governed release rather than partially updated tables.',
    caution: 'The trades are synthetic. Use this example to understand the design, then connect it to work you actually owned.',
  },
  {
    id: 'dataset', topic: 'Start with the data', title: 'Six deliveries. Five different trades.', stage: 0, visual: 'dataset', minutes: 6,
    intro: 'Our entire starting dataset fits on this screen. T101 arrives twice. T103 has a negative quantity. T104 has no price.',
    points: [
      ['Define the grain', 'Raw has one row per delivered event. The current model will have one row per trade ID. These are different promises.'],
      ['Keep useful metadata', 'A version, source update time, ingestion time, sequence, and batch ID let us explain which record won and replay a delivery.'],
      ['Agree the rule', 'This is a long-only teaching dataset: quantity and price must be positive. Real short positions may use negative quantities, so confirm the business rule first.'],
    ],
    takeaway: 'The first question is “What does one row represent?” A duplicate business key is not necessarily a duplicate delivery.',
    question: 'Why keep duplicate and invalid source records?',
    answer: 'Raw is the evidence layer. Keeping the original deliveries and their metadata supports reconciliation, debugging, and replay. Downstream models can select the current version and quarantine invalid values without erasing what the source sent. I distinguish delivery counts from business-record counts.',
    caution: 'All amounts are USD. Quantity × price × reference weight is a simplified teaching calculation, not a regulatory risk model.',
  },
  {
    id: 'snowflake-setup', topic: 'Snowflake worksheet', title: 'Give the data a place to land.', stage: 1, visual: 'warehouse', minutes: 7,
    intro: 'A warehouse is compute. A database and its schemas organize stored objects. They are separate parts of Snowflake.',
    points: [
      ['Compute', 'LAB_WH executes queries. X-Small and auto-suspend are sensible starting settings for this tiny sandbox.'],
      ['Storage layout', 'INTERVIEW_LAB contains RAW, STAGING, and MARTS schemas. Raw keeps deliveries; downstream objects give those deliveries meaning.'],
      ['See the real SQL', 'The worksheet below creates the sandbox objects. The downloadable worksheet also inserts these six rows and builds the complete example.'],
    ],
    takeaway: 'Resizing compute changes the resources running queries. It does not move tables into a different database.',
    question: 'How are a Snowflake warehouse, database, and schema different?',
    answer: 'A virtual warehouse supplies compute for SQL and loading. A database is a logical container, and schemas group tables, views, and other objects within it. Snowflake stores table data independently of a virtual warehouse. I separate development and production access and choose compute based on workload.',
    code: { file: 'Snowflake SQL worksheet', language: 'SQL', text: `CREATE WAREHOUSE IF NOT EXISTS LAB_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS INTERVIEW_LAB;
CREATE SCHEMA IF NOT EXISTS INTERVIEW_LAB.RAW;
CREATE SCHEMA IF NOT EXISTS INTERVIEW_LAB.STAGING;
CREATE SCHEMA IF NOT EXISTS INTERVIEW_LAB.MARTS;
USE WAREHOUSE LAB_WH;
USE DATABASE INTERVIEW_LAB;`, note: 'Optional real execution: use a sandbox role with permission to create these objects. The browser simulation does not create a Snowflake account or consume credits.', download: true },
    reference: ['Snowflake warehouses', 'https://docs.snowflake.com/en/user-guide/warehouses-overview'],
  },
  {
    id: 'dbt-connect', topic: 'dbt architecture', title: 'dbt writes the instructions. Snowflake runs them.', stage: 2, visual: 'dbt', minutes: 7,
    intro: 'Your job description emphasizes dbt Core. Your reference mentions dbt Cloud. Learn the same transformation flow with either interface.',
    points: [
      ['Core', 'Run dbt commands from a terminal or job runner. A local profile selects the Snowflake account, role, warehouse, database, and target schema.'],
      ['Cloud', 'A hosted development and job interface configures the Snowflake connection and Git project. The underlying warehouse still executes the SQL.'],
      ['The model lifecycle', 'SQL + Jinja + project configuration become executable SQL. Dependencies determine build order. Models become views, tables, or incremental tables.'],
    ],
    takeaway: 'dbt primarily transforms data already in the warehouse. Ingestion is a separate responsibility.',
    question: 'What happens when you run dbt build?',
    answer: 'dbt parses the project and resolves dependencies such as ref() and source(). It compiles SQL and Jinja, then runs selected resources in dependency order, including model materializations and relevant tests. Snowflake performs the actual data computation. I inspect failing nodes, compiled SQL, and logs instead of treating a build as one opaque command.',
    code: { file: 'Terminal · configured dbt Core project', language: 'shell', text: `dbt debug                 # verify the configured connection
dbt seed                  # load small CSV reference tables
dbt compile               # inspect rendered SQL
dbt build                 # build selected resources and test
dbt docs generate         # generate project documentation`, note: 'These commands assume dbt-snowflake, a project, and a valid profile. Keep authentication in approved secret storage, outside Git.' },
    reference: ['dbt SQL models', 'https://docs.getdbt.com/docs/build/sql-models'],
  },
  {
    id: 'sources-seeds', topic: 'Sources, ref(), and seeds', title: 'Name the inputs. Connect the dependencies.', stage: 2, visual: 'sources', minutes: 7,
    intro: 'Trades come from a source table. Risk weights come from a small version-controlled CSV seed. Our models need both.',
    points: [
      ['source()', 'Names a table loaded by another process. It makes that external input visible in dbt lineage.'],
      ['ref()', 'Resolves another model or seed and declares a dependency, so dbt knows which object to build first.'],
      ['seed', 'A small CSV such as BND → 0.2, EQT → 1.0, FX → 0.5. Seeds suit small, stable reference data; large or rapidly changing operational data needs ingestion.'],
    ],
    takeaway: 'source() points to an external input. ref() connects dbt-managed resources. Both help describe lineage.',
    question: 'Explain source(), ref(), and a seed using this project.',
    answer: 'source("trading", "trade_events") points to the raw Snowflake table loaded by ingestion. ref("stg_trades") links a downstream model to staging. ref("risk_weights") links to the CSV seed loaded by dbt seed. The dependency graph gives us build order and helps assess downstream impact when a definition changes.',
    code: { file: 'models/sources.yml', language: 'YAML', text: `version: 2
sources:
  - name: trading
    database: INTERVIEW_LAB
    schema: RAW
    tables:
      - name: trade_events

# SQL model references:
# {{ source('trading', 'trade_events') }}
# {{ ref('risk_weights') }}`, note: 'A source definition declares an existing table. It does not load the source data.' },
    reference: ['dbt sources', 'https://docs.getdbt.com/docs/build/sources'],
  },
  {
    id: 'staging', topic: 'Staging + SQL windows', title: 'Clean the types. Choose one current version.', stage: 2, visual: 'staging', minutes: 8,
    intro: 'Six raw deliveries become five current records. T101’s duplicate disappears from current state, while the original raw rows remain.',
    points: [
      ['Standardize', 'Convert quantity and price to numeric types. An invalid conversion remains null, so later checks can catch it.'],
      ['Resolve versions', 'ROW_NUMBER groups by trade ID and orders by version, source update time, ingestion time, then sequence. QUALIFY keeps row 1.'],
      ['Keep errors visible', 'T103 and T104 are still present here. Staging standardizes source data; it should not silently hide business-rule failures.'],
    ],
    takeaway: 'Deduplication needs a business key and a deterministic winner. DISTINCT alone cannot choose the newest correction.',
    question: 'Why use ROW_NUMBER rather than SELECT DISTINCT?',
    answer: 'DISTINCT removes identical selected rows, but it does not express which version of a trade is current. ROW_NUMBER partitions by the business key and applies an explicit precedence order. I include deterministic tie-breakers, validate non-null keys, and test uniqueness downstream.',
    code: { file: 'models/staging/stg_trades.sql', language: 'SQL + Jinja', text: `{{ config(materialized='view') }}
select trade_id, account_id, symbol, status, version,
  try_to_decimal(quantity, 18, 4) as quantity,
  try_to_decimal(price, 18, 4) as price,
  updated_at, ingested_at, ingest_seq
from {{ source('trading', 'trade_events') }}
qualify row_number() over (
  partition by trade_id
  order by version desc, updated_at desc,
           ingested_at desc, ingest_seq desc
) = 1`, note: 'This small teaching model scans the full source history. At scale, identify affected keys without losing late-arriving changes.' },
    reference: ['Snowflake QUALIFY', 'https://docs.snowflake.com/en/sql-reference/constructs/qualify'],
  },
  {
    id: 'macro', topic: 'Jinja + a reusable macro', title: 'Write the calculation once.', stage: 3, visual: 'macro', minutes: 6,
    intro: 'For T101, 50 units × $20 = $1,000 notional. Its EQT weight is 1.0, so weighted exposure is also $1,000.',
    points: [
      ['Jinja', 'Template syntax that dbt renders into SQL. The database does not execute Jinja.'],
      ['Macro', 'A reusable SQL-generating function. Here it keeps the notional calculation consistent across models.'],
      ['Business definition', 'We join the symbol to a reference weight, then calculate notional × weight. Unknown weights go to quarantine rather than defaulting to zero.'],
    ],
    takeaway: 'A macro generates SQL; a model creates a relation. Use macros to share logic, not to hide simple SQL behind unnecessary abstraction.',
    question: 'What is the difference between a macro and a model?',
    answer: 'A model describes a transformation that dbt materializes as a database object or an ephemeral query. A macro is a reusable Jinja function that generates SQL or performs supported compile-time logic. In this project I use a macro for a shared calculation, while the model still defines its inputs, joins, and grain.',
    code: { file: 'macros/notional.sql → models/marts/fct_trades.sql', language: 'SQL + Jinja', text: `{% macro notional(qty, price) -%}
  ({{ qty }} * {{ price }})
{%- endmacro %}

-- Use inside the fact model:
select t.trade_id,
  {{ notional('t.quantity', 't.price') }} as notional
from {{ ref('int_current_trades') }} t`, note: 'Compiled SQL contains (t.quantity * t.price). The browser uses the equivalent deterministic calculation.' },
    reference: ['dbt Jinja and macros', 'https://docs.getdbt.com/docs/build/jinja-macros'],
  },
  {
    id: 'modeling', topic: 'Business rules + dimensional modeling', title: 'Turn clean records into a useful model.', stage: 4, visual: 'modeling', minutes: 8,
    intro: 'Five current trades produce three accepted active facts and two rejects. Each accepted trade joins one account and one risk weight.',
    points: [
      ['Fact grain', 'fct_trades has one current active trade per trade ID, with notional and weighted exposure. Account and symbol are join keys.'],
      ['Dimensions', 'dim_accounts describes the account and desk. risk_weights describes each symbol’s agreed weight. Join many facts to one dimension row.'],
      ['Choose history deliberately', 'Type 1 replaces a value. Type 2 keeps effective-date versions when you must answer “What was true then?” The current trade fact is not a complete historical fact table.'],
    ],
    takeaway: 'Name the grain before a join. Two matching dimension rows can double a measure even when the SQL succeeds.',
    question: 'Why use a star schema, and when would you use another approach?',
    answer: 'A star schema puts measurable events in facts and descriptive context in dimensions, giving consumers clear joins and consistent measures. I would consider an Inmon-style normalized core for enterprise integration or Data Vault hubs, links, and satellites for auditable multi-source history. Those approaches can feed dimensional marts. The choice follows history, audit, change, and consumption needs.',
    caution: 'A dbt snapshot can capture observed dimension changes. Its cadence cannot recover intermediate versions overwritten between snapshot runs.',
    code: { file: 'Fact model · calculation fragment', language: 'SQL', text: `select t.trade_id, t.account_id, t.symbol,
  t.quantity * t.price as notional,
  t.quantity * t.price * w.risk_weight as exposure
from current_trades t
join risk_weights w on t.symbol = w.symbol
where t.status = 'ACTIVE'
  and t.quantity > 0 and t.price > 0;`, note: 'Worksheet-style fragment. Invalid current rows must also be retained in a separate reject relation and counted by the release gate.' },
    reference: ['dbt snapshots and current state', 'https://docs.getdbt.com/best-practices/how-we-handle-cdc/2-choosing-incremental-or-snapshots'],
  },
  {
    id: 'incremental', topic: 'Incremental models + MERGE', title: 'Update a trade instead of appending another one.', stage: 3, visual: 'merge', minutes: 8,
    intro: 'An incremental target persists between runs. trade_id tells Snowflake which existing record to update and which new record to insert.',
    points: [
      ['First run', 'dbt creates the target table from the model query. Later runs use the configured merge strategy.'],
      ['Match on the grain', 'unique_key = trade_id. The input must already contain at most one authoritative current row per key. This setting is not a uniqueness test.'],
      ['Do not lose late data', 'This small example rereads current staging for correctness. A production optimization needs affected keys, reliable ingestion watermarks, and protection against stale updates.'],
    ],
    takeaway: 'Incremental describes how the target is maintained. A correct merge source and explicit history rules still matter.',
    question: 'What can go wrong with an incremental model?',
    answer: 'A non-unique merge source can produce nondeterministic results or errors. An incomplete time filter can miss late corrections, and an old batch can overwrite newer state unless version selection prevents it. I validate keys, keep a reliable change boundary, test replay, and design deletion or cancellation handling explicitly. Full refresh is a controlled rebuild, not a routine fix for missing logic.',
    code: { file: 'models/intermediate/int_current_trades.sql', language: 'SQL + Jinja', text: `{{ config(
  materialized='incremental',
  incremental_strategy='merge',
  unique_key='trade_id'
) }}
select *
from {{ ref('stg_trades') }}`, note: 'Intentionally no time filter for this tiny dataset. Staging selects the latest version from complete history. Large pipelines need a tested change-selection strategy.' },
    reference: ['dbt incremental models', 'https://docs.getdbt.com/docs/build/incremental-models'],
  },
  {
    id: 'replay', topic: 'Simulation · a duplicate delivery', title: 'Run the same batch twice. Keep the same business result.', stage: 3, visual: 'replay', minutes: 6,
    intro: 'The network times out after a load, so ingestion retries B001. You now have 12 raw deliveries, but still only five current trade keys.',
    points: [
      ['What changes', 'Raw delivery count rises from 6 to 12. That is observable evidence of the retry.'],
      ['What stays the same', 'The three accepted active trades still total $3,000 notional and $1,700 weighted exposure.'],
      ['The engineering term', 'Idempotency: repeating the same logical input does not change the intended business state. It needs stable keys and version rules.'],
    ],
    takeaway: 'Retries are expected. Design replay to preserve the business result instead of hoping each batch runs exactly once.',
    question: 'How would you make an ingestion and dbt pipeline idempotent?',
    answer: 'I retain source identity and batch metadata, resolve authoritative versions, and merge on the agreed business key. I test replay and stale out-of-order batches, including cancellations. Raw ingestion may preserve repeated deliveries for evidence, while the current business model remains unchanged. I verify row counts and measures instead of checking only task success.',
  },
  {
    id: 'correction', topic: 'Simulation · correction and cancellation', title: 'A newer version changes the answer.', stage: 3, visual: 'correction', minutes: 8,
    intro: 'B002 corrects T101 from 50 to 60 units and adds T105. Current notional becomes $3,700. Explore a later cancellation without losing the version history.',
    points: [
      ['Correction', 'T101 version 2 replaces version 1 in current state. Its notional increases from $1,000 to $1,200. T105 contributes another $500.'],
      ['Cancellation', 'The optional cancellation branch marks T102 cancelled. It stays in current state as a tombstone, while active facts drop its $1,000.'],
      ['Out-of-order replay', 'An old version must not overwrite the correction or resurrect a cancellation. Source version takes precedence over arrival time here.'],
    ],
    takeaway: 'Updates, late arrivals, and deletes are part of the data contract. They are not solved by adding a unique key alone.',
    question: 'How do you handle late-arriving corrections and cancellations?',
    answer: 'I retain event metadata and define a source-of-truth version order. The current-state model chooses the latest version, including cancellation markers. Only active valid records feed the fact model. I avoid a global business-time cutoff that could miss late arrivals, and I test that stale replays cannot regress current state. If historical reporting is required, I model effective history separately.',
  },
  {
    id: 'quality', topic: 'Tests + reconciliation', title: 'A green model test does not mean “publish”.', stage: 5, visual: 'quality', minutes: 8,
    intro: 'After B002, four accepted active facts total $3,700. Two current trades are still invalid. The application must not see this incomplete release.',
    points: [
      ['Structural checks', 'Test non-null and unique keys, accepted values, and relationships. Tests on accepted facts can pass because bad rows were excluded.'],
      ['Coverage checks', 'Reconcile raw deliveries to current keys and explain deduplication. Reconcile all current records to accepted records plus rejects.'],
      ['Release policy', 'For this delivery, any unresolved critical reject blocks publication. Preserve the last approved version and alert the owner.'],
    ],
    takeaway: 'Test the records you excluded as well as the records you kept. A successful model build is not a complete source reconciliation.',
    question: 'What would you test before releasing a financial dataset?',
    answer: 'I test keys, values, relationships, freshness, completeness, and business reconciliations at the agreed grain. I track rejected rows explicitly and compare expected counts and measures with source controls. The release policy distinguishes warnings from blocking failures. A failed critical check leaves the previous approved dataset in place and creates an actionable alert.',
    code: { file: 'tests/no_critical_rejects.sql', language: 'SQL + Jinja', text: `-- A dbt singular test fails when it returns rows.
select trade_id, reject_reason
from {{ ref('int_trade_rejects') }}
where severity = 'critical'`, note: 'The reject relation is a proposed business model. Define it explicitly; these tests do not run inside the browser.' },
    reference: ['dbt data tests', 'https://docs.getdbt.com/docs/build/data-tests'],
  },
  {
    id: 'publish', topic: 'Simulation · repair and release', title: 'Repair the source. Then open the gate.', stage: 6, visual: 'publish', minutes: 7,
    intro: 'The source sends versioned fixes: T103 quantity becomes 5 and T104 price becomes $10. All six current trades are now valid.',
    points: [
      ['Fix the cause', 'B003 appends source corrections. We do not guess a missing price or edit away the evidence.'],
      ['Rebuild and reconcile', 'Accepted notional is $4,050; weighted exposure is $2,670. Critical rejects fall from 2 to 0.'],
      ['Publish a contract', 'Expose a tested version with an as-of time and status through a governed view or service. Keep consumers on the previous approved version until the gate passes.'],
    ],
    takeaway: 'The application reads an approved release. It should not observe intermediate tables while they are being repaired.',
    question: 'How would you support the backend team consuming your models?',
    answer: 'I agree grain, field names, meanings, freshness, and failure behavior with the backend team. A service or governed view exposes approved data with an as-of time and release identifier. We validate schema changes in CI and coordinate breaking changes. A failed delivery keeps the last approved release visible, with its freshness status clearly reported.',
    caution: 'The repair branch follows B002 without the optional cancellation. A real release also needs source-completeness, authorization, freshness, and operational controls.',
  },
  {
    id: 'sql', topic: 'Snowflake SQL worksheet', title: 'Answer a business question with the finished facts.', stage: 4, visual: 'sql', minutes: 7,
    intro: 'Which account has the largest current notional? Aggregate the repaired facts at account grain, then rank the account totals.',
    points: [
      ['Aggregate first', 'SUM(notional) groups individual trades into one row per account. The result grain changes.'],
      ['Rank second', 'DENSE_RANK orders those account totals while retaining a result for every account. Window functions do not collapse rows by themselves.'],
      ['Check the answer', 'A01 has $2,000, A02 $1,200, A03 $750, and A04 $100. Those totals reconcile to $4,050.'],
    ],
    takeaway: 'Explain the grain of every intermediate result. It is the fastest way to catch an incorrect aggregation or multiplying join.',
    question: 'How are GROUP BY and a window function different?',
    answer: 'GROUP BY collapses rows to the specified grouping grain. A window function computes across a partition while retaining the input rows. Here I first group facts to account totals, then use DENSE_RANK over those totals. ROW_NUMBER gives a unique sequence, RANK leaves gaps after ties, and DENSE_RANK does not.',
    code: { file: 'Snowflake SQL worksheet · after the repair section', language: 'SQL', text: `WITH account_totals AS (
  SELECT account_id, SUM(notional) AS notional
  FROM INTERVIEW_LAB.MARTS.FCT_TRADES
  GROUP BY account_id
)
SELECT account_id, notional,
  DENSE_RANK() OVER (
    ORDER BY notional DESC
  ) AS notional_rank
FROM account_totals
ORDER BY notional_rank, account_id;`, note: 'Run after the optional worksheet’s B003 repair section, or inspect the calculated browser output here.', download: true },
    reference: ['Snowflake window functions', 'https://docs.snowflake.com/en/user-guide/functions-window-using'],
  },
  {
    id: 'performance', topic: 'Snowflake performance', title: 'Find the bottleneck before buying more compute.', stage: 1, visual: 'performance', minutes: 7,
    intro: 'Keep storage, query work, and concurrent workloads separate in your explanation. Try the date predicate to see partition pruning illustrated.',
    points: [
      ['Inspect the query profile', 'Check partitions scanned, bytes scanned, join expansion, spills, and queueing. Start with evidence.'],
      ['Reduce unnecessary work', 'Selective predicates and appropriate clustering can improve pruning on large tables. Clustering adds maintenance cost and is unnecessary for this six-row example.'],
      ['Choose compute deliberately', 'Warehouse size changes compute resources. Multi-cluster scaling primarily addresses concurrency. Result reuse and warehouse caching have different conditions.'],
    ],
    takeaway: 'A slow scan, an exploding join, and a queued query require different fixes. Measure before and after the change.',
    question: 'A Snowflake query is slow. What would you investigate?',
    answer: 'I inspect the query profile and warehouse load first. For excessive scans I check predicates and pruning; for row multiplication I check join grain; for spills I assess the transformation and available memory. Queueing points to concurrency. I change one cause at a time and compare elapsed time, scanned data, and cost using representative queries.',
    code: { file: 'Snowflake SQL worksheet · bounded time filter', language: 'SQL', text: `SELECT trade_id, quantity, price
FROM INTERVIEW_LAB.RAW.TRADE_EVENTS
WHERE updated_at >= '2026-01-07'::TIMESTAMP_NTZ
  AND updated_at <  '2026-01-08'::TIMESTAMP_NTZ;`, note: 'The eight blocks in the illustration are hypothetical date partitions, not measured partitions from this tiny dataset.' },
    reference: ['Snowflake micro-partitions and pruning', 'https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions'],
  },
  {
    id: 'security', topic: 'Roles + masking', title: 'The same dataset. Different permitted views.', stage: 6, visual: 'security', minutes: 6,
    intro: 'A support reader needs useful account context without private contact data. A permitted risk analyst may need the unmasked value.',
    points: [
      ['Least privilege', 'Grant access to the required governed views and compute. Application roles do not need permission to modify raw inputs.'],
      ['Dynamic masking', 'A policy controls the value returned at query time based on approved role context. It does not replace access grants.'],
      ['Operational controls', 'Keep credentials outside Git, separate development and production roles, and retain lineage and audit evidence.'],
    ],
    takeaway: 'Access control decides who can query. Masking decides which values an authorized query returns.',
    question: 'How do RBAC and masking work together?',
    answer: 'Roles and grants restrict access to database objects and compute. A masking policy can redact a sensitive column for a role that is otherwise allowed to query the object. I apply least privilege and test both authorized and restricted roles. I also review inherited-role behavior, policy ownership, and audit requirements instead of assuming a mask alone secures the platform.',
    code: { file: 'Snowflake SQL worksheet · illustrative policy', language: 'SQL', text: `CREATE MASKING POLICY email_mask
  AS (value STRING) RETURNS STRING ->
  CASE WHEN CURRENT_ROLE() = 'RISK_ANALYST'
    THEN value ELSE '***@***' END;

ALTER TABLE dim_accounts MODIFY COLUMN owner_email
  SET MASKING POLICY email_mask;`, note: 'Illustrative objects. Dynamic Data Masking needs a supported Snowflake edition and appropriate policy privileges. The exact-role predicate is intentionally simple; inherited roles need deliberate handling.' },
    reference: ['Snowflake masking policies', 'https://docs.snowflake.com/en/sql-reference/sql/create-masking-policy'],
  },
  {
    id: 'orchestration', topic: 'Python + Airflow + Snowflake Tasks', title: 'Run the right work in the right order.', stage: -1, visual: 'orchestration', minutes: 8,
    intro: 'Ingestion must finish before transformations start. Release must wait for checks. A failed check should block the downstream publish task.',
    points: [
      ['Python ingestion', 'Fetch API pages with timeouts and retry limits, persist batch metadata, and advance a checkpoint only after durable loading.'],
      ['Python models vs operators', 'A dbt Python model transforms a DataFrame on a supported platform, such as Snowpark in Snowflake. Airflow’s PythonOperator runs an orchestration callable. They are different tools.'],
      ['Choose the coordinator', 'Airflow coordinates cross-system dependencies, retries, and alerts. Snowflake Tasks suit warehouse-local schedules and task graphs; Streams expose table change data.'],
    ],
    takeaway: 'Retry a failed task safely. Do not advance publication merely because an upstream SQL statement finished.',
    question: 'How do you connect Python, dbt, and Airflow?',
    answer: 'Python handles integration work such as paginated ingestion and durable checkpoints. Airflow schedules that load before a dbt build, then enforces release checks and publication dependencies. A dbt Python model is a warehouse transformation, not an Airflow operator. I set bounded retries, idempotent task behavior, timeouts, and actionable alerts. Snowflake Tasks can coordinate work that stays inside Snowflake.',
    code: { file: 'Airflow 3.x · requires the standard provider', language: 'Python', text: `from airflow.sdk import DAG
from airflow.providers.standard.operators.bash import BashOperator
from pendulum import datetime

with DAG('trade_risk', schedule='@hourly', catchup=False,
         start_date=datetime(2026, 1, 1, tz='UTC')):
    load = BashOperator(task_id='load',
        bash_command='python ingest.py', retries=2)
    build = BashOperator(task_id='build_and_test',
        bash_command='dbt build --project-dir /opt/dbt/risk')
    load >> build`, note: 'Short orchestration excerpt. The task image must contain the scripts, dbt project, dependencies, and connections. Production publication is a separate gated task.' },
    extraCode: { file: 'models/python/active_trades.py · Snowflake adapter', language: 'Python', text: `def model(dbt, session):
    dbt.config(materialized='table')
    trades = dbt.ref('int_current_trades')
    return trades.filter(trades.status == 'ACTIVE')`, note: 'A Snowpark DataFrame transformation. This fragment selects active rows; downstream quality checks still apply.' },
    reference: ['Airflow DAGs', 'https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html'],
  },
  {
    id: 'delivery', topic: 'Git + CI/CD + collaboration', title: 'Ship a model change without surprising its consumers.', stage: -1, visual: 'delivery', minutes: 6,
    intro: 'A change to a risk definition is a software change and a data-contract change. Review both before releasing it.',
    points: [
      ['Agree the contract', 'Turn a Jira requirement into an explicit grain, definition, expected output, freshness target, and acceptance checks with analysts and application developers.'],
      ['Test in isolation', 'A branch and pull request run compile, focused model builds, tests, and data comparisons in an isolated development target before approval.'],
      ['Release and recover', 'Deploy reviewed code, run production checks, then publish. Monitor freshness and rejects. Reverting Git code does not automatically restore changed warehouse data.'],
    ],
    takeaway: 'Keep the code release, data rebuild, and consumer release coordinated. Document how to recover each one.',
    question: 'Describe your dbt deployment and rollback process.',
    answer: 'I branch the change, document expected data impact, and open a pull request. CI uses an isolated target to build affected models and dependencies and run appropriate tests. After review, production deployment runs with controlled credentials, validates results, and releases approved data. For rollback I distinguish reverting code from rebuilding or restoring data, and verify consumer recovery and freshness.',
    code: { file: 'CI command · isolated Snowflake target', language: 'shell', text: `dbt build --target ci --select +fct_trades+

# After review: deploy the approved revision,
# validate production data, then publish the release.`, note: 'The + selectors include graph relatives and may broaden the build. A production CI strategy can use state artifacts and deferral, with isolated schemas and least-privilege credentials.' },
    reference: ['dbt graph selection', 'https://docs.getdbt.com/reference/node-selection/graph-operators'],
  },
  {
    id: 'your-story', topic: 'Your project explanation', title: 'Now explain it without listing tools.', stage: -1, visual: 'story', minutes: 8,
    intro: 'You have seen the entire system. Turn it into a clear project explanation, then connect the design to your verified experience.',
    points: [
      ['Begin with the purpose', 'Who needed the dataset, what decision or application feature it supported, and what had to be correct.'],
      ['Describe your ownership', 'Choose the transformations, orchestration, quality controls, or consumer contracts you personally designed or maintained.'],
      ['Defend one decision', 'Explain a failure, the evidence you used, the tradeoff you chose, and how you verified the outcome. Use only results you can substantiate.'],
    ],
    takeaway: 'A convincing senior answer connects a business need to a design choice, a failure case, and evidence of the result.',
    question: 'Tell me about yourself and one recent data-engineering project.',
    answer: 'Use this sequence: overall background → recent dbt and Snowflake focus → one project’s purpose → your ownership → one reliability or modeling decision → the verified outcome. Your resume separates 13+ years of overall experience from 5+ years of production dbt and Snowflake. Keep those distinctions. Practise a 90-second answer in your own words rather than reciting the simulator.',
    caution: 'The resume lists different scopes at Wells Fargo, Bank of America, and Citigroup. Keep their DAG counts, responsibilities, and metrics separate. Do not present this teaching dataset as an actual bank system.',
  },
  {
    id: 'rehearsal', topic: 'Final rehearsal', title: 'Draw it. Explain it. Defend it.', stage: -1, visual: 'rehearsal', minutes: 15,
    intro: 'One short interview pass. Answer these five prompts aloud before opening the answer guides. Revisit only the step where your explanation breaks.',
    points: [
      ['The architecture', 'Draw the full route and name the dataset at each stop. Explain the boundary between ingestion, transformation, orchestration, and consumption.'],
      ['The failure case', 'Explain why replay preserves $3,000, how a correction reaches $3,700, and why that result is still blocked from publication.'],
      ['The production judgment', 'Explain one performance investigation, one access-control choice, and how you would recover after a failed release.'],
    ],
    takeaway: 'You are ready for a topic when you can explain the mechanism and a failure case without reading the guide. Completing scenes alone is not proof of skill.',
    question: 'Can you explain this project end to end in two minutes?',
    answer: 'Start with the consumer and grain. Follow raw deliveries to typed current state, reference joins, facts, and an explicit release gate. Use T101 to explain duplicates and corrections. Mention the two invalid trades, source repair, and last-approved release. Finish with orchestration, access controls, CI, and monitoring. Be clear about which parts you personally implemented in real work.',
  },
];

export const rehearsal = [
  { question: 'Draw the project and explain where the data lives.', answer: 'Raw event history lives in Snowflake. dbt staging resolves types and versions; business models apply rules; facts and dimensions feed a governed release. Python loads source data. Airflow coordinates tasks. Application services read approved outputs.', step: 'project' },
  { question: 'Show how ref(), source(), a seed, and a macro fit together.', answer: 'source() names the externally loaded raw table. ref() declares a model or seed dependency. A risk_weights CSV seed supplies a small lookup. A notional macro renders a repeated SQL expression. Snowflake executes the compiled model SQL.', step: 'sources-seeds' },
  { question: 'A batch ran twice, then a correction arrived. What changes?', answer: 'B001 replay raises raw deliveries to 12 while five current keys and $3,000 notional remain. B002 replaces T101 with version 2 and adds T105, giving six current keys, four accepted active facts, and $3,700. Version selection prevents stale replay from regressing state.', step: 'correction' },
  { question: 'All fact-table tests passed. Why is release still blocked?', answer: 'Tests on accepted facts do not prove full source coverage. Two current records were rejected. This delivery blocks publication until versioned repairs resolve both, completeness and reconciliation pass, and operational controls permit release. The repaired fixture totals $4,050.', step: 'quality' },
  { question: 'How would you diagnose and safely ship a slow model?', answer: 'Inspect query profile and warehouse load. Distinguish scans, join expansion, spills, and queueing. Test one targeted change in isolation, compare output and cost, review it in Git, and release only after production validation. Keep a data-recovery plan as well as a code rollback.', step: 'performance' },
];
