/* Mission 5: Snowflake architecture, performance, cost, Time Travel, Streams and Tasks. */
(function () {
  var B = LAB.b;

  var CLUSTER = [
    '-- How well is the table clustered on the column we filter by?',
    "SELECT SYSTEM$CLUSTERING_INFORMATION('marts.fct_payments', '(txn_date)');",
    '',
    '-- Add a clustering key. Snowflake reclusters in the background.',
    'ALTER TABLE marts.fct_payments CLUSTER BY (txn_date);',
    '',
    '-- Expression keys work too. Use a date, not a raw timestamp,',
    '-- so the number of distinct values stays low.',
    'ALTER TABLE marts.fct_events CLUSTER BY (TO_DATE(event_ts), event_type);',
    '',
    '-- Check what automatic clustering cost in the last 7 days.',
    'SELECT * FROM TABLE(INFORMATION_SCHEMA.AUTOMATIC_CLUSTERING_HISTORY(',
    "       DATE_RANGE_START => DATEADD('day', -7, CURRENT_DATE()),",
    "       TABLE_NAME => 'RISK_DB.MARTS.FCT_PAYMENTS'));"
  ].join('\n');

  var TT = [
    '-- Query the table as it was 10 minutes ago',
    'SELECT COUNT(*) FROM marts.fct_loan_exposure AT(OFFSET => -60*10);',
    '',
    '-- Rows were deleted by mistake. Look just before that statement ran.',
    'SELECT COUNT(*) FROM marts.fct_loan_exposure',
    "  BEFORE(STATEMENT => '01b2c3d4-0000-1234-0000-000000000001');",
    '',
    '-- Restore: clone the table as it was, then swap it in',
    'CREATE TABLE marts.fct_loan_exposure_restore CLONE marts.fct_loan_exposure',
    '  AT(OFFSET => -60*10);',
    'ALTER TABLE marts.fct_loan_exposure SWAP WITH marts.fct_loan_exposure_restore;',
    '',
    '-- A table was dropped by mistake?',
    'UNDROP TABLE marts.fct_loan_exposure;'
  ].join('\n');

  var STREAMS = [
    '-- Capture every change made to the raw loans table',
    'CREATE OR REPLACE STREAM raw.strm_core_loans ON TABLE raw.core_loans;',
    '',
    '-- A task runs SQL on a schedule, here only when the stream has data',
    'CREATE OR REPLACE TASK marts.tsk_refresh_loan_latest',
    '  WAREHOUSE = WH_TRANSFORM',
    "  SCHEDULE = '15 MINUTE'",
    "  WHEN SYSTEM$STREAM_HAS_DATA('RAW.STRM_CORE_LOANS')",
    'AS',
    "  -- simplified: a real merge also handles METADATA$ACTION = 'DELETE' rows",
    '  MERGE INTO marts.loan_latest t',
    '  USING raw.strm_core_loans s ON t.loan_id = s.loan_id',
    '  WHEN MATCHED THEN UPDATE SET t.status_cd = s.status_cd, t.upd_ts = s.upd_ts',
    '  WHEN NOT MATCHED THEN INSERT (loan_id, status_cd, upd_ts)',
    '    VALUES (s.loan_id, s.status_cd, s.upd_ts);',
    '',
    '-- Tasks are created suspended. Start it.',
    'ALTER TASK marts.tsk_refresh_loan_latest RESUME;'
  ].join('\n');

  LAB.addChapter({
    id: 'm5', n: 5, title: 'Snowflake in depth', short: 'Snowflake', blurb: 'Architecture, pruning, warehouses, cost', minutes: 32,
    focus: ['raw', 'stg', 'int', 'mart'],
    goals: [
      'Explain the **three layers** of Snowflake in 30 seconds.',
      'Explain **micro-partitions, pruning and clustering**, and when clustering pays off.',
      'Choose **scale up vs scale out**, set auto-suspend, and control cost.',
      'Use **Time Travel, cloning, Streams and Tasks** correctly.',
      'Tell your **performance tuning story** with evidence.'
    ],
    say: 'Mission 5 is Snowflake itself. Your resume claims design, clustering, warehouses, query tuning, security and Tasks. Expect questions on every one.',
    scenes: [
      B.flow({
        id: 'm5-arch', title: 'Snowflake architecture', g: 'snowarch', legend: false,
        steps: [
          { say: 'Snowflake has three layers: cloud services on top, virtual warehouses for compute in the middle, and storage at the bottom. Press Next to light up each one.', cap: 'The key idea: **storage and compute are separate**, so each scales and bills on its own.' },
          { say: 'Cloud services is the brain. It handles login and roles, keeps metadata, plans each query, and manages transactions. It is always on and you do not size it.',
            focus: ['a_cs', 'cs1', 'cs2', 'cs3', 'cs4'], cap: 'Metadata stores the **minimum and maximum of every column in every micro-partition**. The optimizer uses it to skip data.' },
          { say: 'Virtual warehouses are the muscle. Each is an independent cluster that runs queries. I create one per workload: loading, transformation, BI and the API. They never compete for the same compute.',
            focus: ['a_cp', 'w1', 'w2', 'w3', 'w4'], cap: 'A heavy dbt run on **WH_TRANSFORM** cannot slow a dashboard on **WH_BI**.' },
          { say: 'Storage holds one copy of the data as compressed, columnar micro-partitions in cloud object storage. Every warehouse reads the same copy.',
            focus: ['a_st', 'st'], cap: 'You pay for storage separately. Cloning and Time Travel work because micro-partitions are **immutable**.' },
          { say: 'Follow one dashboard query. The BI tool sends it to cloud services, which plans it and picks pruned partitions. The BI warehouse runs it and reads only those partitions from storage.',
            focus: ['cl3', 'a_cs', 'a_cp', 'w3', 'a_st', 'st'], on: ['q3', 'q5', 'q6'], cap: 'Plan, prune, execute. **Fewer partitions read means a faster, cheaper query.**' }
        ]
      }),

      B.widget({ id: 'm5-prune', title: 'Micro-partitions and pruning', kind: 'prune' }),

      B.sql({
        id: 'm5-cluster', title: 'Clustering keys in the worksheet', file: 'worksheet: clustering.sql', code: CLUSTER,
        ctx: { role: 'SYSADMIN', wh: 'WH_TRANSFORM', db: 'RISK_DB.MARTS' },
        steps: [
          { say: 'Here are the commands to check and set clustering. Press Next to go through them.', lines: null },
          { say: 'Always measure first. This function reports how well the table is clustered on a column. Average depth near 1 means well clustered. Press Run. A depth of 21 means the data is scattered.', lines: [1, 2], run: true },
          { say: 'Add the key. Snowflake reclusters in the background. That background work costs credits, so it is a trade.', lines: [4, 5] },
          { say: 'Expression keys work. Use a date rather than a raw timestamp: with a timestamp nearly every value is unique, so the key cannot group rows.', lines: [7, 9] },
          { say: 'And measure the cost. If reclustering costs more than the queries save, remove the key.', lines: [11, 14] }
        ],
        result: { cols: ['cluster_by_keys', 'total_partition_count', 'average_overlaps', 'average_depth'], rows: [['LINEAR(txn_date)', '2481', '38.2', '21.4']], msg: '1 row (JSON fields shown as columns)' }
      }),

      B.cmp({
        id: 'm5-tools', title: 'Which tool fixes which problem',
        say: 'Four tools, four problems. Interviewers love to ask which one you would reach for. Press Next to see each row.',
        cols: ['', 'Scale up (bigger warehouse)', 'Scale out (multi-cluster)', 'Clustering key', 'Search optimization'],
        rows: [
          ['Helps with', 'One big slow query: huge scans, heavy joins, spilling', 'Many users at once, queries waiting in a queue', 'Range filters on large tables, by skipping partitions', 'Point lookups and very selective filters on huge tables'],
          ['Does not help', 'Concurrency. 50 queries still queue', 'A single slow query', 'Small tables, or filters on many different columns', 'Full scans and big aggregations'],
          ['Costs', 'Credits per hour double with each size', 'Each extra cluster bills while it runs', 'Background reclustering credits', 'Extra storage and maintenance compute']
        ],
        steps: [
          { upto: 1, say: 'What each one fixes. A bigger warehouse helps one heavy query. More clusters help many users. Clustering and search optimization help Snowflake read less data.' },
          { upto: 2, say: 'What each one does not fix. Most wrong answers in interviews are here: a bigger warehouse does not fix queueing, and more clusters do not fix a slow query.' },
          { upto: 3, say: 'And what each one costs. Say the cost every time you recommend one.' }
        ],
        pick: 'Diagnose first. **Slow single query** means check pruning and joins, then maybe scale up. **Queued queries** means scale out. **Point lookups on a huge table** means search optimization.'
      }),

      B.talk({
        id: 'm5-wh', title: 'Warehouses and cost levers',
        say: 'Cost is a design topic, not a billing detail. Here are the numbers and settings you should know. Press Next for each.',
        items: [
          ['Sizes double in cost', 'XS uses **1 credit per hour**. S is 2, M is 4, L is 8, XL is 16, 2XL is 32. Billing is per second with a 60 second minimum each time the warehouse starts.', 'Credits double with every size. A Large costs eight times an X-Small.'],
          ['Auto-suspend and auto-resume', 'Suspend after **60 seconds** idle for most warehouses, resume automatically on the next query. Very short suspend on a BI warehouse loses the local cache, so tune it for dashboards.', 'Idle warehouses cost money. Auto-suspend is the first control.'],
          ['One warehouse per workload', 'WH_LOAD (XS), WH_TRANSFORM (M), WH_BI (L, multi-cluster), WH_API (S, multi-cluster). Separate compute means separate cost lines and no interference.', 'Separate warehouses give isolation and cost attribution in one move.'],
          ['Guardrails', '**Resource monitors** notify or suspend at credit thresholds. `STATEMENT_TIMEOUT_IN_SECONDS` stops runaway queries. **Query tags** attribute spend to teams.', 'Guardrails protect you from the 3 AM runaway query.'],
          ['Watch it weekly', 'Query `SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY` and `QUERY_HISTORY`. Review the ten most expensive queries every week.', 'Measure continuously, not once.']
        ],
        cols: 1
      }),

      B.talk({
        id: 'm5-cache', title: 'Three caches', opt: true,
        say: 'Snowflake has three caches. Name all three and say where each lives.',
        items: [
          ['Result cache', 'In cloud services. Same query text, data unchanged, same role privileges: the result comes back in milliseconds with **no warehouse running**. Valid 24 hours, extended each time it is reused.', 'The result cache can answer a repeated dashboard query for free.'],
          ['Local disk cache', 'On the warehouse SSDs. Recently read micro-partitions stay local. **Lost when the warehouse suspends.**', 'The disk cache is why short auto-suspend can slow BI.'],
          ['Metadata cache', 'Counts, minimums and maximums answered from metadata without scanning, for example COUNT(*) or MIN(date) on a whole table.', 'Metadata answers simple aggregates without compute.']
        ]
      }),

      B.flow({
        id: 'm5-profile', title: 'Reading a Query Profile', g: 'profile', legend: false,
        steps: [
          { say: 'When a query is slow, open its Query Profile before touching any setting. Each box is an operator. Snowflake shows rows, time and warnings for each one. This query is slow. Press Next to diagnose it.', cap: 'Read it left to right: **scan, filter, join, aggregate, result.** Look for the box with the largest share of time.' },
          { say: 'Symptom one. The scan reads 11 of 12 partitions even though the query filters by date. Pruning failed.', focus: ['p1'], tags: ['tg1'], cap: '**Cause:** the table is not clustered on the filter column. **Fix:** cluster by date, or change the predicate so it can prune.' },
          { say: 'Symptom two. 41 million rows go into the join and 3.2 billion come out. That is a row explosion. The customer dimension has several versions per customer, and the join ignored the validity dates.', focus: ['p2', 'p3'], tags: ['tg2'], cap: '**Cause:** joining an SCD2 dimension on the business key only. **Fix:** join on key and the valid-from, valid-to range.' },
          { say: 'Symptom three. The aggregate spills 38 gigabytes to remote storage because it is processing billions of rows. Fix the join and the spill disappears.', focus: ['p4'], tags: ['tg3'], cap: 'A bigger warehouse would only **hide** the spill and raise the bill.' },
          { say: 'Fix the causes in order: pruning, then the join, then the spill. Only then ask whether a bigger warehouse is justified.', cap: 'Say it like this: "I diagnose with the profile first. Size is the last lever, not the first."' }
        ]
      }),

      B.sql({
        id: 'm5-tt', title: 'Time Travel, cloning and undrop', file: 'worksheet: recovery.sql', code: TT,
        ctx: { role: 'SYSADMIN', wh: 'WH_TRANSFORM', db: 'RISK_DB.MARTS' },
        steps: [
          { say: 'Time Travel lets you query or restore data as it was in the past. Cloning copies a table without copying data. Press Next.', lines: null },
          { say: 'AT with an offset in seconds reads the table as of ten minutes ago. Press Run.', lines: [1, 2], run: true },
          { say: 'BEFORE with a statement ID reads the table just before a specific statement ran, for example the DELETE that went wrong.', lines: [4, 6] },
          { say: 'To restore, clone the table as it was, then swap the clone in. The clone is zero-copy: it shares storage until data diverges, so it is instant and almost free.', lines: [8, 11] },
          { say: 'A dropped table can be undropped inside the retention period.', lines: [13, 14] }
        ],
        result: { cols: ['COUNT(*)'], rows: [['4182337']], msg: '1 row' },
        note: '**Retention:** 1 day by default on every edition, up to 90 days on Enterprise for permanent tables. Transient and temporary tables get at most 1 day. Permanent tables also have 7 days of Fail-safe, which only Snowflake support can recover. dbt builds **transient** tables by default.'
      }),

      B.sql({
        id: 'm5-stream', title: 'Streams and Tasks', file: 'worksheet: streams_tasks.sql', code: STREAMS,
        ctx: { role: 'SYSADMIN', wh: 'WH_TRANSFORM', db: 'RISK_DB.MARTS' },
        steps: [
          { say: 'The JD lists Snowflake Tasks. Tasks plus Streams give you scheduled, change-driven SQL without any external tool. Press Next.', lines: null },
          { say: 'A stream records changes to a table: inserts, updates and deletes since you last consumed it. It stores no data, only an offset.', lines: [1, 2] },
          { say: 'A task is SQL on a schedule. The WHEN clause skips the run when the stream is empty, so you pay nothing for nothing.', lines: [4, 9] },
          { say: 'The body is a normal statement. This merge reads from the stream. Reading a stream inside a DML statement consumes it, so the next run sees only new changes.', lines: [10, 15] },
          { say: 'New tasks start suspended. You must resume them. Forgetting this is the classic mistake.', lines: [17, 18] }
        ]
      }),

      B.talk({
        id: 'm5-snowpark', title: 'Snowpark and dynamic tables', opt: true,
        say: 'Two newer features worth naming, so you are not caught off guard.',
        items: [
          ['Snowpark', 'DataFrame API for Python, Java and Scala that **runs inside Snowflake**. Also Python UDFs, UDTFs and stored procedures. dbt Python models use it.', 'Snowpark is how Python runs on Snowflake compute.'],
          ['Dynamic tables', 'Declare a query and a target lag. Snowflake keeps the table refreshed incrementally. Good for simple near-real-time derivations. For the standard pipeline I still prefer dbt and Airflow, because of tests, lineage and CI.', 'Know that dynamic tables exist. Say when you would choose dbt instead.']
        ]
      }),

      B.quiz({
        id: 'm5-q1', q: 'A dashboard query that used to take 8 seconds now takes 5 minutes. What is the first thing you do?',
        opts: [
          { t: 'Double the warehouse size', fb: 'That costs more and may not help. You do not know the cause yet.' },
          { t: 'Add a clustering key to every table', fb: 'Clustering costs credits and only helps if scanning is the problem. Measure first.' },
          { t: 'Open the Query Profile and check partitions scanned, spilling and join row counts', fb: '' },
          { t: 'Rewrite the dashboard in Python', fb: 'That adds work without a diagnosis.' }
        ],
        ok: 2, why: 'Diagnose with evidence. The profile tells you whether the problem is **pruning, a join explosion, spilling, or queueing**, and each has a different fix.'
      }),

      B.quiz({
        id: 'm5-q2', q: '60 analysts open dashboards at 9 AM. Individual queries are fast, but many wait in a queue. What fixes it?',
        opts: [
          { t: 'A multi-cluster warehouse (scale out)', fb: '' },
          { t: 'A larger warehouse size (scale up)', fb: 'Each query is already fast. A bigger warehouse does not add concurrency slots.' },
          { t: 'Clustering keys', fb: 'Clustering reduces data scanned, not how many queries can run at once.' },
          { t: 'Time Travel', fb: 'Time Travel is a recovery feature, unrelated to concurrency.' }
        ],
        ok: 0, why: 'Queueing means too many concurrent queries for one cluster. **Multi-cluster** warehouses add clusters automatically when queries queue and remove them when load drops.'
      }),

      B.decide({
        id: 'm5-dec', title: 'Architecture decision: speed up fct_payments',
        scenario: '`fct_payments` has **8 billion rows**. Analysts filter by **date range**. The REST API also looks up **one transaction by txn_id**. Both are slow.',
        opts: [
          { t: 'Cluster by txn_id', d: 'One key for everything.', lose: 'A unique ID as a clustering key has the highest cardinality possible. It cannot group rows, and reclustering it costs a lot.' },
          { t: 'Cluster by txn_date and add search optimization on txn_id', d: 'Different tools for the two access patterns.' },
          { t: 'Create a materialized view', d: 'Pre-compute results.', lose: 'A materialized view suits a repeated aggregate on one table. It does not help ad hoc date ranges or ID lookups.' },
          { t: 'Make the warehouse 4X bigger', d: 'Throw compute at it.', lose: 'Both problems are about reading too much data. Compute treats the symptom at four times the price.' }
        ],
        pick: 1,
        why: 'The two access patterns need different tools. **Clustering on the date** lets range queries skip partitions. **Search optimization on txn_id** makes point lookups fast. Both reduce data read instead of adding compute.',
        when: 'Choose a **bigger warehouse** only after the profile shows the work is genuinely large and already pruned. Choose a **materialized view** when the same aggregate is queried repeatedly.'
      }),

      B.order({
        id: 'm5-ord', q: 'Put the slow-query investigation in order.',
        items: ['Open the Query Profile of the slow query', 'Compare partitions scanned with total partitions', 'Look for spilling and join row explosions', 'Fix the cause: filter, join keys, clustering', 'Only then consider a bigger warehouse', 'Measure again and record the before and after'],
        why: 'Evidence first, cheap fixes next, spending last. Recording before and after turns a fix into a story you can tell in an interview.'
      }),

      B.qa({
        id: 'qa-perf', tag: 'Snowflake', secs: 75,
        q: 'How did you optimize Snowflake performance and cost at Bank of America?',
        pts: ['Evidence first: Query Profile, partitions scanned, spilling, join explosions', 'Clustering on the filter columns of big tables', 'Query rewrites so filters prune', 'Workload separation: warehouses per workload, auto-suspend, right sizing', 'Multi-cluster only where concurrency needed it', 'Measured before and after. PII controls and lineage stayed intact'],
        short: 'I always start with evidence: the Query Profile and query history, looking at how many micro-partitions a query scans, whether it spills, and whether a join explodes rows. The fixes were usually at the cause: clustering big tables on the columns they are filtered by, rewriting queries so filters prune, and removing unnecessary full scans.\n\nFor workload management I separated warehouses by workload, loading, transformation, BI and the API, with auto-suspend and right sizing, and multi-cluster only where concurrency needed it. Heavy jobs stopped slowing analysts and I could attribute cost per workload.\n\nThroughout, PII controls, role-based access and audit-ready lineage stayed intact. I measured each change before and after. At Citigroup a storage optimization pass improved query performance by 40%.',
        fu: [
          ['How do you pick a clustering key?', 'I look at the filters and joins that run most often on the largest tables. I prefer a date or a low-to-medium cardinality column, avoid raw timestamps and IDs, check SYSTEM$CLUSTERING_INFORMATION before and after, and watch the reclustering cost.'],
          ['What does spilling mean?', 'The operator ran out of warehouse memory, so intermediate data went to local disk and then remote storage, which is far slower. The usual fix is to process less data. A larger warehouse for that one job is a last resort.'],
          ['Would you just use a bigger warehouse?', 'Only after the profile shows the work is genuinely large. A bigger warehouse costs more per hour and does not fix poor pruning or exploding joins.']
        ],
        trap: 'Answering "I increased the warehouse size". That invites a hard follow-up. Show the **diagnosis first**, then the fix, then the **measured result**.',
        real: 'Use the numbers from your resume only. If you remember a specific query you tuned at Bank of America, name it and say what the profile showed.'
      }),

      B.qa({
        id: 'qa-snow-arch', tag: 'Snowflake', secs: 60,
        q: 'Explain the Snowflake architecture and how it shapes the way you design pipelines.',
        pts: ['Three layers: storage, compute (warehouses), cloud services', 'Micro-partitions with min/max metadata enable pruning', 'Storage and compute scale and bill separately', 'Warehouse per workload gives isolation', 'Time Travel, cloning follow from immutable storage'],
        short: 'Snowflake separates three layers. Storage holds data once, as compressed columnar micro-partitions in cloud object storage. Compute is virtual warehouses, independent clusters that run queries and loads, which I size per workload so they never compete. Cloud services handles authentication, roles, metadata, query optimization and transactions.\n\nThe metadata knows the minimum and maximum of each column per micro-partition, which is how queries skip data that cannot match, so pruning is central to performance. Because compute and storage are separate, I resume a warehouse for a job and suspend it afterwards, pay only for what ran, and give each team its own compute over the same data. Time Travel and zero-copy cloning also follow from that design.',
        fu: [
          ['What is a micro-partition?', 'The immutable unit of storage, roughly 50 to 500 MB of uncompressed data. Snowflake keeps min, max and other statistics per column for each one, and the optimizer uses them to prune.'],
          ['What happens when a warehouse suspends?', 'You stop paying for compute. The local disk cache is lost, so the first queries after resume are slower. That is why a very short auto-suspend on a BI warehouse can backfire.'],
          ['Where does the result cache live?', 'In the cloud services layer. A repeated identical query on unchanged data can return in milliseconds with no warehouse running.']
        ],
        trap: 'Reciting the three layers without connecting them to a design decision. Add one sentence: "so I separate warehouses by workload."'
      }),

      B.qa({
        id: 'qa-cost', tag: 'Snowflake', secs: 60,
        q: 'How do you keep Snowflake costs under control?',
        pts: ['Compute: warehouse per workload, right size, auto-suspend', 'Guardrails: resource monitors, statement timeouts, query tags', 'Query habits: pruning filters, needed columns only, incremental models', 'Storage: transient tables, retention, drop dead tables', 'Monitor weekly with ACCOUNT_USAGE'],
        short: 'I treat cost as a design constraint with four levers. Compute: separate warehouses per workload, sized for the work, auto-suspend at 60 seconds for most, and multi-cluster only where concurrency needs it. Guardrails: resource monitors with notify and suspend thresholds, statement timeouts, and query tags so spend can be attributed to teams.\n\nQuery habits: filters that prune, only the columns needed, and incremental dbt models instead of full rebuilds. Storage: transient tables for intermediate data, sensible Time Travel retention, and dropping dead tables.\n\nI watch it through ACCOUNT_USAGE views such as warehouse metering and query history, and review the ten most expensive queries every week.',
        fu: [
          ['What is a resource monitor?', 'A credit quota on a warehouse or the account with actions at thresholds: notify at 75 percent, suspend at 100 percent. It stops an unexpected spike from becoming an unexpected invoice.'],
          ['How do you attribute cost to a team?', 'Separate warehouses per workload, and query tags set by dbt and Airflow. Then ACCOUNT_USAGE metering and query history can be grouped by warehouse or tag.']
        ]
      }),

      B.recap({
        id: 'm5-recap', n: 5, badge: 'Snowflake Tuner', color: '#BBF7D0',
        pts: [
          'Three layers: **storage**, **compute** (warehouses), **cloud services**. Storage and compute scale separately.',
          'Micro-partitions plus min/max metadata make **pruning** possible. Cluster big tables on filter columns.',
          '**Scale up** for one heavy query. **Scale out** for many users. Diagnose with the Query Profile first.',
          'Time Travel (1 to 90 days), zero-copy clones, Streams and Tasks. New tasks start **suspended**.',
          'Cost levers: auto-suspend, warehouse per workload, resource monitors, transient tables.'
        ],
        lines: [
          'I diagnose with the Query Profile before I touch warehouse size.',
          'Scale up fixes one big query. Scale out fixes queueing.',
          'I separate warehouses by workload for isolation and cost attribution.'
        ]
      })
    ]
  });
})();
