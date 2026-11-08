# DataCraft — Data Engineer Interview Lab

A visual, self-paced interview preparation website tailored to the supplied Mohammad Alam resume and Data Engineer job description. Built for a 3–7 day preparation window, with plain English first and optional deeper engineering detail.

**68 guided scenes · 105 interview questions · 16 coding walkthroughs · 8 architecture decisions · 2 mock-interview sets**

## Open it locally

Requires Node.js 20 or later. No package installation is needed.

```bash
cd data-engineer-interview-lab
npm start
```

Open **http://localhost:5173**. Use an HTTP server: opening `index.html` directly with a `file://` URL can block JavaScript module imports.

A separate **datacraft-standalone.html** is also provided with the delivery. Download and open that file directly in a browser for immediate study; it embeds the code, styles, and fonts. Progress on file URLs depends on the browser's storage policy. Use the export button to keep a backup. The multi-file project remains the version to upload to GitHub Pages.

Alternatively, use `python3 -m http.server 5173` from the project folder. The site has no application backend, cloud credentials, account requirement, or paid API dependency.

## Publish on GitHub Pages

### Easiest: deploy directly from the main branch

1. Create a GitHub repository.
2. Upload the **contents of this folder**, so `index.html` is at the repository root. Include `src/`, `assets/`, `styles.css`, and `.nojekyll`.
3. In **Settings → Pages → Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**, then save.
5. Open the Pages URL shown in that settings page after deployment completes.

If you upload through the GitHub web interface, hidden files such as `.github/` and `.nojekyll` may need to be added separately. This direct branch method does not need the included Actions workflow. You can omit `.github/` when using it.

### Or: use the included GitHub Actions workflow

Push this full project to a repository whose default branch is `main`, including `.github/workflows/pages.yml`. In **Settings → Pages**, choose **GitHub Actions** as the source. The workflow runs tests, checks the source, builds `dist/`, and publishes the static site. If your branch has a different name, update `branches: [main]` in the workflow.

```bash
git init
git add .
git commit -m "Add visual data engineer interview lab"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

All asset URLs are relative and navigation uses hash routes, so repository sites such as `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/` work without a base-path change or a 404 rewrite.

## How to study

- **Learning lab:** advance with **Next scene**. Every scene offers a visual flow, implementation, and interview answer. No quiz blocks progress. A scene is marked explored when you advance from it.
- **Try a different input:** compare the initial batch, duplicate replay, correction, cancellation, and repair. The browser calculates small fixture results; these are not calls to Snowflake or dbt.
- **Under the hood:** inspect code and configuration. Examples name version assumptions and missing production integration where relevant.
- **Interview room:** search and filter theory, scenarios, and behavioral questions. Reveal an answer, review follow-ups and pitfalls, and self-rate confidence.
- **Code studio:** inspect input and expected output, reveal hints, optionally draft a solution, and step through highlighted lines. The editor does **not** execute SQL, Python, dbt, or YAML.
- **Architecture:** inspect stage responsibilities and choose between design alternatives to reveal their tradeoffs.
- **Your project stories:** rehearse the three main employers and record verified details behind resume claims.
- **Study plan:** follow five sessions, use the last-hour brief, or switch to the essential-scene route.
- **Mock interview:** two fixed 12-question sets with an optional 90-second timer, local notes, answer guides, and self-assessment. No microphone, recording, or AI grading.

Use `/` or `Ctrl/Cmd+K` to search. Tab and Shift+Tab navigate controls; arrow keys navigate lesson tabs; Escape closes dialogs.

## The financial-risk teaching scenario

All trades and identities are synthetic. The risk calculation is deliberately simplified: `quantity × price × reference weight`, with every amount in USD. It is not a regulatory capital or pricing model.

| Fixture | Raw deliveries | Current keys | Accepted active facts | Critical rejects | Accepted-scope notional | Weighted exposure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Initial B001 | 6 | 5 | 3 | 2 | $3,000 | $1,700 |
| Replay B001 | 12 | 5 | 3 | 2 | $3,000 | $1,700 |
| Correction B002 | 8 | 6 | 4 | 2 | $3,700 | $2,400 |
| Cancellation of T102 after B002 | 9 | 6 | 3 | 2 | $2,700 | $1,900 |
| Repair rejects after B002 | 10 | 6 | 6 | 0 | $4,050 | $2,670 |

The cancellation and repair are alternative teaching branches. The repair fixture does not include the cancellation event.

The initial invalid trades remain visible in quarantine. Structural tests on accepted data can pass while **full publication remains blocked**. The repair branch applies versioned source corrections; it does not guess a price or silently change the business rule. Passing this small fixture gate does not stand in for production source controls, authorization, or freshness checks.

The engine uses JavaScript numbers for this small exact fixture. Production financial transformations should use appropriate decimal types and an agreed rounding policy; those patterns are covered in the SQL and Python lessons.

## Resume accuracy

The site distinguishes documented resume claims from recommended practice patterns. It does not invent exact Wells Fargo connectors, SLAs, source names, volumes, degree institution, or the methodology behind the resume's percentages. The project-story evidence checklist identifies details to verify before the interview.

Overall experience of 13+ years is kept separate from the summary's 5+ years of production dbt/Snowflake. Bank of America’s 200+ DAGs and Citigroup’s 150+ pipelines are not combined. A self-rating or explored-scene count is a learning aid, not proof of skill or production experience. No finite guide can guarantee every possible interview question.

## Local progress and privacy

Progress is stored in this browser's `localStorage`, scoped to the site origin. It is not synced to GitHub or another device. Use the preferences button in the top bar to export or import a JSON backup. Backups include your notes and code drafts: keep confidential employer data out of them. Reset is available with an explicit in-app confirmation.

There is no analytics or application network call. The distributed app uses local font files and system fallbacks. Official-reference links open only when selected. The app itself has no live LLM connection.

## Development and validation

```bash
npm test       # fixture invariants and curriculum integrity
npm run check  # JavaScript syntax and local imports
npm run build  # copy static output into dist/
npm run standalone # generate an optional single-file HTML copy
```

Source layout:

```text
index.html                Entry point
styles.css                Responsive interface and accessibility styles
src/app.js                Routing, lesson player, question room, mock, persistence UI
src/content/              Curriculum, questions, challenges, and decisions
src/engine/pipeline.js    Deterministic synthetic-data transformations
src/engine/storage.js     Versioned local progress and backup normalization
tests/                    Node.js tests
scripts/                  No-dependency server, checks, and static build
.github/workflows/        Optional GitHub Pages deployment
```

Examples teach concepts across dbt Core, Snowflake, Airflow, and CI/CD. Check their syntax and capabilities against the versions used in your actual environment. The Airflow DAG coding example explicitly targets 2.x; newer deployments can require updated imports. Python models, generic-test arguments, source freshness configuration, and snapshot syntax are version-sensitive.

The optional `tests/dom-smoke.mjs` exercises navigation and interactions using Happy DOM. Install it separately with `npm install --no-save happy-dom` to run that check. It is a DOM interaction test, not a browser layout or screenshot test. The app and the normal test/build path need no installed packages.
