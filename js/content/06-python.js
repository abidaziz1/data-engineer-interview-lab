/* Mission 7: Python for ingestion and pipelines. Every solution here is run against tests. */
(function () {
  var B = LAB.b;

  var LOADER = [
    'import os',
    'import snowflake.connector',
    '',
    '',
    'def load_csv(local_path: str) -> None:',
    '    conn = snowflake.connector.connect(',
    '        account=os.environ["SNOWFLAKE_ACCOUNT"],',
    '        user=os.environ["SNOWFLAKE_USER"],',
    '        private_key_file=os.environ["SNOWFLAKE_KEY_FILE"],',
    '        role="LOADER", warehouse="WH_LOAD", database="RISK_DB", schema="RAW",',
    '    )',
    '    try:',
    '        cur = conn.cursor()',
    '        cur.execute(f"PUT file://{local_path} @%risk_ratings AUTO_COMPRESS=TRUE")',
    '        cur.execute(',
    '            "COPY INTO risk_ratings FROM @%risk_ratings "',
    '            "FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 1)"',
    '        )',
    '    finally:',
    '        conn.close()'
  ].join('\n');

  var RETRY = [
    'import functools',
    'import random',
    'import time',
    '',
    '',
    'def retry(max_attempts=5, base_delay=1.0, max_delay=30.0, exceptions=(Exception,)):',
    '    def decorator(fn):',
    '        @functools.wraps(fn)',
    '        def wrapper(*args, **kwargs):',
    '            for attempt in range(1, max_attempts + 1):',
    '                try:',
    '                    return fn(*args, **kwargs)',
    '                except exceptions:',
    '                    if attempt == max_attempts:',
    '                        raise',
    '                    delay = min(max_delay, base_delay * 2 ** (attempt - 1))',
    '                    time.sleep(delay * random.uniform(0.5, 1.0))',
    '        return wrapper',
    '    return decorator',
    '',
    '',
    '@retry(max_attempts=4, exceptions=(ConnectionError, TimeoutError))',
    'def fetch_page(url):',
    '    ...'
  ].join('\n');

  var PAGES = [
    'def fetch_all(session, url, page_size=500):',
    '    cursor = None',
    '    while True:',
    '        params = {"limit": page_size}',
    '        if cursor:',
    '            params["cursor"] = cursor',
    '        resp = session.get(url, params=params, timeout=30)',
    '        resp.raise_for_status()',
    '        body = resp.json()',
    '        yield from body["items"]',
    '        cursor = body.get("next_cursor")',
    '        if not cursor:',
    '            break'
  ].join('\n');

  var FLAT = [
    'def flatten(obj, parent_key="", sep="."):',
    '    flat = {}',
    '    for key, value in obj.items():',
    '        name = f"{parent_key}{sep}{key}" if parent_key else key',
    '        if isinstance(value, dict):',
    '            flat.update(flatten(value, name, sep))',
    '        else:',
    '            flat[name] = value',
    '    return flat'
  ].join('\n');

  var LATEST = [
    'def latest_per_key(rows, key="loan_id", ts="updated_at"):',
    '    best = {}',
    '    for row in rows:',
    '        k = row[key]',
    '        if k not in best or row[ts] > best[k][ts]:',
    '            best[k] = row',
    '    return list(best.values())'
  ].join('\n');

  var BATCH = [
    'import csv',
    'from itertools import islice',
    '',
    '',
    'def read_in_batches(path, size=10_000):',
    '    with open(path, newline="") as f:',
    '        reader = csv.DictReader(f)',
    '        while True:',
    '            batch = list(islice(reader, size))',
    '            if not batch:',
    '                return',
    '            yield batch'
  ].join('\n');

  var VALID = [
    'def split_valid(rows):',
    '    good, bad = [], []',
    '    for row in rows:',
    '        errors = []',
    '        if not row.get("txn_id"):',
    '            errors.append("missing txn_id")',
    '        try:',
    '            if float(row.get("amount")) <= 0:',
    '                errors.append("amount must be positive")',
    '        except (TypeError, ValueError):',
    '            errors.append("amount is not a number")',
    '        if errors:',
    '            bad.append({**row, "_errors": errors})',
    '        else:',
    '            good.append(row)',
    '    return good, bad'
  ].join('\n');

  var BUGPY = [
    'def load_day(run_date):',
    '    try:',
    '        files = list_files(run_date)',
    '        for f in files:',
    '            copy_into_raw(f)',
    '    except Exception:',
    '        pass',
    '    mark_done(run_date)'
  ].join('\n');

  LAB.addChapter({
    id: 'm7', n: 7, title: 'Python for pipelines', short: 'Python', blurb: 'Ingestion, retries, generators, coding problems', minutes: 26,
    focus: ['src', 'ing'],
    goals: [
      'Write **retry with backoff, pagination, flatten JSON, latest per key and batch reading** from memory.',
      'Explain how Python ingestion stays **rerunnable, testable and secure**.',
      'Load into Snowflake the **fast way**, with stage and COPY, never row by row.',
      'Answer "How do you use Python in your pipelines?" with specifics.'
    ],
    say: 'Mission 7 is about Python as production code. The JD asks for Python skills for ingestion and integration. Interviewers test it with short coding problems, so you will write six here.',
    scenes: [
      B.talk({
        id: 'm7-roles', title: 'What Python does in this platform',
        say: 'Three jobs for Python, plus the habits that make it production code. Press Next for each.',
        items: [
          ['1. Ingestion', 'Extractors for databases, REST APIs and files: `requests`, `boto3`, database drivers. Retries, timeouts, pagination, deterministic S3 paths.', 'Job one: bring data in, safely and repeatably.'],
          ['2. Glue around the platform', 'Airflow tasks, calling dbt with `dbtRunner`, reading `run_results.json`, pushing metrics to Datadog, running Great Expectations checkpoints.', 'Job two: connect the tools and report on them.'],
          ['3. Heavy processing', 'PySpark and Pandas on EMR or Databricks for large or messy semi-structured data, as in your Bank of America and Citigroup work.', 'Job three: processing at scale. Pandas up to a few GB, PySpark beyond that.'],
          ['Production habits', 'Small functions, type hints, config and secrets from the environment, structured logging, `pytest` with mocked HTTP, and **idempotent** writes.', 'The habits are what turn a script into a pipeline component.']
        ],
        cols: 2
      }),

      B.code({
        id: 'm7-load', title: 'Load into Snowflake the fast way', file: 'ingest/load_csv.py', lang: 'python', code: LOADER,
        steps: [
          { say: 'Here is how Python loads a file into Snowflake. Short, and every line is deliberate. Press Next.', lines: null },
          { say: 'Credentials come from the environment, never from the code. The service user authenticates with a key pair instead of a password, and uses the LOADER role on the load warehouse.', lines: [6, 11] },
          { say: 'PUT uploads the file to the table stage. One command, compressed on the way.', lines: [14, 14] },
          { say: 'COPY INTO loads the staged file in parallel inside Snowflake. A million rows load in seconds this way.', lines: [15, 18] },
          { say: 'Always close the connection, even on failure. Never loop INSERT statements per row: that takes hours for what COPY does in seconds. write_pandas does the stage-and-copy for you from a DataFrame.', lines: [19, 20] }
        ]
      }),

      B.challenge({
        id: 'm7-c1', title: 'Coding problem 1: retry with backoff',
        q: 'Write a **decorator `retry`** that retries a function on specified exceptions, with **exponential backoff and jitter**, a maximum number of attempts, and **re-raises** the last error when it gives up.',
        lang: 'python', starter: 'def retry(max_attempts=5, base_delay=1.0, max_delay=30.0, exceptions=(Exception,)):\n    ...',
        hints: ['A decorator with arguments is three nested functions: retry, decorator, wrapper.', 'Delay doubles each time: `base_delay * 2 ** (attempt - 1)`. Cap it, then multiply by `random.uniform(0.5, 1.0)` for jitter.', 'Use `functools.wraps` so the wrapped function keeps its name.'],
        file: 'retry.py', sol: RETRY,
        expl: ['Three levels: `retry(...)` takes settings, `decorator(fn)` takes the function, `wrapper(...)` runs it.', '**Backoff** (1s, 2s, 4s...) gives the failing service time to recover. **Jitter** spreads many workers apart so they do not all retry at the same instant.', 'On the final attempt the bare `raise` re-raises the original exception, so Airflow still sees the real failure.', 'Retry only **transient** errors (timeouts, connection resets, 429, 5xx). Retrying a 400 bad request just repeats the same mistake.'],
        cx: 'Worst case waits about base x (2^attempts) seconds in total, capped by max_delay per wait.'
      }),

      B.challenge({
        id: 'm7-c2', title: 'Coding problem 2: paginated API generator',
        q: 'Write a **generator `fetch_all(session, url)`** that yields every item from a cursor-paginated API. Each response looks like `{"items": [...], "next_cursor": "abc"}`. The last page has no `next_cursor`. Use a timeout and fail on HTTP errors.',
        lang: 'python', starter: 'def fetch_all(session, url, page_size=500):\n    ...',
        hints: ['Loop until there is no next cursor.', '`yield from body["items"]` hands out items without building a giant list.'],
        file: 'paginate.py', sol: PAGES,
        expl: ['A **generator** yields one item at a time, so memory stays flat even for millions of records.', '`resp.raise_for_status()` turns 4xx and 5xx into exceptions, which your retry layer can handle.', 'Cursor pagination is stable while data changes. Offset pagination can skip or repeat rows.', 'The caller can stop early or write each page to S3 as it streams.'],
        cx: 'O(1) memory per page. Time is dominated by the network calls.'
      }),

      B.challenge({
        id: 'm7-c3', title: 'Coding problem 3: flatten nested JSON',
        q: 'Write **`flatten(obj)`** that turns a nested dictionary into a flat one with dotted keys. For `{"txn_id": "T-9001", "loan": {"id": "L-1001", "terms": {"rate": 0.05}}, "tags": ["a", "b"]}` return `{"txn_id": "T-9001", "loan.id": "L-1001", "loan.terms.rate": 0.05, "tags": ["a", "b"]}`. Leave lists as they are.',
        lang: 'python', starter: 'def flatten(obj, parent_key="", sep="."):\n    ...',
        hints: ['A dictionary inside a dictionary is the recursive case.', 'Build the new key as `parent + sep + key`, but skip the separator at the top level.'],
        file: 'flatten.py', sol: FLAT,
        res: { cols: ['input', 'output'], rows: [['{"txn_id": "T-9001", "loan": {"id": "L-1001", "terms": {"rate": 0.05}}, "tags": ["a", "b"]}', '{"txn_id": "T-9001", "loan.id": "L-1001", "loan.terms.rate": 0.05, "tags": ["a", "b"]}']], msg: 'tested' },
        expl: ['Recursion: a dict value calls `flatten` again with the longer key prefix. Anything else is a leaf.', 'Lists are left alone here. In Snowflake the equivalent is `LATERAL FLATTEN` for arrays and colon paths for objects.', 'Ask the interviewer: should lists be exploded to rows? Asking clarifying questions is part of the score.'],
        cx: 'O(n) in the number of leaf values. Recursion depth equals nesting depth.'
      }),

      B.challenge({
        id: 'm7-c4', title: 'Coding problem 4: latest record per key',
        q: 'Given a list of dictionaries, return **only the latest record per `loan_id`**, judged by `updated_at`. Do not use pandas. This is the Python twin of the SQL dedupe drill.',
        lang: 'python', starter: 'def latest_per_key(rows, key="loan_id", ts="updated_at"):\n    ...',
        hints: ['A dictionary keyed by loan_id keeps one winner per key.', 'Replace the stored row only when the new one is newer.'],
        file: 'latest.py', sol: LATEST,
        expl: ['One pass. The dict holds the best row seen so far for each key.', 'Add a tie-breaker (for example a sequence number) if two rows can share the same timestamp. Otherwise the first one wins.', 'Dates compare correctly as ISO strings (`2026-03-14 02:10`) or as datetime objects. Do not compare dates in another format.'],
        cx: 'O(n) time, O(k) memory where k is the number of distinct keys. Better than sorting, which is O(n log n).'
      }),

      B.challenge({
        id: 'm7-c5', title: 'Coding problem 5: read a huge file in batches',
        q: 'A CSV is **20 GB**. Write a **generator `read_in_batches(path, size)`** that yields lists of up to `size` rows as dictionaries, using constant memory.',
        lang: 'python', starter: 'def read_in_batches(path, size=10_000):\n    ...',
        hints: ['`csv.DictReader` reads lazily, one row at a time.', '`itertools.islice(reader, size)` takes the next `size` rows from an iterator.'],
        file: 'batches.py', sol: BATCH,
        expl: ['The file object and `DictReader` are **iterators**: nothing is loaded until asked.', '`islice` consumes the next `size` rows each time, so a batch is the only thing in memory.', 'Each batch can go to S3 or `write_pandas`. With pandas the same idea is `read_csv(..., chunksize=size)`.', 'Stop condition: an empty batch means the file is finished.'],
        cx: 'O(size) memory regardless of file size. Time is linear in the file.'
      }),

      B.challenge({
        id: 'm7-c6', title: 'Coding problem 6: validate and quarantine', opt: true,
        q: 'Write **`split_valid(rows)`** that returns `(good, bad)`. A row is bad if `txn_id` is empty, or `amount` is not a number, or `amount` is not positive. Each bad row keeps its data plus an `_errors` list saying why.',
        lang: 'python', starter: 'def split_valid(rows):\n    ...',
        hints: ['Collect errors in a list for each row, then decide where the row goes.', '`float()` raises ValueError for text and TypeError for None. Catch both.'],
        file: 'validate.py', sol: VALID,
        expl: ['Never silently drop bad records. **Quarantine** them with the reason so someone can fix the source.', 'Collecting **all** the errors for a row, not just the first, saves a round trip to the data owner.', 'In production, write the bad rows to a quarantine folder or table, count them, and fail the run if the error rate crosses a threshold.']
      }),

      B.bug({
        id: 'm7-bug', say: 'Success every night, data missing on Tuesday. Nobody noticed. That is the bug.', q: 'This loader reports success every night. Last Tuesday it lost a whole day of data and nobody noticed. Which lines are the bug?',
        file: 'ingest/load_day.py', lang: 'python', code: BUGPY, bad: [6, 7],
        why: '`except Exception: pass` **swallows every failure**, and then `mark_done` runs anyway. The day is recorded as loaded though no file was copied. Let the exception propagate, or log it and re-raise, and call `mark_done` only after the loop succeeded.',
        fix: 'def load_day(run_date):\n    files = list_files(run_date)\n    for f in files:\n        copy_into_raw(f)\n    mark_done(run_date)   # only reached if every copy worked',
        hint: 'What happens to an exception inside the try block, and what runs afterwards?'
      }),

      B.quiz({
        id: 'm7-q1', q: 'Why does `read_in_batches` use a generator instead of returning a list of all rows?',
        opts: [
          { t: 'Generators run faster than lists', fb: 'Speed is similar. The benefit is memory.' },
          { t: 'A generator holds one batch in memory at a time, so a 20 GB file never has to fit in RAM', fb: '' },
          { t: 'Lists cannot hold dictionaries', fb: 'Lists can hold anything.' },
          { t: 'Generators are required by the csv module', fb: 'The csv module works with lists or generators.' }
        ],
        ok: 1, why: 'A generator produces values **on demand**. Memory use is the size of one batch, not the size of the file. That is the standard answer to "how do you process a file bigger than memory?"'
      }),

      B.qa({
        id: 'qa-python', tag: 'Python', secs: 60,
        q: 'How do you use Python in your data pipelines?',
        pts: ['Ingestion: databases, REST APIs, files, with retries, timeouts, pagination', 'Glue: Airflow tasks, dbtRunner, run_results.json to Datadog, Great Expectations', 'Scale: PySpark and Pandas on EMR and Databricks', 'Production habits: type hints, config and secrets from env, logging, pytest', 'Snowflake loading via stage and COPY, never row by row'],
        short: 'I use Python in three roles. First, ingestion: extractors for databases, REST APIs and files with retries, timeouts, pagination and deterministic file paths so reruns are safe. They write to S3 and I load with Snowpipe or COPY. Second, glue around the platform: Airflow tasks, calling dbt with dbtRunner, reading run_results.json to push metrics to Datadog, and running Great Expectations checks. Third, processing at scale: PySpark and Pandas jobs on EMR and Databricks to normalize semi-structured data.\n\nI write it as production code: small functions, type hints, config and secrets from the environment or a secrets manager, structured logging, and pytest tests with mocked HTTP. And I never load row by row into Snowflake. Files go through a stage and COPY.',
        fu: [
          ['How do you test an extractor?', 'pytest with the HTTP layer mocked, a fake S3 such as moto, and fixture pages including the last page and an error page. Plus an integration test against a small test schema in Snowflake.'],
          ['How do you handle secrets?', 'Never in code or Git. Environment variables or Airflow connections populated from a secrets manager. The Snowflake service user authenticates with a key pair.'],
          ['Pandas or PySpark?', 'Pandas for data that fits in memory on one worker, up to a few GB. PySpark on EMR or Databricks when it is larger or needs parallelism. If the data is already in Snowflake, push the work into SQL or Snowpark so it never leaves.']
        ],
        trap: 'Saying "I write scripts". Show **production habits**: retries, idempotency, tests, secrets, logging.'
      }),

      B.qa({
        id: 'qa-api-ingest', tag: 'Python', secs: 60,
        q: 'How would you ingest a REST API incrementally and reliably into Snowflake?',
        pts: ['Cursor pagination, timeouts, retry with backoff and jitter', 'Watermark advanced only after files are written', 'Deterministic S3 path from the run date', 'Validate pages, quarantine bad records, threshold to fail', 'Reconcile counts, load with Snowpipe or COPY'],
        short: 'I page with a cursor, never offsets, because offsets skip or repeat rows when data changes. Each call has a timeout and retries on 429 and 5xx with exponential backoff and jitter, honouring Retry-After. For incremental loads I request only data changed since the last successful watermark, and I advance the watermark only after the files are safely written.\n\nFiles land in S3 under a path built from the run date, so a rerun overwrites instead of duplicating. I validate each page against the expected schema, quarantine bad records with the reason, and fail the run if the error rate crosses a threshold. I log counts per page, and Airflow checks the total against the count the API reports before dbt starts.',
        fu: [
          ['What if the API has no change filter?', 'Pull the full set on a schedule and detect changes downstream by comparing row hashes in staging. If the API accepts date ranges, pull by partition to keep each call small.'],
          ['How do you handle rate limits with parallel tasks?', 'An Airflow pool caps concurrent tasks against that API, plus client-side throttling and honouring Retry-After.']
        ],
        trap: 'Advancing the watermark before the data is safely stored. A crash in between loses data permanently.'
      }),

      B.recap({
        id: 'm7-recap', n: 7, badge: 'Python Plumber', color: '#FDE68A',
        pts: [
          '**Retry** transient errors with exponential backoff **and jitter**. Re-raise the last one.',
          '**Generators** keep memory flat: pagination, batches, huge files.',
          'Latest per key: one pass with a dict, O(n).',
          'Load with **PUT and COPY**, never row-by-row INSERT.',
          'Never `except: pass`. Quarantine bad records with the reason.'
        ],
        lines: [
          'I advance the watermark only after the data is safely written.',
          'File paths come from the run date, so reruns overwrite instead of duplicate.',
          'Secrets come from the environment or a secrets manager, never from code.'
        ]
      })
    ]
  });
})();
