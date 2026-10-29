# Chapters 3–5: equivalent work, workloads and the runner

Copyright © 2026 Christopher Snow

These lessons run SQL in the exact browser engines already pinned for Chapter 2:
`@duckdb/duckdb-wasm` 1.32.0 and `@electric-sql/pglite` 0.5.13. Runtime database
versions are obtained with `SELECT version()`. No package additions, remote database
service or canned query timing are used. See [the engine measurement contract](database-measurement.md)
for the shared worker, self-hosted engine resources and deployment boundary.

## Reproduce and inspect

```sh
npm ci
npm run build
CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/methods.spec.ts
npm run preview -- --port 4173
```

Open these pages under `/benchmarking-lab/chapters/`:

- `03-equivalent-work.html`: run the flawed query, export it, select the repaired
  query, optionally enable the month index, rerun and export.
- `04-representative-workloads.html`: compare 80% and 20% lookup traces with the
  same data; then change just size or distribution. Export each run before rerunning.
- `05-trust-the-benchmark.html`: compare closed-loop observations with 0 and 20 ms
  client pauses, then scheduled arrivals with the 20 ms pause. Inspect timestamps
  and accounting for every offered work item.

The lessons remain readable without JavaScript; executable controls remain disabled.
With JavaScript, settings and notes save locally when storage is available. Completed
or incomplete evidence is held in tab memory only until the next run or page exit.
Downloads always describe the completed record's original settings, even if current
controls differ. Notes are captured at export time and do not mutate the raw samples.
No engine worker or Wasm resource loads before an explicit Run.

Sources:

- `src/methods-model.ts`: edge fixture, SQL, independent reference, workload fixture
  and ten-request ordering.
- `src/methods-runtime.ts`: UI, worker requests, timing, run lifecycle, arrival
  scheduling, queue discipline, evidence and local drafts.
- `src/database-model.ts`: the original deterministic generator, INSERT statements,
  SQL and reference aggregation reused by workload/runner exercises.
- `src/database.worker.ts`: existing adapters that execute real SQL and return
  ordered string rows.

## Shared timing and lifecycle

Each Run creates fresh dedicated workers and in-memory databases, with a single
execution thread and one connection per engine. Setup uses the shared worker without
modifying its adapters. The worker wrapper dispatches to DuckDB or PGlite and converts
complete rows to a plain string matrix. Query timing uses main-thread
`performance.now()` immediately before posting SQL until receiving that complete
matrix. It includes scheduling, worker messages, engine work, result conversion and
transfer. Correctness verification happens after this timer stops.

Startup is separately timed from the start request after the Worker constructor returns.
It includes asynchronous worker initialisation, lazy imports, asset fetching or cache
access, compilation, database startup and runtime version lookup; synchronous Worker
constructor overhead is excluded. Load includes
the actual CREATE/INSERT transaction for the large fixtures; the tiny Chapter 3 fixture
uses a CREATE statement and one INSERT. Optional index creation and ANALYZE are separate
preparation phases. Matching setup statements do not imply equal physical plans or
memory consumption. Browser scheduling, timer resolution, cached downloads, JIT and
other device work can affect every observation.

The startup request limit is 60 seconds; an exec request is limited to 30 seconds;
query and close requests are limited to 15 seconds. Stop, page exit and a hidden tab
terminate all active workers. Errors and timeouts stop the run and produce an explicitly
incomplete record. Workers are closed after successful work and terminated in all cases.
The evidence download is available even if failure occurs before the first SQL request.
A partial record is not a successful comparison.

The record format is `benchmarking-lab-methods-v1`. It stores build identity, original
settings, browser user agent, visibility at start, hardware-concurrency hint, wall-clock
creation time, monotonic clock time origin, package/runtime versions, copied asset
manifest with SHA-256 hashes, complete fixture and load SQL, exact query SQL, expected
and actual rows, every measured sample, setup phases, method text, errors and current
notes. It also includes full unminified methods model/runner and shared database model
source. Asset hashes identify the served package copies; the run does not independently
hash the bytes after browser fetching. No statistical confidence claim is generated.

## Chapter 3: correctness admission rule

The eight rows contain repeated values belonging to separate orders, NULL, zero,
negative cents and month-boundary distractors. NULL represents an order with an unknown
amount. The contract counts every January order and treats its unknown contribution as
zero cents. The independent JavaScript loop groups only `month_id === 1`; expected
ordered string rows are `[["1","3","450"],["2","2","0"]]`.

The deliberately flawed query counts only known amounts, sums distinct monetary values
and includes February. Its actual ordered rows in both engines are
`[["1","5","950"],["2","1","0"]]`. Its timings are genuine observations, explicitly
excluded from a claim about equivalent January reports. A completed diagnostic run may
therefore contain `verified: false`; this is the intended exercise outcome, not a hidden
benchmark failure. The repaired query must match every expected field.

Both engines start and load sequentially, DuckDB first. Each candidate executes three
times per engine, alternating the first engine at every repetition. There is no separate
query warm-up, so samples include first-use effects. The optional index is
`CREATE INDEX orders_month ON orders(month_id);`, applied to both before ANALYZE.
The fixture is deliberately too small to establish a useful index performance benefit.
The SQL casts counts and sums to BIGINT; integer-valued outputs compare as strings.

The exercise supports only correctness of these answers on this fixture. It does not
test persistence, acknowledgement durability, concurrent consistency or recovery.

## Chapter 4: workload replay

The fixture has 2,000 or 20,000 orders, generated by the Chapter 2 integer recipe. Uniform
mode retains the four-region cycle. In hotspot mode, rows whose zero-based offset is
not divisible by ten are assigned region 1; every tenth row cycles through regions 2,
3 and 4. Exactly 90% of these bounded fixtures is in region 1. The reference recomputes
expected lookup and report answers directly from those modified rows.

No indexes are built. Each engine executes both queries once before measurement;
those requests are checked and unmeasured. Ten measured requests per engine then follow
a deterministic trace with 2, 5 or 8 lookups. `trace()` spaces lookup jobs through the
trace using the change in `floor((position + 1) * lookupCount / 10)`. At each position,
the first engine alternates. No requests execute concurrently. Any unexpected result
invalidates the run.

Class medians, every individual request and each engine's trace sum remain visible.
The weighted summary is a calculation: lookup fraction times lookup median plus report
fraction times report median. It is not a measured combined request, the whole-trace
median or a capacity result. Trace sum adds only that engine's actual request durations;
it excludes intervening requests to the other engine. Minority classes have as few as
two samples. The exercise makes no inference of significance or a universal winner.

The ten-item trace uses one repeatedly accessed lookup ID and warm sequential reads.
It does not establish a customer's true locality, arrival rate, user concurrency or
server behaviour. Changing the mix also changes request order; an arithmetic-only
reweighting can instead be calculated from one saved set of class medians.

## Chapter 5: runner intervention

This exercise chooses one real engine, uses the 20,000-order uniform fixture, and checks
one unmeasured warm-up lookup. Twelve measured lookups follow. The SQL and expected
answer do not change with the arrival model or client intervention.

Closed-loop mode intends the next arrival only after the previous verified response.
Scheduled mode intends arrivals at 0, 5, 10, …, 55 ms, independent of completion, and
enqueues work using browser timers. One client drains the offered queue in FIFO order,
with at most one SQL request in flight. The per-request intentional preparation pause
is 0 or 20 ms via a browser timer. It models a controlled client delay; it is not
simulated engine latency. Even a zero-delay timer can yield and incur real scheduling
delay. Actual SQL responses are always obtained from the selected engine.

Each offered work item records position, intended arrival and actual enqueue offset
from a common observation start; submission, completion and error fields are added as
those events occur. Completed checked samples retain the corresponding four timestamps
and SQL request duration. All timestamps use one monotonic page clock. The differences
have distinct meanings:

- enqueue − intended: page timer/scheduler lateness;
- submission − enqueue: client queueing plus intentional preparation;
- completion − submission: the real SQL request boundary;
- completion − intended: total elapsed time from the planned arrival.

Accounting retains offered, submitted, completed, errors and pending. Offered equals
completed plus errors plus pending at the observation boundary. Submitted counts attempts,
not a separate terminal outcome. A request-level error is counted once; later unprocessed
items remain pending. Setup failures have zero offered work, retain the setup error,
and do not manufacture a request error count. The short achieved-throughput display uses
verified completions divided by time from observation start through the last checked
response; it labels this as a finite observation under the chosen runner. Error and
partial records carry no successful performance claim.

This finite queue is drained after the twelfth arrival. It is not a fixed-duration
sustained-load test, an engine capacity test, an empirical tail-latency study or a
production outage test. Zero pending at the end does not establish stability under
continuing arrivals. The instructional timeline elsewhere on the page is explicitly
invented arithmetic, separate from the actual measured timestamps.

## Validation boundary

`tests/methods.spec.ts` runs the real shipped engines, observes the deliberately wrong
and repaired results, verifies index phase separation, recomputes exported hotspot
aggregates independently, checks request-class counts, tests scheduled/closed-loop
timestamp ordering and full work accounting, and exercises early failure plus Stop.
It also verifies draft persistence, no pre-run engine fetching, no-JavaScript reading
and phone overflow. Tests assert meaning and provenance, not an expected speed winner.
Automated checks do not prove reader comprehension or browser-to-server portability.
