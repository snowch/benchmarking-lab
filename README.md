# Benchmarking Lab

Copyright © 2026 Christopher Snow.

An interactive book about measuring performance and explaining the evidence.
The first chapter compares two ways to sum a grid using real WebAssembly in a
browser worker. Read the source, step through an address diagram, change the grid
size, edit the Wasm function, and download the measured samples with their conditions.

Start reading: <https://snowch.github.io/benchmarking-lab/chapters/start-here.html>.

Chapter 1 remains at <https://snowch.github.io/benchmarking-lab/>.

## Current scope

An unnumbered **Start here** introduction explains the purpose, reader outcomes
and route through the book. It leads into two executable chapters:

- **Same work, different order:** sum a grid using a real scalar Wasm loop,
  inspect memory addresses, and explore how traversal order affects measured time.
- **DuckDB or Postgres?:** run the same order lookup and revenue aggregation in
  DuckDB-Wasm and PGlite. Verify the answers, inspect setup and query timings,
  change the dataset size, and download the run conditions and raw samples.

Chapters 3–12 have navigable skeleton pages with objectives, planned experiments,
design tasks and evidence checklists. Their labs are explicitly marked as planned.
Book contents and previous/next links connect the introduction and all twelve
chapters, including direct loads without JavaScript. Explanatory diagrams stay
distinct from measured outputs.

The chapter 1 benchmark uses the same scalar function for both traversal orders. Compilation
and input setup happen before timing. It warms both orders, calibrates a common
batch size, alternates the starting order, checks every returned checksum, and
shows all samples alongside medians. Edited code must satisfy the fixture checksum;
that check cannot prove that arbitrary code performs equivalent work.

Chapter 1 runs stop when the tab becomes hidden, on request, or after 30 seconds. Source,
settings and notes save locally when browser storage is available. Run records
remain in the current tab until replaced or reloaded; download them to retain
raw samples, source, hashes, browser identifier and build. Results are never uploaded.
Chapter 2’s timing boundaries, setup conditions, interruption behaviour and evidence
format are described in [its measurement contract](docs/database-measurement.md).
No offline installation or cross-device synchronisation is implemented.

## Develop and verify

Use Node 24 or later.

```sh
npm ci
npx playwright install --with-deps chromium
npm run dev
npm run check
```

The dev URL is <http://localhost:5173/benchmarking-lab/>. `npm run check` runs
formatting, strict TypeScript, a production build, Wasm correctness checks and
browser tests. Browser checks run against the production build at the Pages base
path. `CHROMIUM_PATH=/usr/bin/chromium npm run check` can use an installed browser.
Tests validate behaviour and arithmetic, never a device-specific timing ratio.

## GitHub Pages

`.github/workflows/deploy.yml` checks pushes and pull requests. Successful pushes
to `main` publish `dist/` using GitHub Pages Actions. The repository's Pages source
must be **GitHub Actions**. No backend, secret, external CDN or isolation headers
are required. Wasm engines and compilers are loaded into workers only when Run is pressed.
`prebuild` and `predev` copy the pinned database resources into ignored
`public/engines/`; the production build self-hosts them under the Pages base path.

## Design and implementation

- [Review of six companion books](docs/design-review.md): the selected patterns and their sources.
- [Chapter 1 measurement contract](docs/measurement.md): timing boundaries, limits and validation.
- [Database comparison measurement contract](docs/database-measurement.md): engine builds, correctness, setup and query timing.
- [Course plan](docs/plan.md): twelve chapters, from the first database comparison
  through Kafka, complete pipelines, capacity and cost, and a defensible report.
- [Sizing and TCO companion](https://snowch.github.io/sizing-and-tco/): capacity
  planning and cost modelling, linked from the planned cost chapter.
- `index.html`: the working first chapter, also available without JavaScript.
- `chapters/`: the introduction, working database chapter and static HTML outlines for chapters 3–12.
- `src/theme.ts`, `src/chapter.ts`: shared theme and lightweight outline-page behaviour.
- `src/kernel.wat`: the original scalar Wasm loop.
- `src/benchmark.ts`, `src/worker.ts`: compilation and measurement.
- `src/main.ts`: address explorer, controls, results and local drafts.
- `tests/lab.spec.ts`: real Wasm arithmetic and browser journeys.

This first chapter follows GPU Lab's small standalone approach and the shared
books' interaction vocabulary. It does not vendor or modify `learning-platform`.
The design review explains why the fixed ten-section runtime is not used here.
WABT 1.0.39 compiles chapter 1’s WAT locally; its Apache-2.0 licence ships in
`public/third-party-notices.txt`. Chapter 2 ships DuckDB-Wasm, PGlite and wrapper
dependency notices in `public/engine-licenses.txt`. No lesson text or application code is copied
from the reference books.

## Editing chapter outlines

Edit the corresponding HTML file in `chapters/`. Keep its question, objectives,
planned example, planned experiment, independent design task, evidence checklist
and interpretation boundary together. Update the book-contents lists and
previous/next links when changing chapter order or titles. Vite discovers all
chapter HTML entry points during the production build. These pages load the
shared theme without loading the benchmark worker or compiler.

An outline becomes a working chapter only after its real execution path, checks,
evidence and explanatory text are implemented and verified. Until then retain
the outline notice and planned-lab labels.
