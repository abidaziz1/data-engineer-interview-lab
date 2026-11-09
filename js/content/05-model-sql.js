/* Mission 6: data modeling (Kimball, Inmon, Data Vault, SCD2) and the SQL interview drills. SQL results verified in DuckDB. */
(function () {
  var B = LAB.b;

  var ASOF = [
    '-- Which segment was each customer in on the day the loan was originated?',
    'SELECT l.loan_id, l.orig_date, d.customer_key, d.segment',
    'FROM loans l',
    'JOIN dim_customer d',
    '  ON  d.customer_id = l.customer_id',
    '  AND l.orig_date >= d.valid_from',
    "  AND l.orig_date <  COALESCE(d.valid_to, '9999-12-31')",
    'ORDER BY l.loan_id;'
  ].join('\n');

  var S_DEDUPE = [
    'SELECT loan_id, status, principal_usd, updated_at',
    'FROM raw_loans_cdc',
    'QUALIFY ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY updated_at DESC) = 1',
    'ORDER BY loan_id;'
  ].join('\n');
  var S_RANK = [
    'SELECT segment, loan_id, outstanding_usd',
    'FROM loans_seg',
    'QUALIFY DENSE_RANK() OVER (PARTITION BY segment ORDER BY outstanding_usd DESC) = 2',
    'ORDER BY segment, loan_id;'
  ].join('\n');
  var S_RUN = [
    'SELECT pay_date, amount,',
    '       SUM(amount) OVER (ORDER BY pay_date',
    '                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,',
    '       ROUND(AVG(amount) OVER (ORDER BY pay_date',
    '                               ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 2) AS moving_avg_3d',
    'FROM daily_payments',
    'ORDER BY pay_date;'
  ].join('\n');
  var S_ISLAND = [
    'WITH numbered AS (',
    '  SELECT loan_id, miss_date,',
    "         DATEADD('day', -ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY miss_date), miss_date) AS island_key",
    '  FROM missed',
    ')',
    'SELECT loan_id,',
    '       MIN(miss_date) AS streak_start,',
    '       MAX(miss_date) AS streak_end,',
    '       COUNT(*)       AS days',
    'FROM numbered',
    'GROUP BY loan_id, island_key',
    'ORDER BY loan_id, streak_start;'
  ].join('\n');
  var S_FLAT = [
    'SELECT p.payload:txn_id::STRING   AS txn_id,',
    '       p.payload:loan_id::STRING  AS loan_id,',
    '       f.value:type::STRING       AS component,',
    '       f.value:amt::NUMBER(18,2)  AS amount',
    'FROM raw.payments_txns p,',
    '     LATERAL FLATTEN(INPUT => p.payload:items) f;'
  ].join('\n');
  var S_MERGE = [
    'MERGE INTO marts.dim_loan t',
    'USING (',
    '  SELECT * FROM staging.stg_core__loans',
    '  QUALIFY ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY updated_at DESC) = 1',
    ') s',
    '  ON t.loan_id = s.loan_id',
    'WHEN MATCHED AND s.updated_at > t.updated_at THEN UPDATE SET',
    '  t.loan_status = s.loan_status,',
    '  t.principal_usd = s.principal_usd,',
    '  t.updated_at = s.updated_at',
    'WHEN NOT MATCHED THEN INSERT (loan_id, loan_status, principal_usd, updated_at)',
    '  VALUES (s.loan_id, s.loan_status, s.principal_usd, s.updated_at);'
  ].join('\n');
  var S_MOM = [
    'SELECT month, exposure_usd,',
    '       LAG(exposure_usd) OVER (ORDER BY month) AS prev_usd,',
    '       ROUND(100.0 * (exposure_usd - LAG(exposure_usd) OVER (ORDER BY month))',
    '             / LAG(exposure_usd) OVER (ORDER BY month), 1) AS pct_change',
    'FROM monthly',
    'ORDER BY month;'
  ].join('\n');
  var S_NOTIN = [
    'SELECT customer_id',
    'FROM customers',
    'WHERE customer_id NOT IN (SELECT customer_id FROM loans);'
  ].join('\n');

  LAB.addChapter({
    id: 'm6', n: 6, title: 'Data modeling and SQL', short: 'Modeling + SQL', blurb: 'Star schema, Data Vault, SCD2, window functions', minutes: 40,
    focus: ['mart'],
    goals: [
      'Declare a **grain** and design a fact table with its dimensions.',
      'Compare **Kimball, Inmon and Data Vault** and say when you would use each.',
      'Query an **SCD Type 2** dimension as of a date without double counting.',
      'Solve the **classic SQL interview problems** with window functions.'
    ],
    say: 'Mission 6 has two halves. First the modeling theory interviewers ask about. Then eight SQL problems you can solve here, with data and results. All the SQL ran in a real engine.',
    scenes: [
      B.flow({
        id: 'm6-star', title: 'The star schema for this project', g: 'star', legend: false,
        steps: [
          { say: 'This is the star schema behind the marts. One fact table in the middle and four dimensions around it. Press Next.', cap: 'Star means **one fact at the centre, dimensions around it.** Every report joins the fact to the dimensions it needs.' },
          { say: 'The fact table. Say the grain out loud: one row per loan per day. Every row is one loan on one date. The measures are outstanding balance and expected loss.', focus: ['fct'], cap: '**Always state the grain first.** Wrong grain is the number one cause of wrong totals.' },
          { say: 'Four dimensions: who, what, when and how risky. The fact stores only their surrogate keys. All descriptive text lives in the dimensions.', focus: ['fct', 'd_cust', 'd_loan', 'd_date', 'd_rate'], on: ['k1', 'k2', 'k3', 'k4'], cap: 'Dimensions are **small and wide**. The fact is **tall and narrow**.' },
          { say: 'dim_customer is Type 2. It keeps history. The fact holds the customer_key of the version that was valid on that date, so an old report never changes when a customer later moves segment.', focus: ['fct', 'd_cust'], on: ['k1'], cap: 'This is why **surrogate keys** matter: the business key repeats across versions, the surrogate key does not.' }
        ]
      }),

      B.talk({
        id: 'm6-kim', title: 'Designing a fact table: the Kimball steps',
        say: 'Kimball gives you four steps. Press Next and say each one out loud, using this project as the example.',
        items: [
          ['1. Pick the business process', 'Daily loan exposure reporting.', 'One: what business process are we measuring?'],
          ['2. Declare the grain', '**One row per loan per day.** Write this sentence before any column exists.', 'Two: the grain. One row means what, exactly?'],
          ['3. Choose the dimensions', 'Customer, loan, date, rating. The who, what, when and how.', 'Three: which dimensions describe each row?'],
          ['4. Choose the facts', 'Numeric measures at that grain: `outstanding_usd` and `expected_loss_usd`. Check each one for additivity.', 'Four: the measures. And check how they add up.'],
          ['Additive or not?', 'Expected loss adds across loans **and** days. Outstanding balance adds across loans but **not across days**: a balance is a snapshot, so average it over time. Say this and you stand out.', 'A balance is semi-additive. Interviewers love this detail.'],
          ['Keys', 'Surrogate keys in the fact and dimensions. Keep business keys as attributes. Facts join on surrogate keys, so a dimension change does not break history.', 'Surrogate keys protect history.']
        ],
        cols: 2
      }),

      B.cmp({
        id: 'm6-cmp', title: 'Kimball, Inmon and Data Vault',
        say: 'The JD names all three. You need one clear sentence for each, and a rule for choosing. Press Next to reveal each row.',
        cols: ['', 'Kimball (dimensional)', 'Inmon (enterprise warehouse)', 'Data Vault 2.0'],
        hl: 1,
        rows: [
          ['Approach', 'Bottom-up. Build marts per business process with conformed dimensions', 'Top-down. Build a normalized (3NF) enterprise warehouse first, then marts from it', 'Insert-only integration layer of hubs, links and satellites, with star marts on top'],
          ['Strength', 'Fast to deliver. Easy for BI users', 'One integrated version of the truth', 'Audit trail. Absorbs source change. Parallel loading'],
          ['Weakness', 'Cross-mart integration needs discipline. Grain changes are costly', 'Slow to deliver. Heavy up-front modeling', 'Many tables and joins. Needs a presentation layer. Steeper learning'],
          ['Pick it when', 'One team, clear questions, BI focus', 'Enterprise-wide integration and strong governance', 'Dozens of changing sources and strict audit or history needs']
        ],
        steps: [
          { upto: 1, say: 'First, the approach. Kimball starts from the report. Inmon starts from the enterprise. Data Vault starts from the sources.' },
          { upto: 2, say: 'Strengths. Kimball wins on speed and usability. Inmon on one integrated truth. Data Vault on auditability and change.' },
          { upto: 3, say: 'Weaknesses. Say these honestly. Data Vault needs a star layer on top, or nobody can query it comfortably.' },
          { upto: 4, say: 'The rule of choice. Sources, change rate, audit need and team size.' }
        ],
        pick: '**Kimball marts over clean staging** for this project: one team, clear reporting needs, fast delivery. Add a **Data Vault** layer only with dozens of volatile sources and audit requirements that justify the extra tables. Keep Inmon for a bank-wide enterprise warehouse program.'
      }),

      B.flow({
        id: 'm6-vault', title: 'Data Vault in one picture', g: 'vault', legend: false, opt: true,
        steps: [
          { say: 'Data Vault splits everything into three kinds of tables. Press Next to see each.', cap: 'Every row carries a **load date** and a **record source**, so you can always say where data came from and when.' },
          { say: 'Hubs hold business keys only. One hub for customers and one for loans, each with a hash key.', focus: ['hub_c', 'hub_l'], cap: 'A hub is **just the list of business keys** and where they were first seen.' },
          { say: 'Links hold relationships. This link says which customer holds which loan. Links are many-to-many by design, so a relationship change never needs a schema change.', focus: ['link', 'hub_c', 'hub_l'], cap: 'Relationships live in **links**, not in foreign keys.' },
          { say: 'Satellites hold the descriptive attributes and their history. They are insert-only: a new row for every change, with a hash difference to detect it.', focus: ['sat_c', 'sat_l', 'sat_p', 'hub_c', 'hub_l'], cap: 'Insert-only means **auditable** and **parallel-loadable**. The price is more tables and joins, so marts are still built on top.' }
        ]
      }),

      B.cmp({
        id: 'm6-scd', title: 'Slowly changing dimensions', opt: true,
        say: 'Four types you should be able to name. Press Next for each.',
        cols: ['Type', 'On a change', 'History kept?', 'Use when'],
        rows: [
          ['Type 0', 'Never changes', 'Not applicable', 'Birth date, original loan terms'],
          ['Type 1', 'Overwrite the value', 'No', 'Typo corrections, attributes nobody needs historically'],
          ['Type 2', 'Add a new row with valid-from and valid-to', 'Full', 'Customer segment, region, anything reports must show as of the date'],
          ['Type 3', 'Add a column holding the previous value', 'One step', 'Rare. A single previous value is enough']
        ],
        steps: [{ upto: 2, say: 'Type 0 and Type 1 are the simple ones. Type 1 overwrites and loses history.' }, { upto: 4, say: 'Type 2 is the one that matters. A new row per version. Type 3 is rare.' }],
        pick: '**Type 2** for customer segment, because risk reports must show the segment as it was. **Type 1** for typo fixes.'
      }),

      B.sql({
        id: 'm6-asof', title: 'Query an SCD2 dimension as of a date', file: 'worksheet: asof_join.sql', code: ASOF,
        ctx: { role: 'ANALYST', wh: 'WH_BI', db: 'RISK_DB.MARTS' },
        steps: [
          { say: 'This is the query behind a report that must show history correctly. The loan table has an origination date and the dimension has validity ranges. Press Next.', lines: null },
          { say: 'Join on the business key first.', lines: [4, 5] },
          { say: 'Then the validity range. Half-open: valid_from inclusive, valid_to exclusive, with NULL meaning still current. Half-open means a date matches exactly one version.', lines: [6, 7] },
          { say: 'Press Run. L-1010 was originated in September 2025, after the customer became a small business, so it gets SMALL_BUSINESS. The older loans keep RETAIL.', lines: [1, 8], run: true }
        ],
        result: { cols: ['loan_id', 'orig_date', 'customer_key', 'segment'], rows: [['L-1001', '2024-01-15', '1', 'RETAIL'], ['L-1002', '2023-03-02', '3', 'RETAIL'], ['L-1003', '2025-06-10', '1', 'RETAIL'], ['L-1010', '2025-09-01', '2', 'SMALL_BUSINESS']], msg: '4 rows', chg: [[3, 3]] },
        note: '**Without lines 6 and 7** every loan matches every version of its customer, rows multiply, and exposure is double counted. This is the classic fan-out bug.'
      }),

      B.challenge({
        id: 'm6-c1', title: 'SQL drill 1: latest row per key',
        q: 'The CDC feed sends **every change** to a loan. Return **one row per loan: the most recent version**.',
        data: [{ name: 'raw_loans_cdc', cols: ['loan_id', 'status', 'principal_usd', 'updated_at'], rows: [['L-1001', 'ACTIVE', '250000', '2026-03-12 08:00'], ['L-1001', 'ACTIVE', '245000', '2026-03-14 02:10'], ['L-1002', 'ACTIVE', '12000', '2026-03-10 09:30'], ['L-1002', 'CLOSED', '0', '2026-03-13 18:00'], ['L-1003', 'ACTIVE', '90000', '2026-03-14 02:12']] }],
        lang: 'sql', hints: ['You need to rank the versions of each loan, newest first.', 'ROW_NUMBER over a partition by loan_id. Snowflake has QUALIFY to filter on a window function, so no subquery is needed.'],
        file: 'dedupe_latest.sql', sol: S_DEDUPE,
        res: { cols: ['loan_id', 'status', 'principal_usd', 'updated_at'], rows: [['L-1001', 'ACTIVE', '245000', '2026-03-14 02:10'], ['L-1002', 'CLOSED', '0', '2026-03-13 18:00'], ['L-1003', 'ACTIVE', '90000', '2026-03-14 02:12']], msg: '3 rows' },
        expl: ['`PARTITION BY loan_id` restarts the numbering for each loan. `ORDER BY updated_at DESC` puts the newest row first.', '`QUALIFY` filters after window functions run, like HAVING does for aggregates.', 'Databases without QUALIFY need a subquery or CTE: rank in the inner query, filter `rn = 1` outside.'],
        cx: 'One sort per partition, so about O(n log n). One pass, no self-join, which is why it beats a join on MAX(updated_at). Add a tie-breaker column to the ORDER BY if two rows can share a timestamp.'
      }),

      B.challenge({
        id: 'm6-c2', title: 'SQL drill 2: second highest per group',
        q: 'Return the loans with the **second-highest outstanding balance in each segment**. Loans with the same balance **share a rank**. A segment with only one distinct balance returns nothing.',
        data: [{ name: 'loans_seg', cols: ['loan_id', 'segment', 'outstanding_usd'], rows: [['L-1001', 'SMB', '210000'], ['L-1003', 'SMB', '85000'], ['L-1004', 'SMB', '85000'], ['L-1005', 'SMB', '40000'], ['L-2001', 'RETAIL', '30000'], ['L-2002', 'RETAIL', '18000'], ['L-2003', 'RETAIL', '18000'], ['L-3001', 'CORP', '900000']] }],
        lang: 'sql', hints: ['RANK, DENSE_RANK and ROW_NUMBER behave differently when values tie.', 'Ties should share a rank and the next value should be rank 2, not 3. Which function does that?'],
        file: 'second_highest.sql', sol: S_RANK,
        res: { cols: ['segment', 'loan_id', 'outstanding_usd'], rows: [['RETAIL', 'L-2002', '18000'], ['RETAIL', 'L-2003', '18000'], ['SMB', 'L-1003', '85000'], ['SMB', 'L-1004', '85000']], msg: '4 rows' },
        expl: ['**DENSE_RANK** gives tied rows the same rank and does not skip numbers: 1, 2, 2, 3.', '**RANK** would give 1, 2, 2, 4. **ROW_NUMBER** gives every row a unique number and breaks ties arbitrarily, so one of two tied loans would be dropped.', 'CORP has one loan, so it has no rank 2 and returns nothing.'],
        cx: 'Same cost as any window function. Say the difference between the three ranking functions. That is what the question tests.'
      }),

      B.challenge({
        id: 'm6-c3', title: 'SQL drill 3: running total and moving average',
        q: 'For daily payments, return each day with a **running total** and a **3-day moving average** (the day and the two before it), rounded to 2 decimals.',
        data: [{ name: 'daily_payments', cols: ['pay_date', 'amount'], rows: [['2026-03-10', '1000'], ['2026-03-11', '2500'], ['2026-03-12', '1500'], ['2026-03-13', '3000'], ['2026-03-14', '500'], ['2026-03-15', '2000']] }],
        lang: 'sql', hints: ['Aggregate functions become window functions with OVER.', 'A frame clause limits which rows the window sees: ROWS BETWEEN 2 PRECEDING AND CURRENT ROW.'],
        file: 'running_total.sql', sol: S_RUN,
        res: { cols: ['pay_date', 'amount', 'running_total', 'moving_avg_3d'], rows: [['2026-03-10', '1000', '1000', '1000.00'], ['2026-03-11', '2500', '3500', '1750.00'], ['2026-03-12', '1500', '5000', '1666.67'], ['2026-03-13', '3000', '8000', '2333.33'], ['2026-03-14', '500', '8500', '1666.67'], ['2026-03-15', '2000', '10500', '1833.33']], msg: '6 rows' },
        expl: ['`SUM(...) OVER (ORDER BY pay_date)` is a running total because the default frame grows from the first row to the current one.', 'The explicit `ROWS BETWEEN` frame limits the window to three rows. The first two days average fewer rows.', 'Use **ROWS** rather than **RANGE** when dates can repeat, otherwise rows with the same date are treated as peers and added together.']
      }),

      B.challenge({
        id: 'm6-c4', title: 'SQL drill 4: gaps and islands',
        q: 'Each row is a day a loan payment was **missed**. Return each **streak of consecutive missed days** per loan: start date, end date and length.',
        data: [{ name: 'missed', cols: ['loan_id', 'miss_date'], rows: [['L-1001', '2026-03-01'], ['L-1001', '2026-03-02'], ['L-1001', '2026-03-03'], ['L-1001', '2026-03-07'], ['L-1001', '2026-03-08'], ['L-1003', '2026-03-05'], ['L-1003', '2026-03-06']] }],
        lang: 'sql', hints: ['Number the rows with ROW_NUMBER in date order.', 'For consecutive dates, date minus row number is constant. Group by that value.'],
        file: 'streaks.sql', sol: S_ISLAND,
        res: { cols: ['loan_id', 'streak_start', 'streak_end', 'days'], rows: [['L-1001', '2026-03-01', '2026-03-03', '3'], ['L-1001', '2026-03-07', '2026-03-08', '2'], ['L-1003', '2026-03-05', '2026-03-06', '2']], msg: '3 rows' },
        expl: ['For consecutive days, the date goes up by 1 and the row number goes up by 1, so **date minus row number stays the same**. When a day is missing, the value jumps and a new island starts.', 'GROUP BY the island key to get each streak. MIN and MAX give start and end, COUNT gives the length.', 'This is the standard "gaps and islands" pattern. Interviewers use it to test window-function fluency.']
      }),

      B.challenge({
        id: 'm6-c5', title: 'SQL drill 5: unpack JSON with FLATTEN',
        q: 'The payments feed lands in RAW as a **VARIANT** column. Each transaction has an `items` array. Return **one row per item** with the transaction id, loan id, item type and amount.',
        data: [{ name: 'raw.payments_txns (payload VARIANT)', cols: ['payload'], rows: [['{"txn_id":"T-9001","loan_id":"L-1001","items":[{"type":"principal","amt":1000.00},{"type":"interest","amt":250.50}]}'], ['{"txn_id":"T-9002","loan_id":"L-1003","items":[{"type":"principal","amt":500.00}]}']] }],
        lang: 'sql', hints: ['Colon paths read fields from a VARIANT: `payload:txn_id`. Cast with `::STRING`.', 'LATERAL FLATTEN turns an array into one row per element. The element is available as `value`.'],
        file: 'flatten_items.sql', sol: S_FLAT,
        res: { cols: ['txn_id', 'loan_id', 'component', 'amount'], rows: [['T-9001', 'L-1001', 'principal', '1000.00'], ['T-9001', 'L-1001', 'interest', '250.50'], ['T-9002', 'L-1003', 'principal', '500.00']], msg: '3 rows' },
        expl: ['`payload:txn_id::STRING` reads the field and casts it. Without a cast the value stays a VARIANT.', '`LATERAL FLATTEN(INPUT => ...)` joins each row to its array elements. Add `OUTER => TRUE` to keep transactions whose array is empty.', 'This is exactly what a dbt staging model for the JSON feed does.']
      }),

      B.challenge({
        id: 'm6-c6', title: 'SQL drill 6: month over month change', opt: true,
        q: 'Return each month\'s total exposure, the **previous month\'s** exposure, and the **percent change**, rounded to 1 decimal. The first month has no previous value.',
        data: [{ name: 'monthly', cols: ['month', 'exposure_usd'], rows: [['2025-12-01', '1000000'], ['2026-01-01', '1100000'], ['2026-02-01', '990000'], ['2026-03-01', '1200000']] }],
        lang: 'sql', hints: ['LAG looks at the previous row in the window order.', 'Percent change = (current - previous) / previous x 100.'],
        file: 'mom_change.sql', sol: S_MOM,
        res: { cols: ['month', 'exposure_usd', 'prev_usd', 'pct_change'], rows: [['2025-12-01', '1000000', 'NULL', 'NULL'], ['2026-01-01', '1100000', '1000000', '10.0'], ['2026-02-01', '990000', '1100000', '-10.0'], ['2026-03-01', '1200000', '990000', '21.2']], msg: '4 rows' },
        expl: ['`LAG(col)` returns the previous row\'s value. The first row gets NULL, and the percent change is NULL as well.', 'Note March: it is +21.2% against February\'s dip, not against January. Mention that comparison base when you present numbers.']
      }),

      B.challenge({
        id: 'm6-c7', title: 'SQL drill 7: upsert with MERGE', opt: true,
        q: 'Write a **MERGE** that loads the latest version of each loan from `staging.stg_core__loans` into `marts.dim_loan`. Update only when the incoming row is **newer**. Insert new loans. The source can contain several versions per loan.',
        lang: 'sql', hints: ['Deduplicate the source first, or the merge can match one target row several times.', '`WHEN MATCHED AND <condition>` lets you update only some matches.'],
        file: 'merge_dim_loan.sql', sol: S_MERGE,
        expl: ['The subquery with QUALIFY keeps **one row per loan**. Without it Snowflake raises a nondeterministic merge error, or applies an arbitrary row.', '`WHEN MATCHED AND s.updated_at > t.updated_at` stops an old batch from overwriting newer data. This protects you when a file is replayed.', 'This is the same statement dbt generates for an incremental model with the merge strategy.']
      }),

      B.quiz({
        id: 'm6-q1', say: 'A classic. It looks correct, runs without errors, and returns nothing. Pick an answer.', q: 'You run this query to find customers with no loans. `loans.customer_id` contains one NULL. What does it return?',
        code: S_NOTIN, lang: 'sql', file: 'not_in.sql',
        opts: [
          { t: 'The customers who have no loans', fb: 'That is what you expect, but NULL breaks it.' },
          { t: 'No rows at all', fb: '' },
          { t: 'An error', fb: 'No error is raised. That is what makes it dangerous.' },
          { t: 'Every customer', fb: 'It returns nothing, not everything.' }
        ],
        ok: 1, why: '`x NOT IN (list containing NULL)` is never true, because comparing with NULL gives unknown. The query silently returns **zero rows**. Use **NOT EXISTS** or a **LEFT JOIN ... WHERE right.key IS NULL** instead. In this data both return customer C-88.'
      }),

      B.qa({
        id: 'qa-model', tag: 'Modeling', secs: 75,
        q: 'Kimball, Inmon or Data Vault: which do you use and when? Which have you actually built?',
        pts: ['Kimball: marts, conformed dimensions, speed of delivery', 'Inmon: normalized enterprise warehouse first, top-down', 'Data Vault: hubs, links, satellites, insert-only, audit', 'Rule of choice: number of sources, change rate, audit need, team size', 'A star layer is still needed on top of a vault', 'Honest about what you built'],
        short: 'I use them for different jobs. Kimball dimensional modeling is how I design the presentation layer: business-process fact tables with conformed dimensions, easy for BI and quick to deliver. That is what I built at Bank of America on Snowflake. Inmon builds a normalized enterprise warehouse first and then marts from it: one integrated truth, but slower up front. Data Vault is an insert-only integration layer of hubs, links and satellites that copes well with many changing sources and strict audit, but you still need a star layer on top to consume it.\n\nFor most analytics projects I choose Kimball marts over clean staging. I would add a Data Vault layer with dozens of volatile sources where audit and history requirements justify the extra tables.',
        fu: [
          ['How would you implement Data Vault with dbt?', 'With the automate_dv package: macros generate hubs, links and satellites with hash keys and load dates. Raw vault models are incremental and insert-only. A business vault and star marts are built on top.'],
          ['Why not use Kimball everywhere?', 'Kimball works well until sources change often and auditors want the exact record as received at a point in time. A raw vault makes both easy, at the cost of more tables and joins.'],
          ['Have you used Data Vault in production?', 'Answer with the real depth. Example: "It is on my skills list. I know the structure, I know when I would choose it, and day to day I have built Kimball star schemas." Never claim more than you did.']
        ],
        trap: 'Presenting one method as always right. Say what each is **for** and how you **choose**.',
        real: 'Your resume lists Kimball, Inmon and Data Vault. Prepare one real sentence about where you used each, even if small.'
      }),

      B.qa({
        id: 'qa-fact', tag: 'Modeling', secs: 75,
        q: 'Walk me through how you would design a fact table for loan exposure. How do you choose the grain and keys?',
        pts: ['Business process, then the grain as one sentence', 'Dimensions at that grain', 'Measures and additivity (balance is semi-additive)', 'Surrogate keys. SCD2 key valid on the date', 'Incremental in dbt with unique and relationship tests, reconciled totals'],
        short: 'I start with the business process and write the grain as a sentence: one row per loan per day. Everything follows from that. Then the dimensions at that grain: customer, loan, date and rating. Then the measures, outstanding balance and expected loss, and I check whether each is additive. Balance adds across loans but not across days, so I flag that for BI.\n\nKeys: surrogate keys in the fact pointing at the dimension surrogate keys. For the Type 2 customer dimension the fact stores the key of the version valid on that date. In dbt the fact is incremental, merged on a surrogate key built from loan and date, with unique, not_null and relationship tests, and totals reconciled against the source.',
        fu: [
          ['What goes wrong if the grain is unclear?', 'Fan-out joins and double counting. Totals are wrong and nobody can say why. Most wrong dashboard numbers are grain mismatches.'],
          ['Where do attributes like loan status go?', 'Descriptive attributes belong in the dimension. A status that changes daily and is analyzed heavily can also be a column in a daily snapshot fact, or a junk dimension.'],
          ['What is a degenerate dimension?', 'An identifier that lives in the fact with no dimension table of its own, such as a transaction id.']
        ],
        trap: 'Listing columns before stating the grain. The grain comes first, always.'
      }),

      B.qa({
        id: 'qa-scd', tag: 'Modeling', secs: 60,
        q: 'How do you implement slowly changing dimensions in dbt?',
        pts: ['Type 2 with dbt snapshots (timestamp or check strategy)', 'Dimension model reads from the snapshot', 'Facts join on key and a half-open date range', 'Limits: snapshot only sees changes when it runs. Snapshot raw source', 'Type 1 by overwrite in a table model'],
        short: 'For Type 2 I use dbt snapshots. A snapshot on the source table with a unique key and a timestamp or check strategy adds valid-from and valid-to columns and keeps history. The dimension model reads from the snapshot, and fact models join to it on the business key and the date range, half-open, so a date matches exactly one version. Type 1 attributes I simply overwrite in a table model.\n\nI plan for the limits. A snapshot only sees changes that exist when it runs, so I run it at least as often as the source changes, and I snapshot the raw source with minimal logic so later cleaning changes cannot rewrite history.',
        fu: [
          ['Timestamp or check strategy?', 'Timestamp when the source has a reliable updated_at: cheap and exact. Check when there is none: dbt compares chosen columns, which is heavier.'],
          ['How do you query as of a date?', 'Join on the key with valid_from <= date and date < COALESCE(valid_to, far future). Without the range every version matches and rows multiply.']
        ]
      }),

      B.qa({
        id: 'qa-star', tag: 'Modeling', secs: 45, opt: true,
        q: 'What is the difference between a star schema and a snowflake schema?',
        pts: ['Star: denormalized dimensions, one join per dimension', 'Snowflake schema: normalized dimensions split into sub-tables', 'Trade-off: storage vs joins and simplicity', 'Snowflake the product is a different thing'],
        short: 'In a star schema each dimension is one denormalized table joined straight to the fact, so queries are simple and fast. In a snowflake schema dimensions are normalized into sub-tables, for example product, then category, then department. That saves a little storage and avoids repeated text, but adds joins and complexity. On a columnar warehouse like Snowflake, storage is cheap and compression is strong, so I default to a star schema. And I mention that Snowflake the product has nothing to do with the snowflake schema, which usually gets a smile.'
      }),

      B.recap({
        id: 'm6-recap', n: 6, badge: 'Data Modeler', color: '#FED7AA',
        pts: [
          '**Grain first.** One row per loan per day. Wrong grain, wrong totals.',
          'Kimball for marts, Inmon for enterprise integration, Data Vault for audit and many changing sources.',
          'SCD Type 2: new row per version. Join as-of with a **half-open** date range.',
          'Window functions: ROW_NUMBER / DENSE_RANK / LAG / frames. QUALIFY filters them in Snowflake.',
          '`NOT IN` with a NULL returns nothing. Use NOT EXISTS.'
        ],
        lines: [
          'I declare the grain before I name a single column.',
          'Kimball marts on top of clean staging. Data Vault only when sources and audit justify it.',
          'For history I use Type 2 and join as of the date with a half-open range.'
        ]
      })
    ]
  });
})();
