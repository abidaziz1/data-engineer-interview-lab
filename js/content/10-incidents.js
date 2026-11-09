/* Mission 11: incident drills. Scenarios are teaching drills, not claims about your past. */
(function () {
  var B = LAB.b;

  LAB.addChapter({
    id: 'm11', n: 11, title: 'Incident drills', short: 'Incidents', blurb: 'Seven on-call scenarios with the first move', minutes: 30,
    focus: ['src', 'ing', 'raw', 'stg', 'int', 'mart', 'con', 'air', 'qual', 'ci', 'mon'],
    goals: [
      'Pick the **right first move** in seven production incidents.',
      'Run a **triage checklist** from cheap checks to costly ones.',
      'Tell an incident as **situation, action, result, prevention**.',
      'Always finish with the **prevention**, which is what seniors add.'
    ],
    say: 'Pagers are loud. Runbooks are quiet. Mission 11 is a set of drills. Each is a short alert, then you choose the first move, see the triage order, and learn how to tell it in 30 seconds. Treat them as shapes. Swap in a real incident of yours whenever you have one.',
    scenes: [
      B.incident({
        id: 'm11-i1', time: '06:42',
        alert: 'Slack: **"The risk dashboard still shows yesterday\'s numbers. The 07:00 report goes out in 18 minutes."**',
        clues: ['Airflow shows the DAG is still running.', 'Task `wait_pipe` has been in "up for reschedule" since 05:10.'],
        opts: [
          { t: 'Rerun the whole DAG from the start', fb: 'The problem is upstream data, not code. A rerun would wait on the same missing file.' },
          { t: 'Check whether the expected files arrived in S3 and whether Snowpipe loaded them', fb: '' },
          { t: 'Increase the warehouse size', fb: 'Nothing is running slowly. The pipeline is waiting.' },
          { t: 'Ask the BI team to refresh the dashboard', fb: 'A refresh shows the same stale data.' }
        ],
        best: 1, why: 'The sensor is waiting for data. The question is **which hop** is missing: source, S3 or the pipe. A file check takes 30 seconds and answers it.',
        checks: [
          ['Read the sensor log', 'wait_pipe is rescheduling and waiting for `payments/dt=2026-03-14/*`. No error. Just no files.'],
          ['Look in S3', 'The folder is empty. `pull_payments` shows success but wrote **zero pages**.'],
          ['Check the source', 'The payments API returned an empty list with HTTP 200, because its own batch ran late. That is why nothing failed.'],
          ['Decide: wait, or tell people', 'Get an ETA from the API owner. If it is later than the report deadline, tell consumers the report is late rather than publish stale numbers.'],
          ['Let it recover', 'When files arrive, Snowpipe loads them, the sensor passes, and the DAG continues by itself. Confirm row counts before the marts publish.'],
          ['Communicate', 'A short update: what is wrong, impact, ETA, time of the next update.']
        ],
        tell: 'At 06:42 the risk dashboard was stale 18 minutes before the report. I saw the sensor was waiting, checked S3, and found an empty folder. I traced it to the upstream API batch running late: our extract had succeeded with zero rows. I told stakeholders the report would be late instead of publishing stale numbers, and when the files arrived the pipeline resumed on its own.\n\nAfterwards I made the extract fail on an unexpected zero-row result and added an alert when a sensor has waited more than 30 minutes.',
        prevent: ['Fail the extract on an unexpected **zero-row** result', 'Alert when a sensor waits more than **30 minutes**, well before the SLA', 'Add freshness tests and a visible freshness dashboard', 'Agree an SLA and a contact path with the API owner']
      }),

      B.incident({
        id: 'm11-i2', time: '05:11',
        alert: 'Alert: **dbt_stg FAILED.** `unique_stg_core__loans_loan_id`: 3 failures. Downstream tasks are upstream_failed.',
        clues: ['Yesterday\'s run was green.', 'The core banking team deployed a release last night.'],
        opts: [
          { t: 'Disable the unique test so the pipeline can finish', fb: 'That ships duplicate loans and double counts exposure. The test is the gate working.' },
          { t: 'Look at the 3 duplicated keys in RAW and staging to see where the duplicates come from', fb: '' },
          { t: 'Run dbt with --full-refresh', fb: 'It rebuilds the same duplicates from the same data.' },
          { t: 'Delete the duplicate rows by hand in the mart', fb: 'The mart rebuilds from staging next run. The cause remains.' }
        ],
        best: 1, why: 'Three duplicate keys is a **data issue, not a pipeline break**. Look at the rows. They tell you whether the source resent data, your dedupe is wrong, or a join fanned out.',
        checks: [
          ['Read the failure line', '3 rows, key `loan_id`. Small, so a data problem, not a broken pipeline.'],
          ['Run the compiled test SQL', 'It lists L-1001, L-1044 and L-1090, each twice.'],
          ['Check RAW', 'Both versions arrived in the same file. The source resent changed rows after last night\'s release.'],
          ['Check the staging logic', 'The dedupe orders by `updated_at` only, and the two rows have identical timestamps, so which one wins is arbitrary.'],
          ['Fix', 'Add a deterministic tie-breaker such as the ingest sequence, rebuild staging, rerun from `dbt_stg`.'],
          ['Confirm and inform', 'The unique test passes, totals match the source, and the source team hears about the resend.']
        ],
        tell: 'At 05:11 a unique test on loan keys failed with three duplicates and stopped everything downstream, so no bad data reached the marts. I ran the failing test SQL, found three loans each appearing twice, and traced it to a source release that resent changed rows with identical timestamps. My dedupe had no tie-breaker.\n\nI added a deterministic tie-breaker, rebuilt staging, reran from that task, and confirmed totals against the source.',
        prevent: ['Make dedupe ordering **deterministic** with a tie-breaker', 'Add a unique test **close to the cause**, at the RAW to staging boundary', 'Agree resend behaviour with the source team', 'Use `store_failures` so failing rows are kept for investigation']
      }),

      B.incident({
        id: 'm11-i3', time: '09:15',
        alert: 'Finance: **"Snowflake credits yesterday were three times normal."**',
        clues: ['Nothing changed in the pipelines.', 'WH_BI shows activity for 24 hours.'],
        opts: [
          { t: 'Suspend every warehouse now', fb: 'That breaks everyone\'s work. Find the cause first, then act narrowly.' },
          { t: 'Query ACCOUNT_USAGE metering and query history to find the warehouse, user and query behind it', fb: '' },
          { t: 'Reduce all warehouses to X-Small', fb: 'That slows legitimate work and may not touch the cause.' },
          { t: 'Wait and see tomorrow', fb: 'If it repeats, you pay three times again.' }
        ],
        best: 1, why: 'Cost incidents are **data problems**: the metering and query history views tell you exactly who, what and when. Diagnose, then act narrowly.',
        checks: [
          ['Find the warehouse', '`WAREHOUSE_METERING_HISTORY` by hour shows WH_BI running all night.'],
          ['Find the queries', '`QUERY_HISTORY` shows one dashboard query every 2 minutes from 02:00, each scanning about 2 TB.'],
          ['Find the owner', 'The query tag identifies the BI team. A new schedule was created with a 2-minute refresh instead of daily.'],
          ['Stop the bleeding', 'Disable that schedule. Set AUTO_SUSPEND to 60 seconds. Add a resource monitor to WH_BI with a suspend threshold.'],
          ['Fix properly', 'Pre-aggregate the dashboard source into a mart so each refresh reads megabytes, not terabytes. Agree a sensible refresh frequency.'],
          ['Report', 'Quantify the credits lost and list the new guardrails.']
        ],
        tell: 'Finance flagged triple credit use. I checked the warehouse metering view and saw WH_BI running all night, then query history showed one dashboard scanning about 2 TB every two minutes. A new schedule had been created with the wrong refresh interval. I disabled it, set a resource monitor with a suspend threshold, and then built a pre-aggregated mart so the dashboard reads megabytes.\n\nI reported the credits lost and the guardrails now in place.',
        prevent: ['Resource monitors: notify at 75 percent, suspend at 100 percent', 'Query tags on BI tools so spend maps to teams', 'AUTO_SUSPEND of 60 seconds on BI warehouses', 'A **weekly review** of the ten most expensive queries']
      }),

      B.incident({
        id: 'm11-i4', time: '05:05',
        alert: 'Alert: **dbt_stg failed.** `SQL compilation error: invalid identifier \'CUST_ID\'`.',
        clues: ['The core banking team renamed columns in a release.', 'The RAW load succeeded. The new file has a column called CUSTOMER_ID.'],
        opts: [
          { t: 'Ask the source team to revert their release', fb: 'Not in your control, and not necessary. The change is small and fixable on your side.' },
          { t: 'Update the staging model to read the new column, rebuild, then agree a change process with the source team', fb: '' },
          { t: 'Rename the column in the RAW table by hand', fb: 'RAW must stay exactly as loaded. Fix the interpretation in staging.' },
          { t: 'Skip the failing model', fb: 'Everything downstream would fail or serve stale data.' }
        ],
        best: 1, why: 'Staging is the **only place that knows raw column names**. A one-model fix restores the pipeline, and the process fix prevents the next surprise.',
        checks: [
          ['Read the error', '`invalid identifier CUST_ID` in `stg_core__loans`.'],
          ['Compare RAW columns', '`DESC TABLE` shows `CUSTOMER_ID` replaced `CUST_ID`.'],
          ['Check the blast radius', 'Lineage shows `int_loan_exposure`, `fct_loan_exposure` and the API exposure downstream of that one model.'],
          ['Fix in staging', 'Select `coalesce(customer_id, cust_id)` during the transition so replays of old files still work. Rerun from `dbt_stg`.'],
          ['Fix the process', 'Agree schema change notices with the source team and add an ingestion schema check that alerts on drift.']
        ],
        tell: 'dbt staging failed on an invalid identifier. The source team had renamed a column in a release. RAW had loaded fine because the table holds files as received. I fixed it in the one staging model that references raw names, used a coalesce so old and new files both work, and reran from that task. Downstream models were untouched.\n\nThen I added a schema check to the extractor and agreed a change-notice process with the source team.',
        prevent: ['A **schema check** in the extractor that alerts on missing or new columns', 'A written **contract and change notice** with the upstream team', 'dbt **contracts** on marts, so shape changes fail in CI, not production', 'Only staging models reference raw column names']
      }),

      B.incident({
        id: 'm11-i5', time: 'Tue 10:30',
        alert: 'Finance: **"Total outstanding in the dashboard is 1.2 million lower than the core banking report."**',
        clues: ['Every pipeline run was green.', 'The gap is concentrated in loans corrected two days ago.'],
        opts: [
          { t: 'Tell finance the core banking report is wrong', fb: 'You have no evidence yet. Check your own pipeline first.' },
          { t: 'Compare the mart with RAW for one affected loan, then read the incremental filter', fb: '' },
          { t: 'Add more tests', fb: 'More tests do not explain a gap you have not investigated yet.' },
          { t: 'Run a full refresh immediately', fb: 'That may fix the numbers but hides the cause, and the same bug returns tomorrow.' }
        ],
        best: 1, why: 'A green pipeline with wrong numbers means **logic**, not failure. Reproduce with **one record**, then read the code that decides which rows load.',
        checks: [
          ['Reproduce with one loan', 'L-1001: RAW shows the corrected balance from 12 March. The mart still shows the old balance.'],
          ['Read the incremental filter', 'It filters `created_at > max(created_at)`. A corrected row keeps its old created_at, so it never loads.'],
          ['Measure the blast radius', 'Query RAW for loans where `updated_at > created_at` since the filter was introduced.'],
          ['Fix the logic', 'Filter on `updated_at` with a three-day lookback and merge on the unique key.'],
          ['Repair the data', 'A targeted backfill, or a full refresh of that table. Reconcile totals with the core banking report.'],
          ['Prevent a repeat', 'A daily reconciliation test of totals between RAW and the mart.']
        ],
        tell: 'Finance saw a 1.2 million gap against the core report while every run was green. I reproduced it with one loan: RAW had the correction and the mart did not. The incremental model filtered on created_at, so corrected rows never loaded. I changed the filter to updated_at with a three-day lookback, backfilled the affected loans, and reconciled totals with the report.\n\nI also added a daily reconciliation test between RAW and the mart.',
        prevent: ['A **daily reconciliation** of totals between RAW and the marts', 'Incremental models filter on **updated_at with a lookback**', 'A review checklist item for every incremental model', 'A repeatable backfill procedure with a date range variable']
      }),

      B.incident({
        id: 'm11-i6', time: '14:20',
        alert: 'Compliance: **"An analyst reports they can see full SSNs in the customer dimension."**',
        clues: ['`dim_customer` was rebuilt by the 13:00 run.', 'The masking policy still exists in the governance schema.'],
        opts: [
          { t: 'Investigate quietly before telling anyone', fb: 'Delay lengthens the exposure window and the compliance risk. Contain first and notify per policy.' },
          { t: 'Contain it now: restrict access to the table, tell the security team, then investigate', fb: '' },
          { t: 'Rebuild the table again', fb: 'It may reapply the policy but destroys evidence about the exposure window.' },
          { t: 'Disable the analyst\'s account', fb: 'The failure is the control, not the person.' }
        ],
        best: 1, why: '**Contain first, then investigate.** Restricting access ends the exposure. Telling security starts the formal process. Then you find the cause and measure who saw what.',
        checks: [
          ['Contain', 'Revoke SELECT on `dim_customer` from analyst roles, or swap the table for a masked view, immediately.'],
          ['Find the cause', 'The 13:00 run rebuilt the table with CREATE OR REPLACE. The masking policy attached by hand was dropped with the old table.'],
          ['Measure the exposure', '`ACCESS_HISTORY` shows who read the SSN column between 13:00 and 14:20: three analysts, eleven queries.'],
          ['Fix', 'Re-attach the policy. Add a post-hook or tag-based masking so every rebuild reapplies it. Restore access.'],
          ['Report', 'Notify the security and privacy teams with the exposure window and the access list, as policy requires.'],
          ['Prevent', 'A CI check that asserts the masking policy is attached after the build.']
        ],
        tell: 'Compliance reported that an analyst could see full SSNs. First I restricted access to the table and told the security team. Then I found the cause: the 13:00 dbt run rebuilt the table and dropped a masking policy that had been attached manually. Access history showed the exposure window and who had queried the column.\n\nI re-attached the policy, added a post-hook so every rebuild reapplies it, and added a CI check that asserts the policy exists after the build.',
        prevent: ['**Post-hooks or tag-based masking**, so rebuilds reapply policies', 'A CI check that the policy is **attached after build**', 'An alert on unusual reads of PII columns', 'A runbook for suspected PII exposure: contain, notify, measure, fix']
      }),

      B.incident({
        id: 'm11-i7', time: '11:05',
        alert: 'App team: **"The exposure API is timing out at peak. p95 latency is 12 seconds."**',
        clues: ['The API reads `fct_loan_exposure` through WH_API (Small).', 'Traffic doubled after a product launch.'],
        opts: [
          { t: 'Make WH_API four sizes bigger', fb: 'Bigger does not add concurrency. If queries are waiting, size is the wrong lever.' },
          { t: 'Check queue time on WH_API, then add multi-cluster capacity and review the access pattern', fb: '' },
          { t: 'Tell the app team to retry on timeouts', fb: 'Retries add load to an overloaded system.' },
          { t: 'Point the API at the RAW tables', fb: 'Slower, ungoverned and unmasked.' }
        ],
        best: 1, why: 'Diagnose **queueing versus slow queries**. At peak, many small lookups wait for a slot. That calls for more clusters, not a bigger one.',
        checks: [
          ['Check warehouse load', 'Queued time dominates. Execution is about 300 ms, but queries wait for a free slot.'],
          ['Add capacity for concurrency', 'Multi-cluster WH_API, 1 to 4 clusters, standard scaling policy.'],
          ['Reduce work per call', 'Select only needed columns, use stable query text so the result cache helps, and filter on the clustered key.'],
          ['Question the access pattern', 'High-rate tiny lookups are not what a warehouse is best at. Consider caching hot keys in the API layer or a low-latency serving store.'],
          ['Protect the platform', 'Rate limits and timeouts in the API, and a resource monitor on WH_API.']
        ],
        tell: 'The exposure API timed out at peak after a launch doubled traffic. Query profiles showed 300 ms of execution but long queue times, so it was a concurrency problem, not slow SQL. I enabled multi-cluster on the API warehouse, trimmed the queries to the needed columns, and the p95 dropped back. For the longer term I proposed caching hot customer keys in the API layer, since this access pattern suits a serving store better than a warehouse.\n\nI also added rate limits and a queue-time alert.',
        prevent: ['**Load-test** before launches', 'Cache hot keys in the API layer', 'Alert on **queue time**, not just errors', 'Document capacity limits in the API contract']
      }),

      B.qa({
        id: 'qa-incident', tag: 'Incident story', secs: 90,
        q: 'Tell me about a production incident you handled. What happened, what did you do, and what changed afterwards?',
        pts: ['Situation in one sentence, with the business impact', 'How it was detected (alert, monitor)', 'Your actions in order: contain, diagnose, fix', 'Result with a number: time to recover, impact avoided', 'What changed afterwards: the prevention', 'Resume: failed or delayed loads resolved, recovery documented'],
        short: 'At Wells Fargo a critical workflow missed its SLA because an upstream file arrived late. Datadog alerted us before the business noticed. I checked the sensor and the landing folder, confirmed the file was late and not corrupt, and told the downstream teams the new ETA. When the file landed, the pipeline resumed, and I verified row counts before the marts published.\n\nAfterwards I documented the recovery steps in the runbook and added two safeguards: an alert when a sensor has waited 30 minutes, and a row-count expectation so a late or empty file fails fast.',
        long: 'Situation. At Wells Fargo a workflow feeding financial-risk datasets missed its SLA because an upstream file arrived late. Datadog SLA monitoring alerted us before the business noticed.\n\nAction. I opened the Airflow task log and saw the sensor waiting with no error. I checked the landing folder, confirmed the file had not arrived rather than arrived corrupt, and contacted the source owner for an ETA. I told the downstream teams the new expected time instead of letting them discover it. When the file arrived the pipeline resumed on its own, and I verified row counts against the source before the marts published.\n\nResult. No bad data reached consumers, and the delay was communicated before anyone asked.\n\nPrevention. I documented the recovery steps in the runbook and added an alert when a sensor has waited 30 minutes, plus a row-count expectation so a late or empty file fails fast.',
        fu: [
          ['What would you do differently?', 'Name one real improvement. Example: "I would have agreed the SLA and a contact path with the upstream owner earlier, so the first call took minutes."'],
          ['How did you prioritize while it was happening?', 'Contain impact first, communicate early, then fix the cause. The communication step is what stakeholders remember.']
        ],
        trap: 'Skipping the prevention. An incident story that ends at "and then it worked" sounds junior.',
        real: 'This answer uses the Wells Fargo bullet from your resume (failed or delayed loads resolved, recovery documented). **Replace the details with a real incident of yours**: what failed, how you found it, how long it took, what you changed.'
      }),

      B.recap({
        id: 'm11-recap', n: 11, badge: 'Incident Commander', color: '#FED7AA',
        pts: [
          'Cheap, fast checks first. They rule out the most causes in the least time.',
          '**Contain, communicate, then fix.** Tell stakeholders early.',
          'A green pipeline with wrong numbers is a **logic** problem. Reproduce with one record.',
          'Queueing is fixed by **scale out**, slow queries by diagnosis. Not by size alone.',
          'Always end with the **prevention**: a test, an alert, a runbook.'
        ],
        lines: [
          'I contain first, communicate early, then diagnose from the cheapest check to the costliest.',
          'Every incident ends with a prevention: a test, an alert or a runbook step.',
          'A failed gate keeps yesterday\'s good data in place, so consumers are protected while I fix it.'
        ]
      })
    ]
  });
})();
