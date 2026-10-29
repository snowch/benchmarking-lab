# Benchmarking Lab

Copyright © 2026 Christopher Snow.

An interactive book about designing, running and explaining technology comparisons
that help a customer choose. Start with a small experiment, develop a fair workload
and measurement method, then use evidence to build a recommendation.

Start reading: <https://snowch.github.io/benchmarking-lab/chapters/start-here.html>.
Chapter 1 remains at <https://snowch.github.io/benchmarking-lab/>.

## The book

The introduction and all twelve chapters are complete, with worked examples,
exercises, independent practice, progressive hints, further reading and evidence
that can be downloaded. The chapters use several kinds of execution deliberately:

| Chapters | What runs                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | A real scalar WebAssembly memory traversal, with editable source and checked sums.                                                                                                    |
| 2        | DuckDB-Wasm and PGlite against identical orders, with checked answers and every request plotted.                                                                                      |
| 3–5      | Real SQL equivalence checks, workload replays and runner interventions using the same browser engines.                                                                                |
| 6–8      | Evidence-analysis tools for independent runs, request populations and load steps; authored starter inputs are labelled. Chapter 6 also imports real Chapter 2 exports.                |
| 9–10     | A downloadable real Kafka, S3-compatible storage and Postgres harness, plus browser trace inspection and backlog plots. Docker Engine and Compose are required for service execution. |
| 11       | A validated capacity and complete-deployment cost planner with visible provenance, assumptions and sensitivity.                                                                       |
| 12       | A persistent benchmark brief/report builder, evidence attachments and a downloadable self-checking Python HTTP runner to adapt.                                                       |

Browser timings describe the tested browser builds and device. Analysis exercises
and cost assumptions are not live service measurements. Short infrastructure
smoke tests establish execution and checking, not sustainable capacity, production
availability or a universal winner.

One book menu connects every page. It stays visible on desktop/tablet and uses a
collapsed “Chapters” disclosure on phones. With JavaScript disabled, the phone
menu starts open and the complete reading path remains available. Light/dark themes
and a clearly marked current chapter are shared throughout.

Settings and notes are local browser drafts where storage is available. Downloads
are the portable record; no offline installation, account or cross-device sync is
implemented. Imported evidence remains local. Wasm engines load only after Run.

## Develop and verify

Use Node 24 or later:

```sh
npm ci
npx playwright install --with-deps chromium
npm run dev
npm run check
```

The dev URL is <http://localhost:5173/benchmarking-lab/>. `npm run check` checks
formatting, strict TypeScript, the production build, internal links/fragments, real Wasm/database correctness
and browser journeys at the GitHub Pages base path. An installed browser can be
selected with `CHROMIUM_PATH=/usr/bin/chromium npm run check`. Tests verify
arithmetic, evidence, lifecycle, layouts and state; they never require a particular
engine to win a timing comparison.

Run the native service harness separately using [its README](harnesses/infrastructure/README.md).
It creates an isolated local Compose topology and writes raw observations to its
`results/` directory. The book ships a [download bundle](public/harnesses/infrastructure.zip).
The independent runner in [Chapter 12](chapters/12-defensible-comparison.html) uses
Python's standard library and includes an intentional wrong-answer exercise.

## Measurement and source

- [Course progression](docs/plan.md): chapter outcomes and execution boundaries.
- [Memory contract](docs/measurement.md): timed region, checks and limits.
- [Database contract](docs/database-measurement.md): pinned engines, SQL, setup and evidence.
- [Methods contract](docs/methods-measurement.md): fairness, replay and runner accounting.
- [Statistics contract](docs/statistics-measurement.md): independent runs, populations, intervals and load rules.
- [Infrastructure contract](docs/infrastructure-measurement.md): topology, guarantees, traces and limitations.
- [Decision tools contract](docs/decision-measurement.md): sizing/TCO semantics, evidence and report formats.
- [Design review](docs/design-review.md): patterns selected from six companion books.
- [Sizing and TCO](https://snowch.github.io/sizing-and-tco/): the companion for deeper modelling.

The static HTML lives in `index.html` and `chapters/`. Small TypeScript modules in
`src/` own each lab. Vite discovers chapter HTML automatically. Shared typography
and navigation live in `style.css`, `lesson.css` and `chapter.ts`; group-specific
styles and runtimes stay scoped to their lessons.

The initial memory and database workers remain independent of the analysis tools.
They use WABT 1.0.39, DuckDB-Wasm 1.32.0 and PGlite 0.5.13, self-hosted under the
Pages base path. Notices ship in `public/third-party-notices.txt` and
`public/engine-licenses.txt`. Downloadable harnesses contain authored source and
pinned dependency references; dependencies are installed when the reader builds.

## Publish and maintain

`.github/workflows/deploy.yml` checks pushes and pull requests. Successful pushes
to `main` publish `dist/` through GitHub Pages Actions. The site needs no backend,
external CDN or cross-origin isolation headers. `prebuild` and `predev` copy pinned
database resources into ignored `public/engines/`.

When editing a chapter, preserve its customer question, source/provenance,
correctness checks, measurement boundary, independent task and interpretation
limits. Keep status labels and previous/next links consistent across all book
menus. An explanatory model must stay visibly distinct from measured execution.

When editing the infrastructure harness, regenerate and verify its source-only
download with Python 3:

```sh
python3 scripts/package-harness.py
python3 scripts/package-harness.py --check
```

CI verifies the bundle against its source and checks both downloadable Python
programs for valid syntax. Infrastructure runs are tested separately against real
local services; the browser suite does not imply those services ran inside Pages.
