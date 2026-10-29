# Recorded local functional examples

These JSON records were produced on 29 October 2026 by the repository's real
Docker Compose harness. They contain actual observations, not illustrative
product timings. The topology used one Kafka 3.9.1 broker, one partition and
replica, SeaweedFS 3.85 and PostgreSQL 17.5 on a local Docker network, with the
pinned Python client. Each JSON includes the executed harness SHA-256 and actual
Python/client-library versions; pipeline evidence includes the PostgreSQL version.
Declared image tags are distinct from queried runtime versions.

- `broker-smoke.json`: 30 offered events, 10/s target, consumer paused from 0.5
  through 2.0 seconds. All 30 were received/processed with no missing, wrong,
  duplicate or out-of-order output or recorded errors. Actual timestamps show
  whether the client achieved the target.
- `pipeline-smoke.json`: 12 uploaded objects × 5 records, 4 objects/s target,
  consumer paused from 1 through 3 seconds, verification polled every 0.1 seconds.
  All 60 transformed records and all 12 complete objects were verified with no
  missing, extra or incorrect values, duplicate receipts or recorded errors.

The root integration also ran the same 60-record pipeline workload twice against
one service deployment. Both passed, checking repeat-run isolation. An intentionally
paused five-event broker run retained five missing records and exited nonzero.

These are short functional checks of execution, accounting, correlation and
correctness. They do not establish sustainable throughput, a latency service
level, production durability or performance on another deployment. Services and
client share a host; device resources were not isolated or priced. The harness
uses a synchronous sender, one monotonic client clock and a declared drain budget.
Verification polling includes detection delay. Inspect the raw observations,
configuration, provenance and workload source before using any result.

Reproduce or adapt the method using `../harnesses/infrastructure.zip`. Keep the
exact source, image identities, configuration and raw output with your own run.
