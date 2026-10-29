# Benchmarking Lab

Copyright © 2026 Christopher Snow.

An interactive book about measuring performance and explaining the evidence.
The first chapter compares two ways to sum a grid using real WebAssembly in a
browser worker. Read the source, step through an address diagram, change the grid
size, edit the Wasm function, and download the measured samples with their conditions.

Course URL: <https://snowch.github.io/benchmarking-lab/>.

## Current scope

One complete chapter: **Same work, different order**. It includes a working
benchmark, optional predictions and notes, five practice hints, and a deliberate
fault-and-repair exercise. The remaining chapters are explicitly marked as planned.
The address diagram is explanatory; elapsed times come only from executed Wasm.

The benchmark uses the same scalar function for both traversal orders. Compilation
and input setup happen before timing. It warms both orders, calibrates a common
batch size, alternates the starting order, checks every returned checksum, and
shows all samples alongside medians. Edited code must satisfy the fixture checksum;
that check cannot prove that arbitrary code performs equivalent work.

Runs stop when the tab becomes hidden, on request, or after 30 seconds. Source,
settings and notes save locally when browser storage is available. Run records
remain in the current tab until replaced or reloaded; download them to retain
raw samples, source, hashes, browser identifier and build. Results are never uploaded.
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
are required. Wasm and the compiler are loaded into a worker only when Run is pressed.

## Design and implementation

- [Review of six companion books](docs/design-review.md): the selected patterns and their sources.
- [Measurement contract](docs/measurement.md): timing boundaries, limits and validation.
- [Course plan](docs/plan.md): progression and future work.
- `index.html`: the readable chapter, also available without JavaScript.
- `src/kernel.wat`: the original scalar Wasm loop.
- `src/benchmark.ts`, `src/worker.ts`: compilation and measurement.
- `src/main.ts`: address explorer, controls, results and local drafts.
- `tests/lab.spec.ts`: real Wasm arithmetic and browser journeys.

This first chapter follows GPU Lab's small standalone approach and the shared
books' interaction vocabulary. It does not vendor or modify `learning-platform`.
The design review explains why the fixed ten-section runtime is not used here.
WABT 1.0.39 compiles WAT locally; its Apache-2.0 licence ships in
`public/third-party-notices.txt`. No lesson text or application code is copied
from the reference books.
