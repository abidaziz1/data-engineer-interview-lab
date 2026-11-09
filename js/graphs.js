/* Diagram specs. Plain data: nodes, edges, groups. graph.js draws them. */
(function () {
  var LAB = (window.LAB = window.LAB || {});
  var H = LAB.Graph.h, V = LAB.Graph.v;
  var S = (LAB.graphs = {});

  /* ------------------------------------------------------------------ */
  /* 1. The whole project on one page                                    */
  /* ------------------------------------------------------------------ */
  S.master = {
    w: 1100, h: 680, label: 'The whole project: sources, ingestion, Snowflake layers, consumers, and the control layers around them',
    groups: [
      { id: 'g_src', x: 10, y: 84, w: 240, h: 224, t: 'SOURCES', c: 'src' },
      { id: 'g_sf', x: 10, y: 352, w: 850, h: 232, t: 'SNOWFLAKE', c: 'sf', tx: 300 },
      { id: 'g_dbt', x: 225, y: 388, w: 618, h: 142, t: 'dbt Core builds these', c: 'dbt', dash: true, tb: true, tx: 410 }
    ],
    nodes: [
      { id: 'air', x: 10, y: 8, w: 1080, h: 50, t: 'AIRFLOW', s: 'runs every step on a schedule, retries failures, sends alerts', c: 'air', k: 'bar', inline: true },
      { id: 's_core', x: 22, y: 116, w: 216, h: 56, t: 'Core banking DB', s: 'loans, customers', c: 'src', k: 'chip' },
      { id: 's_pay', x: 22, y: 178, w: 216, h: 56, t: 'Payments API', s: 'transactions JSON', c: 'src', k: 'chip' },
      { id: 's_ven', x: 22, y: 240, w: 216, h: 56, t: 'Risk vendor files', s: 'credit ratings CSV', c: 'src', k: 'chip' },
      { id: 'py', x: 320, y: 140, w: 200, h: 96, t: 'Python jobs', s: 'extract + validate', c: 'ing' },
      { id: 's3', x: 570, y: 140, w: 200, h: 96, t: 'S3 landing', s: 'files by date', c: 'ing' },
      { id: 'pipe', x: 820, y: 140, w: 200, h: 96, t: 'Snowpipe', s: 'auto-loads files', c: 'ing' },
      { id: 'raw', x: 30, y: 404, w: 160, h: 96, t: 'RAW', s: 'as loaded', c: 'raw', k: 'layer' },
      { id: 'stg', x: 245, y: 404, w: 160, h: 96, t: 'STAGING', s: 'clean + dedupe', c: 'stg', k: 'layer' },
      { id: 'int', x: 460, y: 404, w: 160, h: 96, t: 'INTERMEDIATE', s: 'joins + rules', c: 'int', k: 'layer' },
      { id: 'mart', x: 675, y: 404, w: 160, h: 96, t: 'MARTS', s: 'facts + dims', c: 'mart', k: 'layer' },
      { id: 'api', x: 890, y: 392, w: 200, h: 76, t: 'REST API', s: 'for app teams', c: 'con' },
      { id: 'bi', x: 890, y: 488, w: 200, h: 76, t: 'BI tools', s: 'Tableau, Looker', c: 'con' },
      { id: 'qual', x: 10, y: 606, w: 348, h: 66, t: 'QUALITY + SECURITY', s: 'tests, masking, roles', c: 'qual', k: 'pill' },
      { id: 'cicd', x: 376, y: 606, w: 348, h: 66, t: 'DELIVERY', s: 'Git, CI/CD, Docker', c: 'ci', k: 'pill' },
      { id: 'mon', x: 742, y: 606, w: 348, h: 66, t: 'MONITORING', s: 'Datadog, SLA alerts', c: 'mon', k: 'pill' }
    ],
    edges: [
      { id: 'e1a', a: 's_core', b: 'py', d: H(238, 144, 320, 170), n: 1, nb: true },
      { id: 'e1b', a: 's_pay', b: 'py', d: H(238, 206, 320, 188), n: 1, bx: 279, by: 196 },
      { id: 'e1c', a: 's_ven', b: 'py', d: H(238, 268, 320, 206), n: 1, nb: true },
      { id: 'e2', a: 'py', b: 's3', d: 'M520 188 H570', n: 2, bx: 545, by: 160 },
      { id: 'e3', a: 's3', b: 'pipe', d: 'M770 188 H820', n: 3, bx: 795, by: 160 },
      { id: 'e4', a: 'pipe', b: 'raw', d: 'M920 236 V318 Q920 330 908 330 H122 Q110 330 110 342 V402', n: 4, bx: 520, by: 330 },
      { id: 'e5', a: 'raw', b: 'stg', d: 'M190 452 H245', n: 5, bx: 217, by: 426 },
      { id: 'e6', a: 'stg', b: 'int', d: 'M405 452 H460', n: 6, bx: 432, by: 426 },
      { id: 'e7', a: 'int', b: 'mart', d: 'M620 452 H675', n: 7, bx: 647, by: 426 },
      { id: 'e8a', a: 'mart', b: 'api', d: 'M835 430 H890', n: 8, nb: true },
      { id: 'e8b', a: 'mart', b: 'bi', d: H(835, 474, 890, 526), n: 8, bx: 862, by: 482 }
    ],
    tags: [
      { id: 't_py', x: 330, y: 104, t: 'Airflow task', c: 'air' },
      { id: 't_pipe', x: 826, y: 104, t: 'Airflow sensor', c: 'air' },
      { id: 't_dbt', x: 560, y: 354, t: 'Airflow runs dbt', c: 'air' },
      { id: 't_q1', x: 40, y: 506, t: 'freshness + counts', c: 'qual' },
      { id: 't_q2', x: 255, y: 506, t: 'dbt tests', c: 'qual' },
      { id: 't_q3', x: 470, y: 506, t: 'dbt tests', c: 'qual' },
      { id: 't_q4', x: 665, y: 506, t: 'tests + contracts', c: 'qual' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 2. Ingestion zoom                                                   */
  /* ------------------------------------------------------------------ */
  S.ingest = {
    w: 1100, h: 520, label: 'Ingestion: three extractors write files to S3, Snowpipe loads them into RAW tables',
    groups: [{ id: 'g_raw', x: 830, y: 250, w: 262, h: 250, t: 'RAW schema', c: 'raw' }],
    nodes: [
      { id: 'src1', x: 0, y: 40, w: 220, h: 100, t: 'Core banking DB', s: 'loans, customers', c: 'src' },
      { id: 'src2', x: 0, y: 200, w: 220, h: 100, t: 'Payments API', s: 'REST, JSON pages', c: 'src' },
      { id: 'src3', x: 0, y: 360, w: 220, h: 100, t: 'Vendor SFTP', s: 'daily ratings CSV', c: 'src' },
      { id: 'x1', x: 290, y: 40, w: 250, h: 100, t: 'Extract: database', s: 'upd_ts > watermark', c: 'ing' },
      { id: 'x2', x: 290, y: 200, w: 250, h: 100, t: 'Extract: API', s: 'cursor, retry, timeout', c: 'ing' },
      { id: 'x3', x: 290, y: 360, w: 250, h: 100, t: 'Extract: files', s: 'new files only', c: 'ing' },
      { id: 's3', x: 610, y: 180, w: 190, h: 220, t: 'S3 landing', ss: ['core/dt=...', 'payments/dt=...', 'ratings/dt=...'], c: 'ing' },
      { id: 'pipe', x: 850, y: 40, w: 230, h: 110, t: 'Snowpipe', s: 'COPY INTO, serverless', c: 'ing' },
      { id: 'r1', x: 846, y: 282, w: 230, h: 56, t: 'core_loans', s: 'typed columns', c: 'raw', k: 'chip' },
      { id: 'r2', x: 846, y: 350, w: 230, h: 56, t: 'payments_txns', s: 'payload VARIANT', c: 'raw', k: 'chip' },
      { id: 'r3', x: 846, y: 418, w: 230, h: 56, t: 'risk_ratings', s: 'typed columns', c: 'raw', k: 'chip' }
    ],
    edges: [
      { id: 'i1a', a: 'src1', b: 'x1', d: 'M220 90 H290', n: 1, bx: 255, by: 62 },
      { id: 'i1b', a: 'src2', b: 'x2', d: 'M220 250 H290', n: 1, bx: 255, by: 222 },
      { id: 'i1c', a: 'src3', b: 'x3', d: 'M220 410 H290', n: 1, bx: 255, by: 382 },
      { id: 'i2a', a: 'x1', b: 's3', d: H(540, 90, 610, 240), n: 2, nb: true },
      { id: 'i2b', a: 'x2', b: 's3', d: H(540, 250, 610, 290), n: 2, bx: 575, by: 262 },
      { id: 'i2c', a: 'x3', b: 's3', d: H(540, 410, 610, 340), n: 2, nb: true },
      { id: 'i3', a: 's3', b: 'pipe', d: H(800, 270, 850, 105), n: 3, bx: 820, by: 190, label: 'S3 event', lx: 770, ly: 150 },
      { id: 'i4', a: 'pipe', b: 'g_raw', d: V(965, 150, 965, 248), n: 4, bx: 965, by: 200, label: 'COPY INTO', lx: 1028, ly: 216 }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 3. dbt lineage (DAG)                                                */
  /* ------------------------------------------------------------------ */
  var cx = [6, 234, 462, 690, 918];
  function rowY(i) { return 54 + i * 54; }
  S.lineage = {
    pk: 1, w: 1112, h: 392, label: 'dbt lineage graph from sources and seeds to marts and consumers',
    groups: [
      { id: 'L0', x: cx[0] - 6, y: 34, w: 200, h: 340, t: 'SOURCES + SEEDS', c: 'src', tx: cx[0] - 2 },
      { id: 'L1', x: cx[1] - 6, y: 34, w: 200, h: 340, t: 'STAGING', c: 'stg', tx: cx[1] - 2 },
      { id: 'L2', x: cx[2] - 6, y: 34, w: 200, h: 340, t: 'INTERMEDIATE', c: 'int', tx: cx[2] - 2 },
      { id: 'L3', x: cx[3] - 6, y: 34, w: 200, h: 340, t: 'MARTS', c: 'mart', tx: cx[3] - 2 },
      { id: 'L4', x: cx[4] - 6, y: 34, w: 200, h: 340, t: 'CONSUMERS', c: 'con', tx: cx[4] - 2 }
    ],
    nodes: [
      { id: 'core_loans', k: 'dag', x: cx[0], y: rowY(0), w: 188, h: 40, t: 'core.loans', c: 'src' },
      { id: 'core_customers', k: 'dag', x: cx[0], y: rowY(1), w: 188, h: 40, t: 'core.customers', c: 'src' },
      { id: 'pay_txns', k: 'dag', x: cx[0], y: rowY(2), w: 188, h: 40, t: 'payments.txns', c: 'src' },
      { id: 'risk_ratings', k: 'dag', x: cx[0], y: rowY(3), w: 188, h: 40, t: 'risk.ratings', c: 'src' },
      { id: 'seed_status', k: 'dag', x: cx[0], y: rowY(4), w: 188, h: 40, t: 'loan_status_codes', c: 'seed' },
      { id: 'seed_lgd', k: 'dag', x: cx[0], y: rowY(5), w: 188, h: 40, t: 'lgd_by_collateral', c: 'seed' },
      { id: 'stg_loans', k: 'dag', x: cx[1], y: rowY(0), w: 188, h: 40, t: 'stg_core__loans', c: 'stg' },
      { id: 'snap_cust', k: 'dag', x: cx[1], y: rowY(1), w: 188, h: 40, t: 'snap_customers', c: 'snap' },
      { id: 'stg_txns', k: 'dag', x: cx[1], y: rowY(2), w: 188, h: 40, t: 'stg_payments__txns', c: 'stg' },
      { id: 'stg_ratings', k: 'dag', x: cx[1], y: rowY(3), w: 188, h: 40, t: 'stg_risk__ratings', c: 'stg' },
      { id: 'int_pay', k: 'dag', x: cx[2], y: rowY(2), w: 188, h: 40, t: 'int_loan_payments', c: 'int' },
      { id: 'int_exp', k: 'dag', x: cx[2], y: rowY(4), w: 188, h: 40, t: 'int_loan_exposure', c: 'int' },
      { id: 'dim_cust', k: 'dag', x: cx[3], y: rowY(1), w: 188, h: 40, t: 'dim_customer', c: 'mart' },
      { id: 'fct_pay', k: 'dag', x: cx[3], y: rowY(2), w: 188, h: 40, t: 'fct_payments', c: 'mart' },
      { id: 'fct_exp', k: 'dag', x: cx[3], y: rowY(4), w: 188, h: 40, t: 'fct_loan_exposure', c: 'mart' },
      { id: 'mart_sum', k: 'dag', x: cx[3], y: rowY(5), w: 188, h: 40, t: 'mart_risk_summary', c: 'mart' },
      { id: 'x_api', k: 'dag', x: cx[4], y: rowY(4), w: 188, h: 40, t: 'risk_api', c: 'con' },
      { id: 'x_dash', k: 'dag', x: cx[4], y: rowY(5), w: 188, h: 40, t: 'risk_dashboard', c: 'con' }
    ],
    edges: []
  };
  (function () {
    var sp = S.lineage, byId = {};
    sp.nodes.forEach(function (n) { byId[n.id] = n; });
    function link(a, b) {
      var A = byId[a], B = byId[b], d;
      if (A.x === B.x && Math.abs(B.y - A.y) > A.h + 30) {
        var ay = A.y + A.h / 2, by = B.y + B.h / 2, rx = A.x + A.w;
        d = 'M' + rx + ' ' + ay + ' C' + (rx + 42) + ' ' + ay + ' ' + (rx + 42) + ' ' + by + ' ' + rx + ' ' + by;
      } else if (A.x === B.x) {
        var down = B.y > A.y;
        d = 'M' + (A.x + A.w / 2) + ' ' + (down ? A.y + A.h : A.y) + ' V' + (down ? B.y : B.y + B.h);
      } else {
        d = H(A.x + A.w, A.y + A.h / 2, B.x, B.y + B.h / 2);
      }
      sp.edges.push({ id: a + '>' + b, a: a, b: b, d: d });
    }
    [['core_loans', 'stg_loans'], ['seed_status', 'stg_loans'], ['core_customers', 'snap_cust'], ['pay_txns', 'stg_txns'], ['risk_ratings', 'stg_ratings'],
      ['stg_txns', 'int_pay'], ['stg_loans', 'int_exp'], ['snap_cust', 'int_exp'], ['stg_ratings', 'int_exp'], ['seed_lgd', 'int_exp'], ['int_pay', 'int_exp'],
      ['snap_cust', 'dim_cust'], ['int_exp', 'fct_exp'], ['int_pay', 'fct_pay'], ['fct_exp', 'mart_sum'], ['dim_cust', 'mart_sum'],
      ['fct_exp', 'x_api'], ['mart_sum', 'x_dash']].forEach(function (p) { link(p[0], p[1]); });
  })();

  /* ------------------------------------------------------------------ */
  /* 4. Airflow DAG                                                      */
  /* ------------------------------------------------------------------ */
  var ax = [0, 190, 380, 570, 760, 950];
  S.airflow = {
    w: 1100, h: 360, label: 'Airflow DAG: three parallel extract tasks, load checks, dbt freshness, dbt builds, publish',
    nodes: [
      { id: 'pull_core', k: 'dag', x: ax[0], y: 20, w: 150, h: 66, t: 'pull_core', s: 'Python', c: 'ing' },
      { id: 'pull_pay', k: 'dag', x: ax[0], y: 120, w: 150, h: 66, t: 'pull_payments', s: 'Python', c: 'ing' },
      { id: 'pull_rat', k: 'dag', x: ax[0], y: 220, w: 150, h: 66, t: 'pull_ratings', s: 'Python', c: 'ing' },
      { id: 'wait_pipe', k: 'dag', x: ax[1], y: 120, w: 150, h: 66, t: 'wait_pipe', s: 'sensor', c: 'ing' },
      { id: 'ge_raw', k: 'dag', x: ax[2], y: 120, w: 150, h: 66, t: 'ge_raw', s: 'raw checks', c: 'qual' },
      { id: 'dbt_fresh', k: 'dag', x: ax[3], y: 120, w: 150, h: 66, t: 'dbt_fresh', s: 'freshness', c: 'stg' },
      { id: 'dbt_stg', k: 'dag', x: ax[4], y: 120, w: 150, h: 66, t: 'dbt_stg', s: 'build + test', c: 'stg' },
      { id: 'dbt_marts', k: 'dag', x: ax[5], y: 120, w: 150, h: 66, t: 'dbt_marts', s: 'build + test', c: 'mart' },
      { id: 'alert', k: 'dag', x: ax[4], y: 270, w: 150, h: 66, t: 'alert', s: 'if any fails', c: 'qual' },
      { id: 'publish', k: 'dag', x: ax[5], y: 270, w: 150, h: 66, t: 'publish', s: 'metrics', c: 'air' }
    ],
    edges: [
      { id: 'pull_core>wait_pipe', a: 'pull_core', b: 'wait_pipe', d: H(150, 53, 190, 153) },
      { id: 'pull_pay>wait_pipe', a: 'pull_pay', b: 'wait_pipe', d: 'M150 153 H190' },
      { id: 'pull_rat>wait_pipe', a: 'pull_rat', b: 'wait_pipe', d: H(150, 253, 190, 153) },
      { id: 'wait_pipe>ge_raw', a: 'wait_pipe', b: 'ge_raw', d: 'M340 153 H380' },
      { id: 'ge_raw>dbt_fresh', a: 'ge_raw', b: 'dbt_fresh', d: 'M530 153 H570' },
      { id: 'dbt_fresh>dbt_stg', a: 'dbt_fresh', b: 'dbt_stg', d: 'M720 153 H760' },
      { id: 'dbt_stg>dbt_marts', a: 'dbt_stg', b: 'dbt_marts', d: 'M910 153 H950' },
      { id: 'dbt_marts>publish', a: 'dbt_marts', b: 'publish', d: 'M1025 186 V270' },
      { id: 'dbt_stg>alert', a: 'dbt_stg', b: 'alert', d: 'M835 186 V270', k: 'ctl' },
      { id: 'dbt_marts>alert', a: 'dbt_marts', b: 'alert', d: H(1010, 186, 910, 292), k: 'ctl' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 5. Star schema                                                      */
  /* ------------------------------------------------------------------ */
  S.star = {
    w: 1000, h: 560, label: 'Star schema for loan exposure: one fact table and four dimensions',
    nodes: [
      { id: 'fct', x: 330, y: 190, w: 340, h: 180, t: 'fct_loan_exposure', ss: ['grain: one row per loan per day', 'outstanding_usd', 'expected_loss_usd', 'risk_tier'], c: 'mart' },
      { id: 'd_cust', x: 10, y: 20, w: 290, h: 120, t: 'dim_customer', ss: ['SCD Type 2', 'segment, valid_from, valid_to'], c: 'stg' },
      { id: 'd_loan', x: 700, y: 20, w: 290, h: 120, t: 'dim_loan', ss: ['terms, collateral', 'origination date, status'], c: 'stg' },
      { id: 'd_date', x: 10, y: 420, w: 290, h: 120, t: 'dim_date', ss: ['calendar day', 'month, quarter, weekday'], c: 'stg' },
      { id: 'd_rate', x: 700, y: 420, w: 290, h: 120, t: 'dim_risk_rating', ss: ['rating, PD band', 'rating agency'], c: 'stg' }
    ],
    edges: [
      { id: 'k1', a: 'd_cust', b: 'fct', k: 'ref', d: 'M200 140 L360 190', label: 'customer_key', lx: 190, ly: 176 },
      { id: 'k2', a: 'd_loan', b: 'fct', k: 'ref', d: 'M800 140 L640 190', label: 'loan_key', lx: 818, ly: 176 },
      { id: 'k3', a: 'd_date', b: 'fct', k: 'ref', d: 'M200 420 L360 370', label: 'date_key', lx: 186, ly: 408 },
      { id: 'k4', a: 'd_rate', b: 'fct', k: 'ref', d: 'M800 420 L640 370', label: 'rating_key', lx: 818, ly: 408 }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 6. Data Vault                                                       */
  /* ------------------------------------------------------------------ */
  S.vault = {
    w: 1000, h: 520, label: 'Data Vault: hubs hold business keys, links hold relationships, satellites hold descriptive history',
    nodes: [
      { id: 'hub_c', x: 20, y: 20, w: 290, h: 130, t: 'HUB_CUSTOMER', ss: ['customer_hk (hash key)', 'customer_id (business key)', 'load_date, record_source'], c: 'raw' },
      { id: 'link', x: 355, y: 20, w: 290, h: 130, t: 'LINK_CUSTOMER_LOAN', ss: ['link_hk, customer_hk, loan_hk', 'load_date, record_source'], c: 'int' },
      { id: 'hub_l', x: 690, y: 20, w: 290, h: 130, t: 'HUB_LOAN', ss: ['loan_hk (hash key)', 'loan_id (business key)', 'load_date, record_source'], c: 'raw' },
      { id: 'sat_c', x: 20, y: 300, w: 290, h: 150, t: 'SAT_CUSTOMER', ss: ['customer_hk, load_date', 'name, segment, email', 'hash_diff, record_source'], c: 'stg' },
      { id: 'sat_l', x: 690, y: 300, w: 290, h: 150, t: 'SAT_LOAN_TERMS', ss: ['loan_hk, load_date', 'principal, rate, status', 'hash_diff, record_source'], c: 'stg' },
      { id: 'sat_p', x: 355, y: 300, w: 290, h: 150, t: 'SAT_LOAN_PAYMENTS', ss: ['loan_hk, load_date', 'txn_id, amount, posted_at', 'insert-only history'], c: 'stg' }
    ],
    edges: [
      { id: 'v1', a: 'hub_c', b: 'link', k: 'ref', d: 'M310 85 H355' },
      { id: 'v2', a: 'link', b: 'hub_l', k: 'ref', d: 'M645 85 H690' },
      { id: 'v3', a: 'hub_c', b: 'sat_c', k: 'ref', d: 'M165 150 V300' },
      { id: 'v4', a: 'hub_l', b: 'sat_l', k: 'ref', d: 'M835 150 V300' },
      { id: 'v5', a: 'hub_l', b: 'sat_p', k: 'ref', d: 'M760 150 L560 300' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 7. RBAC                                                             */
  /* ------------------------------------------------------------------ */
  S.rbac = {
    w: 1100, h: 520, label: 'Role based access: who connects, which role they use, what the role can do',
    groups: [
      { id: 'c0', x: 0, y: 34, w: 270, h: 470, t: 'WHO CONNECTS', c: 'src', tx: 8 },
      { id: 'c1', x: 340, y: 34, w: 270, h: 470, t: 'ROLE', c: 'int', tx: 348 },
      { id: 'c2', x: 680, y: 34, w: 420, h: 470, t: 'WHAT THE ROLE CAN DO', c: 'mart', tx: 688 }
    ],
    nodes: [
      { id: 'u1', x: 12, y: 60, w: 246, h: 70, t: 'svc_airflow', s: 'ingestion service', c: 'src', k: 'chip' },
      { id: 'u2', x: 12, y: 150, w: 246, h: 70, t: 'svc_dbt', s: 'transform service', c: 'src', k: 'chip' },
      { id: 'u3', x: 12, y: 240, w: 246, h: 70, t: 'analyst team', s: 'BI + SQL users', c: 'src', k: 'chip' },
      { id: 'u4', x: 12, y: 330, w: 246, h: 70, t: 'compliance', s: 'audit + investigations', c: 'src', k: 'chip' },
      { id: 'u5', x: 12, y: 420, w: 246, h: 70, t: 'svc_api', s: 'REST API service', c: 'src', k: 'chip' },
      { id: 'r1', x: 352, y: 60, w: 246, h: 70, t: 'LOADER', s: 'write RAW', c: 'int', k: 'chip' },
      { id: 'r2', x: 352, y: 150, w: 246, h: 70, t: 'TRANSFORMER', s: 'build layers', c: 'int', k: 'chip' },
      { id: 'r3', x: 352, y: 240, w: 246, h: 70, t: 'ANALYST', s: 'read marts', c: 'int', k: 'chip' },
      { id: 'r4', x: 352, y: 330, w: 246, h: 70, t: 'PII_READER', s: 'inherits ANALYST', c: 'int', k: 'chip' },
      { id: 'r5', x: 352, y: 420, w: 246, h: 70, t: 'API_READER', s: 'read marts only', c: 'int', k: 'chip' },
      { id: 'p1', x: 692, y: 60, w: 396, h: 70, t: 'Write RAW tables', s: 'WH_LOAD, XS', c: 'mart', k: 'chip' },
      { id: 'p2', x: 692, y: 150, w: 396, h: 70, t: 'Read RAW, build STAGING + MARTS', s: 'WH_TRANSFORM, M', c: 'mart', k: 'chip' },
      { id: 'p3', x: 692, y: 240, w: 396, h: 70, t: 'Read MARTS, PII columns masked', s: 'WH_BI, multi-cluster', c: 'mart', k: 'chip' },
      { id: 'p4', x: 692, y: 330, w: 396, h: 70, t: 'Read MARTS, PII columns clear', s: 'audited in ACCESS_HISTORY', c: 'mart', k: 'chip' },
      { id: 'p5', x: 692, y: 420, w: 396, h: 70, t: 'Read MARTS through the API', s: 'WH_API, small, cached', c: 'mart', k: 'chip' }
    ],
    edges: (function () {
      var e = [];
      for (var i = 1; i <= 5; i++) {
        e.push({ id: 'u' + i + '>r' + i, a: 'u' + i, b: 'r' + i, d: 'M258 ' + (25 + i * 90 + 10) + ' H352' });
        e.push({ id: 'r' + i + '>p' + i, a: 'r' + i, b: 'p' + i, d: 'M598 ' + (25 + i * 90 + 10) + ' H692' });
      }
      e.push({ id: 'r3>r4', a: 'r3', b: 'r4', d: 'M475 310 V330', k: 'ref' });
      return e;
    })()
  };

  /* ------------------------------------------------------------------ */
  /* 8. Snowflake architecture                                           */
  /* ------------------------------------------------------------------ */
  S.snowarch = {
    w: 1000, h: 580, label: 'Snowflake architecture: cloud services, virtual warehouses, storage',
    groups: [
      { id: 'a_cs', x: 0, y: 112, w: 1000, h: 118, t: 'CLOUD SERVICES', c: 'int', tx: 14 },
      { id: 'a_cp', x: 0, y: 280, w: 1000, h: 140, t: 'COMPUTE: VIRTUAL WAREHOUSES', c: 'stg', tx: 14 },
      { id: 'a_st', x: 0, y: 470, w: 1000, h: 100, t: 'STORAGE', c: 'mart', tx: 14 }
    ],
    nodes: [
      { id: 'cl1', x: 0, y: 0, w: 220, h: 56, t: 'dbt Core', c: 'src', k: 'chip' },
      { id: 'cl2', x: 260, y: 0, w: 220, h: 56, t: 'Airflow', c: 'src', k: 'chip' },
      { id: 'cl3', x: 520, y: 0, w: 220, h: 56, t: 'BI tools', c: 'src', k: 'chip' },
      { id: 'cl4', x: 780, y: 0, w: 220, h: 56, t: 'REST API', c: 'src', k: 'chip' },
      { id: 'cs1', x: 14, y: 140, w: 220, h: 72, t: 'Login + roles', s: 'authentication, RBAC', c: 'int', k: 'chip' },
      { id: 'cs2', x: 256, y: 140, w: 220, h: 72, t: 'Metadata', s: 'min/max per partition', c: 'int', k: 'chip' },
      { id: 'cs3', x: 498, y: 140, w: 220, h: 72, t: 'Optimizer', s: 'query plans, pruning', c: 'int', k: 'chip' },
      { id: 'cs4', x: 740, y: 140, w: 246, h: 72, t: 'Transactions', s: 'ACID, Time Travel', c: 'int', k: 'chip' },
      { id: 'w1', x: 14, y: 312, w: 220, h: 92, t: 'WH_LOAD', s: 'X-Small', c: 'stg', k: 'chip' },
      { id: 'w2', x: 256, y: 312, w: 220, h: 92, t: 'WH_TRANSFORM', s: 'Medium', c: 'stg', k: 'chip' },
      { id: 'w3', x: 498, y: 312, w: 220, h: 92, t: 'WH_BI', s: 'Large, multi-cluster', c: 'stg', k: 'chip' },
      { id: 'w4', x: 740, y: 312, w: 246, h: 92, t: 'WH_API', s: 'Small, multi-cluster', c: 'stg', k: 'chip' },
      { id: 'st', x: 14, y: 498, w: 972, h: 62, t: 'Micro-partitions in object storage', s: 'columnar, compressed, immutable, one shared copy', c: 'mart', k: 'bar', inline: true }
    ],
    edges: [
      { id: 'q1', a: 'cl1', b: 'a_cs', d: 'M110 56 V112' },
      { id: 'q2', a: 'cl2', b: 'a_cs', d: 'M370 56 V112' },
      { id: 'q3', a: 'cl3', b: 'a_cs', d: 'M630 56 V112' },
      { id: 'q4', a: 'cl4', b: 'a_cs', d: 'M890 56 V112' },
      { id: 'q5', a: 'a_cs', b: 'a_cp', d: 'M500 230 V280' },
      { id: 'q6', a: 'a_cp', b: 'a_st', d: 'M500 420 V470' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 9. CI/CD flow                                                       */
  /* ------------------------------------------------------------------ */
  S.ci = {
    w: 1100, h: 470, label: 'CI/CD: branch, pull request, CI build in an isolated schema, review, merge, deploy to production',
    nodes: [
      { id: 'dev', x: 0, y: 20, w: 240, h: 110, t: 'Feature branch', ss: ['change models + tests', 'dbt build in dev schema'], c: 'src' },
      { id: 'pr', x: 290, y: 20, w: 240, h: 110, t: 'Pull request', ss: ['diff + lineage review', 'Jira ticket linked'], c: 'ci' },
      { id: 'ci', x: 580, y: 10, w: 270, h: 130, t: 'CI run', ss: ['lint, parse, compile', 'state:modified+ with defer', 'tests in a PR schema'], c: 'ci' },
      { id: 'rev', x: 900, y: 20, w: 200, h: 110, t: 'Review', ss: ['approve or request', 'changes'], c: 'ci' },
      { id: 'mrg', x: 0, y: 300, w: 240, h: 110, t: 'Merge to main', ss: ['squash + tag', 'PR schema dropped'], c: 'ci' },
      { id: 'cd', x: 290, y: 300, w: 270, h: 110, t: 'Deploy job', ss: ['dbt build in PROD', 'docs + artifacts saved'], c: 'ci' },
      { id: 'prod', x: 610, y: 300, w: 240, h: 110, t: 'PROD schemas', ss: ['RAW, STAGING,', 'INTERMEDIATE, MARTS'], c: 'mart' },
      { id: 'mon', x: 900, y: 300, w: 200, h: 110, t: 'Datadog', ss: ['SLA + failure', 'alerts'], c: 'mon' }
    ],
    edges: [
      { id: 'c1', a: 'dev', b: 'pr', d: 'M240 75 H290', n: 1, bx: 265, by: 47 },
      { id: 'c2', a: 'pr', b: 'ci', d: 'M530 75 H580', n: 2, bx: 555, by: 47 },
      { id: 'c3', a: 'ci', b: 'rev', d: 'M850 75 H900', n: 3, bx: 875, by: 47 },
      { id: 'c4', a: 'rev', b: 'mrg', d: 'M1000 130 V200 Q1000 212 988 212 H132 Q120 212 120 224 V298', n: 4, bx: 560, by: 212 },
      { id: 'c5', a: 'mrg', b: 'cd', d: 'M240 355 H290', n: 5, bx: 265, by: 327 },
      { id: 'c6', a: 'cd', b: 'prod', d: 'M560 355 H610', n: 6, bx: 585, by: 327 },
      { id: 'c7', a: 'prod', b: 'mon', d: 'M850 355 H900', n: 7, bx: 875, by: 327 }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* 10. Quality gates                                                   */
  /* ------------------------------------------------------------------ */
  S.quality = {
    w: 1100, h: 440, label: 'Quality gates between the layers of the pipeline',
    nodes: [
      { id: 'q_src', x: 0, y: 40, w: 170, h: 90, t: 'SOURCES', s: 'systems of record', c: 'src' },
      { id: 'q_raw', x: 232, y: 40, w: 170, h: 90, t: 'RAW', s: 'as loaded', c: 'raw' },
      { id: 'q_stg', x: 464, y: 40, w: 170, h: 90, t: 'STAGING', s: 'clean + dedupe', c: 'stg' },
      { id: 'q_mart', x: 696, y: 40, w: 170, h: 90, t: 'MARTS', s: 'facts + dims', c: 'mart' },
      { id: 'q_con', x: 928, y: 40, w: 172, h: 90, t: 'CONSUMERS', s: 'API + BI', c: 'con' },
      { id: 'g1', x: 174, y: 62, w: 54, h: 46, t: 'G1', c: 'qual', k: 'gate' },
      { id: 'g2', x: 406, y: 62, w: 54, h: 46, t: 'G2', c: 'qual', k: 'gate' },
      { id: 'g3', x: 638, y: 62, w: 54, h: 46, t: 'G3', c: 'qual', k: 'gate' },
      { id: 'g4', x: 870, y: 62, w: 54, h: 46, t: 'G4', c: 'qual', k: 'gate' },
      { id: 'c1', x: 100, y: 190, w: 250, h: 200, t: 'G1 on arrival', ss: ['file count + size', 'schema matches', 'row count vs source', 'Great Expectations'], c: 'qual', k: 'checks' },
      { id: 'c2', x: 360, y: 190, w: 230, h: 200, t: 'G2 after cleaning', ss: ['source freshness', 'unique + not_null', 'accepted_values', 'dedupe worked'], c: 'qual', k: 'checks' },
      { id: 'c3', x: 600, y: 190, w: 250, h: 200, t: 'G3 before publish', ss: ['relationships (FKs)', 'contract enforced', 'totals reconcile', 'no negative balances'], c: 'qual', k: 'checks' },
      { id: 'c4', x: 860, y: 190, w: 240, h: 200, t: 'G4 after publish', ss: ['row count vs yesterday', 'freshness lag', 'Datadog monitors', 'alert + runbook'], c: 'mon', k: 'checks' }
    ],
    edges: [
      { id: 'p1', a: 'q_src', b: 'g1', d: 'M170 85 H174' },
      { id: 'p2', a: 'g1', b: 'q_raw', d: 'M228 85 H232' },
      { id: 'p3', a: 'q_raw', b: 'g2', d: 'M402 85 H406' },
      { id: 'p4', a: 'g2', b: 'q_stg', d: 'M460 85 H464' },
      { id: 'p5', a: 'q_stg', b: 'g3', d: 'M634 85 H638' },
      { id: 'p6', a: 'g3', b: 'q_mart', d: 'M692 85 H696' },
      { id: 'p7', a: 'q_mart', b: 'g4', d: 'M866 85 H870' },
      { id: 'p8', a: 'g4', b: 'q_con', d: 'M924 85 H928' },
      { id: 'd1', a: 'g1', b: 'c1', k: 'ref', d: 'M201 108 V190' },
      { id: 'd2', a: 'g2', b: 'c2', k: 'ref', d: 'M433 108 V190' },
      { id: 'd3', a: 'g3', b: 'c3', k: 'ref', d: 'M665 108 V190' },
      { id: 'd4', a: 'g4', b: 'c4', k: 'ref', d: 'M897 108 V190' }
    ]
  };
  /* ------------------------------------------------------------------ */
  /* 11. Query profile                                                   */
  /* ------------------------------------------------------------------ */
  S.profile = {
    w: 1100, h: 270, label: 'Query profile: the operators of one slow query',
    nodes: [
      { id: 'p1', x: 0, y: 30, w: 190, h: 130, t: 'TableScan', ss: ['fct_payments', '11 of 12 partitions'], c: 'raw' },
      { id: 'p2', x: 227, y: 30, w: 190, h: 130, t: 'Filter', ss: ['txn_date = ...', '41M rows pass'], c: 'stg' },
      { id: 'p3', x: 454, y: 30, w: 190, h: 130, t: 'Join', ss: ['with dim_customer', '3.2B rows out'], c: 'int' },
      { id: 'p4', x: 681, y: 30, w: 190, h: 130, t: 'Aggregate', ss: ['SUM(amount_usd)', '38 GB spilled'], c: 'mart' },
      { id: 'p5', x: 908, y: 30, w: 190, h: 130, t: 'Result', ss: ['4 rows'], c: 'con' }
    ],
    edges: [
      { id: 'pe1', a: 'p1', b: 'p2', d: 'M190 95 H227' },
      { id: 'pe2', a: 'p2', b: 'p3', d: 'M417 95 H454' },
      { id: 'pe3', a: 'p3', b: 'p4', d: 'M644 95 H681' },
      { id: 'pe4', a: 'p4', b: 'p5', d: 'M871 95 H908' }
    ],
    tags: [
      { id: 'tg1', x: 0, y: 185, t: 'Almost no pruning', c: 'qual' },
      { id: 'tg2', x: 400, y: 185, t: 'Row explosion: 41M in, 3.2B out', c: 'qual' },
      { id: 'tg3', x: 681, y: 185, t: 'Spilling to remote storage', c: 'qual' }
    ]
  };
})();
