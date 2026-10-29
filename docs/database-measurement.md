# Chapter 2: browser database measurement contract

Copyright © 2026 Christopher Snow

This lab implements a first, bounded database comparison for readers learning to design and explain benchmarks. Its two preset SQL queries execute in real local engines; neither answers nor timings are simulated. The lesson deliberately avoids an overall winner and asks the reader for a conditional finding and a next experiment.

## Reproduce the shipped experiment

```sh
npm ci
npm run build
CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/database.spec.ts
npm run preview -- --port 4173
```

Open `/benchmarking-lab/chapters/02-duckdb-postgres.html`. Press **Run database comparison**, inspect the result and download its JSON record. Run both sizes before leaving the tab. Up to four completed records are retained in tab memory; changing controls marks mismatching selected results as stale. Notes, the interpretation draft and input selections are saved locally when storage is available. Completed records are not persisted across page reloads.

The production build uses the GitHub Pages base path `/benchmarking-lab/`. `prebuild` and `predev` call `scripts/prepare-engines.mjs`, which copies five resources verbatim from the exact npm packages into ignored `public/engines/` and writes their SHA-256 manifest. Vite copies that directory into `dist/engines/`; no CDN or backend is used. The wrapper JavaScript is bundled with the dedicated runtime worker. Vite also emits PGlite's default URL resources under `dist/assets/` because the upstream package references them; the lab explicitly passes the copies in `engines/` and does not fetch those duplicate defaults.

Package pins:

- `@duckdb/duckdb-wasm` **1.32.0** (stable npm release), MVP bundle.
- `@electric-sql/pglite` **0.5.13**.

Package versions identify JavaScript distributions, not necessarily database engine versions. Each fresh engine executes `SELECT version();`; the returned runtime string is retained independently in the record. `package-lock.json` pins transitive dependencies. Source and licence notices are at `public/engine-licenses.txt`.

No engine code or binary is loaded before an explicit Run. The initial chapter imports only the UI, fixture model and theme code. The self-hosted engine resources total about 54 MiB before HTTP compression, plus wrapper JavaScript. The MVP bundle avoids cross-origin isolation and shared-memory requirements. Both engines use a single execution thread, with one connection and an in-memory database. PGlite starts with 128 MiB of linear memory; both engines may grow memory. Budget roughly 300 MiB or more, rather than treating the initial allocation as a cap.

## Fixture, queries and expected answers

`src/database-model.ts` is the source of the deterministic fixture and SQL. The static chapter shows the complete schema and generator recipe. The interactive source view expands every load statement for the selected size. Export also retains the full unminified model source, all INSERT statements and their SHA-256 hash, so the evidence does not depend on a later copy of the source repository.

The two bounded sizes are **2,000** and **20,000** orders. For offset `i` from zero through `N - 1`:

```js
const id = i + 1;
const row = [
  id,
  (Math.floor(i / 4) % 12) + 1,
  (i % 4) + 1,
  ((id * 37) % 10000) + 100,
];
```

The four columns are `order_id INTEGER`, `month_id INTEGER`, `region_id INTEGER`, `amount_cents INTEGER`. Values are identical in both engines. Numbered months avoid date and timezone conversions. Integer cents avoid floating point currency rounding; aggregates are explicitly cast to 64-bit integers. All expected totals remain exactly representable as JavaScript integers at both sizes.

The load transaction contains `BEGIN`, table creation, INSERT statements of 500 rows in ID order, and `COMMIT`. There are **no indexes or constraints**, including no implicit primary key. A separate `ANALYZE orders;` gathers planner statistics. The lookup at ID `floor(N / 2)` is an unindexed baseline, not a tuned point-lookup deployment test. The revenue query groups all orders by month and region and sorts by those integer keys. It returns all 48 groups, including their exact integer totals.

An independent JavaScript reference scans the generated rows to find the chosen order and accumulates grouped totals with a `Map`. It never uses either engine to produce an expected answer. Comparison uses ordered matrices of decimal strings so Arrow integers, JavaScript numbers and Postgres bigint strings have the same representation. No tolerance is used. The reference is checked against both engines before warm-up, during warm-up, and after every measured request. Any mismatch rejects the run; no partial record or summary is accepted.

## Operation order and measurement boundary

The browser generates the shared fixture, INSERT SQL and expected outputs once. It records fixture generation separately. It then starts DuckDB, loads it, and runs ANALYZE; starts PGlite, loads it, and runs ANALYZE. Both engines remain resident until query measurements finish.

Each engine gets one correctness request for each query, then one separate warm-up request for each query. Neither is included in the measured sample list. Each query has five or nine measured **pairs**, each containing one SQL request per engine. The first engine alternates between pairs. The second query inverts the first pair's starting engine. Queries never execute concurrently.

All durations use the page's monotonic `performance.now()` timer in milliseconds. Query timing starts immediately before `postMessage` and stops at the beginning of the matching response handler, after the browser has received the complete result. The worker converts every required returned field into a plain string matrix **before** posting that response. Verification and UI updates follow the timer. There is one query per request, no batching, no division by a batch size, and no invented engine-only time.

DuckDB uses its asynchronous wrapper and nested engine worker, with Arrow result conversion inside the lab worker. PGlite executes inside the lab worker and returns JavaScript rows. The common page-to-materialized-result boundary includes these different wrappers and transports, queueing, scheduling, engine execution, conversion and result transfer. It is an end-to-end browser request measurement. Request overhead and timer resolution can dominate small queries; no claim is made that it measures only execution within the engine.

Setup is separate from measured requests:

| Export phase   | Boundary                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startup`      | Before dedicated worker creation through lazy imports, binary/data fetch, Wasm compilation, in-memory engine initialization, connection establishment and `SELECT version()` response. |
| `load`         | Page dispatch through acknowledgement of the complete identical load transaction, including schema creation and SQL parsing.                                                           |
| `analyze`      | Page dispatch through acknowledgement of `ANALYZE orders;`. No index is created.                                                                                                       |
| `verification` | Sum of two separate correctness-request durations, one per query.                                                                                                                      |
| `warmup`       | Sum of two separate warm-up-request durations, one per query.                                                                                                                          |

The summary reports each engine/query median, observed minimum and maximum, and request count. Raw samples retain pair number, position within the pair, elapsed milliseconds, complete actual rows and successful verification. Ranges are descriptive; the lab does not calculate confidence intervals, attach significance to differences, or infer a universal winner.

## Cancellation and bounded work

The main thread remains responsive while engine work runs in dedicated workers. Startup has a 60-second limit per engine; loading has a 30-second limit; setup and each query have 15-second limits. Manifest fetching is limited to 15 seconds. Graceful close has a 3-second limit, followed by unconditional worker termination. A timeout, a failed engine response, a failed answer, Stop, page exit or a hidden tab terminates/discards the current workers. A run cannot continue accepting samples after a stop. Every next run creates fresh workers and databases.

Stop also aborts an in-flight manifest fetch. The page listens for visibility changes and rejects the unfinished run when hidden, to avoid accepting background-tab scheduling as a valid measurement. No partial run is added to the completed history. A previous completed record remains inspectable and exportable. Successful runs close both engines and terminate their workers before being accepted into history.

## Evidence and limits

The `benchmarking-lab-databases-v1` JSON includes build identifier, times, exact SQL/schema/setup, fixture source and load statements/hash, independent expected outputs, package and runtime versions, expected build asset manifest with hashes (not a per-run integrity verification of downloaded bytes), browser details, method text, every setup phase, every actual measured answer and sample, and the prediction at run start. The current notes and conditional finding are attached in a clearly labelled interpretation block at export time. Editing inputs never rewrites an accepted measurement snapshot.

This experiment holds input values, query text, output order, thread choice and outer timing boundary constant. It does **not** equalize storage layouts, optimizers, physical plans, memory consumption, runtime defaults or wrapper overhead. Sequential setup always starts DuckDB first. Both resident engines compete for the same browser memory budget. Browser caching affects startup; JIT, thermal state, browser work and query warm-up affect later requests. Alternating measured order distributes some order effects but does not remove them.

The fixtures are synthetic, tiny, single-client, warm and unindexed. There is no persistent disk, database network, native server process, customer distribution or concurrent-user traffic. Browser-build findings cannot establish native/server performance, durability, capacity, or customer cost. Indexed workloads, realistic distributions, deployment configuration, repeated independent runs and uncertainty belong in the next benchmark design.

## Reading the comparison plots

Each query has a horizontal plot of the selected completed run. Both engines share
one zero-based time scale within that query; different queries may have different
scales. Every measured request is a dot. Vertical offsets keep repeated values
visible and do not represent another measured quantity. A diamond below each row
marks the median; the horizontal line spans the observed minimum and maximum.
The observed range is not a confidence interval.

Exact medians, observed ranges and counts remain available in an expandable table;
the request table and JSON export retain all samples and their execution order.
The plots redraw at the available width without scaling down their text. Choosing
a different completed run updates the plots, exact values and generated finding
together. Findings describe lower medians in the selected browser run. Equal
medians at the displayed three-decimal precision are described as equal at that
precision. They do not establish statistical confidence or a general winner.
