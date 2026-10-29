# Course progression

Copyright © 2026 Christopher Snow.

The reader learns to take a customer question, design and run a fair benchmark,
and explain the evidence behind a recommendation. Readers practise both producing
their own comparison and reviewing somebody else's. Small runnable examples lead
to independently designed experiments, executable scripts and a final report.

The reader can recognise a loop and an array. Introduce terminal commands,
configuration files and small scripts as they become useful. Wasm provides the
initial execution environment. Later infrastructure exercises use real services
with downloadable harnesses and recorded deployment conditions.

## Chapters

| Chapter                                         | Question                                                                                        | Status      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------- |
| 1. Same work, different order                   | How do we turn “faster” into a specific comparison question?                                    | Implemented |
| 2. DuckDB or Postgres?                          | What does a first comparison of DuckDB-Wasm and PGlite show, and what must we check next?       | Planned     |
| 3. Are they doing the same work?                | Do inputs, answers, configuration and service guarantees make the comparison fair?              | Planned     |
| 4. Choose a representative workload             | Does the recommendation change with the customer's data and usage?                              | Planned     |
| 5. Can you trust your benchmark?                | Is the harness measuring the intended work, or limiting and distorting it?                      | Planned     |
| 6. How much faster—and how certain?             | What do repeated runs and their variation support?                                              | Planned     |
| 7. Beyond the average                           | What do response-time distributions, errors and throughput tell us?                             | Planned     |
| 8. What happens as demand grows?                | Where do capacity limits and crossover points appear?                                           | Planned     |
| 9. Beyond databases                             | Which methods transfer to Kafka, object storage and search, and which measurements must change? | Planned     |
| 10. Benchmark the complete pipeline             | How do storage, brokers, connectors and databases combine to determine the customer's result?   | Planned     |
| 11. From benchmark results to capacity and cost | What does it cost to meet the same workload and service requirements?                           | Planned     |
| 12. Present a comparison you can defend         | Can another reader reproduce, challenge and use the recommendation?                             | Planned     |

Chapter 1 introduces “two options, one question” through the existing memory-order
lab. Chapter 2 provides an early database comparison. Subsequent chapters improve
that experiment rather than requiring every method before running anything. Keep
the final report after the technology, pipeline and cost chapters so readers can
use all three in their project.

## The recurring database comparison

Chapter 2 runs DuckDB-Wasm and PGlite against the same generated orders dataset.
Begin with a lookup and an aggregation, verify equivalent answers, record actual
times and let the reader change the data size. The first conclusion is provisional.
End by asking what needs checking before recommending either option.

Later chapters revisit correctness, indexes, timing boundaries, startup and warm
operation, workload distributions, repeated runs and scaling. Preserve the reader's
benchmark brief and run records as the experiment develops. Browser-build results
describe those builds and conditions. Native/server companion exercises establish
the performance inputs used for deployment and cost comparisons.

## Trusting the runner and the evidence

Chapter 5 makes the harness an object of investigation. Separate offered load from
achieved work, identify a client bottleneck, and count errors, timeouts and pending
work. Explain how closed-loop clients reduce offered load when the system slows,
and why latency measured only after sending can omit waiting before submission.
Choose the arrival model to match the customer scenario and record it.

Distinguish compilation/startup, cache warming, sustained operation and recovery.
Include long enough observations to encounter relevant background work. Chapter 6
treats independent repeated runs and uncertainty; chapter 7 defines measurement
points, latency distributions and error accounting. Read a published comparison
critically before designing the experiment that would resolve its missing evidence.

## Beyond databases

Chapter 9 uses Kafka as a worked transfer exercise. Begin with a sustained event
rate and a delivery-latency target. Define message sizes, arrival patterns,
partitions, producers, consumer groups, batching, compression, replication and
acknowledgement semantics. Compare equivalent guarantees, not merely option names.

Distinguish producer acknowledgement, consumer receipt and completed downstream
processing. Record delivered rate, errors, consumer lag and latency under load.
Pause a consumer and measure catch-up while new events continue arriving. Verify
event identities and explain which loss, duplication and ordering checks the
exercise performs. Delivery guarantees must match the actual configuration.

Run the benchmark against a real broker using a downloadable harness. Browser
activities support configuration, predictions and inspection of recorded traces.
Shorter design exercises apply the same reasoning to object-storage request sizes,
concurrency and request charges, and to search relevance, indexing delay and
response time. Teach readers to define success before selecting the tool.

## Benchmark the complete pipeline

Chapter 10 follows one customer outcome across several services. The planned
reference pipeline is:

```text
Object upload to S3-compatible storage
  → ingestion worker reads and transforms records
  → Kafka carries events
  → sink worker writes the database
  → a query verifies the records are available
```

The adapters, clients, networks and serialisation are part of the system being
tested. A diagram must name them. The reference implementation will declare how
ingestion is triggered, when offsets are committed and how retries and duplicate
events are handled.

Start from a customer question: how long after submitting an upload are all
expected records queryable, at the required arrival rate? Define the expected
record set and any transformation before running the test. Record the query-polling
interval and verification cost: observed availability includes detection delay.
Distinguish per-object completion time from per-record latency.

The lesson must cover:

- **An end-to-end contract.** Use unique run, object and record identifiers to
  correlate work. Measure from upload submission to verification of queryable
  output with the harness's monotonic clock. Record upload acknowledgement and
  stage boundaries separately. If timestamps cross hosts, state clock
  synchronisation and its uncertainty.
- **Correctness and completion.** Verify expected records and values, detect
  missing or duplicate output, and record failures, late completions and unfinished
  work. An intermediate acknowledgement is not final completion.
- **A workload for the whole path.** Vary object sizes, records per object,
  arrival bursts, message batching, transformations and concurrent queries.
  Express stage rates in compatible units when comparing capacity. Record both
  offered input and verified output, with bounded backlog as a steady-state goal.
- **Bottleneck diagnosis.** Collect component metrics and correlated stage
  observations alongside end-to-end results. Deliberately slow one worker or
  restrict a resource, then test an explanation by changing that constraint.
  Inspect queues and backpressure; a faster database may leave the limiting stage
  elsewhere. Component scores alone cannot predict pipeline capacity.
- **Recovery under continuing load.** Pause a worker or introduce a service
  failure, then restore it while arrivals continue. Measure backlog growth,
  catch-up, user-visible delay, retries and data correctness. Interpret results
  within the tested topology and availability guarantees.
- **Latency across the path.** Match observations for the same work item.
  Do not add stage p99 values to manufacture an end-to-end p99. Stages can
  overlap, batch and queue differently; measure the full path directly.

The independent task changes one component or configuration and asks whether it
improved the complete customer outcome. Require a repeatable baseline and control
changes to guarantees, output, resources and topology. The report distinguishes
local improvements from observed whole-system improvements.

Use real containerised services and a runnable harness for execution. Pin versions,
record configuration and supply reset, run, collect and verify commands. A small
local deployment teaches the procedure; deployment-scale or resilience claims
require corresponding tests. Browser queue models must be labelled explanatory,
and recorded examples must identify their source rather than imply live execution.

## From performance to capacity and TCO

Chapter 11 links directly to [Sizing and TCO](https://snowch.github.io/sizing-and-tco/).
Keep the practical bridge here and use the companion for deeper modelling and
uncertainty analysis:

```text
Measured performance at the required service level
  → required capacity and deployment design
  → total cost over a stated period
```

Readers use sustainable throughput while meeting latency and correctness targets,
then account for demand, headroom and availability needs. Explain where replication
and redundancy are already included in measured capacity to avoid counting them
twice. For a pipeline, size its interacting stages and check the proposed complete
deployment; isolated component peaks are insufficient evidence.

Include compute, storage capacity, storage operations, networking/egress, licences
and operational effort where relevant. Pipeline costs include workers, connectors,
retention, replicas, retries and recovery capacity. Record region, price date,
discount assumptions and time horizon. Compare cost per correct useful result
meeting the stated target, while also reporting failures and missed targets.

Follow the companion's distinction between measured facts, vendor claims and
assumptions. Attach benchmark run records to performance inputs; retain separate
sources for prices and operating assumptions. Explore sensitivity to demand,
performance and prices. Missing measurements remain visible. Cost exercises use
native/server evidence and priced configurations; browser timings alone do not
establish infrastructure TCO.

The independent task asks: one option costs less per instance, but does it still
cost less when both deployments satisfy the same workload and service requirements?

## Final project and chapter requirements

The final project produces a benchmark brief, a self-checking workload, a repeatable
runner, raw observations with recorded conditions, and a concise recommendation.
Readers also review somebody else's comparison and propose a fair follow-up test.
The chosen system may be a database, broker or complete pipeline.

Each chapter needs a concrete question, a small runnable example, an observation
target, an independent task, progressive hints and an account of what the evidence
establishes. Keep predictions optional and a reading path available before execution.
Introduce enough command-line and scripting practice to let readers modify and
eventually build their own harness, not just operate preset controls.

Before expanding, try chapter 1 with readers: can they explain the address orders,
distinguish a model from a measurement, identify the timed region, and state a
conditional conclusion from their own run? Automated checks do not establish this.
All chapters after chapter 1 remain planned. No unfinished lab is presented as
implemented.
