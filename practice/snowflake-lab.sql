-- OPTIONAL: real Snowflake worksheet for the browser's synthetic example.
-- Run in a disposable INTERVIEW_LAB sandbox with CREATE permissions.
-- This script replaces the named lab tables. It does not use real employer data.
-- No Snowflake connection is needed to study the browser walkthrough.

CREATE WAREHOUSE IF NOT EXISTS LAB_WH
  WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS INTERVIEW_LAB;
CREATE SCHEMA IF NOT EXISTS INTERVIEW_LAB.RAW;
CREATE SCHEMA IF NOT EXISTS INTERVIEW_LAB.STAGING;
CREATE SCHEMA IF NOT EXISTS INTERVIEW_LAB.MARTS;
USE WAREHOUSE LAB_WH;
USE DATABASE INTERVIEW_LAB;

-- 1. Preserve raw strings and source/ingestion metadata.
CREATE OR REPLACE TABLE RAW.TRADE_EVENTS (
  trade_id VARCHAR, account_id VARCHAR, symbol VARCHAR,
  quantity VARCHAR, price VARCHAR, version INTEGER,
  updated_at TIMESTAMP_NTZ, ingested_at TIMESTAMP_NTZ,
  ingest_seq INTEGER, batch_id VARCHAR, status VARCHAR
);
INSERT INTO RAW.TRADE_EVENTS VALUES
('T100','A01','BND','100','10.00',1,'2026-01-07 09:00:00','2026-01-07 09:01:00',1,'B001','ACTIVE'),
('T101','A02','EQT','50','20.00',1,'2026-01-07 09:00:00','2026-01-07 09:01:00',2,'B001','ACTIVE'),
('T101','A02','EQT','50','20.00',1,'2026-01-07 09:00:00','2026-01-07 09:01:01',3,'B001','ACTIVE'),
('T102','A01','FX','25','40.00',1,'2026-01-07 09:00:00','2026-01-07 09:01:00',4,'B001','ACTIVE'),
('T103','A03','EQT','-5','50.00',1,'2026-01-07 09:00:00','2026-01-07 09:01:00',5,'B001','ACTIVE'),
('T104','A04','BND','10',NULL,1,'2026-01-07 09:00:00','2026-01-07 09:01:00',6,'B001','ACTIVE');

-- The dbt version loads this small reference table using dbt seed.
CREATE OR REPLACE TABLE RAW.RISK_WEIGHTS (symbol VARCHAR, risk_weight NUMBER(10,4));
INSERT INTO RAW.RISK_WEIGHTS VALUES ('BND',0.2),('EQT',1.0),('FX',0.5);

CREATE OR REPLACE TABLE MARTS.DIM_ACCOUNTS (account_id VARCHAR, desk VARCHAR);
INSERT INTO MARTS.DIM_ACCOUNTS VALUES
  ('A01','Rates'),('A02','Equities'),('A03','Macro'),('A04','Credit');

-- 2. Equivalent to the stg_trades dbt model, written as worksheet SQL.
CREATE OR REPLACE VIEW STAGING.STG_TRADES AS
SELECT trade_id, account_id, symbol,
  TRY_TO_DECIMAL(quantity,18,4) AS quantity,
  TRY_TO_DECIMAL(price,18,4) AS price,
  version, updated_at, ingested_at, ingest_seq, batch_id, status
FROM RAW.TRADE_EVENTS
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY trade_id
  ORDER BY version DESC, updated_at DESC, ingested_at DESC, ingest_seq DESC
) = 1;

-- First build of the current-state incremental target.
CREATE OR REPLACE TABLE STAGING.INT_CURRENT_TRADES AS
SELECT * FROM STAGING.STG_TRADES;

-- 3. Keep rejects visible. Positive quantity is this lab's long-only rule.
CREATE OR REPLACE VIEW STAGING.INT_TRADE_REJECTS AS
SELECT t.trade_id, 'critical' AS severity,
  CASE
    WHEN t.trade_id IS NULL THEN 'missing trade ID'
    WHEN t.quantity IS NULL OR t.quantity <= 0 THEN 'quantity must be positive'
    WHEN t.price IS NULL OR t.price <= 0 THEN 'missing or invalid price'
    WHEN w.symbol IS NULL THEN 'unknown risk weight'
  END AS reject_reason
FROM STAGING.INT_CURRENT_TRADES t
LEFT JOIN RAW.RISK_WEIGHTS w ON t.symbol = w.symbol
WHERE t.trade_id IS NULL OR t.quantity IS NULL OR t.quantity <= 0
  OR t.price IS NULL OR t.price <= 0 OR w.symbol IS NULL;

CREATE OR REPLACE VIEW MARTS.FCT_TRADES AS
SELECT t.trade_id, t.account_id, t.symbol, t.version,
  t.quantity, t.price, t.quantity * t.price AS notional,
  w.risk_weight, t.quantity * t.price * w.risk_weight AS exposure
FROM STAGING.INT_CURRENT_TRADES t
JOIN RAW.RISK_WEIGHTS w ON t.symbol = w.symbol
WHERE t.trade_id IS NOT NULL AND t.quantity > 0 AND t.price > 0
  AND t.status = 'ACTIVE';

SELECT COUNT(*) AS active_facts, SUM(notional) AS notional, SUM(exposure) AS exposure
FROM MARTS.FCT_TRADES;
-- EXPECT: 3 active facts, 3000 notional, 1700 exposure. Two critical rejects remain.
SELECT * FROM STAGING.INT_TRADE_REJECTS;

-- 4. Replay in a transaction, then roll it back to keep the baseline for B002.
BEGIN TRANSACTION;
INSERT INTO RAW.TRADE_EVENTS SELECT * FROM RAW.TRADE_EVENTS;
MERGE INTO STAGING.INT_CURRENT_TRADES t USING STAGING.STG_TRADES s
  ON t.trade_id = s.trade_id
  WHEN MATCHED THEN UPDATE ALL BY NAME
  WHEN NOT MATCHED THEN INSERT ALL BY NAME;
SELECT COUNT(*) AS raw_deliveries FROM RAW.TRADE_EVENTS; -- EXPECT: 12
SELECT COUNT(*) AS current_keys FROM STAGING.INT_CURRENT_TRADES; -- EXPECT: 5
SELECT SUM(notional) AS notional FROM MARTS.FCT_TRADES; -- EXPECT: 3000
ROLLBACK;

-- 5. B002 corrects T101 and introduces T105. Full raw history remains available.
INSERT INTO RAW.TRADE_EVENTS VALUES
('T101','A02','EQT','60','20.00',2,'2026-01-07 09:05:00','2026-01-07 09:31:00',7,'B002','ACTIVE'),
('T105','A03','EQT','20','25.00',1,'2026-01-07 09:30:00','2026-01-07 09:31:00',8,'B002','ACTIVE');
MERGE INTO STAGING.INT_CURRENT_TRADES t USING STAGING.STG_TRADES s
  ON t.trade_id = s.trade_id
  WHEN MATCHED THEN UPDATE ALL BY NAME
  WHEN NOT MATCHED THEN INSERT ALL BY NAME;
SELECT COUNT(*) AS active_facts, SUM(notional) AS notional, SUM(exposure) AS exposure
FROM MARTS.FCT_TRADES;
-- EXPECT: 4 active facts, 3700 notional, 2400 exposure. Publication stays blocked.

-- 6. Optional cancellation branch, rolled back before the independent repair branch.
BEGIN TRANSACTION;
INSERT INTO RAW.TRADE_EVENTS VALUES
('T102','A01','FX','25','40.00',2,'2026-01-07 09:40:00','2026-01-07 09:41:00',9,'B003_CANCEL','CANCELLED');
MERGE INTO STAGING.INT_CURRENT_TRADES t USING STAGING.STG_TRADES s
  ON t.trade_id = s.trade_id
  WHEN MATCHED THEN UPDATE ALL BY NAME
  WHEN NOT MATCHED THEN INSERT ALL BY NAME;
SELECT trade_id, version, status FROM STAGING.INT_CURRENT_TRADES WHERE trade_id = 'T102';
-- EXPECT: retained CANCELLED tombstone, version 2.
SELECT SUM(notional) AS notional FROM MARTS.FCT_TRADES; -- EXPECT: 2700
ROLLBACK;

-- 7. B003 supplies actual source fixes. Do not invent a default price.
INSERT INTO RAW.TRADE_EVENTS VALUES
('T103','A03','EQT','5','50.00',2,'2026-01-07 10:00:00','2026-01-07 10:01:00',9,'B003','ACTIVE'),
('T104','A04','BND','10','10.00',2,'2026-01-07 10:00:00','2026-01-07 10:01:00',10,'B003','ACTIVE');
MERGE INTO STAGING.INT_CURRENT_TRADES t USING STAGING.STG_TRADES s
  ON t.trade_id = s.trade_id
  WHEN MATCHED THEN UPDATE ALL BY NAME
  WHEN NOT MATCHED THEN INSERT ALL BY NAME;
SELECT COUNT(*) AS active_facts, SUM(notional) AS notional, SUM(exposure) AS exposure
FROM MARTS.FCT_TRADES;
-- EXPECT: 6 active facts, 4050 notional, 2670 exposure, zero rejects.

-- Simplified teaching gate. Production also verifies manifests, freshness,
-- source totals, authorization, and operational readiness before release.
CREATE OR REPLACE TABLE MARTS.PUBLISHED_RISK (
  release_id VARCHAR, as_of TIMESTAMP_LTZ,
  active_trades INTEGER, notional NUMBER(20,4), weighted_exposure NUMBER(20,4)
);
INSERT INTO MARTS.PUBLISHED_RISK
SELECT 'B003', CURRENT_TIMESTAMP(), COUNT(*), SUM(notional), SUM(exposure)
FROM MARTS.FCT_TRADES
HAVING COUNT(*) = 6
  AND (SELECT COUNT(*) FROM STAGING.INT_TRADE_REJECTS) = 0;
SELECT * FROM MARTS.PUBLISHED_RISK;

-- 8. Aggregate first, then rank. These totals must reconcile to 4050.
WITH account_totals AS (
  SELECT account_id, SUM(notional) AS notional
  FROM MARTS.FCT_TRADES GROUP BY account_id
)
SELECT account_id, notional,
  DENSE_RANK() OVER (ORDER BY notional DESC) AS notional_rank
FROM account_totals ORDER BY notional_rank, account_id;
-- EXPECT: A01 2000, A02 1200, A03 750, A04 100.

-- The worksheet is deliberately small and scans full source history.
-- For a real incremental load, design and test affected-key selection and
-- complete version ordering before optimizing the source scan.
