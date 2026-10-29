# Course progression

Copyright © 2026 Christopher Snow.

The reader learns to take a customer question, design and run a fair benchmark,
and explain the evidence behind a recommendation. Small experiments lead to
independent workload design, real service tests, cost models and a final report.
The full introduction and twelve chapters are implemented.

No programming or database experience is required for the opening labs. Introduce
loops, arrays, queries and other technical terms when readers need them. Explain
the purpose of an example before its technical question. Terminal commands and
small scripts appear alongside their explanation and source.

## Introduction

[Start here](../chapters/start-here.html) is an unnumbered three-minute guide to
the customer decision, skills, route and final evidence package. It explains
WebAssembly and why the opening experiments use it. The header and every book menu
link to it; Chapter 1's existing URL and all chapter numbers are preserved.

## Chapters

| Chapter                                                                                  | Reader outcome                                                               | Execution                                                                                 |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Same work, different order                                                            | Inspect equivalent work and explain a conditional timing finding.            | Real editable Wasm; checksums, samples and export.                                        |
| 2. [DuckDB or Postgres?](../chapters/02-duckdb-postgres.html)                            | Run both jobs, check answers, separate setup and query time.                 | Real DuckDB-Wasm and PGlite; visual request comparisons.                                  |
| 3. [Are they doing the same work?](../chapters/03-equivalent-work.html)                  | Find different output or configuration before quoting a speed claim.         | Real SQL, independent edge-case reference, flawed/repaired queries and indexes.           |
| 4. [Choose a representative workload](../chapters/04-representative-workloads.html)      | Connect the data and request mix to a customer's usage.                      | Real workload replay, uniform/hotspot data and explicit weighting.                        |
| 5. [Can you trust your benchmark?](../chapters/05-trust-the-benchmark.html)              | Audit timing, client limits and work accounting.                             | Real SQL with controlled client pauses, closed-loop/scheduled arrivals and a full ledger. |
| 6. [How much faster—and how certain?](../chapters/06-differences-and-uncertainty.html)   | Compare independent paired runs and practical benefit.                       | Editable analysis and import of compatible real Chapter 2 records.                        |
| 7. [Beyond the average](../chapters/07-beyond-the-average.html)                          | Read response-time populations alongside failures and unfinished work.       | Editable request-ledger analysis with explicit timing boundaries.                         |
| 8. [What happens as demand grows?](../chapters/08-demand-and-scaling.html)               | Design load sweeps and screen capacity evidence against targets.             | Editable load-step analysis plus real browser/service sweep assignments.                  |
| 9. [Beyond databases](../chapters/09-beyond-databases.html)                              | Adapt the method to Kafka, storage and search.                               | Real downloadable broker workload and browser trace inspector.                            |
| 10. [Benchmark the complete pipeline](../chapters/10-complete-pipeline.html)             | Verify the customer's result across connected services.                      | Real object store→ingestion→Kafka→sink→Postgres harness and trace inspection.             |
| 11. [From benchmark results to capacity and cost](../chapters/11-capacity-and-cost.html) | Estimate complete deployments at equivalent targets and explore uncertainty. | Capacity/TCO planner with explicit provenance and assumptions.                            |
| 12. [Present a comparison you can defend](../chapters/12-defensible-comparison.html)     | Build, reproduce and review an evidence-backed recommendation.               | Report/evidence builder and adaptable self-checking HTTP runner.                          |

The book deliberately runs a first comparison early. Later chapters improve it
instead of requiring every method before a first experiment. The final report
follows the technology, pipeline and cost chapters so readers can use all three.

## Recurring comparison and measurement

Chapters 2–5 use the pinned browser database engines and checked order fixtures.
A lookup and an aggregation reveal why the customer's job matters. Equivalent
answers come before timings; configuration choices, indexes, setup and warm
requests stay visible. Workload replay distinguishes actual request timings from
an arithmetic weighted summary. The runner experiment records intended arrival,
actual enqueue, submission and completion for every offered item.

Browser-build results describe those builds and conditions. They do not establish
native/server throughput, availability or infrastructure cost. Fresh engine runs
can be analysed as paired run summaries in Chapter 6, but an importer cannot prove
experimental independence or representative conditions.

Chapter 6 uses independent paired log time ratios and a stated approximate
Student-t interval. Requests within one run are not treated as independent
experiments. Chapter 7 defines successful-request latency populations and retains
errors, timeouts and pending work. Chapter 8 reconciles offered work and queue
changes, distinguishes finite draining from steady operation, and treats supplied
passing points as a screening result requiring longer repeated observations.

All authored starter traces are labelled illustrative. Their calculations are
real, but the numbers are not claimed as measured product performance. Actual
measurements require the relevant executable workload, configuration and records.

## Real service transfer and pipelines

The downloadable Compose harness runs Kafka 3.9.1, SeaweedFS 3.85 (S3-compatible
storage) and PostgreSQL 17.5 with versioned Python clients. The broker exercise
records scheduled and actual offers, acknowledgement, receipt, processing, errors
and event identities. Consumer pauses are tested while arrivals continue. Explicit
offset commits follow processing. One broker/partition/replica is a teaching
topology, so acknowledgement and ordering checks do not establish production
replicated durability or cross-partition ordering.

The pipeline follows uploaded objects through a synchronous ingestion adapter,
Kafka, a consumer/sink worker and a verification query. Records are transformed
and checked against an independent expected set. Unique run and object identities
connect milestones. Duplicate receipts remain visible even though the sink uses
idempotent upserts. Each run has an isolated object-key prefix in a shared local
bucket, so repeated runs do not create a new storage collection for every run.

All event timestamps use one client monotonic clock. Query polling adds detection
delay, and verification cost is recorded. Object completion differs from record
latency. End-to-end time is measured directly; stage p99 values cannot be added.
Target arrival rate differs from achieved offers when the synchronous client falls
behind. The timeout is a declared drain budget; library calls have their own
bounds. Failed correctness checks retain the evidence and fail the command.

Browser inspectors validate and render user-supplied traces, keep the inspected
snapshot separate from edits, and show unique outstanding work over time. They
also retain exact observations and notes. No broker runs inside the browser.

## Capacity, cost and final project

[The Sizing and TCO companion](https://snowch.github.io/sizing-and-tco/) supplies
deeper modelling. Chapter 11 makes the bridge from performance at a required
service level to complete deployments and cost over a stated horizon. Capacity
and price must cover the same service group, including replicas. Headroom and a
group-loss reserve are explicit; linear scaling remains an assumption to test.

Prices, discounts, region/date, physical storage, operations, network, licences,
workers, labour and setup have sources and exclusions. Failed or late output stays
visible beside cost per useful result. Starter capacities/prices are illustrative
example credits. Imported browser timings cannot silently become server sizing.

The capstone combines a benchmark brief, source/setup, a self-checking workload,
raw records, conditions, analysis and recommendation. Its report builder retains
original evidence payloads and file hashes, while identifying missing evidence
and the limits of each record. Review checks do not certify fairness. Markdown
reports and JSON evidence projects can be downloaded, restored and reviewed.

The downloadable Python standard-library runner gives readers complete code to
adapt: HTTP work, an independent oracle, paired order, warmup, raw observations
and negative controls. Local closed-loop runs teach the method; their blocks do
not claim independent server deployments or fixed-arrival sustainable capacity.
Readers must modify the operation and checks, repeat relevant experiments and
review somebody else's published comparison.

## Maintenance and verification

Every chapter has a purpose-first opening, worked example, executable or analytical
exercise, independent task, progressive hints, further reading and interpretation
boundaries. Notes and portable evidence support work beyond preset controls.

The reading path and styles work without JavaScript. There is one book menu:
static on larger screens and a native “Chapters” disclosure on phones. Light/dark
themes, keyboard controls, readable visual results and local scrolling tables are
shared requirements. Current chapter labels distinguish measured browser labs,
analysis labs, real service exercises, cost planning and the final project.

Detailed implementation and validation boundaries are in the memory, database,
methods, statistics, infrastructure and decision measurement documents. Automated
checks cover behaviour, arithmetic and provenance; learner comprehension and the
quality of a customer's chosen workload still need human review.
