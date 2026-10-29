# Infrastructure measurement harness

Docker Engine and Compose are required. This creates local services and stores output in `results/`. Images and Python libraries are version-pinned. First startup downloads images and builds the client. The commands below run from this directory.

```sh
docker compose up -d kafka store db
docker compose run --rm client broker --count 200 --rate 20 --pause-at 2 --pause-for 3
docker compose run --rm client pipeline --count 20 --records 5 --rate 2 --pause-at 2 --pause-for 3
ls results/*.json
```

`--timeout` is the maximum drain wait after submissions finish, not a whole-run deadline; the run duration also includes the scheduled count/rate and individual service calls. Use small bounded counts and reasonable rates. Change `--sink-delay 0.05` to slow every sink write. Change `--poll`, `--timeout`, `--records`, `--rate` and `--count` to define bounded experiments. A unique topic, run ID, object-key prefix within the shared local bucket, and database key isolate each run. Repeated runs share the bucket rather than creating a new storage collection each time. The local object-store client uses a 2-second connection timeout, 5-second read timeout and at most two total attempts; an ingestion error stops further submissions. The evidence records the harness source SHA-256, actual Python and client library versions, actual PostgreSQL server version for a pipeline run, and separately labelled image pins. The client waits for services; if readiness fails, inspect `docker compose logs`. For a clean reset, **this removes this project’s service data**:

```sh
docker compose down -v --remove-orphans
```

Inspect `summary` and `observations` in the JSON. `missing`, `wrong_values`, `extra`, `duplicate_receipts`, errors and unfinished objects describe correctness; the program records outcomes even when they fail. Upload acknowledgement is not queryable completion. `verified` is a polling observation and includes detection delay. Inspect actual offered timestamps: the synchronous sender can fall behind its target; target rate is not achieved offered rate. No records are silently invented. Single partition ordering is checked at receipt, not across multiple partitions. Pipeline primary-key upsert hides duplicate rows, so duplicate receipt count is reported separately. The ingestion adapter runs in the load client and reads each object immediately after upload; the consumer thread is the sink worker. A sink pause leaves arrivals running when the client can keep up. Acknowledgements and all trace timestamps use one process monotonic clock. The producer library retries as configured; object-store calls use the bounded retry policy above. No application-level retry is claimed. This is a single-node teaching topology, not a production availability test.

If your network requires a trusted interception CA for image builds, use Docker BuildKit's optional secret to provide your system CA bundle without embedding it in the image, then run Compose normally:

```sh
docker build --secret id=proxy_ca,src=/path/to/ca-bundle.pem -t infrastructure-client .
```

The command exits nonzero after saving evidence if required records are missing,
extra, incorrect or out of order, or if a runtime error was recorded. Duplicate
receipts remain a separately reported delivery observation; an idempotent sink
can receive a key more than once while keeping one correct output row. Inspect
all correctness and timing fields even when the command succeeds.
