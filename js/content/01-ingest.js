/* Mission 2: getting data into Snowflake (Python, S3, Snowpipe). */
(function () {
  var B = LAB.b;

  var EXTRACT = [
    'import json',
    'import boto3',
    'import requests',
    'from requests.adapters import HTTPAdapter',
    'from urllib3.util.retry import Retry',
    '',
    'BUCKET = "bank-risk-landing"',
    'PAYMENTS_URL = "https://payments.internal/v1/txns"',
    '',
    'def build_session():',
    '    retry = Retry(total=5, backoff_factor=1.0,',
    '                  status_forcelist=[429, 500, 502, 503, 504],',
    '                  allowed_methods=["GET"])',
    '    session = requests.Session()',
    '    session.mount("https://", HTTPAdapter(max_retries=retry))',
    '    return session',
    '',
    'def extract_payments(run_date: str) -> int:',
    '    """Pull one day of transactions. Same run_date, same files."""',
    '    session, s3 = build_session(), boto3.client("s3")',
    '    cursor, page = None, 0',
    '    while True:',
    '        params = {"date": run_date, "limit": 500}',
    '        if cursor:',
    '            params["cursor"] = cursor',
    '        resp = session.get(PAYMENTS_URL, params=params, timeout=30)',
    '        resp.raise_for_status()',
    '        body = resp.json()',
    '',
    '        key = f"payments/dt={run_date}/page-{page:05d}.json"',
    '        ndjson = "\\n".join(json.dumps(item) for item in body["items"])',
    '        s3.put_object(Bucket=BUCKET, Key=key, Body=ndjson.encode("utf-8"))',
    '',
    '        cursor, page = body.get("next_cursor"), page + 1',
    '        if not cursor:',
    '            return page'
  ].join('\n');

  var LOADSQL = [
    'USE ROLE LOADER;',
    'USE WAREHOUSE WH_LOAD;',
    'USE SCHEMA RISK_DB.RAW;',
    '',
    '-- A stage is a named pointer to the S3 folder. The storage integration',
    '-- is created once by an admin, so no AWS keys appear in SQL.',
    'CREATE STAGE IF NOT EXISTS landing_stage',
    "  URL = 's3://bank-risk-landing/'",
    '  STORAGE_INTEGRATION = s3_landing;',
    '',
    'CREATE TABLE IF NOT EXISTS payments_txns (',
    '  payload       VARIANT,',
    '  _source_file  STRING,',
    '  _loaded_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()',
    ');',
    '',
    'CREATE PIPE IF NOT EXISTS pipe_payments AUTO_INGEST = TRUE AS',
    '  COPY INTO payments_txns (payload, _source_file)',
    '  FROM (SELECT $1, METADATA$FILENAME FROM @landing_stage/payments/)',
    "  FILE_FORMAT = (TYPE = 'JSON');",
    '',
    '-- Did the files load? Check the last hour.',
    'SELECT file_name, status, row_count, first_error_message',
    'FROM TABLE(INFORMATION_SCHEMA.COPY_HISTORY(',
    "       TABLE_NAME => 'PAYMENTS_TXNS',",
    "       START_TIME => DATEADD('hour', -1, CURRENT_TIMESTAMP())));"
  ].join('\n');

  var BUGCODE = [
    'from datetime import datetime',
    'import json',
    'import boto3',
    '',
    'BUCKET = "bank-risk-landing"',
    '',
    'def land_page(items, page, run_date):',
    '    s3 = boto3.client("s3")',
    '    day = datetime.utcnow().date()',
    '    key = f"payments/dt={day}/page-{page:05d}.json"',
    '    body = "\\n".join(json.dumps(i) for i in items)',
    '    s3.put_object(Bucket=BUCKET, Key=key, Body=body.encode("utf-8"))',
    '    return key'
  ].join('\n');

  LAB.addChapter({
    id: 'm2', n: 2, title: 'Getting data in', short: 'Ingestion', blurb: 'Python, S3, Snowpipe, RAW', minutes: 22,
    focus: ['src', 'ing', 'raw'],
    goals: [
      'Explain how data enters Snowflake **from a database, an API and files**.',
      'Write an **incremental, rerunnable** Python extractor with retries.',
      'Choose between **COPY INTO, Snowpipe and Snowpipe Streaming**.',
      'Handle **duplicates, late files and schema changes** without waking anyone up.'
    ],
    say: 'Mission 2 covers the left half of the diagram: everything before dbt. Interviewers use it to check whether you understand failure, not just the happy path.',
    scenes: [
      B.flow({
        id: 'm2-flow', title: 'Ingestion, zoomed in', g: 'ingest',
        steps: [
          { say: 'Zoom into the ingestion part of the map. Three sources, three extractors, one landing zone in S3, then Snowpipe and the RAW tables. Press Next to follow each path.', cap: 'The pattern is always the same: **extract, land, load**. Only the extractor changes per source.' },
          { say: 'Database source. The extractor asks only for rows changed since the last successful run, using an updated-at column as a watermark. It saves the new watermark only after the files are safely in S3.',
            focus: ['src1', 'x1'], on: ['i1a'], cap: '**Watermark rule:** advance it **after** the write succeeds. If the job dies halfway, the next run repeats the same window. Hard deletes are invisible to this method, so use CDC or a periodic full compare.' },
          { say: 'API source. Page through with a cursor, set a timeout on every call, and retry on 429 and 5xx with backoff. Respect the rate limit.',
            focus: ['src2', 'x2'], on: ['i1b'], cap: 'The API gives you a **cursor**, not an offset. Offsets skip or repeat rows when data changes during the run.' },
          { say: 'File source. Download only files you have not seen, verify size or checksum, keep the original file name. The vendor sends no JSON here, just CSV.',
            focus: ['src3', 'x3'], on: ['i1c'], cap: 'Keep a **control table** of processed file names and checksums, so the same vendor file is never processed twice.' },
          { say: 'All three extractors write to S3 under a folder named for the run date. Same input, same path. A rerun overwrites the same files instead of creating duplicates.',
            focus: ['x1', 'x2', 'x3', 's3'], on: ['i2a', 'i2b', 'i2c'], cap: 'Paths use the **logical run date**, not the clock. That is what makes backfills and reruns safe.' },
          { say: 'When a file arrives, S3 sends an event to a queue, and Snowpipe wakes up. It loads each new file once, using Snowflake-managed compute. You pay per file, not for an idle warehouse.',
            focus: ['s3', 'pipe'], on: ['i3'], cap: 'S3 event notification, then an SQS queue, then Snowpipe. **No scheduler involved.**' },
          { say: 'Finally COPY INTO fills the RAW tables. Typed columns for the database and CSV feeds, a VARIANT column for JSON, plus the source file name and a load timestamp.',
            focus: ['pipe', 'g_raw', 'r1', 'r2', 'r3'], on: ['i4'], cap: 'RAW tables are **append-only landing tables**. Cleaning is dbt\'s job in the next layer.' }
        ]
      }),

      B.code({
        id: 'm2-py', title: 'The Python extractor', file: 'ingest/extract_payments.py', lang: 'python', code: EXTRACT,
        steps: [
          { say: 'Here is the extractor for the payments API. About 35 lines, and every part has a reason. Press Next and I will mark them one at a time.', lines: null },
          { say: 'First, retries. A session that retries 429 and 5xx up to five times with growing delays: 1, 2, 4 seconds and so on. Without it, one flaky minute fails the whole daily run.', lines: [10, 16] },
          { say: 'Cursor pagination with a timeout on every request. No timeout means a hung connection can block a worker forever. raise_for_status turns an HTTP error into an exception that Airflow can retry.', lines: [23, 28] },
          { say: 'The most important lines. The S3 path comes from run_date, never from the clock. Same input gives the same path, so a rerun overwrites instead of duplicating. This is idempotency.', lines: [30, 32] },
          { say: 'Loop until the API says there is no next cursor. Returning the page count lets Airflow log it and the next task check it.', lines: [34, 36] }
        ]
      }),

      B.sql({
        id: 'm2-sql', title: 'The Snowflake worksheet that loads it', file: 'worksheet: load_payments.sql', code: LOADSQL,
        ctx: { role: 'LOADER', wh: 'WH_LOAD (XS)', db: 'RISK_DB.RAW' },
        steps: [
          { say: 'This is the worksheet for the load side. Press Next to walk through it, then Run the last query.', lines: null },
          { say: 'Use a loader role, a load warehouse and the RAW schema. Three lines, three safeguards: least privilege, separate compute so loading never slows reporting, and the right schema.', lines: [1, 3] },
          { say: 'A stage points at the S3 folder. A storage integration, created once by an admin, grants access through an IAM role, so no AWS keys appear in SQL.', lines: [5, 9] },
          { say: 'The RAW table. JSON goes into a VARIANT column, so a new field in the API cannot break the load. Two metadata columns record which file the row came from and when it landed.', lines: [11, 15] },
          { say: 'The pipe. AUTO_INGEST means S3 events trigger it. The COPY statement reads the stage, takes the whole JSON document as $1 and the file name from METADATA$FILENAME.', lines: [17, 20] },
          { say: 'Always verify. COPY_HISTORY shows each file, whether it loaded, how many rows, and the first error. Press Run.', lines: [22, 26], run: true }
        ],
        result: { cols: ['file_name', 'status', 'row_count', 'first_error_message'], rows: [
          ['payments/dt=2026-03-14/page-00000.json', 'Loaded', '500', 'NULL'],
          ['payments/dt=2026-03-14/page-00001.json', 'Loaded', '500', 'NULL'],
          ['payments/dt=2026-03-14/page-00002.json', 'Loaded', '312', 'NULL']
        ], msg: '3 rows' }
      }),

      B.cmp({
        id: 'm2-cmp', title: 'COPY INTO, Snowpipe, Snowpipe Streaming',
        say: 'Interviewers ask this one a lot. Four ways to get data in. Press Next to reveal each row.',
        cols: ['', 'COPY INTO', 'Snowpipe', 'Snowpipe Streaming', 'External table'],
        hl: 2,
        rows: [
          ['Triggered by', 'You run it (Airflow, a Task)', 'A file arriving (S3 event) or a REST call', 'Your app or the Kafka connector writing rows', 'A query reading files in place'],
          ['Compute', 'Your warehouse', 'Snowflake-managed, billed per use', 'Snowflake-managed', 'Your warehouse at query time'],
          ['Latency', 'Whatever your schedule is', 'About a minute or a few', 'Seconds', 'Query time, slower'],
          ['Best for', 'Big scheduled batches, backfills', 'A steady trickle of files', 'Events, CDC, Kafka topics', 'Rarely queried data lake files']
        ],
        steps: [
          { upto: 1, say: 'First row: who starts it. COPY INTO is a command you run. Snowpipe reacts to a file arriving. Streaming is rows written directly.' },
          { upto: 2, say: 'Second row: whose compute. COPY INTO uses a warehouse you size and pay for. Snowpipe and Streaming use Snowflake-managed compute.' },
          { upto: 3, say: 'Latency decides it for many teams. Minutes is fine for daily risk data. Seconds needs Streaming.' },
          { upto: 4, say: 'Rule of thumb: Snowpipe for files that trickle in, COPY INTO for big scheduled batches and backfills.' }
        ],
        pick: 'Snowpipe for the daily files, because latency of a minute is fine and nobody manages a warehouse for it. Keep **COPY INTO** in your toolbox for backfills and historical loads, where you want a big warehouse for 20 minutes.'
      }),

      B.talk({
        id: 'm2-idem', title: 'Duplicates, late files, schema changes',
        say: 'Four things go wrong in real ingestion. Press Next for each, with the fix that interviewers want to hear.',
        items: [
          ['Same file arrives twice', 'COPY INTO and Snowpipe remember loaded files by name and skip repeats. COPY keeps that load history for 64 days, Snowpipe for 14 days. After that, or if the file is renamed, only the **business key dedupe in staging** protects you.', 'First problem: the same file twice. Snowflake helps for a while, then your own dedupe has to take over.'],
          ['A file arrives late', 'The pipeline already ran at 05:00. A sensor with a timeout waits for the expected files, and **freshness tests** alert if data is older than the agreed threshold. Late rows then flow through incremental models using a **lookback window**.', 'Second: late data. Wait with a timeout, alert on staleness, and design models to accept late rows.'],
          ['The source changes shape', 'JSON lands in a VARIANT column, so extra fields do not break loading. Extractors compare the schema against the expected one and alert. dbt **contracts** stop a breaking change reaching consumers. Migrate with **expand and contract**: add the new column, move consumers, then drop the old one.', 'Third: schema drift. Absorb it in RAW, detect it early, and migrate in two steps.'],
          ['A load half-fails', 'Snowpipe skips a bad file by default and reports the error, rather than loading half of it. Check COPY_HISTORY, fix or quarantine the file, and let the next run pick it up. Reconcile **row counts** between the source and RAW before dbt starts.', 'Fourth: partial failure. Never let dbt start on incomplete data. Reconcile counts first.']
        ]
      }),

      B.bug({
        id: 'm2-bug', q: 'This extractor passed code review but corrupts reruns. Which line is the bug?',
        file: 'ingest/land_page.py', lang: 'python', code: BUGCODE, bad: [9, 10],
        why: 'The folder name comes from the **wall clock**, not the logical run date. A retry after midnight, or a backfill of last Tuesday, writes into today\'s folder. Files get mixed, and rerunning creates duplicates in the wrong place.',
        fix: BUGCODE.replace('    day = datetime.utcnow().date()\n    key = f"payments/dt={day}/page-{page:05d}.json"', '    key = f"payments/dt={run_date}/page-{page:05d}.json"'),
        hint: 'Look at where the date in the file path comes from. Is it an input, or is it read from the machine?'
      }),

      B.quiz({
        id: 'm2-q1', q: 'The vendor drops the same file twice with an identical name. A Snowpipe is configured on the folder. What happens?',
        opts: [
          { t: 'The rows are loaded twice', fb: 'Not by default. Snowflake records the file name in load metadata and skips files it already loaded.' },
          { t: 'The second copy is skipped because Snowflake already recorded the file as loaded', fb: '' },
          { t: 'The pipe fails and stops until someone resumes it', fb: 'A repeated file is not an error. The pipe keeps running.' },
          { t: 'Snowflake merges the two files into one', fb: 'Snowflake does not merge files. It tracks them individually.' }
        ],
        ok: 1,
        why: 'Snowpipe keeps load history for **14 days** (COPY INTO for 64 days). That protects you from repeats inside the window. For anything outside it, or renamed files, your **dedupe on the business key** in staging is the real defence.'
      }),

      B.quiz({
        id: 'm2-q2', q: 'Your API call returns HTTP 429 (too many requests). What should the extractor do?',
        opts: [
          { t: 'Fail the whole run immediately', fb: 'That turns a short rate limit into an outage and a manual rerun.' },
          { t: 'Retry right away in a tight loop', fb: 'That makes the rate limit worse and can get you blocked.' },
          { t: 'Wait using exponential backoff with jitter (and honour Retry-After), then retry a limited number of times', fb: '' },
          { t: 'Skip the page and continue', fb: 'Silently skipping data is the worst outcome. You would load incomplete data without knowing.' }
        ],
        ok: 2,
        why: 'Backoff with **jitter** spreads retries out so many workers do not hit the API at the same moment. Cap the attempts, then fail loudly so Airflow can alert.'
      }),

      B.qa({
        id: 'qa-ingest', tag: 'Ingestion', secs: 60,
        q: 'How does data get into Snowflake in your pipelines?',
        pts: [
          'Two steps: extract to S3, then load to RAW',
          'Database: incremental watermark. API: cursor, retries. Files: new files only',
          'Snowpipe for continuous files, COPY INTO for scheduled bulk and backfills',
          'RAW keeps the source file name and load timestamp',
          'Rerunnable: file load history plus business key dedupe',
          'Airflow sensor and row-count reconciliation before dbt'
        ],
        short: 'In my pipelines data enters Snowflake in two steps. First, Python extractors pull from the source and write files to S3 under a folder named for the run date. For a database that is an incremental query on an updated-at watermark, for a REST API it is cursor pagination with retries and timeouts, and for vendor files it is new files only.\n\nSecond, Snowpipe loads each new file into a RAW table, triggered by an S3 event. For big scheduled loads and backfills I use COPY INTO on a dedicated load warehouse.\n\nRAW keeps the data exactly as received, plus the source file name and load time, so any batch can be replayed. Loads are rerunnable: Snowflake tracks which files it loaded and staging deduplicates on the business key. Airflow waits for the load with a sensor and reconciles row counts before dbt starts.',
        fu: [
          ['Snowpipe or COPY INTO. How do you choose?', 'Snowpipe when files arrive continuously and a minute of latency is fine, because it is serverless and event-driven. COPY INTO when the load is scheduled, large, or I want the cost on a named warehouse. Snowpipe Streaming when I need rows in seconds, for example from Kafka.'],
          ['What if the same file arrives twice?', 'Snowflake skips files it already loaded (COPY remembers 64 days, Snowpipe 14 days). Outside that window or for renamed files, staging deduplicates on the business key, so the result is the same.'],
          ['How do you load JSON?', 'Into a VARIANT column in RAW, together with the file name and load time. Staging parses it with colon paths and FLATTEN. RAW stays stable when the API adds fields.']
        ],
        trap: 'Saying "we use Snowpipe" without explaining what triggers it and how you know it finished. Mention the S3 event notification and how Airflow confirms completion.',
        real: 'Replace the example with a real source of yours: the system, the file format, how often it loads.'
      }),

      B.qa({
        id: 'qa-drift', tag: 'Ingestion', secs: 60,
        q: 'An upstream API adds a field and renames another overnight. What happens to your pipeline, and how do you protect against it?',
        pts: ['RAW absorbs the change (VARIANT or schema check)', 'Detect early: extractor schema check, alerts', 'dbt tests and contracts stop it before the marts', 'Expand and contract migration', 'Agree a contract with the upstream team'],
        short: 'Loading does not break, because JSON lands in a VARIANT column and the other feeds have a defined column list with schema checks. The break would show up in dbt staging if a model reads a column that no longer exists.\n\nI protect against it in layers. The extractor compares the incoming schema with the expected one and alerts on new or missing fields. In dbt, tests on staging and **contracts** on the marts make a breaking change fail the build instead of reaching consumers.\n\nFor the change itself I use expand and contract: add the new column next to the old one, move consumers over, then remove the old one. And I agree a contract with the upstream team, so renames are announced rather than discovered.',
        fu: [
          ['What is a dbt model contract?', 'A `contract: {enforced: true}` setting on a model with declared column names and data types. dbt checks that the built model matches and fails the build if it does not. It protects consumers such as the API from silent shape changes.'],
          ['Why not just turn on schema evolution?', 'Snowflake can add new columns automatically during loads, which is handy for a landing table. But I still want to be told, because downstream models and consumers need a decision, not a surprise column.']
        ],
        trap: 'Saying "we would just fix it when it breaks". Describe how you **detect** it before the business does.'
      }),

      B.qa({
        id: 'qa-idem', tag: 'Ingestion', secs: 45, opt: true,
        q: 'What does idempotent mean for a pipeline, and how do you achieve it?',
        pts: ['Definition: rerun gives the same result', 'Deterministic paths from the run date', 'Load history avoids reloading files', 'Merge on a business key, or delete and insert a partition', 'Never blind append'],
        short: 'Idempotent means running the same job twice gives the same final state as running it once. I get there with deterministic inputs and writes: file paths come from the logical run date, Snowflake skips files it has already loaded, and transformations merge on a business key or replace a whole partition instead of blindly appending. Then a retry, a rerun after a failure, or a backfill is safe, and nobody has to clean up duplicates afterwards.',
        fu: [['How do you test it?', 'Run the pipeline twice for the same date in a test schema and assert the row counts and key totals are identical. In dbt, a unique test on the business key catches duplicates.']]
      }),

      B.recap({
        id: 'm2-recap', n: 2, badge: 'Ingestion Engineer', color: '#A5F3FC',
        pts: [
          'Extract, land, load. Python to S3 to Snowpipe to RAW.',
          'Watermark on a database, cursor on an API, new files only for files.',
          'Paths come from the **run date**, never the clock. That makes reruns safe.',
          'Snowpipe for trickling files, COPY INTO for bulk, Streaming for seconds.',
          'RAW keeps everything plus file name and load time. Dedupe happens in staging.'
        ],
        lines: [
          'I land files in S3 by run date, load them with Snowpipe, and keep RAW exactly as received.',
          'Every step is rerunnable: deterministic paths, load history, and business-key dedupe.',
          'Airflow reconciles row counts before dbt starts, so bad loads never reach the marts.'
        ]
      })
    ]
  });
})();
