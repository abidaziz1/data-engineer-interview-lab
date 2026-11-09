# Interview Quest: Senior Data Engineer

A guided, press-Next simulation of one data platform (Snowflake, dbt Core, Airflow, Python, CI/CD) built to prepare you for a Senior Data Engineer interview. A coach talks you through every step, you watch the data move, then you practise the answers out loud.

No install. No account. No server. It runs from a double-click and works offline.

## Open it

1. Download or clone the repository.
2. Double-click **`index.html`**.
3. Pick a track and press **Next** (or the right arrow key).

To put it online, see [Publish on GitHub Pages](#publish-on-github-pages).

## How you learn

Every mission uses the same rhythm.

| Step | What you do |
| --- | --- |
| **SEE** | Watch animated diagrams. Orange blocks move along numbered arrows, so you always see **where data goes next**. Follow one loan (L-1001) through RAW, staging, intermediate and marts. |
| **TRY** | Quizzes, bug hunts, ordering games, architecture decisions (with the Coach's pick), and coding problems with hints and verified solutions. |
| **SAY** | Interview questions with a timer. You answer out loud first, then compare with a model answer written in first person from your resume, tick the key points you hit, and open the likely follow-ups. |

Coach Sam is an illustrated teacher who reacts to your answers. To use a real photo instead, see [Make it yours](#make-it-yours).

Text is large and dark by default. The **A-** and **A+** buttons change the size. A progress bar, XP, badges and a "minutes left" counter keep score.

## Three tracks

You choose a track on the first screen and can switch at any time from the **Map** button.

| Track | Time | What is in it |
| --- | --- | --- |
| **Fast** | about 105 minutes | The map, the key ideas, the main coding problems, and 3 mock questions. |
| **Standard** (recommended) | about 3 hours | Core topics, coding problems, decisions, incident drills and a 5-question mock round. |
| **Everything** | about 6 hours | Every lesson, drill and follow-up. |

Times are estimates based on reading and speaking each step. Speaking the answers aloud is part of the time.

## The missions

| # | Mission | Fast | Standard | Everything |
| --- | --- | --- | --- | --- |
| 1 | The project on one page | 10 min | 13 min | 17 min |
| 2 | Getting data in (Python, S3, Snowpipe) | 5 min | 12 min | 20 min |
| 3 | dbt Core essentials | 8 min | 14 min | 27 min |
| 4 | Advanced dbt (Jinja, macros, incremental, Python) | 11 min | 19 min | 42 min |
| 5 | Snowflake in depth | 7 min | 13 min | 27 min |
| 6 | Data modeling and SQL | 8 min | 15 min | 36 min |
| 7 | Python for pipelines | 6 min | 10 min | 25 min |
| 8 | Airflow and orchestration | 8 min | 15 min | 25 min |
| 9 | Quality, security and governance | 9 min | 15 min | 29 min |
| 10 | CI/CD, Git, Docker and Agile | 6 min | 13 min | 27 min |
| 11 | Incident drills | 6 min | 8 min | 19 min |
| 12 | Architecture decisions | 5 min | 10 min | 15 min |
| 13 | People, stories and resume probes | 6 min | 13 min | 20 min |
| 14 | Boss round and cheat sheet | 7 min | 9 min | 28 min |

Across the whole course: 42 interview questions, 15 coding problems (SQL, Python, dbt macros), 9 architecture decisions, 7 incident drills, 19 quizzes, 6 bug hunts, and a one-page cheat sheet at the end.

## The one project you follow

A financial-risk data product, so every example connects to the same story:

- **Sources:** a core banking database (loans, customers), a payments REST API (JSON), vendor credit-rating files (CSV).
- **Ingestion:** Python extractors, S3 landing folders by run date, Snowpipe into RAW tables.
- **Snowflake layers:** RAW, STAGING, INTERMEDIATE, MARTS, built by dbt Core.
- **Business rule:** expected loss = probability of default x loss given default x outstanding balance.
- **Consumers:** a REST API for application teams, and BI tools.
- **Around it:** Airflow, quality gates, role-based security and masking, CI/CD, Datadog monitoring.

## Publish on GitHub Pages

The site is plain static files with relative paths, so it works on any project URL.

1. Merge this branch into `main` (or open a pull request and merge it).
2. In the repository, open **Settings, Pages**.
3. Under **Build and deployment**, choose one of:
   - **Source: GitHub Actions.** The included workflow `.github/workflows/pages.yml` publishes the site on every push to `main`. Run it once from the **Actions** tab if you want it right away.
   - **Source: Deploy from a branch**, branch `main`, folder `/ (root)`. This also works, because `index.html` is at the root and `.nojekyll` is present.
4. Your site is at `https://<your-user>.github.io/data-engineer-interview-lab/`.

## Make it yours

- **Replace the examples with your real details.** Every model answer that mentions your employers uses only numbers from your resume. The Q&A screens carry a "Make it yours" note wherever you should swap in a real story. Do this for the incident, mistake and disagreement answers in particular.
- **Coach photo.** Put a picture in `assets/` (for example `assets/coach.jpg`) and set `coachPhoto: 'assets/coach.jpg'` in `js/config.js`. Leave it empty to keep the illustration.
- **Edit the lessons.** Each mission is one file in `js/content/`. Questions, answers, code and diagrams are plain data.
- **Change what each track contains.** Edit the two lists in `js/content/zz-tiers.js`.

## How it was checked

Everything that can be run was run, and the lessons only show code that passed its check.

- **SQL drills** ran in DuckDB, and the result tables in the lessons are the real output.
- **Python solutions** ran against unit tests (retry, pagination, flatten, latest per key, batching, validation). Every Python snippet compiles.
- **dbt snippets** (macros, Jinja loop, incremental model, snapshot, custom test, YAML tests, `dbt_project.yml`, `dbtRunner`) were parsed and compiled with dbt-core 1.12 on DuckDB. The compiled SQL shown in the lessons is real compiler output.
- **The Airflow DAG** was parsed by Airflow 2.10.5 with zero import errors, and its structure matches the diagram.
- **The CI workflow** parses as valid YAML.
- **The app** was clicked through on all three tracks in Chromium with no console errors, no horizontal overflow, and no text under 15 px. An end-to-end test exercises every interactive element (`dev/e2e.js`).

What was **not** run: Snowflake-specific statements (Time Travel, clustering, Streams and Tasks, Snowpipe, masking policies, `FLATTEN`) were reviewed but not executed on a live Snowflake account. dbt was run on DuckDB, not on the Snowflake adapter. Terminal logs and DAG runs in the animations are scripted simulations that follow the real output format.

## A note on privacy

The model answers name employers and use numbers from your resume. A GitHub Pages site is **public**, even when the repository is private on most plans. The page asks search engines not to index it, but anyone with the link can read it. If that matters, keep the folder local and open `index.html` from your computer instead.

## For maintainers

No build step. Plain HTML, CSS and JavaScript (no modules, so `file://` works).

```text
index.html            the page
css/app.css           all styling
js/config.js          optional settings (coach photo)
js/util.js            text helpers, syntax highlighter, storage
js/graph.js           diagram engine (nodes, edges, moving packets)
js/graphs.js          diagram definitions (plain data)
js/coach.js           the coach illustration
js/term.js            terminal simulator and dbt log builder
js/render1.js         SEE scenes     js/render2.js   TRY and SAY scenes
js/build.js           helpers used to write lessons
js/content/*.js       the lessons, one file per mission
js/content/zz-tiers.js  which scenes belong to which track
js/app.js             navigation, XP, progress, map
dev/                  content lint, end-to-end test, text-size check
```

Checks (Node 20 or later):

```bash
node dev/lint-content.js          # highlight ranges, answer lengths, style rules
npm install playwright && npx playwright install chromium
node dev/e2e.js                   # every interactive element
node dev/check-text-size.js       # no text below 15 px
```

Fonts: DM Sans, Manrope and IBM Plex Mono, all under the SIL Open Font License (licence files are in `assets/fonts/`).
