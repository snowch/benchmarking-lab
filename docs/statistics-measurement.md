# Chapters 6–8: evidence and measurement boundaries

Copyright © 2026 Christopher Snow.

These chapters contain runnable local evidence-analysis exercises. Their starter
CSV values were authored for teaching and were not measured from a database,
server or customer. Every page identifies this provenance beside its input and
includes the provenance in evidence downloads. Charts are calculations from the
current input, not live service measurements.

Chapter 6 additionally imports completed Chapter 2 exports. Each original record
is retained in its evidence download. The importer accepts the existing
`benchmarking-lab-databases-v1` format and requires matching settings, build,
engine identities, method and fixture hash. It rejects duplicate start timestamps,
incomplete records and absent, non-positive or unverified query timings. It takes
the within-run median of each engine's selected query. These two summaries form
one paired observation. It does not treat individual requests within one run as
independent experiments. Independence and stable operating conditions remain
experimental assumptions that the importer cannot establish.

The reported ratio is exp(mean(ln(A/B))). Approximate interval endpoints are
exp(mean ± t × sample_sd / sqrt(n)), with n−1 degrees of freedom. Critical values
are the two-sided 95% Student t values rounded to three decimals; above 30 degrees
of freedom the implementation conservatively uses t(30) = 2.042. The normality
approximation applies to independent paired run log ratios, not to raw request
latencies. Few runs cannot establish that assumption. A ratio above one means B
has lower elapsed time. B's proportional time reduction is 1 − 1/ratio. The chapter
separates parity from a predeclared practical improvement threshold and explains
why the interval does not describe 95% of requests or remove workload bias.

Chapter 7 records elapsed event times relative to a single observation window.
Its statuses are mutually exclusive caller-visible terminal outcomes (`ok`,
`error`, `timeout`) or `pending` at window end. A pending request can be planned
but unsent. Timeouts are censored caller outcomes, not completed server latencies.
Latency summaries include successful responses only, with send-to-response or
planned-arrival-to-response timing selected explicitly. Percentiles use nearest
rank ceil(p × n), with one-based indexing. Offered rate counts planned arrivals;
successful throughput counts successful completions over the whole window. These
populations are reported beside failures and unfinished work. The chapter explains
that planned timestamps expose generator waiting only for work actually planned;
they do not reconstruct omitted arrivals.

Chapter 8 checks each load-step accounting identity:

    starting pending + offered rate × duration
      = successful + errors + timeouts + ending pending

CPU percentages are supplied diagnostic context. They are not used to infer a
bottleneck or claim measured utilisation. A point passes the local screen when its
supplied successful-request p99 meets the target, its error-plus-timeout fraction
meets the allowance and pending count does not grow. This permits a point draining
an initial queue to pass the screen; it does not label it steady state. The text
requires repeated long observations, bounded queues and recovery under ongoing
arrivals before a sustainable-capacity claim. Per-request records and percentile
methods must accompany actual supplied summaries. Server work continuing after a
caller timeout needs a separate server-queue account.

For actual experiments, readers run a two-size Chapter 2 browser sweep, with at
least five fresh runs per size and compatible evidence analysed separately. That
establishes only single-request browser-build data-size observations. Native/server
load sweeps require the corresponding real service and runner. The infrastructure
harness linked from Chapter 8 offers a runnable service exercise with its own
stated workload and guarantees, and does not establish database capacity.

Evidence downloads include current CSV, control values, calculations, notes,
provenance and imported originals. Local storage is optional; downloads are the
portable record. Edits invalidate the previous downloadable calculation until the
reader analyses again. Validation rejects malformed CSV, impossible event order,
missing outcomes, duplicate request IDs and unreconciled load counts. The format
intentionally accepts plain unquoted CSV, up to 10,000 rows, for inspection rather
than unlimited trace ingestion.

Focused tests in `tests/statistics.spec.ts` cover interval direction and numerical
values, tail populations and boundary changes, load accounting, qualification,
real-export import structure, portable original records and saved notes. The root
integration run supplies the built preview and browser validation.
