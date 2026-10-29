# Infrastructure measurement

The downloadable infrastructure bundle contains a pinned Compose deployment and Python client. See its README for reset, run and collection commands. Each run writes a JSON trace containing actual monotonic observations and verification results. It operates real Kafka, SeaweedFS and PostgreSQL services; browser inspectors only display entered or imported evidence. Each run uses a unique prefix in a shared local object-store bucket. Evidence includes a source hash, actual runtime versions and separately labelled image pins. The client is synchronous on the upload and ingestion side, so actual offered timestamps must be checked against the intended schedule. The sink commits offsets after successful processing; an upsert makes a repeated key idempotent but duplicate receipts remain visible. Kafka acknowledgement with one replica is not a replicated durability guarantee. Stop and investigate errors or incomplete output rather than reporting a successful throughput result.

## Recorded examples and integration checks

The book includes actual, labelled local records under `public/examples/`. Readers
can inspect them before installing Docker; the page identifies them as recorded
functional runs and retains their original configuration, observations and source
provenance. The source/example README explains their tested environment and limits.
The browser does not run services or infer a production capacity result from them.

Integration on 29 October 2026 ran the current source against the real local
Compose services. Two consecutive pipeline runs each offered 12 objects with five
records, verified all 60 transformed records and all 12 objects, and reported zero
missing, extra or wrong values, duplicate receipts or errors. The same service
instance and shared bucket were reused, with isolated run prefixes. A broker run
received and processed all 30 events, including a consumer pause with continuing
arrivals. A deliberate five-event incomplete run retained all five missing records
and returned a nonzero exit after writing its evidence. These are functional and
repeatability checks; their short observation windows do not establish sustainable
throughput or a service-level percentile.

The command saves its record before returning a failing status for missing, extra,
wrong or out-of-order output or recorded errors. Duplicate receipts remain a
separate observation because idempotent processing may still produce one correct
output. Inspect all guarantees and fields even after a zero exit status.

The trace inspector bounds inputs, validates the evidence shape, rejects malformed
counts/timestamps/IDs, counts each completed input once, and invalidates the prior
inspection on edits. Notes and drafts are local when storage permits. Exact event
observations remain in a keyboard-scrollable table. Plots redraw at their actual
width with fixed-size labels. Exports contain the inspected snapshot and source
label, never a different uninspected draft. Shape validation does not authenticate
user-supplied evidence or independently establish its claims.

`python3 scripts/package-harness.py` regenerates the deterministic source-only ZIP.
CI runs `--check` to verify every bundled source file and the syntax of both
published Python programs. `tests/infrastructure.spec.ts` exercises imports,
stale-result handling, duplicate-completion accounting, persistence, actual
recorded examples and 320/390-pixel chart readability.
