# DataCraft · The Pipeline Walkthrough

One small financial-risk project, explained in **20 sequential steps** for **2–3 hours of interview preparation**. Open the site and press **Next**. Every step connects a visible dataset, a transformation, and a likely interview question.

## Start

Node.js 20 or later. No package installation, API keys, Snowflake account, or backend is needed.

```bash
npm start
```

Open **http://localhost:5173**. Begin with the full project map, then follow the route. The previous daily schedules, question catalogue, and separate coding curriculum have been removed.

## What you will understand

```text
Trade events → Snowflake raw → dbt staging → business models
             → facts + dimensions → quality gate → application

Python loads source data. Airflow coordinates the sequence.
Git + CI review changes. Tests + monitoring protect publication.
```

The route covers the actual source records, Snowflake compute and schemas, dbt Core and Cloud, sources, seeds, ref(), staging, Jinja macros, dimensional modeling, incremental merges, replay, corrections, cancellation, rejected rows, repair, governed publication, SQL windows, performance, security, Python, Airflow, CI/CD, and your project explanation. It ends with **five rehearsal prompts**, not another study programme.

Read the three explanations beside each visual. Open **Interviewer asks** when ready to rehearse. Short code appears where it explains the mechanism. Simulations play automatically; **Replay flow** repeats them. The main **Next** button remains available throughout.

Use **Project map** to jump to any step. **Aa** increases text size further. Progress and optional project-story notes stay in this browser. Export notes before changing browsers or clearing site storage. Previous version-1 progress is left untouched.

## One consistent teaching dataset

Six initial deliveries contain five trade keys, a duplicate T101, and two invalid current records. Quantity must be positive in this deliberately long-only example. All amounts are USD; weighted exposure is `quantity × price × reference weight`, not a regulatory model.

| Scenario | Raw deliveries | Current keys | Active accepted facts | Critical rejects | Accepted notional | Weighted exposure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Initial B001 | 6 | 5 | 3 | 2 | $3,000 | $1,700 |
| Replay B001 | 12 | 5 | 3 | 2 | $3,000 | $1,700 |
| Correction B002 | 8 | 6 | 4 | 2 | $3,700 | $2,400 |
| Cancel T102 after B002 | 9 | 6 | 3 | 2 | $2,700 | $1,900 |
| Repair after B002 | 10 | 6 | 6 | 0 | $4,050 | $2,670 |

Cancellation and repair are alternative branches. The repair follows B002 without the cancellation. A filtered set of valid facts can pass structural checks while publication remains blocked by unresolved critical rejects.

## Optional real SQL

`practice/snowflake-lab.sql` contains a complete sandbox worksheet using the same fixtures: object creation, source loading, deterministic deduplication, current-state merges, replay, cancellation, repairs, a teaching release gate, and account aggregation. The app offers a download beside its worksheet examples.

Running it is optional. It replaces named tables inside `INTERVIEW_LAB` and needs a role with the required Snowflake privileges. The browser never executes SQL, Python, dbt, or Airflow. Its numerical scenarios are calculated locally in JavaScript. Illustrations of partition pruning, masking roles, and task execution are labeled simulations. Code snippets are deliberately short and state their assumptions. The worksheet has not been executed against a live Snowflake account.

Use the synthetic project to learn the mechanisms. Relate interview answers to verified responsibilities from your own resume; do not claim this example was an employer system.

## GitHub Pages

Keep `index.html` at the repository root. In **Settings → Pages**, set **Source → GitHub Actions**, then run **Validate and deploy to GitHub Pages** from Actions. The included workflow tests, checks, builds, and publishes `dist/`. Relative assets and hash routes support repository URLs.

## Checks and offline copy

```bash
npm test
npm run check
npm run build
npm run standalone
```

The last command writes `dist/datacraft-standalone.html`, with embedded code, fonts, styling, and the optional SQL download. Open that generated file directly in a browser. Normal development uses an HTTP server because browsers restrict multi-file module loading on file URLs.

Source: `src/guided-app.js` (interface), `src/content/walkthrough.js` (20 steps), `src/engine/pipeline.js` (calculated scenarios), `src/engine/walkthrough-state.js` (local progress), and `walkthrough.css` (readable responsive layout).
