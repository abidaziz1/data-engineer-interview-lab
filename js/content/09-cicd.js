/* Mission 10: Git, CI/CD, Docker, Terraform, Agile, and working with application developers. */
(function () {
  var B = LAB.b;

  var GHA = [
    'name: dbt-ci',
    'on:',
    '  pull_request:',
    '    paths: ["models/**", "macros/**", "seeds/**", "snapshots/**", "tests/**", "dbt_project.yml"]',
    '',
    'jobs:',
    '  build:',
    '    runs-on: ubuntu-latest',
    '    env:',
    '      SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}',
    '      SNOWFLAKE_USER: ${{ secrets.DBT_CI_USER }}',
    '      SNOWFLAKE_PRIVATE_KEY: ${{ secrets.DBT_CI_KEY }}',
    '      DBT_CI_SCHEMA: dbt_ci_pr_${{ github.event.number }}',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: actions/setup-python@v5',
    '        with:',
    '          python-version: "3.11"',
    '      - run: pip install -r requirements.txt',
    '      - run: dbt deps',
    '      - run: sqlfluff lint models --dialect snowflake',
    '      - uses: aws-actions/configure-aws-credentials@v4',
    '        with:',
    '          role-to-assume: ${{ secrets.CI_AWS_ROLE }}',
    '          aws-region: us-east-1',
    '      - run: aws s3 cp s3://dbt-artifacts/prod/manifest.json prod_state/manifest.json',
    '      - run: dbt build --select state:modified+ --defer --state prod_state --target ci',
    '      - if: always()',
    '        run: dbt run-operation drop_ci_schema --target ci'
  ].join('\n');

  var DOCKER = [
    'FROM python:3.11-slim',
    '',
    'WORKDIR /opt/dbt/risk_platform',
    '',
    '# requirements.txt pins dbt-core and dbt-snowflake to exact versions',
    'COPY requirements.txt .',
    'RUN pip install --no-cache-dir -r requirements.txt',
    '',
    'COPY . .',
    'RUN dbt deps',
    '',
    'ENTRYPOINT ["dbt"]',
    'CMD ["build", "--target", "prod"]'
  ].join('\n');

  var JENKINS = [
    'pipeline {',
    "  agent { docker { image 'risk-dbt:latest' } }",
    '  environment {',
    "    SNOWFLAKE_ACCOUNT = credentials('snowflake-account')",
    '    DBT_CI_SCHEMA = "dbt_ci_${env.CHANGE_ID}"',
    '  }',
    '  stages {',
    "    stage('Lint')  { steps { sh 'sqlfluff lint models --dialect snowflake' } }",
    "    stage('Build') { steps { sh 'dbt build --select state:modified+ --defer --state prod_state --target ci' } }",
    '  }',
    "  post { always { sh 'dbt run-operation drop_ci_schema --target ci' } }",
    '}'
  ].join('\n');

  function ciLines() {
    var pre = [
      { c: 'cmd', t: '$ sqlfluff lint models --dialect snowflake', d: 500 },
      { c: 'ok', t: 'All Finished. 14 files, 0 violations.', d: 400 },
      { c: 'cmd', t: '$ dbt build --select state:modified+ --defer --state prod_state --target ci', d: 500 },
      { c: 'dim', t: 'Comparing against prod_state/manifest.json ... 1 modified model: int_loan_exposure', d: 450 },
      { c: 'dim', t: 'Selected with children: 7 of 20 nodes. The rest resolve to PRODUCTION tables (deferred).', d: 600 }
    ];
    var body = LAB.Term.dbt('dbt build --select state:modified+ --defer --state prod_state --target ci', [
      { kind: 'table', name: 'int_loan_exposure', schema: 'dbt_ci_pr_42', ms: 3100, node: 'int_exp', res: 'ok' },
      { kind: 'test', name: 'not_null_int_loan_exposure_expected_loss_usd', ms: 480, res: 'ok' },
      { kind: 'incremental', name: 'fct_loan_exposure', schema: 'dbt_ci_pr_42', ms: 3900, node: 'fct_exp', res: 'ok' },
      { kind: 'test', name: 'unique_fct_loan_exposure_loan_key', ms: 600, res: 'ok' },
      { kind: 'test', name: 'not_null_fct_loan_exposure_risk_tier', ms: 380, res: 'ok' },
      { kind: 'table', name: 'mart_risk_summary', schema: 'dbt_ci_pr_42', ms: 1500, node: 'mart_sum', res: 'ok' },
      { kind: 'test', name: 'not_null_mart_risk_summary_segment', ms: 390, res: 'ok' }
    ], { target: 'ci', found: 'Found 9 models, 2 seeds, 1 snapshot, 8 data tests, 4 sources, 2 exposures', total: '14.30' });
    return pre.concat(body.slice(5));
  }

  LAB.addChapter({
    id: 'm10', n: 10, title: 'CI/CD, Git, Docker and Agile', short: 'CI/CD + Agile', blurb: 'Slim CI, deploys, Docker, Jira, app developers', minutes: 30,
    focus: ['ci', 'stg', 'int', 'mart'],
    goals: [
      'Walk a change from **branch to production** with slim CI and isolated schemas.',
      'Explain **`state:modified+`, `--defer`** and **atomic promotion**.',
      'Show where **Docker, Terraform, Jenkins, GitLab and GitHub Actions** fit.',
      'Describe **Agile and Jira** habits and how you work with **application developers**.',
      'Explain how you use **Claude and Claude Code** responsibly.'
    ],
    say: 'Mission 10 covers the delivery bar at the bottom of the map, plus the teamwork the JD stresses: Agile, Jira, application developers, product managers. Interviewers weigh these heavily for senior roles.',
    scenes: [
      B.flow({
        id: 'm10-flow', title: 'A change travels to production', g: 'ci', legend: false,
        steps: [
          { say: 'This is the path of one change, from your laptop to production. Seven hops. The yellow pill is pull request 42. Press Next.', cap: 'Every change takes the **same path**. No exceptions, no manual changes in production.' },
          { say: 'Hop 1. You work on a feature branch and build in your own dev schema. Then you open a pull request linked to the Jira ticket.', focus: ['dev', 'pr'], on: ['c1'], pill: { edge: 'c1', label: 'PR 42' }, cap: 'Dev schema per developer, for example `dbt_priya`. You never build into shared or production schemas.' },
          { say: 'Hop 2. Opening the pull request starts CI automatically.', focus: ['pr', 'ci'], on: ['c2'], pill: { edge: 'c2', label: 'PR 42' }, cap: 'CI is triggered only when dbt files change.' },
          { say: 'Hop 3. CI lints the SQL, then runs a slim build: only changed models and their children, in a schema created for this pull request, with the tests.', focus: ['ci', 'rev'], on: ['c3'], pill: { edge: 'c3', label: 'PR 42' }, cap: 'Schema `dbt_ci_pr_42`. Parents that did not change are read from production, so CI takes minutes.' },
          { say: 'Hop 4. A reviewer reads the SQL diff, the lineage impact and the test results, and approves or asks for changes.', focus: ['rev', 'mrg'], on: ['c4'], pill: { edge: 'c4', label: 'PR 42' }, cap: 'Review checks **definitions and impact**, not just syntax.' },
          { say: 'Hop 5. After approval, merge to main. The temporary CI schema is dropped.', focus: ['mrg', 'cd'], on: ['c5'], pill: { edge: 'c5', label: 'PR 42' }, cap: 'Merge is the only way into production.' },
          { say: 'Hop 6. The deploy job runs dbt build in production, publishes the docs, and saves the new manifest, which the next CI run compares against.', focus: ['cd', 'prod'], on: ['c6'], pill: { edge: 'c6', label: 'PR 42' }, cap: 'The saved **manifest** is what makes slim CI possible.' },
          { say: 'Hop 7. Datadog watches the result. If the SLA slips or a run fails, the on-call engineer is alerted.', focus: ['prod', 'mon'], on: ['c7'], pill: { edge: 'c7', label: 'PR 42' }, cap: 'Delivery does not end at deploy. **Monitoring closes the loop.**' }
        ]
      }),

      B.code({
        id: 'm10-gha', title: 'The CI workflow', file: '.github/workflows/dbt-ci.yml', lang: 'yaml', code: GHA,
        steps: [
          { say: 'This is the CI workflow in GitHub Actions. Jenkins and GitLab CI do the same thing in different syntax. Press Next.', lines: null },
          { say: 'Trigger on pull requests, and only when dbt files changed.', lines: [2, 4] },
          { say: 'Secrets come from the CI secret store, never from the repo. The CI user authenticates with a key pair. The schema name includes the pull request number, so every PR gets its own.', lines: [9, 13] },
          { say: 'Set up Python, install pinned dependencies, and install dbt packages.', lines: [15, 20] },
          { say: 'Lint the SQL with SQLFluff. Style problems fail fast, before any warehouse time is spent.', lines: [21, 21] },
          { say: 'Fetch the production manifest from the last deploy. Credentials come from a short-lived role, not stored keys.', lines: [22, 26] },
          { say: 'The slim build. State modified plus children, defer to production for everything else, build into the CI target with tests.', lines: [27, 27] },
          { say: 'Always drop the PR schema at the end, even when the build failed, so abandoned schemas do not pile up and cost storage.', lines: [28, 29] }
        ]
      }),

      B.term({
        id: 'm10-ci', title: 'A slim CI run', g: 'lineage', initial: {}, lines: ciLines,
        say: 'Here is what that workflow does on a real pull request that changed one model. Watch the graph. Only a few nodes light up.',
        doneSay: 'Seven nodes built, three models and four tests, in about fourteen seconds of warehouse time. The other thirteen nodes were never touched. That is the point of slim CI.',
        after: 'A full build of this project takes minutes. A slim build takes seconds because **state:modified+** selects the change and its children, and **--defer** reads untouched parents from production.'
      }),

      B.talk({
        id: 'm10-slim', title: 'Slim CI in plain words',
        say: 'Six ideas explain how this works. Say them in your own words. Press Next.',
        items: [
          ['`state:modified+`', 'Compare this branch with the saved **production manifest**. Select models that changed, plus everything downstream (the plus).', 'One: build only what changed and what depends on it.'],
          ['`--defer --state`', 'Unchanged parents are **not rebuilt**. dbt reads them from production tables instead. CI touches a few models, not the whole project.', 'Two: borrow unchanged parents from production.'],
          ['One schema per pull request', '`dbt_ci_pr_42` is created for the run and dropped afterwards. Two pull requests cannot overwrite each other, and none can touch production.', 'Three: isolation per pull request.'],
          ['A restricted CI role', 'The CI user can write only to CI schemas and read production. Key-pair authentication, secrets in the CI secret store.', 'Four: least privilege applies to CI too.'],
          ['Alternative: zero-copy clone', '`CREATE DATABASE ci_db CLONE prod_db` gives CI a full writable copy in seconds, with no extra storage until data changes.', 'Five: a clone gives CI a full copy instantly.'],
          ['Atomic promotion', 'For critical marts, build into a staging schema and `ALTER SCHEMA ... SWAP WITH` the live one. Consumers never see a half-built mart.', 'Six: swap, so consumers never see half-built tables.']
        ],
        cols: 2
      }),

      B.code({
        id: 'm10-docker', title: 'Docker: one image everywhere', file: 'Dockerfile', lang: 'docker', code: DOCKER,
        steps: [
          { say: 'The Dockerfile for the dbt image. Press Next. The point: the same image runs on a laptop, in CI, and in Airflow.', lines: null },
          { say: 'A slim Python base and a working folder for the project.', lines: [1, 3] },
          { say: 'Install from a requirements file with exact version pins. A build today equals a build next month. Copying requirements first lets Docker cache this layer.', lines: [5, 7] },
          { say: 'Copy the project and install the dbt packages at build time, so containers start fast.', lines: [9, 10] },
          { say: 'The entrypoint is dbt itself, with a default command. Airflow can launch it with DockerOperator or KubernetesPodOperator and pass different arguments.', lines: [12, 13] }
        ],
        note: '**Why Docker:** pinned versions, identical runtime in dev, CI and production, and isolation from Airflow\'s own dependencies. Your resume lists Docker for container-based development.'
      }),

      B.code({
        id: 'm10-jenkins', title: 'The same pipeline in Jenkins', file: 'Jenkinsfile', lang: 'groovy', code: JENKINS, opt: true,
        steps: [
          { say: 'Your resume lists Jenkins at Citigroup. This is the same CI idea as a Jenkinsfile. The stages and the commands are identical to the GitHub version.', lines: null },
          { say: 'Run inside the dbt image, bind secrets from the Jenkins credentials store, and name the CI schema after the change number.', lines: [2, 6] },
          { say: 'Two stages: lint, then the slim build.', lines: [8, 9] },
          { say: 'The post block runs always, so the PR schema is dropped even when a stage fails.', lines: [11, 11] }
        ]
      }),

      B.cmp({
        id: 'm10-tools', title: 'Jenkins, GitLab CI/CD and GitHub Actions', opt: true,
        say: 'Your resume lists all three. They do the same job. Know one deeply and the differences of the others.',
        cols: ['', 'Jenkins', 'GitLab CI/CD', 'GitHub Actions'],
        rows: [
          ['Pipeline file', 'Jenkinsfile (Groovy)', '.gitlab-ci.yml', '.github/workflows/*.yml'],
          ['Runs on', 'Agents you operate', 'Shared or self-managed runners', 'GitHub-hosted or self-hosted runners'],
          ['Secrets', 'Credentials store', 'CI/CD variables (masked, protected)', 'Repository and environment secrets'],
          ['Good for', 'Large enterprise setups with custom plugins and legacy estates', 'One platform for repo, CI and registry', 'Quick start for teams already on GitHub']
        ],
        pick: 'The **stages are the same everywhere**: lint, slim build with tests, review gate, deploy, save the manifest. Say that, and the tool becomes a detail.'
      }),

      B.talk({
        id: 'm10-env', title: 'Environments, Git and Terraform',
        say: 'Three habits that make delivery boring, which is the goal. Press Next.',
        items: [
          ['Three environments', '**DEV**: a schema per developer. **CI**: a schema per pull request. **PROD**: only the deploy job writes there. Targets in `profiles.yml` switch between them.', 'Three environments, each isolated.'],
          ['Git workflow', 'Short-lived feature branches, a protected main branch, pull requests with required review and green CI, squash merge, tickets referenced in commits.', 'Protected main. Everything through a pull request.'],
          ['Terraform for infrastructure', 'S3 buckets, IAM roles and Snowflake objects such as warehouses and roles are defined in code, reviewed and applied the same way as dbt. Your Citigroup Terraform and Jenkins automation cut **manual intervention by 50%**.', 'Infrastructure as code removes manual steps.'],
          ['Secrets', 'Never in Git. CI secret store or a secrets manager. Key-pair auth for service users. Rotate on a schedule.', 'Secrets live in a vault, not in a repo.']
        ],
        cols: 2
      }),

      B.talk({
        id: 'm10-agile', title: 'Agile, Jira and application developers',
        say: 'The JD mentions Agile ceremonies, Jira, application developers, UI engineers and product managers. These are the habits to describe. Press Next.',
        items: [
          ['Definition of done for data', 'A story is done when it has **tests, documentation, a reviewed pull request, green CI**, updated lineage, and the consumers have been told.', 'Done means tested, documented, reviewed.'],
          ['Slice stories small', 'One model or one metric definition per story. Spikes for unknowns. Stories that fit a sprint, and a visible demo at the end.', 'Small stories ship value every sprint.'],
          ['A contract with application developers', 'Agree the API shape, fields, freshness and ownership **before** building. Record it as a dbt contract and an exposure. Announce breaking changes early and use expand and contract.', 'Treat app developers as consumers with a contract.'],
          ['Definitions with analysts and product managers', 'Agree each metric definition in writing before building. Most data disputes are definition disputes, so settle them upfront.', 'Settle the definition first. It prevents the argument later.'],
          ['Jira hygiene', 'Every pull request links to a ticket. Estimates are honest. Blockers are raised at stand-up, not at the end of the sprint.', 'Traceability from ticket to pull request to deploy.']
        ],
        cols: 2
      }),

      B.order({
        id: 'm10-ord', q: 'Put the delivery steps in order.',
        items: ['Developer builds in a personal dev schema', 'Open a pull request linked to the Jira ticket', 'CI lints and compiles the project', 'CI builds changed models and children with tests in a PR schema', 'Reviewer approves the pull request', 'Merge to main', 'Deploy job runs dbt build in PROD and saves the manifest'],
        why: 'Develop, propose, verify automatically, review, merge, deploy, record state. Production is only touched by the last step.'
      }),

      B.quiz({
        id: 'm10-q1', q: 'What does `--defer` do in a CI build?',
        opts: [
          { t: 'It delays the build until the evening', fb: 'Defer has nothing to do with timing.' },
          { t: 'It reads unchanged parent models from production instead of rebuilding them', fb: '' },
          { t: 'It skips all tests', fb: 'Tests still run on the models that are built.' },
          { t: 'It deletes old schemas', fb: 'Schema cleanup is a separate step, such as a run-operation macro.' }
        ],
        ok: 1, why: '`--defer` with `--state` points unchanged references at the **production relations** recorded in the saved manifest. CI builds a handful of models, not the whole project.'
      }),

      B.quiz({
        id: 'm10-q2', q: 'Why does each pull request get its own schema, such as `dbt_ci_pr_42`?',
        opts: [
          { t: 'Snowflake limits each schema to one user', fb: 'Snowflake has no such limit.' },
          { t: 'Isolation: parallel pull requests cannot overwrite each other, and none can touch production', fb: '' },
          { t: 'It makes queries run faster', fb: 'Schema names do not affect speed.' },
          { t: 'dbt requires it', fb: 'dbt does not require it. It is a good practice you add.' }
        ],
        ok: 1, why: 'Isolation per pull request. Two engineers can test at once, a broken branch cannot corrupt anyone else\'s run, and **production is never written by CI**. Drop the schema afterwards.'
      }),

      B.decide({
        id: 'm10-dec', title: 'Architecture decision: how do deploys reach production?',
        scenario: 'The platform runs dbt daily through Airflow. A reviewer asks: "How does a merged change actually get into production? Who or what runs it?"',
        opts: [
          { t: 'An engineer runs dbt build against production from a laptop', d: 'Fast and flexible.', lose: 'No audit trail, depends on one person\'s machine and credentials, and bypasses CI. This is the incident waiting to happen.' },
          { t: 'A deploy job triggered by the merge to main, running with a production service account', d: 'Automated, audited, repeatable.' },
          { t: 'Airflow checks out whatever is on main when the schedule fires', d: 'No separate deploy step.', lose: 'The code that runs depends on the moment of checkout. Half-merged work or a force push could run in production. Airflow should run a **pinned, deployed version**.' },
          { t: 'A manual approval button in the Airflow UI', d: 'A human gate.', lose: 'Useful as an extra gate for risky changes, but it does not replace an automated, audited deploy.' }
        ],
        pick: 1,
        why: 'The merge is the approval. A **deploy job** with a service account runs the build, saves the manifest and docs, and leaves an audit trail. Airflow then runs the **deployed, pinned version** on schedule, for example a Docker image tag.',
        when: 'Add a **manual approval step** for high-risk changes such as a metric definition change in a regulated report. Keep the automation underneath it.'
      }),

      B.qa({
        id: 'qa-deploy', tag: 'CI/CD', secs: 75,
        q: 'How do you deploy dbt code?',
        pts: ['Everything through a pull request, never manual changes in production', 'CI: lint, slim build with state:modified+ and defer, schema per PR, tests', 'Review of definitions and lineage impact', 'Deploy job on merge, saves manifest and docs', 'Secrets, key-pair auth, restricted CI role', 'Rollback plan. Resume: Jenkins and Terraform at Citigroup, manual intervention down 50%'],
        short: 'Every change goes through a pull request. CI lints the SQL with SQLFluff, then runs a slim build: dbt build with state:modified+ and defer against the production manifest, into a schema created for that pull request, with tests. Unchanged parents resolve to production tables, so CI takes minutes instead of rebuilding everything.\n\nA reviewer checks the diff and the lineage impact. On merge to main, a deploy job runs dbt build in production, publishes docs, and saves the new manifest for the next CI run. Airflow runs the scheduled builds from the deployed version. Secrets live in the CI secret store with key-pair authentication and a restricted CI role.\n\nAt Citigroup I built the Terraform and Jenkins deployment automation that cut manual intervention by 50 percent.',
        fu: [
          ['How do you roll back a bad deploy?', 'Revert the pull request and redeploy. If data was affected, restore with Time Travel or a clone and rebuild forward.'],
          ['How do you keep CI fast?', 'Slim builds with defer, a small CI warehouse, tests only on modified models and children, and the `--empty` flag to validate SQL against zero-row inputs where that is enough.'],
          ['What about a critical mart that consumers read all day?', 'Build into a staging schema, test it there, then swap schemas atomically, so consumers never see a half-built table.']
        ],
        trap: 'Saying "we deploy with Jenkins" and stopping. Describe the **stages, the isolation, the gates and the rollback**.'
      }),

      B.qa({
        id: 'qa-agile', tag: 'Collaboration', secs: 75,
        q: 'How do you work with application developers, analysts and product managers in an Agile team?',
        pts: ['A contract with app developers: shape, freshness, ownership, announced changes', 'Definitions agreed in writing with analysts and product managers', 'Small stories, definition of done includes tests, docs, review, CI', 'Jira tickets linked to pull requests', 'Early access: dev schema, sample data', 'Resume: REST APIs at Wells Fargo and Citigroup, stakeholder reviews'],
        short: 'I treat application developers as consumers with a contract. Before building, we agree the API shape, the fields, freshness and ownership, and I record it as a dbt contract and an exposure so changes are visible. I give them a dev schema or sample data early and warn them before breaking changes, using expand and contract.\n\nWith analysts and product managers I get metric definitions agreed in writing before building, since most data disputes are really definition disputes. In Scrum I split work into small stories, one model or one definition at a time, with a definition of done that includes tests, documentation, review and green CI. Jira tickets link to pull requests so every change is traceable.\n\nAt Wells Fargo I expose governed datasets through internal REST APIs for application teams, and I review model definitions with analytics, risk and platform stakeholders and explain the trade-offs.',
        fu: [
          ['A developer wants a field renamed in the API. What do you do?', 'Add the new field next to the old one, tell consumers, set a deprecation date, remove the old field after they have moved. A contract and a version make the change explicit.'],
          ['Two stakeholders define a metric differently. What do you do?', 'Bring both definitions to one conversation, show the numbers each produces on the same data, get a decision recorded in the ticket and in the model documentation, and implement one definition. If both are needed, give them different names.'],
          ['How do you handle a tight deadline?', 'Cut scope, not quality gates. Ship the smaller version with tests, say what is deferred and why, and put the rest on the backlog visibly.']
        ],
        trap: 'Describing ceremonies only. Interviewers want **specific habits**: contracts, written definitions, definition of done, early access.'
      }),

      B.qa({
        id: 'qa-ai', tag: 'Resume probe', secs: 60,
        q: 'Your resume mentions Claude and Claude Code. How do you use AI tools in pipeline work, and how do you make sure the output is safe?',
        pts: ['Where it helps: boilerplate, tests, documentation, review for edge cases', 'Treat output like a pull request from a new teammate', 'Validate against tests, source definitions, compiled SQL, totals', 'No production credentials, no real PII in prompts', 'Decisions on definitions, security and architecture stay with the team'],
        short: 'I use Claude and Claude Code in pipeline development, code review and documentation. I treat generated output like a pull request from a new teammate: I read every change, then validate it against what we already trust, dbt tests, source definitions, the compiled SQL, row counts and totals on a CI schema, and our production controls.\n\nI do not give it production credentials or real PII, and I keep sensitive data out of prompts. It speeds up boilerplate such as staging models, YAML, test cases and documentation, and it helps me review for edge cases I may have missed. Decisions about definitions, security and architecture stay with me and the team.',
        fu: [
          ['Give an example where it was wrong.', 'Use a real one. Typical honest examples: a macro that compiled but used the wrong grain for a join, or a test that passed because it checked the wrong column. Say how the tests, the compiled SQL or the totals caught it.'],
          ['Would you let it deploy to production?', 'No. Production changes go through the same pull request, CI and review as anything else. The pipeline does not know or care who wrote the code, and that is the point.']
        ],
        trap: 'Either avoiding the topic or claiming "it writes the pipelines". Show **judgment**: where it helps, how you verify, what you never share.',
        real: 'Prepare one true example of AI-generated code that you corrected. It makes the answer credible in a way no policy statement can.'
      }),

      B.recap({
        id: 'm10-recap', n: 10, badge: 'Release Captain', color: '#C7D2FE',
        pts: [
          'Path to production: **branch, PR, CI, review, merge, deploy, monitor**. Only the deploy job writes to PROD.',
          'Slim CI: **`state:modified+`** selects the change and children, **`--defer`** reads the rest from production.',
          'One schema per pull request, dropped afterwards. Restricted CI role, key-pair auth, secrets in a vault.',
          'Docker pins the runtime. Terraform defines infrastructure. The stages are the same in Jenkins, GitLab and GitHub.',
          'Agile habits: definition of done, small stories, contracts with app developers, written metric definitions.'
        ],
        lines: [
          'Every change goes through a pull request and a slim CI build in its own schema.',
          'Production is written only by the deploy job, never by a person.',
          'I use AI tools like a new teammate\'s pull request: review it and validate it against tests.'
        ]
      })
    ]
  });
})();
