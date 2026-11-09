/* Mission 12: architecture and design decisions, each with the Coach's pick. */
(function () {
  var B = LAB.b;

  LAB.addChapter({
    id: 'm12', n: 12, title: 'Architecture decisions', short: 'Architecture', blurb: 'Whiteboard design and five decisions with my pick', minutes: 26,
    focus: ['src', 'ing', 'raw', 'stg', 'int', 'mart', 'con', 'air', 'qual', 'ci', 'mon'],
    goals: [
      'Run a **whiteboard design answer** in a fixed order, using the project map.',
      'Make and defend **five design decisions** with clear trade-offs.',
      'State **trade-offs and risks** out loud, which is what senior answers contain.',
      'Describe how you would **phase delivery**.'
    ],
    say: 'Mission 12 is the design round. Interviewers rarely want a perfect architecture. They want to see your **order of thinking, your trade-offs, and your risks**. Press Next for a framework, then five decisions with my pick for each.',
    scenes: [
      B.talk({
        id: 'm12-frame', title: 'A framework for any design question',
        say: 'Use this order every time. It keeps you calm and shows structure. Press Next for each step.',
        items: [
          ['1. Clarify', 'Data volume and growth, latency needs, SLAs, who consumes it, compliance rules, team size. Two minutes of questions beat ten minutes of wrong design.', 'One: ask before you draw.'],
          ['2. Ingest', 'Group sources by style (database, API, file). Decide batch or streaming. Land raw data as files with deterministic paths.', 'Two: how data comes in.'],
          ['3. Store in layers', 'RAW, staging, intermediate, marts, in separate schemas with separate roles.', 'Three: layers and separation.'],
          ['4. Transform', 'dbt Core for modular, tested SQL. Incremental for big facts. Contracts on what consumers read.', 'Four: how it is transformed.'],
          ['5. Orchestrate and deliver', 'Airflow for order, retries and gates. CI/CD for safe change. An API or BI layer for consumers.', 'Five: how it runs and ships.'],
          ['6. Operate', 'Quality gates, security and masking, monitoring and SLAs, cost controls, runbooks.', 'Six: how you keep it healthy.'],
          ['7. Trade-offs and risks', 'Name **three trade-offs** you made and **two risks** with their mitigation. This step is what separates senior answers.', 'Seven: say the trade-offs out loud. Always.']
        ],
        cols: 2
      }),

      B.flow({
        id: 'm12-board', title: 'Whiteboard: 15 sources, risk reporting and an API', g: 'master', ctl: true,
        steps: [
          { say: 'The question: design a platform that ingests 15 source systems and serves risk reporting and an application API. This is the map you already know. I will walk it in the framework order.', cap: '**Step 1, clarify.** How much data per day? What latency? Who consumes it? What SLA? Which regulations apply? Say these questions out loud first.' },
          { say: 'Ingestion. Group the 15 sources by style: relational, API, file. Use managed connectors for the common ones and custom Python for the unusual ones. Everything lands in S3 by run date, and Snowpipe loads it.',
            focus: ['g_src', 's_core', 's_pay', 's_ven', 'py', 's3', 'pipe'], on: ['e1a', 'e1b', 'e1c', 'e2', 'e3'], cap: '**Step 2.** The pattern is the same for all 15. Only the extractor changes.' },
          { say: 'Storage in layers. RAW exactly as received, then staging, intermediate and marts in separate schemas, each with its own roles.',
            focus: ['g_sf', 'raw', 'stg', 'int', 'mart'], on: ['e4', 'e5', 'e6', 'e7'], cap: '**Step 3.** Separate schemas give separate permissions and a clear place for every kind of logic.' },
          { say: 'Transformation with dbt Core. Staging cleans, intermediate holds business logic, marts are Kimball star schemas. Incremental for large facts, tests on every key, contracts on the marts.',
            focus: ['g_sf', 'g_dbt', 'stg', 'int', 'mart'], cap: '**Step 4.** One tested, version-controlled definition for each metric.' },
          { say: 'Serving. The application team reads the marts through an API on its own warehouse. Analysts use BI tools on a separate warehouse. Neither reads staging or RAW.',
            focus: ['mart', 'api', 'bi'], on: ['e8a', 'e8b'], cap: '**Step 5 (delivery).** Consumers get a contract, not a table dump.' },
          { say: 'Operations. Airflow with quality gates, CI/CD with slim builds, Datadog for SLAs, masking and roles for security.',
            focus: ['air', 'qual', 'cicd', 'mon'], tags: ['t_py', 't_pipe', 't_dbt'], cap: '**Step 6.** This is the part many candidates skip. Do not.' },
          { say: 'Close with trade-offs and risks. Three trade-offs: Kimball over Data Vault for speed, managed connectors for speed against cost, batch over streaming for simplicity. Two risks: late or changed sources, and API concurrency at peak. Mitigations: freshness tests and schema checks, multi-cluster and caching.',
            cap: '**Step 7.** Naming risks **before** the interviewer does earns trust.' }
        ]
      }),

      B.decide({
        id: 'm12-d1', title: 'Decision 1: ETL or ELT?',
        scenario: 'Today a Python service **cleans and joins** loan data before loading it into the warehouse. Business rules are buried in that code and only one engineer understands them. Reprocessing last month requires re-extracting from the sources. What do you recommend?',
        opts: [
          { t: 'Keep ETL: clean in Python, then load', d: 'No change.', lose: 'The rules stay hidden, untested and without lineage, and every fix requires going back to the sources.' },
          { t: 'ELT: land raw data in Snowflake, transform with dbt', d: 'Load first, transform inside the warehouse.' },
          { t: 'Transform in the BI tool', d: 'Let each dashboard define its own logic.', lose: 'Two dashboards give two answers, and nothing is versioned or tested.' },
          { t: 'Move the logic into stored procedures', d: 'Keep it in the database.', lose: 'Better than hidden Python, but you lose modular models, automatic dependencies, built-in tests, documentation and CI.' }
        ],
        pick: 1,
        why: 'With ELT, raw data is kept, so **replay is cheap**. Transformations are SQL in Git with tests, lineage and CI, and Snowflake compute scales with the work. Any bug fix is a rebuild from RAW.',
        when: '**ETL still wins** when sensitive data must be removed or masked **before** it may enter the warehouse, or when processing is not SQL-shaped, such as image or heavy ML preprocessing.'
      }),

      B.decide({
        id: 'm12-d2', title: 'Decision 2: how to build each table',
        scenario: 'Three tables: **dim_customer** (history matters), **fct_payments** (billions of rows, mostly new events each day), **dim_loan_status** (twelve rows). The team suggests: "Just full refresh everything every night. It is simplest."',
        opts: [
          { t: 'Full refresh everything nightly', d: 'One pattern for all.', lose: 'The billion-row fact rebuilds every night for hours, and dim_customer loses its history on every rebuild.' },
          { t: 'Pick per table: snapshot for dim_customer, incremental for fct_payments, a plain table for dim_loan_status', d: 'The right tool for each.' },
          { t: 'Incremental for everything', d: 'Always process less.', lose: 'Incremental adds late-data and key complexity. A twelve-row table gains nothing, and a dimension needing history needs a snapshot, not a merge.' },
          { t: 'Views for everything', d: 'No storage, always fresh.', lose: 'Every query recomputes the logic, so the billion-row fact makes dashboards slow and expensive.' }
        ],
        pick: 1,
        why: 'Match the **materialization to the shape of the data**. History needs a snapshot. Huge append-heavy facts need incremental. Tiny reference tables need nothing clever.',
        when: 'Use a **full refresh** nightly for a modest table that rebuilds in seconds, because simplicity beats optimisation when the cost is trivial.'
      }),

      B.decide({
        id: 'm12-d3', title: 'Decision 3: test data for dev and CI',
        scenario: 'Developers and CI need **production-like data**. Copying production nightly takes hours and doubles storage cost. Several columns are **PII**.',
        opts: [
          { t: 'Copy production into dev every night', d: 'Realistic data.', lose: 'Slow, doubles storage, and copies unmasked PII into a less-controlled environment.' },
          { t: 'Zero-copy clone of production for dev and CI, with masking policies applied and a dev row limit', d: 'Instant and nearly free.' },
          { t: 'Use hand-made fake data only', d: 'No privacy risk.', lose: 'It misses real edge cases: duplicates, late rows, odd formats. Tests pass and production still breaks.' },
          { t: 'Let developers query production directly', d: 'Zero setup.', lose: 'Risk to production and exposure of PII to everyone building models.' }
        ],
        pick: 1,
        why: 'A **zero-copy clone** gives a full, writable copy in seconds with no extra storage until data changes. Apply masking so dev roles never see real PII, and use a dev limit macro so builds stay fast.',
        when: 'Use **fake or synthetic data** when regulation forbids any production-derived data in lower environments, and add a small set of real-shaped edge-case fixtures to compensate.'
      }),

      B.decide({
        id: 'm12-d4', title: 'Decision 4: how application teams consume data',
        scenario: 'An application team wants to read data **directly from the warehouse** to ship a feature quickly. They propose reading `stg_core__loans` because "it is already clean."',
        opts: [
          { t: 'Let them read staging tables directly', d: 'Fastest for them.', lose: 'Staging has no contract. Any refactor of a staging model silently breaks the app.' },
          { t: 'Give them the marts through an API or secure view with a contract, a version and a dedicated warehouse', d: 'A governed interface.' },
          { t: 'Send nightly CSV exports', d: 'Decoupled and simple.', lose: 'Stale, duplicated, ungoverned copies of data. Masking and audit are lost.' },
          { t: 'Let them read RAW', d: 'Most complete data.', lose: 'Unmasked, uncleaned, with duplicates and all the source quirks leaking into the app.' }
        ],
        pick: 1,
        why: 'Consumers should depend on a **contract**, not on whatever table happens to exist. Marts are tested, documented and versioned. A dedicated warehouse isolates their load, and an exposure records who depends on what.',
        when: 'For a quick prototype, a **secure view over a mart** is enough. Move to a versioned API when several teams depend on it.'
      }),

      B.decide({
        id: 'm12-d5', title: 'Decision 5: build or buy ingestion',
        scenario: 'Fifteen sources: **6 common databases and SaaS apps**, **5 vendor file feeds**, **4 internal APIs with custom authentication**. The team has two engineers. Do you write all extractors yourself?',
        opts: [
          { t: 'Custom Python for all 15', d: 'Full control.', lose: 'Two engineers would maintain 15 extractors forever: schema changes, retries, upgrades. Most of that work adds no business value.' },
          { t: 'Managed connectors for the common sources, custom Python for files and internal APIs', d: 'Buy the commodity, build the unusual.' },
          { t: 'Managed connectors for everything', d: 'Zero code.', lose: 'Managed tools rarely support custom authentication or odd vendor formats, so you end up forcing them or waiting for support.' },
          { t: 'Ask each source team to push data into Snowflake', d: 'Shift the work to them.', lose: 'Fifteen teams, fifteen different quality levels and no consistency in landing, naming or security.' }
        ],
        pick: 1,
        why: 'Maintenance is the real cost. **Buy what is commodity** and **build what is unusual**. Keep one landing pattern for both, so everything downstream looks the same.',
        when: '**Build everything** when security review forbids third-party data paths, or when volume makes per-row pricing painful. Check compliance and cost at your data volumes before you decide.'
      }),

      B.qa({
        id: 'qa-design', tag: 'Architecture', secs: 120,
        q: 'Design a data platform that ingests 15 source systems and serves risk reporting and an application API. Walk me through it.',
        pts: ['Clarify requirements first', 'Group sources by style. Land files in S3 by run date. Managed connectors and custom Python', 'RAW as received, then staging, intermediate, marts with separate roles', 'dbt Core: incremental, tests, contracts, Kimball marts', 'Airflow with quality gates, Datadog SLAs, CI/CD with slim builds', 'RBAC and masking. API on its own warehouse', 'Trade-offs and risks stated'],
        short: 'I would start by clarifying volume, latency, SLAs, consumers and compliance. Then I would group the 15 sources by style, relational, API and file, and land them as files in S3 by run date, using managed connectors for common systems and custom Python for unusual ones. Snowpipe loads them into RAW exactly as received.\n\nIn Snowflake I keep four layers in separate schemas with separate roles. dbt Core builds everything after RAW: staging for cleaning, intermediate for business logic, and Kimball star schema marts, with incremental models for large facts, tests on every key and contracts on the marts. Airflow orchestrates with quality gates, Datadog watches SLAs, CI/CD runs slim builds per pull request, and access is role based with masking on PII. The application team reads the marts through an API on its own warehouse.\n\nTrade-offs: Kimball over Data Vault for speed, managed connectors for speed over cost. Risks: late or changed sources, and API concurrency at peak.',
        long: 'Clarify first: data volume and growth, latency, SLAs, consumers, and compliance rules.\n\n**Ingest.** Group the 15 sources by style: relational, API and file. Managed connectors for the common ones, custom Python for the unusual ones. Land everything as files in S3 under run-date paths and load with Snowpipe into RAW, untouched, with load metadata.\n\n**Layers.** RAW, staging, intermediate and marts in separate schemas with separate roles. Staging cleans and deduplicates. Intermediate holds business logic. Marts are Kimball star schemas with incremental models for large facts, unique, not_null and relationship tests, and enforced contracts.\n\n**Run.** Airflow runs extraction in parallel, waits for loads, applies quality gates, and runs dbt by layer. CI/CD does slim builds in a schema per pull request, then a deploy job. Datadog alerts on SLAs and freshness. Warehouses are split by workload with auto-suspend and resource monitors.\n\n**Security.** Role-based access, masking policies on PII, key-pair authentication for services, audit through access history.\n\n**Consumers.** The application team reads marts through an API on a dedicated multi-cluster warehouse. Analysts use BI on another warehouse.\n\n**Trade-offs and risks.** Kimball for speed with Data Vault as an option if sources churn. Managed connectors trade cost for speed. Risks are late or changed sources, mitigated by freshness tests and schema checks, and API concurrency, mitigated by multi-cluster and caching. I would deliver in phases: three sources end to end first, then waves of sources on the same pattern.',
        fu: [
          ['Where would this design break first?', 'Honestly: late or changed sources, concurrency at API peaks, and cost growth from full refreshes. The mitigations are freshness tests and schema checks, a multi-cluster API warehouse with caching, and incremental models with a weekly cost review.'],
          ['How would you phase delivery?', 'Phase one: the three highest-value sources end to end with one mart and the API, to prove the pattern. Phase two: add sources in waves on the same pattern. Phase three: harden governance, cost and observability. Value ships early and each wave gets cheaper.'],
          ['What would make you choose Data Vault here?', 'Many volatile sources, strict requirements to reproduce the data exactly as received at any point in time, and several teams loading in parallel. Then a raw vault with star marts on top.']
        ],
        trap: 'Drawing boxes without trade-offs. If you do not name risks, the interviewer will, and you will look unprepared.',
        real: 'Your Bank of America warehouse was Kimball over 15+ source systems. Use it as the proof point: "this is the shape of the warehouse I architected."'
      }),

      B.qa({
        id: 'qa-migrate', tag: 'Architecture', secs: 60, opt: true,
        q: 'How would you migrate a legacy ETL and on-premises warehouse to Snowflake and dbt?',
        pts: ['Inventory and prioritize by business value', 'Run old and new in parallel', 'Rebuild logic in dbt with tests', 'Reconcile old against new (counts, totals, audit_helper)', 'Cut over per consumer, then decommission'],
        short: 'I would inventory what exists and rank it by business value and risk, then migrate one business process at a time, not everything at once. For each I land the source data in Snowflake, rebuild the logic as dbt models with tests, and run old and new in parallel. I reconcile the two with row counts, key totals and the audit_helper package until differences are explained. Then consumers cut over one at a time, and the legacy job is decommissioned only after sign-off. Along the way I document the rules I discover, because legacy code often contains logic nobody remembers.'
      }),

      B.recap({
        id: 'm12-recap', n: 12, badge: 'Architect', color: '#C7D2FE',
        pts: [
          'Order of thinking: **clarify, ingest, layers, transform, orchestrate, operate, trade-offs**.',
          'ELT over ETL: keep raw, transform in the warehouse with tested SQL.',
          'Materialization follows the data: snapshot for history, incremental for huge facts, table for small ones.',
          'Clone for test data, with masking. Marts behind a contract for consumers.',
          '**Buy the commodity, build the unusual.** Always end with trade-offs and risks.'
        ],
        lines: [
          'Let me start by clarifying volume, latency, SLAs, consumers and compliance.',
          'The three trade-offs I made are these, and the two risks are these.',
          'I would phase it: three sources end to end first, then waves on the same pattern.'
        ]
      })
    ]
  });
})();
