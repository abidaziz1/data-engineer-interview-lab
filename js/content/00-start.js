/* Start screen, job description map, and Mission 1 (the whole project on one page). */
(function () {
  var B = LAB.b;

  /* ============================== START ============================== */
  LAB.addChapter({
    id: 'm0', n: 0, title: 'Start here', short: 'Start', blurb: 'Pick your time, see what the job asks for', noIntro: true,
    scenes: [
      B.welcome({ title: 'Welcome' }),

      B.cmp({
        title: 'What the job asks for, and your proof',
        say: 'The job description is long, but every line maps to something on your resume. Press Next and I will reveal the map one row at a time. Notice the middle column: those are the sentences you will say.',
        cols: ['The job asks for', 'Your proof (resume)', 'Trained in'],
        rows: [
          ['dbt Core: modular models, macros, seeds, tests', 'dbt layers inside 150+ Airflow pipelines at Citigroup. dbt models, macros, seeds and tests at Wells Fargo.', 'Missions 3 and 4'],
          ['Python operators in the dbt flow', 'Python models and Python tasks around dbt. This one is a trap. See Mission 4.', 'Mission 4'],
          ['Snowflake: design, performance, security', 'Kimball warehouse over 15+ sources at Bank of America. Clustering, warehouses, RBAC, masking.', 'Missions 5 and 9'],
          ['ETL/ELT from many sources', 'API and file ingestion at Citigroup. 50+ source systems at UnitedHealth Group.', 'Missions 2 and 7'],
          ['Data modeling: Kimball, Inmon, Data Vault', 'Star schemas at Bank of America. Inmon and Data Vault in your skills list.', 'Mission 6'],
          ['Airflow or Snowflake Tasks', '40+ workflows at Wells Fargo, 200+ DAGs at Bank of America, 150+ pipelines at Citigroup.', 'Mission 8'],
          ['Data quality, tests, docs, version control', 'Great Expectations and dbt tests. 99.8% accuracy at Citigroup. Zero compliance incidents at Bank of America.', 'Mission 9'],
          ['CI/CD, Git, Docker', 'Jenkins and Terraform at Citigroup. GitHub Actions and GitLab CI/CD in your skills.', 'Mission 10'],
          ['Work with app developers, analysts, product managers. Agile, Jira.', 'REST APIs for application teams at Wells Fargo. Trading desk APIs at Citigroup.', 'Missions 10 and 13'],
          ['Monitor and fix problems early', 'Datadog SLA monitoring and documented recovery at Wells Fargo.', 'Missions 8 and 11']
        ],
        steps: [
          { upto: 2, say: 'First two rows. dbt Core is the centre of this job. Your resume has dbt in production at two employers, so lead with it.' },
          { upto: 4, say: 'Row 2 is a trap I will explain properly in Mission 4. Rows 3 and 4 are your Snowflake and ingestion stories.' },
          { upto: 6, say: 'Modeling and orchestration. You list Kimball, Inmon and Data Vault. Be ready to say when you would use each.' },
          { upto: 8, say: 'Quality and delivery. Your numbers here (99.8%, zero incidents) will be questioned, so we will practise defining them.' },
          { upto: 10, say: 'Last two rows are collaboration and operations. Senior roles are judged heavily on these.' }
        ],
        pick: 'Every mission follows the same rhythm: **SEE** it, **TRY** it, **SAY** it. By the end you will have said about 30 answers out loud.'
      }),

      B.talk({
        title: 'What the interview will test',
        say: 'Expect three kinds of questions. Press Next to see each one. Most candidates only prepare the first kind, which is why the other two decide the result.',
        items: [
          ['1. Explain your work', 'Walk through a project: sources, ingestion, dbt layers, orchestration, quality. They listen for **specific** tool names, **reasons** for choices, and **what broke**.', 'Kind one is the project walkthrough. It sounds easy. Candidates fail it by staying vague. You will practise it in Mission 1.'],
          ['2. Solve live', 'A SQL query with window functions. A Python function with retries or pagination. A dbt macro or incremental model written from scratch. Often on a shared screen, 20 to 30 minutes.', 'Kind two is live coding. You will get SQL, Python and dbt problems with hints, then the solution.'],
          ['3. Handle scenarios and people', 'A pipeline is late at 7 AM. A stakeholder disagrees with your metric. Pick between Airflow and Snowflake Tasks and defend it. Describe a mistake you made.', 'Kind three is judgment. There is rarely one right answer, so say your reasoning out loud. I will give you my pick for each decision.']
        ],
        call: { k: 'warn', h: 'Your one risk.', t: 'Thirteen years of experience can sound vague if you stay at tool-name level. Add one **number, one failure and one reason** to every answer.' }
      })
    ]
  });

  /* ============================== MISSION 1 ============================== */
  var hop = function (n, say, cap, focus, on, edge) {
    return { say: say, cap: cap, focus: focus, on: on, pill: { edge: edge, label: 'L-1001' } };
  };

  LAB.addChapter({
    id: 'm1', n: 1, title: 'The project on one page', short: 'Big picture', blurb: 'Sources to Snowflake layers to consumers', minutes: 18,
    focus: ['src', 'ing', 'raw', 'stg', 'int', 'mart', 'con', 'air', 'qual', 'ci', 'mon'],
    goals: [
      'Draw the whole platform on a whiteboard in 60 seconds.',
      'Explain **where each tool starts and stops**: Python, Snowflake, dbt, Airflow.',
      'Walk through your **current project** the way the interviewer asked it.',
      'Give a **2-minute introduction** that matches your resume.'
    ],
    say: 'Mission 1 gives you the map. Every later mission zooms into one part of it. If you only had 20 minutes before the interview, this mission is the one to do.',
    scenes: [
      B.flow({
        id: 'm1-map', title: 'The whole platform', g: 'master', ctl: true,
        steps: [
          { say: 'This is the entire project on one page. Sources on the left, ingestion across the top, Snowflake layers across the bottom, consumers on the right. Four bars wrap around it. Press Next to light up one zone at a time.',
            cap: 'Read it like a page: top row **brings data in**, bottom row **makes it useful**, right side **delivers it**.' },
          { say: 'Three source systems. A core banking database with loans and customers. A payments REST API with transactions as JSON. A risk vendor that drops credit rating files.',
            focus: ['g_src', 's_core', 's_pay', 's_ven'], cap: '**Three source styles**: a relational database, a REST API, and files. Almost every ingestion question reduces to one of these three.' },
          { say: 'Ingestion has three small steps. Python jobs extract and validate. Files land in S3. Snowpipe loads each new file into Snowflake.',
            focus: ['py', 's3', 'pipe'], cap: 'Python **moves** data. It does not clean it or apply business rules. That comes later, inside Snowflake.' },
          { say: 'Inside Snowflake there are four layers. RAW keeps data as loaded. Then dbt builds staging, intermediate and marts. The dashed box shows what dbt owns.',
            focus: ['g_sf', 'raw', 'stg', 'int', 'mart', 'g_dbt'], cap: '**RAW** is a copy of the source. **STAGING** cleans it. **INTERMEDIATE** applies business rules. **MARTS** publish facts and dimensions.' },
          { say: 'On the right, consumers. Application teams call a REST API. Analysts use Tableau or Looker. Both read the marts, never the raw tables.',
            focus: ['api', 'bi', 'mart'], cap: 'Both consumers read the **same tables**, so there is one definition of every number.' },
          { say: 'Four bars wrap around everything. Airflow runs the schedule. Quality and security protect the data. Delivery ships code safely. Monitoring wakes you up when something slips.',
            focus: ['air', 'qual', 'cicd', 'mon'], cap: 'These four are what make it a **production** platform instead of a script. Senior interviews spend half their time here.' }
        ]
      }),

      B.flow({
        id: 'm1-hops', title: 'Follow one loan through the pipeline', g: 'master',
        steps: [
          hop(1, 'Hop 1. We follow one loan, L-1001, shown as the yellow pill. Python jobs pull it out of the core banking database. The orange blocks on the other lines are the payments and ratings data travelling at the same time.',
            '**Hop 1: extract.** The database is queried for rows changed since the last run. The API is read page by page. The vendor file is downloaded once.',
            ['g_src', 's_core', 's_pay', 's_ven', 'py'], ['e1a', 'e1b', 'e1c'], 'e1a'),
          hop(2, 'Hop 2. The job checks the data, then writes it to S3 in a folder named for the run date. Files are cheap, easy to replay and easy to audit.',
            '**Hop 2: land in S3.** For example `core/dt=2026-03-14/part-0001.parquet`. Reloading a day means pointing at the same folder again.',
            ['py', 's3'], ['e2'], 'e2'),
          hop(3, 'Hop 3. S3 sends an event when a file arrives. Snowpipe picks it up and copies the file into Snowflake. No one has to start this by hand.',
            '**Hop 3: auto-ingest.** Airflow does not push the data. It waits with a sensor until the load is confirmed.',
            ['s3', 'pipe'], ['e3'], 'e3'),
          hop(4, 'Hop 4. The rows arrive in RAW. RAW is what the source sent, plus two columns saying when and from which file. Nothing is cleaned here, on purpose.',
            '**Hop 4: RAW.** If a dbt model has a bug next week, you fix it and rebuild from RAW. You never ask the source system again.',
            ['pipe', 'raw', 'g_sf'], ['e4'], 'e4'),
          hop(5, 'Hop 5. dbt staging models clean the data. Rename columns, cast types, convert cents to dollars, translate status codes, remove duplicates.',
            '**Hop 5: STAGING.** One staging model per source table. No joins and no business rules yet. Usually built as views.',
            ['raw', 'stg', 'g_sf', 'g_dbt'], ['e5'], 'e5'),
          hop(6, 'Hop 6. Intermediate models carry the business logic. They join loans with payments, customers and credit ratings, then calculate expected loss.',
            '**Hop 6: INTERMEDIATE.** Expected loss = default probability x loss given default x outstanding balance. This is where risk definitions live.',
            ['stg', 'int', 'g_sf', 'g_dbt'], ['e6'], 'e6'),
          hop(7, 'Hop 7. Marts publish the result as a star schema: a fact table for exposure plus dimensions such as customer and date. Tests run here before anything counts as done.',
            '**Hop 7: MARTS.** `fct_loan_exposure`, `dim_customer`, `mart_risk_summary`. These are the only tables consumers are allowed to read.',
            ['int', 'mart', 'g_sf', 'g_dbt'], ['e7'], 'e7'),
          hop(8, 'Hop 8. Consumers read the marts. The application team calls the REST API. Analysts open dashboards. Same tables, same numbers.',
            '**Hop 8: serve.** One definition of expected loss, used everywhere. No dashboard re-implements the logic.',
            ['mart', 'api', 'bi', 'g_sf'], ['e8a', 'e8b'], 'e8a')
        ]
      }),

      B.rows({
        id: 'm1-row', title: 'Follow the data itself: loan L-1001',
        steps: [
          { say: 'Here is what loan L-1001 looks like in RAW. Cents as a whole number, a one-letter status, a text date. This is exactly how the core banking system stores it.',
            tabs: [{ layer: 'RAW', c: 'raw', name: 'RISK_DB.RAW.CORE_LOANS', cols: ['LOAN_ID', 'CUST_ID', 'PRINCIPAL_CENTS', 'STATUS_CD', 'COLLATERAL_CD', 'UPD_TS'],
              rows: [['L-1001', 'C-42', '25000000', 'A', 'RE', '2026-03-14 02:10'], ['L-1002', 'C-77', '1200000', 'C', 'AU', '2026-03-13 18:00'], ['L-1003', 'C-42', '9000000', 'A', 'UN', '2026-03-14 02:12']], trk: 0 }],
            notes: ['Orange row = our tracked loan. Yellow cells = values that change in the next step.', '`PRINCIPAL_CENTS` is an integer: 25,000,000 cents is $250,000.'] },
          { say: 'Staging cleans it. Principal becomes dollars. The status code A becomes the word ACTIVE using a small lookup file called a seed. Names follow one standard. Yellow cells show what changed.',
            tabs: [
              { layer: 'RAW', c: 'raw', name: 'RAW.CORE_LOANS', cols: ['LOAN_ID', 'CUST_ID', 'PRINCIPAL_CENTS', 'STATUS_CD'], rows: [['L-1001', 'C-42', '25000000', 'A']], trk: 0 },
              { layer: 'STAGING', c: 'stg', name: 'stg_core__loans', cols: ['loan_id', 'customer_id', 'principal_usd', 'loan_status'], rows: [['L-1001', 'C-42', '250000.00', 'ACTIVE']], trk: 0, chg: [[0, 2], [0, 3]] }
            ],
            ops: ['dbt view: rename, cast, cents_to_dollars() macro, join seed loan_status_codes'],
            notes: ['`25000000 / 100 = 250000.00`', '`A` becomes `ACTIVE` through the seed `loan_status_codes.csv`.'] },
          { say: 'Intermediate adds meaning. We bring in payments already made, the vendor credit rating and a loss-given-default from a seed. Then expected loss is probability times loss rate times what is still owed.',
            tabs: [
              { layer: 'STAGING', c: 'stg', name: 'stg_core__loans + payments + ratings', cols: ['loan_id', 'principal_usd', 'paid_usd', 'pd_score', 'collateral'], rows: [['L-1001', '250000.00', '40000.00', '0.04', 'RE']], trk: 0 },
              { layer: 'INTERMEDIATE', c: 'int', name: 'int_loan_exposure', cols: ['loan_id', 'principal_usd', 'outstanding_usd', 'pd_score', 'lgd', 'expected_loss_usd'], rows: [['L-1001', '250000.00', '210000.00', '0.04', '0.25', '2100.00'], ['L-1003', '90000.00', '85000.00', '0.04', '0.65', '2210.00']], trk: 0, chg: [[0, 2], [0, 4], [0, 5]] }
            ],
            ops: ['dbt model: join payments, ratings and seed lgd_by_collateral, then apply the risk formula'],
            notes: ['`outstanding = 250,000 - 40,000 = 210,000`', '`expected_loss = 0.04 x 0.25 x 210,000 = 2,100`', 'L-1002 is closed (status C), so it does not appear. The model keeps active loans only.'] },
          { say: 'The mart gives the loan a surrogate key, links it to the customer version that was valid on that day, and adds a risk tier. One row per loan per day. That is the grain.',
            tabs: [
              { layer: 'INTERMEDIATE', c: 'int', name: 'int_loan_exposure', cols: ['loan_id', 'customer_id', 'outstanding_usd', 'expected_loss_usd', 'pd_score'], rows: [['L-1001', 'C-42', '210000.00', '2100.00', '0.04']], trk: 0 },
              { layer: 'MARTS', c: 'mart', name: 'fct_loan_exposure', cols: ['loan_key', 'customer_key', 'date_key', 'outstanding_usd', 'expected_loss_usd', 'risk_tier'], rows: [['8f3a91', '12', '20260314', '210000.00', '2100.00', 'MEDIUM']], trk: 0, chg: [[0, 0], [0, 1], [0, 2], [0, 5]] }
            ],
            ops: ['dbt incremental model: surrogate keys, SCD2 customer lookup, risk_tier macro'],
            notes: ['Risk tier macro: PD at least 0.10 is HIGH, at least 0.03 is MEDIUM, else LOW. PD 0.04 gives **MEDIUM**.', '`customer_key = 12` is the version of customer C-42 that was valid on 2026-03-14.'] },
          { say: 'Finally the API returns it to the application team as JSON. Same numbers as the dashboard, because both read the same mart.',
            tabs: [],
            code: { file: 'GET /v1/exposure/customers/C-42', lang: 'json', code: '{\n  "customer_id": "C-42",\n  "as_of_date": "2026-03-14",\n  "loans": [\n    {\n      "loan_id": "L-1001",\n      "outstanding_usd": 210000.00,\n      "expected_loss_usd": 2100.00,\n      "risk_tier": "MEDIUM"\n    }\n  ]\n}' },
            notes: ['The API selects from `fct_loan_exposure` joined to `dim_customer`. It never touches RAW or staging.'] }
        ]
      }),

      B.flow({
        id: 'm1-airflow', title: 'Who presses the start button', g: 'master', ctl: true,
        steps: [
          { say: 'Airflow is the clock and the safety net. At 05:00 Eastern it starts the three Python extract tasks in parallel. Then a sensor waits until Snowpipe has loaded everything.',
            focus: ['air', 'py', 'pipe', 's3'], tags: ['t_py', 't_pipe'], on: ['e1a', 'e1b', 'e1c', 'e2', 'e3'], cap: 'Orchestration means **order, retries and visibility**. The data work itself happens in Python, Snowpipe and Snowflake.' },
          { say: 'Next Airflow runs dbt. Source freshness first, then staging, then intermediate and marts, with tests as gates. If a test fails, the models after it do not run.',
            focus: ['air', 'g_sf', 'raw', 'stg', 'int', 'mart', 'g_dbt'], tags: ['t_dbt'], on: ['e5', 'e6', 'e7'], cap: 'A failed test stops the chain. **Bad data never reaches the marts**.' },
          { say: 'If something fails, Airflow retries with a delay, then alerts. Datadog tracks run duration against the SLA, so a slow run raises an alert before the business notices.',
            focus: ['air', 'mon', 'qual'], cap: 'In your resume: **40+ production workflows** at Wells Fargo with dependency-aware orchestration, Datadog SLA monitoring, quality checks and alerting.' }
        ]
      }),

      B.talk({
        id: 'm1-roles', title: 'Where each tool starts and stops',
        say: 'Interviewers love to ask who does what. Press Next to reveal one tool at a time. Memorise the verb for each one.',
        items: [
          ['Python **moves** data', 'Extracts from databases, APIs and files. Validates, retries and writes to S3. It does not transform business data.', 'Python moves data. It does not apply business rules.'],
          ['Snowflake **stores and computes**', 'Holds RAW and every dbt layer. Runs all the SQL. Warehouses give compute, micro-partitions hold storage.', 'Snowflake stores the data and runs the SQL.'],
          ['dbt **defines transformations**', 'Turns SELECT statements into tables and views, in dependency order, with tests and docs. dbt does not hold data and does not run SQL itself. It sends SQL to Snowflake.', 'dbt writes the instructions. Snowflake runs them. Say that sentence in the interview.'],
          ['Airflow **schedules and retries**', 'Runs tasks in order on a schedule. Retries, sends alerts, records history. It orchestrates. It should not do heavy data work inside its own workers.', 'Airflow is the conductor, not the orchestra.'],
          ['Git and CI/CD **ship safely**', 'Every change goes through a pull request, an automated build in an isolated schema, review, and then deployment.', 'Delivery is the fourth bar around the project.'],
          ['Datadog **watches**', 'Collects Airflow and pipeline metrics. Alerts on failures, slow runs and stale data.', 'Monitoring closes the loop.']
        ],
        cols: 2
      }),

      B.order({
        id: 'm1-order', q: 'Put the journey of one loan record in order.',
        items: ['Core banking database', 'Python extract job', 'S3 landing folder', 'Snowpipe load', 'RAW table', 'dbt staging model', 'dbt intermediate model', 'dbt mart (fact table)', 'REST API and dashboards'],
        why: 'Files land first, RAW keeps them untouched, dbt builds staging, intermediate and marts in that order, and only the marts are served.',
        cheer: 'This sequence is your project walkthrough in one line.'
      }),

      B.quiz({
        id: 'm1-q1', q: 'Expected loss needs probability of default, loss given default and the outstanding balance. Where should this calculation live?',
        opts: [
          { t: 'In the Tableau dashboard, so analysts can adjust it quickly', fb: 'Then every dashboard has its own version. Two dashboards, two different expected-loss numbers.' },
          { t: 'In a dbt intermediate model with tests, in Git', fb: '' },
          { t: 'In the REST API code', fb: 'Then only the API is right. Analysts and other teams would calculate their own numbers.' },
          { t: 'In the RAW tables', fb: 'RAW must stay exactly as the source sent it, otherwise you cannot replay or audit.' }
        ],
        ok: 1,
        why: 'Business definitions live in **one tested, version-controlled place** that every consumer reads. In this platform that is a dbt model.'
      }),

      B.quiz({
        id: 'm1-q2', q: 'Why do we keep RAW exactly as the source sent it?',
        opts: [
          { t: 'So we can replay and audit any batch without asking the source system again', fb: '' },
          { t: 'Because Snowflake cannot store cleaned and uncleaned data in one database', fb: 'It can. Layers are separated by schema, not by database limits.' },
          { t: 'To reduce storage cost', fb: 'Keeping RAW costs more storage, not less. The benefit is recoverability.' },
          { t: 'Because dbt can only read from RAW', fb: 'dbt reads from any table you declare as a source or model.' }
        ],
        ok: 0,
        why: 'If a bug is found in a transformation next month, you fix it and rebuild from RAW. That is called **replay**, and it is why ELT beats cleaning data on the way in.'
      }),

      B.qa({
        id: 'qa-wf-project', tag: 'Project walkthrough', secs: 90,
        q: 'Walk me through your current project at Wells Fargo. What are the source systems, how does data enter Snowflake, how do you use dbt to transform it, and how does Airflow orchestrate the workflow?',
        pts: [
          'Business purpose: governed financial-risk datasets for application teams and analysts',
          'Sources: relational systems, REST APIs, vendor files',
          'Ingestion: Python extracts, S3 landing, Snowpipe or COPY into RAW with load metadata',
          'dbt layers: staging, intermediate, marts, with star and snowflake schemas',
          'dbt features: incremental models, Jinja macros, seeds, tests, documented rules',
          'Airflow: 40+ workflows, dependencies, retries, Datadog SLA monitoring, alerts',
          'Delivery: Git, Liquibase, access controls, lineage, REST APIs for app teams'
        ],
        short: 'At Wells Fargo I build the dbt and Snowflake layer that turns raw financial-risk data into governed datasets for application teams.\n\nPython jobs extract from relational systems, REST APIs and vendor files and land them in S3. Snowpipe loads them into RAW tables exactly as received, with load metadata, so any batch can be replayed.\n\ndbt Core takes it from there. Staging models rename, cast and deduplicate. Intermediate models hold the business logic. Marts expose facts and dimensions on star and snowflake schemas. I use incremental models, Jinja macros, seeds, and tests on every key.\n\nAirflow runs the sequence. I keep more than 40 production workflows reliable with dependency-aware DAGs, retries, quality checks and Datadog SLA monitoring. If a load fails or runs late, I resolve it and document the recovery.\n\nApplication teams read the marts through internal REST APIs. Changes are versioned in Git and Liquibase, with access controls and lineage documented.',
        long: 'At Wells Fargo my job is to make financial-risk data trustworthy for the teams that build on it. I own the dbt and Snowflake layer between the raw feeds and the application teams.\n\n**Ingestion.** Data comes from relational systems, REST APIs and vendor files. Python jobs extract incrementally, validate schema and row counts, and write files to S3 in run-date folders. Snowpipe loads them into RAW tables untouched, with `_loaded_at` and `_source_file` columns, so any batch can be replayed.\n\n**dbt.** Staging has one view per source table: rename, cast, deduplicate, convert units. Intermediate holds business logic. Loans join payments, customers and ratings, and expected loss is probability of default times loss given default times outstanding balance, with the rates coming from seeds. Marts publish facts and dimensions on star and snowflake schemas. Large facts are incremental, merged on the business key with a lookback window for late updates. Shared logic lives in Jinja macros. Every key has unique and not_null tests, and the rules are documented in dbt docs.\n\n**Airflow.** DAGs extract in parallel, wait for the load, check source freshness, then build staging and marts with tests as gates. I keep more than 40 production workflows healthy with retries, alerting and Datadog SLA monitoring, and I document every recovery.\n\n**Delivery.** Changes go through pull requests and CI. Schema changes are versioned with Liquibase and access is role based. Application teams consume the governed datasets through internal REST APIs, and I review model definitions with analytics, risk and platform stakeholders and explain the trade-offs.',
        fu: [
          ['Why dbt instead of stored procedures or plain SQL scripts?', 'Version control, modular SQL with `ref()`, automatic dependency order, built-in tests and documentation, and CI. A stored-procedure estate has none of that by default, and nobody can see lineage.'],
          ['How do you make the loads safe to rerun?', 'Files are loaded once (COPY tracks load history), RAW keeps every batch, staging deduplicates deterministically, and marts merge on the business key. Rerunning a day gives the same result.'],
          ['How do application teams get the data?', 'Through internal REST APIs that read the marts using a dedicated small warehouse. They never read RAW or staging. Masking policies apply, so the API role sees only what it should.'],
          ['What breaks most often?', 'Upstream changes: a late file or a renamed column. Source freshness tests, sensors with timeouts and schema checks catch those before the marts are built, and alerts reach the on-call engineer.']
        ],
        trap: 'Listing tools without responsibilities. "We use Python, Snowflake, dbt and Airflow" tells them nothing. Say what each one **does**, and what happens when it fails.',
        real: 'The three source types are examples that match your resume skills. Swap in your real source names and one real dataset, and keep the same order: sources, ingestion, dbt layers, Airflow, delivery.'
      }),

      B.qa({
        id: 'qa-intro', tag: 'Opening question', secs: 90,
        q: 'Tell me about yourself and your experience as a data engineer.',
        pts: ['13+ years, last 5+ on dbt and Snowflake', 'Now: Wells Fargo, dbt, Snowflake, 40+ Airflow workflows, REST APIs', 'Before: Bank of America, Kimball warehouse, 15+ sources, 200+ DAGs, zero compliance incidents', 'Before: Citigroup, 150+ pipelines at 99.8% accuracy, Terraform and Jenkins cut manual work 50%', 'Why this role matches'],
        short: 'I am a senior data engineer with 13 years of experience, the last five-plus building dbt and Snowflake platforms in financial services.\n\nAt Wells Fargo I build dbt models and Snowflake datasets that carry financial-risk definitions into reusable facts and dimensions. I run more than 40 production Airflow workflows and expose governed datasets to application teams through REST APIs.\n\nAt Bank of America I architected the Snowflake warehouse on Kimball star schemas across more than 15 source systems and owned over 200 Airflow DAGs, with zero compliance incidents across 500-plus users. At Citigroup I kept more than 150 Airflow and dbt pipelines at 99.8% accuracy and built Terraform and Jenkins automation that cut manual intervention by 50%.\n\nThis role is dbt Core on Snowflake with Airflow, next to application developers. That is the work I enjoy most.',
        long: 'I am a senior data engineer with 13 years of experience across financial services and healthcare. My core stack is SQL, Python, dbt Core, Snowflake and Airflow, and I focus on modular, reliable transformation pipelines.\n\nAt Wells Fargo I build dbt models and Python and SQL ELT that carry financial-risk definitions into reusable facts and dimensions on Snowflake star and snowflake schemas, with documented rules. I keep more than 40 production Airflow workflows reliable with Datadog SLA monitoring, quality checks and alerting, and I expose governed datasets to application teams through internal REST APIs.\n\nAt Bank of America I architected the Snowflake enterprise warehouse on Kimball star schemas from more than 15 source systems. I tuned query performance and storage cost with clustering and workload management, wrote the data-governance standard for PII and role-based access, and owned over 200 Airflow DAGs with Great Expectations checks. Zero compliance incidents across more than 500 analytical users.\n\nAt Citigroup I maintained more than 150 Airflow-orchestrated pipelines with dbt transformation layers at 99.8% accuracy, and built Terraform and Jenkins automation that cut manual intervention by 50%. Before that I built pipelines over 50-plus healthcare source systems at UnitedHealth Group.\n\nWhat attracts me here is dbt Core, Snowflake and Airflow combined with close work alongside application developers.',
        fu: [
          ['You have 13 years. This role asks for 3 to 5. Why this one?', 'Say it positively: "The scope matches what I want to do hands-on every day: dbt Core on Snowflake with Airflow, working with application teams. I am not looking to move into management. I bring depth, so I can design well and mentor, but I want to build."'],
          ['What is your strongest skill from that list?', 'Pick one with proof: "Designing Snowflake warehouses. At Bank of America I architected a Kimball-modelled warehouse over 15+ sources, and I can walk through the grain, keys, clustering and access model."']
        ],
        trap: 'Reciting every job in order for four minutes. Give two minutes: the present, two proof points with numbers, why this role.',
        real: 'Use only numbers that are true. If you are unsure of one, say "more than" or leave it out.'
      }),

      B.recap({
        id: 'm1-recap', n: 1, badge: 'Pipeline Mapper', color: '#BFDBFE',
        pts: [
          'Sources, Python, S3, Snowpipe, RAW, staging, intermediate, marts, consumers. Eight hops.',
          'Python **moves**. Snowflake **stores and computes**. dbt **defines**. Airflow **schedules**. CI/CD **ships**. Datadog **watches**.',
          'Business logic lives in **dbt intermediate models**, not in dashboards or API code.',
          'RAW is never edited. It is what makes replay and audit possible.'
        ],
        lines: [
          'dbt writes the instructions. Snowflake runs them.',
          'Load first, transform inside the warehouse. That is ELT.',
          'Tests are gates. A failed test stops everything after it.'
        ]
      })
    ]
  });
})();
