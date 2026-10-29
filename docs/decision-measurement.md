# Capacity and capstone tools

Copyright © 2026 Christopher Snow.

Chapters 11 and 12 are complete lessons with planning and report tools. Neither
runs a deployment benchmark in the browser or infers server capacity from browser
engine timings. `src/decision-model.ts` contains the pure arithmetic, input
validation, evidence checks and report serialization. The two UI entry modules
import `chapter.ts`, the shared lesson typography and scoped `decision.css`.

## Capacity model

The starting plan contains invented capacities and prices in example credits.
It is not a comparison of named vendors, a live quote or a measured result.

A service group is the complete topology described by the author. Capacity and
compute price must cover that same group, including its replicas. Usable rate is
correct, on-time results per second per group multiplied by one minus headroom.
Active group count is the ceiling of required peak useful demand divided by usable
rate. The additional group-loss reserve is added once. A reserve for failures
already represented in the measured topology must not be added again.

The model assumes independent groups scale linearly. It cannot establish scaling,
failover, topology equivalence or the service contract. The evidence display
retains that unresolved assumption even when performance provenance is marked
measured. Independent service groups are unsuitable for a shared bottleneck or
pipeline stage without further sizing and whole-deployment verification.

Costs are compute per complete group-hour, physical billable storage per group,
operations and network for the complete deployment, licences/support per group,
shared workers/connectors/monitoring, operational effort, and one-time
migration/setup. The source and exclusions fields explain inclusions and zeros.
Physical storage must include billable replicas, indexes and backups; requests,
replication traffic and recovery may incur additional charges. Hours per month,
horizon, region, price date, currency and discount/commitment conditions remain
explicit. Discounts are documented; the entered prices must already reflect them.
No tax, currency conversion, financing or discount engine is implied.

Average offered demand estimates volume. Useful results are offered volume times
the projected correct fraction times the projected on-time fraction among correct
results. Failures/incorrect and correct-but-late volumes remain separate. These
fractions are assumptions, not observed quality. The tool does not automatically
recommend an option from the cost total or treat failure to meet targets as an
acceptable cost reduction. At zero useful output, unit cost is undefined.

Demand sensitivity changes peak and average demand, operations and network.
Capacity sensitivity changes capacity per group. Price sensitivity scales all
costs, including setup. Shared workers, labour and physical storage remain fixed
unless the author changes them. The lesson identifies these simplifications and
requires separate scenarios for retention growth or shared-service scaling.

The versioned `benchmarking-lab-capacity-v1` JSON includes all inputs and sources.
Calculate validates and saves it locally. Edits invalidate the displayed result
until recalculation. Invalid imports preserve the current plan. All numbers must
be finite; capacity and positive demand/horizon are required, average cannot
exceed peak, percentages are bounded and reserve groups are integers. A browser
run JSON is rejected as a capacity-plan import, with an explanation.

## Report project

The `benchmarking-lab-report-v1` export retains the brief fields and evidence
register. Each attached JSON has an evidence ID, filename, source with SHA-256 of
the original file bytes, relevance/limits note and original parsed payload. The
hash identifies the uploaded byte sequence; JSON reserialization may produce
different bytes, and the hash is not a correctness or authenticity check.

Chapter 2 records (`format: benchmarking-lab-databases-v1`) are visibly labelled
browser runs and produce a server-capacity limitation in the evidence check.
Infrastructure runs (`schema: benchmarking-lab-infrastructure-v1`) and capacity
plans receive distinct labels. Classification alone does not verify their claims.
Short infrastructure smoke runs demonstrate execution and checking, not a
sustainable capacity or availability result.

Individual evidence uploads are bounded at 4 MB, newly built embedded projects at
24 MB and restored projects at 32 MB, with
at most 100 evidence entries. Large artifacts can be external references with a
path, source revision and checksum recorded by the author. Markdown export includes
the report text, evidence register and open checks; payloads stay in companion JSON.
External artifacts must be packaged separately. All imported text is rendered via
DOM text content, never HTML. Unknown run schemas can be attached as custom records.
Invalid project imports preserve the current draft. Local-storage failures are
reported with a download instruction; they do not silently claim persistence.

The review checks for empty required fields and missing evidence relevance/source.
It does not certify fairness, statistical validity or reproducibility. No customer
recommendation is generated by the tool. A reviewer must check the actual evidence
and reproduce a result from the package.

## Downloadable starting runner

`public/templates/decision-runner.py` is a Python 3.10+ standard-library script.
It provides loopback HTTP sum services and a self-checking sequential client.
The record includes the executed script SHA-256 as well as the launch directory’s
Git revision when available. Retain the exact source alongside the record.
The expected result uses an arithmetic identity independent of both service
implementations. Paired A/B blocks use seeded random order, one recorded warmup
per option/block, monotonic client timings, raw results and per-block medians.
The timed region includes HTTP submission, response parsing and checking, and
excludes service startup. The default timeout is five seconds. Errors, incorrect
answers and unfinished requests are retained; any of them causes a nonzero exit.
An interrupted run writes its partial artifact in the `finally` block.

This is a closed-loop teaching workload on a local machine. It does not establish
fixed-arrival capacity, independent process-level repetitions or deployment TCO.
The chapter asks the author to modify the operation and independent oracle and
revisit the arrival model before answering a customer capacity question. The real
broker/pipeline harnesses in Chapters 9/10 are alternative starting points.

## Verification

`tests/decision.spec.ts` checks known cost arithmetic and the decision crossover,
headroom and reserve quantities, quality accounting, invalid inputs and duplicate
evidence IDs. Browser tests exercise recalculation/stale-result handling, local
persistence, download/import preservation, evidence payload retention, safe text
rendering and Markdown limitations. A separate functional run checked both algorithms with two blocks of two requests
each, plus a wrong-answer HTTP negative control. It verified output accounting and
a failing exit status without making any performance claim.

These checks do not establish educational
usability or validate a customer's supplied prices/performance evidence.
