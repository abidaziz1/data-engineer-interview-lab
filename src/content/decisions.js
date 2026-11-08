export const decisions = [
  { id: 'orchestrator', title: 'Who owns this job?', context: 'The workflow calls an external API, loads Snowflake, runs dbt, validates totals, and updates an application dataset version.', options: [
    { label: 'Airflow coordinates; dbt transforms', result: 'Good fit for this scenario. Airflow coordinates external boundaries, dbt owns its model graph, and Snowflake executes the SQL.', preferred: true },
    { label: 'A dbt macro does the whole workflow', result: 'A macro is a SQL-generation abstraction, not a general cross-system workflow engine. Keep extraction, retries, and publication explicit.' },
    { label: 'Snowflake Tasks for everything', result: 'Native Tasks fit contained warehouse work. External API extraction and application coordination need supported integrations and may be clearer in Airflow.' },
  ], tradeoff: 'Airflow adds an operating platform. If the entire workload is SQL inside Snowflake, Tasks can be the simpler choice.' },
  { id: 'watermark', title: 'Which clock finds the correction?', context: 'A trade from last month is corrected today and arrives after your event-date window closed.', options: [
    { label: 'Ingestion / CDC watermark + version resolution', preferred: true, result: 'This finds the new arrival even when its business date is old. Resolve the latest source version, retain an overlap, and reconcile older gaps.' },
    { label: 'Only max(trade_date)', result: 'This can miss an old trade corrected today. Business event time and arrival time serve different purposes.' },
    { label: 'Full-refresh every five minutes', result: 'This may be correct for a small retained dataset but can be unnecessarily expensive and disruptive at scale.' },
  ], tradeoff: 'A bounded lookback reduces risk but cannot guarantee capture of arbitrary lateness. Periodic reconciliation remains necessary.' },
  { id: 'compute', title: 'Fix the queue or fix the query?', context: 'A query waits 45 seconds for compute and executes in 2 seconds once admitted. It runs alongside 100 concurrent dashboard queries.', options: [
    { label: 'Investigate concurrency and isolate / scale out', preferred: true, result: 'The dominant delay is queueing. Workload isolation or supported multi-cluster scaling targets concurrency.' },
    { label: 'Rewrite every CTE', result: 'The execution time is already short. Rewriting SQL without profiling does not address the measured queue delay.' },
    { label: 'Cluster every table', result: 'Clustering targets data locality and pruning, not the warehouse admission queue.' },
  ], tradeoff: 'Concurrency scaling costs compute and depends on the platform configuration. Compare queue latency and credits after the change.' },
  { id: 'quarantine', title: 'Publish with two bad financial records?', context: 'Grain tests pass, but two source trades have invalid mandatory values. The financial contract requires complete valid coverage.', options: [
    { label: 'Block, preserve evidence, request correction', preferred: true, result: 'Correct. A passing accepted-scope test does not establish complete financial risk. Keep the last validated version and expose its freshness.' },
    { label: 'Replace missing price with zero', result: 'This invents a value, understates exposure, and hides the source defect.' },
    { label: 'Publish because quarantining is enough', result: 'Quarantine makes rejects visible. The stated contract still requires valid complete coverage before publication.' },
  ], tradeoff: 'Some products explicitly permit qualified partial data. That requires an agreed policy, visible scope, and an approved threshold.' },
  { id: 'serve', title: 'Can the application query the warehouse directly?', context: 'A risk UI needs a few fresh analytical requests per minute today; future demand might become thousands per second.', options: [
    { label: 'Start with a governed API; measure latency', preferred: true, result: 'A restricted API over a validated dataset can fit current demand. Preserve an as-of contract and benchmark latency.' },
    { label: 'Give the browser Snowflake credentials', result: 'Warehouse credentials and broad data access must not be shipped to client-side code.' },
    { label: 'Build five serving systems immediately', result: 'Extra stores add synchronization and invalidation complexity before the need is established.' },
  ], tradeoff: 'High QPS or strict millisecond latency may justify a serving database or cache. Keep the same definition and versioning contract.' },
  { id: 'history', title: 'Which history does the report mean?', context: 'An account changes desks at 10:00. A report must attribute a 09:00 trade to the desk that owned it at trade time.', options: [
    { label: 'Type 2 dimension with an effective-time join', preferred: true, result: 'Correct for the stated historical contract. Use non-overlapping [from, to) intervals and test exactly one match.' },
    { label: 'Join to the current account row', result: 'That answers a different question: historical trades attributed to the account’s current desk.' },
    { label: 'Use DISTINCT after joining all versions', result: 'DISTINCT cannot decide which historical desk is valid, and it may leave multiple distinct matches.' },
  ], tradeoff: 'If reports must reconstruct both effective time and when the organization learned the change, consider a bitemporal design.' },
  { id: 'release', title: 'The code rolled back. Is the data restored?', context: 'A bad MERGE changed current trade quantities. The Git commit has been reverted.', options: [
    { label: 'Inspect and repair data separately', preferred: true, result: 'Correct. Identify affected state, restore or replay using verified inputs, reconcile, and publish a coherent result.' },
    { label: 'Yes, Git revert undid the MERGE', result: 'Git only changes source code. It does not reverse warehouse writes.' },
    { label: 'Retry publication immediately', result: 'Publication must wait for validated recovery; otherwise the bad state may reach consumers.' },
  ], tradeoff: 'Recovery options depend on retained raw data, object retention, downstream exposure, and the required recovery time.' },
  { id: 'python-location', title: 'Where should the Python run?', context: 'You need to call an external trade API and later perform a DataFrame transformation inside Snowflake.', options: [
    { label: 'Ingestion task first; dbt Python only for transformation', preferred: true, result: 'Correct. The API integration runs in an appropriate orchestration or ingestion runtime; a supported dbt Python model can use Snowpark for the transformation.' },
    { label: 'Use dbt’s built-in PythonOperator', result: 'PythonOperator is an Airflow operator. dbt Python models use a different API and execution model.' },
    { label: 'Collect all Snowflake data into local pandas', result: 'This can introduce unnecessary movement and memory pressure. Keep large relational processing on the platform where appropriate.' },
  ], tradeoff: 'Use SQL when it is simpler and well optimized. Python platform support, package availability, and network policy need verification.' },
];
