# Verification scope

The active version is the 20-step guided walkthrough. The old multi-day application and unused content modules have been removed.

All **17 Node.js tests passed**, covering deterministic version selection, stale replay, correction and cancellation behavior, critical-reject release blocking, source repair, account-total reconciliation, the short route, progress normalization and blocked storage, and exact agreement between the browser fixtures and optional Snowflake worksheet inputs.

`npm run check` checks JavaScript syntax, relative imports, and the entry-point assets. `npm run build` copies the static application, including the optional SQL worksheet. `npm run standalone` embeds the application, fonts, licenses, and SQL download into one HTML file.

Browser checks passed in Microsoft Edge for all 20 sequential steps and their interview-answer guides; duplicate replay, correction, cancellation, release rejection and repair, live formula input, role masking, pruning, task failure and repair retry, project navigation, notes and HTML escaping, reload persistence, and the standalone build with its embedded SQL download. Desktop (1280 and 1440 pixels) and mobile (390 pixels) layouts were checked for horizontal overflow, with separate screenshot review. The main teaching text measures 19px on desktop with a contrast ratio of approximately 10.49:1; the Aa control raises it to 21px. Browser checks reported no page errors.

No live Snowflake, dbt, Airflow, API ingestion, or LLM integration is asserted. The SQL worksheet inputs match the browser engine, but the worksheet has not been executed in Snowflake. Real integration also requires configured credentials, permissions, version-compatible dependencies, and production source and release controls.
