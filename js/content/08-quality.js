/* Mission 9: data quality, security, governance. */
(function () {
  var B = LAB.b;

  var TESTS = [
    'version: 2',
    '',
    'models:',
    '  - name: fct_loan_exposure',
    '    config:',
    '      contract:',
    '        enforced: true      # every column must be listed with a data_type',
    '    columns:',
    '      - name: loan_key',
    '        data_type: varchar',
    '        constraints:',
    '          - type: not_null',
    '        data_tests:',
    '          - unique',
    '          - not_null',
    '      - name: customer_key',
    '        data_type: number',
    '        data_tests:',
    '          - relationships:',
    "              to: ref('dim_customer')",
    '              field: customer_key',
    '      - name: outstanding_usd',
    '        data_type: number(18,2)',
    '        data_tests:',
    '          - dbt_utils.expression_is_true:',
    '              expression: ">= 0"',
    '              config:',
    '                severity: warn',
    '                store_failures: true',
    '      - name: risk_tier',
    '        data_type: varchar',
    '        data_tests:',
    '          - accepted_values:',
    "              values: ['LOW', 'MEDIUM', 'HIGH']"
  ].join('\n');

  var RBAC = [
    'USE ROLE SECURITYADMIN;',
    '',
    '-- Functional roles',
    'CREATE ROLE IF NOT EXISTS LOADER;',
    'CREATE ROLE IF NOT EXISTS TRANSFORMER;',
    'CREATE ROLE IF NOT EXISTS ANALYST;',
    'CREATE ROLE IF NOT EXISTS PII_READER;',
    '',
    '-- Least privilege: only what each role needs',
    'GRANT USAGE ON WAREHOUSE WH_TRANSFORM TO ROLE TRANSFORMER;',
    'GRANT USAGE ON DATABASE RISK_DB TO ROLE ANALYST;',
    'GRANT USAGE ON SCHEMA RISK_DB.MARTS TO ROLE ANALYST;',
    'GRANT SELECT ON ALL TABLES IN SCHEMA RISK_DB.MARTS TO ROLE ANALYST;',
    'GRANT SELECT ON FUTURE TABLES IN SCHEMA RISK_DB.MARTS TO ROLE ANALYST;',
    '',
    '-- Role hierarchy: PII_READER inherits everything ANALYST can do',
    'GRANT ROLE ANALYST TO ROLE PII_READER;',
    '',
    '-- Roles roll up to SYSADMIN so admins can manage objects; people get roles, not tables',
    'GRANT ROLE TRANSFORMER TO ROLE SYSADMIN;',
    'GRANT ROLE PII_READER TO USER jane_compliance;'
  ].join('\n');

  var BUGMASK = [
    'CREATE OR REPLACE MASKING POLICY governance.ssn_mask AS (val STRING)',
    '  RETURNS STRING ->',
    '  CASE',
    "    WHEN CURRENT_ROLE() = 'PII_READER' THEN val",
    "    ELSE 'XXX-XX-' || RIGHT(val, 4)",
    '  END;'
  ].join('\n');

  LAB.addChapter({
    id: 'm9', n: 9, title: 'Quality, security and governance', short: 'Quality + security', blurb: 'dbt tests, Great Expectations, RBAC, masking, lineage', minutes: 34,
    focus: ['raw', 'stg', 'int', 'mart', 'qual'],
    goals: [
      'Place **quality gates** at every stage and name the tool for each.',
      'Write **dbt tests** with severity and stored failures, and explain **contracts**.',
      'Design **RBAC** with functional roles and explain **masking** and its gotchas.',
      'Explain how you protect **PII and PHI**, and how you stay audit-ready.',
      'Defend your **99.8% accuracy** and **zero compliance incidents** claims.'
    ],
    say: 'Mission 9 covers data quality and security, the JD lines about testing, documentation, roles, access control and masking. It is also where your resume numbers get questioned, so we practise defending them.',
    scenes: [
      B.flow({
        id: 'm9-gates', title: 'Quality gates across the pipeline', g: 'quality', legend: false,
        steps: [
          { say: 'Quality is not one test at the end. There are four gates, one between each stage. Press Next to see what runs at each gate.', cap: 'A **gate** stops the pipeline when a check fails. Cheap checks run first, close to the source.' },
          { say: 'Gate one, on arrival. File counts and sizes, the schema, and row counts against the source. Great Expectations runs here on the raw data.', focus: ['q_src', 'g1', 'q_raw', 'c1'], on: ['p1', 'p2'], cap: 'Catch problems **before** transformation. This is where Great Expectations and reconciliation earn their keep.' },
          { say: 'Gate two, after cleaning. Source freshness, then unique, not_null and accepted_values tests on the staging models.', focus: ['q_raw', 'g2', 'q_stg', 'c2'], on: ['p3', 'p4'], cap: 'These tests prove the **dedupe worked** and the keys are safe to join on.' },
          { say: 'Gate three, before publish. Relationship tests, contracts, and reconciliation of totals. If this gate fails, the marts are not replaced.', focus: ['q_stg', 'g3', 'q_mart', 'c3'], on: ['p5', 'p6'], cap: 'The marts are what consumers trust. **Nothing publishes past a failed gate.**' },
          { say: 'Gate four, after publish. Monitors watch freshness lag, row counts against yesterday, and run duration, and alert the on-call person.', focus: ['q_mart', 'g4', 'q_con', 'c4'], on: ['p7', 'p8'], cap: 'Gate four does not block. It **notices** what the earlier gates could not predict.' }
        ]
      }),

      B.code({
        id: 'm9-tests', title: 'Tests, severity and contracts in YAML', file: 'models/marts/_marts.yml', lang: 'yaml', code: TESTS,
        note: '**Version note.** dbt 1.10 and later prefer test arguments nested under an `arguments:` key and warn about the older layout shown here, which many projects still use. Know both and match your team\'s dbt version.',
        steps: [
          { say: 'This one YAML file is the quality contract for the fact table. Press Next to go through it.', lines: null },
          { say: 'The contract. With enforced true, dbt checks that the built table has exactly these columns and types, and fails the build if not. That is what protects the API from silent shape changes. Every column must be listed.', lines: [4, 8] },
          { say: 'Primary key rules. unique and not_null. The constraint also asks Snowflake itself to enforce not null. Snowflake only enforces NOT NULL, so unique has to be a dbt test.', lines: [9, 15] },
          { say: 'A relationships test: every customer_key must exist in dim_customer. It finds orphans before a BI user does.', lines: [16, 21] },
          { say: 'A soft rule. Outstanding balance should not be negative, but we only warn. store_failures saves the offending rows into a table you can query to investigate.', lines: [22, 29] },
          { say: 'accepted_values keeps the category set honest. A new tier from upstream fails the test instead of silently appearing in reports.', lines: [30, 34] }
        ]
      }),

      B.talk({
        id: 'm9-debug', title: 'A test failed. Four moves',
        say: 'You will be asked how you debug a failed test. Four moves, in this order.',
        items: [
          ['1. Read the failure line', 'It names the test, the model and the number of failing rows: "Got 3 results, configured to fail if != 0". Three rows is a data issue. Three million is a pipeline issue.', 'Move one: read the count. Scale tells you what kind of problem it is.'],
          ['2. See the failing rows', 'Open the compiled test SQL under `target/compiled` and run it in a worksheet, or query the table created by `store_failures`.', 'Move two: look at the actual rows.'],
          ['3. Trace upstream', 'Use the lineage graph or `dbt ls --select +model` to find where the problem entered. Check staging first: are keys duplicated at the source?', 'Move three: find where it entered, not where it showed up.'],
          ['4. Fix at the right layer', 'Fix the cause, then **add a test upstream** so next time it fails close to the source. Decide the severity: hard rule blocks, soft rule warns with a threshold.', 'Move four: fix, then move the test closer to the cause.']
        ]
      }),

      B.cmp({
        id: 'm9-tools', title: 'dbt tests, Great Expectations, reconciliation, monitors',
        say: 'Your resume lists dbt tests, Great Expectations and reconciliation. Know what each is for. Press Next for each row.',
        cols: ['', 'dbt tests', 'Great Expectations', 'Reconciliation', 'Monitors'],
        rows: [
          ['Checks', 'Keys, nulls, accepted values, relationships, custom SQL rules on built models', 'Schema, ranges and distributions on raw files and tables', 'Row counts and totals between source and target, per partition', 'Trends: freshness lag, row count anomalies, run duration'],
          ['Runs', 'Inside dbt build, right after each model', 'As an Airflow task on RAW or landing data', 'As a task after loads and after the marts', 'Continuously, outside the pipeline'],
          ['Blocks the pipeline?', 'Yes, with error severity', 'Yes, the task fails', 'Yes, the task fails', 'No. It alerts']
        ],
        steps: [
          { upto: 1, say: 'What each one checks. dbt tests check built models. Great Expectations checks incoming data. Reconciliation compares source and target.' },
          { upto: 2, say: 'Where each one runs. Different points in the pipeline, so they complement each other.' },
          { upto: 3, say: 'Which ones block. Three can stop the pipeline. Monitors only tell you.' }
        ],
        pick: 'Use **all four, each at its own point**: Great Expectations and reconciliation on arrival, dbt tests on each layer, reconciliation on the marts, monitors for trends.'
      }),

      B.flow({
        id: 'm9-rbac', title: 'Role-based access control', g: 'rbac', legend: false,
        steps: [
          { say: 'Access in Snowflake is built from roles. People and services connect with a role, and the role holds the privileges. Read the picture left to right: who, which role, what it can do.', cap: 'Rule: **grant privileges to roles, grant roles to users.** Never grant tables to individual people.' },
          { say: 'Two service accounts. Airflow ingestion uses the LOADER role, which can only write RAW. dbt uses TRANSFORMER, which can read RAW and build staging and marts.', focus: ['c0', 'c1', 'c2', 'u1', 'u2', 'r1', 'r2', 'p1', 'p2'], on: ['u1>r1', 'r1>p1', 'u2>r2', 'r2>p2'], cap: '**Least privilege.** The loader cannot read marts. dbt cannot touch other databases.' },
          { say: 'Analysts use ANALYST, which reads the marts with PII columns masked. Compliance uses PII_READER, which inherits everything ANALYST can do and also sees PII in clear text.', focus: ['c0', 'c1', 'c2', 'u3', 'u4', 'r3', 'r4', 'p3', 'p4'], on: ['u3>r3', 'r3>p3', 'u4>r4', 'r4>p4', 'r3>r4'], cap: 'Role **inheritance** keeps it simple: PII_READER = ANALYST plus one extra right.' },
          { say: 'The REST API has its own role and its own small warehouse, and can read the marts only. If the API is compromised, nothing else is exposed.', focus: ['c0', 'c1', 'c2', 'u5', 'r5', 'p5'], on: ['u5>r5', 'r5>p5'], cap: 'One role per **workload**. That also gives you per-workload cost and audit trails.' }
        ]
      }),

      B.sql({
        id: 'm9-rbac-sql', title: 'The grants behind the role picture', file: 'worksheet: roles_and_grants.sql', code: RBAC,
        ctx: { role: 'SECURITYADMIN', wh: 'none needed', db: 'account level' },
        steps: [
          { say: 'This is the SQL behind the role picture. Press Next.', lines: null },
          { say: 'Functional roles, created by the security admin role. Not by ACCOUNTADMIN, which should hardly ever be used for daily work.', lines: [3, 7] },
          { say: 'Least privilege grants. Note the FUTURE TABLES line: new tables dbt creates later automatically inherit the read grant, even after a rebuild.', lines: [9, 14] },
          { say: 'Hierarchy. Granting a role to another role makes the second role inherit it. PII_READER now has all ANALYST rights.', lines: [16, 17] },
          { say: 'Roles roll up to SYSADMIN so administrators can manage the objects. People receive roles, never table grants.', lines: [19, 21] }
        ],
        note: '**System roles to know:** ACCOUNTADMIN (top, use rarely), SECURITYADMIN (manages grants), USERADMIN (users and roles), SYSADMIN (creates objects). Pair roles with SSO and MFA for people and **key-pair authentication** for service users.'
      }),

      B.widget({ id: 'm9-mask', title: 'Dynamic data masking', kind: 'mask' }),

      B.talk({
        id: 'm9-pii', title: 'Protecting PII and PHI',
        say: 'Resume: you wrote the governance standard for PII at Bank of America, and you handled PHI at UnitedHealth. Here are the controls to name. Press Next.',
        items: [
          ['Classify and tag', 'Tag columns (SSN, email, health data). **Tag-based masking** applies a policy to every column carrying the tag, so a new tagged column is protected automatically.', 'Control one: classify and tag, so protection follows the tag.'],
          ['Mask and filter', '**Dynamic masking policies** hide values by role. **Row access policies** filter rows by role, for example each region sees its own. **Secure views** hide the definition and prevent leaks through the optimizer.', 'Control two: mask values, filter rows.'],
          ['Authenticate properly', 'SSO and MFA for people. **Key-pair** or OAuth for services. Network policies restrict where connections may come from.', 'Control three: strong authentication and network limits.'],
          ['Audit', '`ACCESS_HISTORY` shows who read which columns. `QUERY_HISTORY` shows every statement. Alert on unusual access, such as a bulk read of PII columns.', 'Control four: you can prove who saw what.'],
          ['Minimize', 'Do not carry PII downstream if analytics does not need it. Use hashed or tokenized identifiers in the marts.', 'Control five: the safest PII is the PII you never copied.'],
          ['Know the limits', 'PHI under HIPAA needs the right Snowflake edition and agreements, and strict access reviews. Encryption at rest and in transit is on by default.', 'Control six: be honest about edition and compliance requirements.']
        ],
        cols: 2
      }),

      B.talk({
        id: 'm9-lineage', title: 'Lineage, documentation and schema change', opt: false,
        say: 'Audit-ready means you can answer three questions: what changed, who approved it, and where did this number come from.',
        items: [
          ['Lineage and docs from dbt', '`dbt docs generate` publishes model and column descriptions with a lineage graph. `persist_docs` copies descriptions into Snowflake comments. Exposures list the dashboards and APIs that use each model.', 'Lineage tells you where a number came from.'],
          ['Versioned schema changes', 'dbt in Git owns the transformed layers: every change is a reviewed pull request. **Liquibase** changelogs own the DDL dbt does not manage, such as landing tables, stages, pipes, policies and grants, so every schema change is versioned and reversible.', 'Git plus Liquibase gives you a full change history.'],
          ['Expand and contract', 'For a breaking change, add the new column or model version **next to** the old one, move consumers, then retire the old one after a deprecation window. dbt **contracts** and **model versions** make this explicit for consumers.', 'Never break consumers in one step.'],
          ['Rollback plan', 'Revert the pull request and rerun the build. For data, use Time Travel or a clone to restore. Write the steps down before the change, not after.', 'Every change ships with a way back.']
        ],
        cols: 2
      }),

      B.quiz({
        id: 'm9-q1', q: 'Which dbt test finds a loan whose `customer_key` does not exist in `dim_customer`?',
        opts: ['unique', 'not_null', 'accepted_values', 'relationships'], ok: 3,
        why: '`relationships` is the **foreign key check**. It lists child rows whose key has no match in the parent table. `unique` and `not_null` check a single column, and `accepted_values` checks a fixed list.'
      }),

      B.quiz({
        id: 'm9-q2', q: 'A dbt test with `severity: warn` finds 5 failing rows during `dbt build`. What happens?',
        opts: [
          { t: 'The build fails and downstream models are skipped', fb: 'That is what severity error does.' },
          { t: 'dbt prints a WARN and carries on building downstream models', fb: '' },
          { t: 'dbt deletes the 5 rows', fb: 'dbt never modifies data to fix a test.' },
          { t: 'The test is ignored and not shown', fb: 'Warnings are shown in the log and in run_results.json.' }
        ],
        ok: 1, why: 'A warn is logged and recorded in `run_results.json`, but the build continues. Use it for **soft rules**. Use **error** for rules that must block, such as key uniqueness.'
      }),

      B.bug({
        id: 'm9-bug', q: 'Compliance complains: a manager whose role inherits PII_READER sees masked SSNs, and teams started granting PII_READER everywhere as a workaround. Which line is the cause?',
        file: 'governance/masking_policies.sql', lang: 'sql', code: BUGMASK, bad: [4],
        why: '`CURRENT_ROLE()` compares only the **active role name**. It ignores the role hierarchy and secondary roles. Use **`IS_ROLE_IN_SESSION(\'PII_READER\')`**, which is true when the role is active or inherited, so access follows your role design instead of exact names.',
        fix: "CREATE OR REPLACE MASKING POLICY governance.ssn_mask AS (val STRING)\n  RETURNS STRING ->\n  CASE\n    WHEN IS_ROLE_IN_SESSION('PII_READER') THEN val\n    ELSE 'XXX-XX-' || RIGHT(val, 4)\n  END;",
        hint: 'Which function is aware of role inheritance?'
      }),

      B.decide({
        id: 'm9-dec', title: 'Architecture decision: block or warn?',
        scenario: 'A new test finds **4 loans out of 3 million** with a negative outstanding balance in the marts. The risk report publishes at **08:00**. The business says it is probably a source glitch. Do you block the build?',
        opts: [
          { t: 'Error on any row. Block publication.', d: 'Strict. The build fails whenever one row breaks the rule.', lose: 'Four rows out of three million would block the whole report for a glitch the business calls minor. People then learn to ignore or disable tests.' },
          { t: 'Warn only. Always publish.', d: 'Never block on this rule.', lose: 'If 40 percent of rows were negative next week, the pipeline would still publish. You have no safety net for a real problem.' },
          { t: 'Use thresholds: warn above 0 rows, error above a materiality limit, store the failures and alert the owner', d: '`warn_if` and `error_if` with `store_failures`.' },
          { t: 'Delete the test', d: 'Remove the noise.', lose: 'You lose the signal. A test that finds a real issue is doing its job.' }
        ],
        pick: 2,
        why: 'Quality rules need a **materiality threshold**. Four rows warn and are stored for the data owner. A hundred or a large percentage blocks the publish. That protects the report without turning every glitch into an incident.',
        when: 'Use **plain error** for rules that are never acceptable to break: key uniqueness, not-null keys, referential integrity. Use **warn** for soft, statistical rules during their first weeks, while you learn what normal looks like.'
      }),

      B.qa({
        id: 'qa-dq', tag: 'Quality', secs: 75,
        q: 'How do you implement data quality in your pipelines?',
        pts: ['Gates at every stage, not one test at the end', 'On arrival: Great Expectations and reconciliation', 'dbt: freshness, unique, not_null, accepted_values, relationships, contracts', 'Severity levels: soft rules warn, hard rules block', 'Monitors after publish: freshness lag, row counts', 'Failed gates keep yesterday\'s good data. Owners and runbooks. Resume: 99.8%, zero incidents'],
        short: 'I put quality gates at every stage instead of one test at the end. On arrival, Great Expectations and reconciliation checks verify file counts, schema and row counts against the source. In dbt I use source freshness, unique, not_null, accepted_values and relationship tests on every key, contracts on the marts, and severity levels so soft rules warn and hard rules block. After publishing, monitors in Datadog watch freshness lag and row-count anomalies.\n\nFailed checks stop downstream tasks, so consumers keep yesterday\'s good data, and every failure has an owner and a runbook. At Citigroup this kept more than 150 pipelines at 99.8% accuracy, and at Bank of America the 200-plus DAGs I owned carried Great Expectations checks, with zero compliance incidents across 500-plus users.',
        fu: [
          ['How do you decide what to test?', 'Every primary key gets unique and not_null. Every foreign key gets a relationships test. Every enumerated column gets accepted_values. Then business rules from the stakeholders, such as balances not negative. Start with these, add tests when an incident teaches you a new one.'],
          ['What is a model contract?', 'A contract with enforced true declares column names and data types. dbt fails the build if the built table does not match, which protects consumers from silent shape changes.'],
          ['How do you avoid alert fatigue?', 'Severity levels and thresholds, one owner per check, and removing or retuning noisy tests. A test nobody trusts gets ignored.']
        ],
        trap: 'Listing tools without saying where each one sits and what happens on failure. Describe the **gate**, the **action** and the **owner**.'
      }),

      B.qa({
        id: 'qa-accuracy', tag: 'Resume probe', secs: 60,
        q: 'Your resume says the Citigroup pipelines held 99.8% data accuracy. How was that measured?',
        pts: ['A clear definition: what is counted', 'Control totals: row counts and sums vs source', 'Great Expectations rules inside the workflow', 'Tracked over time, failures owned and root-caused', 'Failed checks held data back from consumers'],
        short: 'We defined accuracy as the share of automated reconciliation and validation checks that matched without manual correction. For each load, the pipeline compared control totals with the source: row counts, sums of key measures and key uniqueness. Great Expectations validated schema and value rules inside the workflow. The 99.8% was the proportion of those checks passing first time across the 150-plus pipelines, tracked over time, and every failure had an owner and a root cause. When a check failed, the data was held back from the investment-reporting consumers until it was fixed.',
        fu: [
          ['What was in the 0.2%?', 'Typical causes were late source files, upstream format changes and duplicate source records. Each had a root cause and a fix, for example a new schema check or a dedupe rule, so the same failure did not repeat.'],
          ['How did you prove it to the business?', 'A dashboard of check results per pipeline, plus the reconciliation reports that investment reporting could audit.']
        ],
        trap: 'Repeating a definition you cannot back up. A made-up definition collapses at the first follow-up.',
        real: 'I do not know how you measured 99.8%. **Replace my definition with the true one.** If you cannot reconstruct it, say what you can stand behind, such as "the share of automated reconciliation checks that passed without manual correction", and only if that matches what you did.'
      }),

      B.qa({
        id: 'qa-pii', tag: 'Security', secs: 75,
        q: 'How do you secure PII and PHI in Snowflake?',
        pts: ['RBAC: functional roles, least privilege, future grants, PII_READER', 'Dynamic masking, tag-based, IS_ROLE_IN_SESSION', 'Row access policies and secure views', 'SSO and MFA for people, key-pair for services, network policies', 'Audit: ACCESS_HISTORY, QUERY_HISTORY', 'Minimize PII downstream. Resume: governance standard, zero incidents'],
        short: 'I protect PII in layers. Access: role-based control with functional roles, least privilege, future grants, and a PII_READER role that only compliance and a few services get. Masking: dynamic masking policies on sensitive columns, ideally tag-based so a new column tagged as SSN is protected automatically, using IS_ROLE_IN_SESSION so role hierarchy works. Row access policies where data is partitioned by business unit.\n\nAuthentication: SSO and MFA for people, key-pair for services, network policies. Audit: ACCESS_HISTORY and QUERY_HISTORY show who read what. And I minimize PII downstream, with hashed or tokenized identifiers in marts wherever possible.\n\nAt Bank of America I wrote the data-governance standard for PII handling and role-based access, with zero compliance incidents across more than 500 analytical users. The same controls applied to PHI at UnitedHealth Group.',
        fu: [
          ['How do masking policies behave with dbt?', 'dbt rebuilds tables with CREATE OR REPLACE, which drops policies attached by hand. I re-attach with a post-hook or use tag-based masking driven from dbt, and apply grants through the `grants` config.'],
          ['What is a row access policy?', 'A policy that decides which rows a role can see, for example each regional team sees only its region. It is evaluated at query time like a masking policy.'],
          ['How do you audit access?', 'ACCESS_HISTORY records column-level reads, and QUERY_HISTORY records statements. I alert on unusual patterns such as a bulk read of PII columns by a role that normally does not.']
        ],
        trap: 'Describing masking only. Security is **access, masking, authentication, audit and minimization**, together.'
      }),

      B.qa({
        id: 'qa-schema', tag: 'Governance', secs: 60,
        q: 'How do you manage schema changes?',
        pts: ['Ownership: dbt in Git for transformed layers, Liquibase for DDL', 'Every change: ticket, pull request, review, CI', 'Expand and contract for breaking changes', 'Contracts and model versions protect consumers', 'Rollback plan: revert PR, rerun, Time Travel'],
        short: 'I separate who owns what. dbt in Git owns the transformed layers, so changes are pull requests with CI. Liquibase changelogs own the DDL that dbt does not manage: landing tables, stages, pipes, policies and grants, so every schema change is versioned, reviewed and reversible.\n\nFor breaking changes I use expand and contract: add the new column or model version next to the old one, migrate consumers, then retire the old one after a deprecation window. dbt contracts on public models fail the build if the shape changes unexpectedly, and model versions let two shapes coexist.\n\nEvery change has a ticket, a reviewer, lineage documentation and a rollback plan: revert the pull request, rerun, and use Time Travel if data needs restoring.',
        fu: [
          ['How do you roll back a bad dbt deploy?', 'Revert the pull request and rerun the production build. For incremental tables that were corrupted, restore from Time Travel or a clone and rebuild forward.'],
          ['What are dbt model versions?', 'A model can declare versions, for example v1 and v2, with different columns. Consumers pin a version and get a deprecation date, so a breaking change does not surprise anyone.']
        ]
      }),

      B.recap({
        id: 'm9-recap', n: 9, badge: 'Quality Guardian', color: '#FECACA',
        pts: [
          'Four gates: **arrival**, **after cleaning**, **before publish**, **after publish**. A failed gate keeps yesterday\'s good data in place.',
          'dbt tests: unique, not_null, accepted_values, relationships, plus **contracts**. `severity`, thresholds and `store_failures` for soft rules.',
          'RBAC: privileges to roles, roles to users. **Future grants**. System roles each have one job.',
          'Masking: use `IS_ROLE_IN_SESSION`. dbt table rebuilds drop policies, so **re-attach** them.',
          'Governance: Git plus Liquibase, expand and contract, a rollback plan for every change.'
        ],
        lines: [
          'I put quality gates at every stage, and a failed gate stops the chain.',
          'Soft rules warn with thresholds. Hard rules block. Every check has an owner.',
          'I grant privileges to roles, never tables to people, and I minimize PII downstream.'
        ]
      })
    ]
  });
})();
