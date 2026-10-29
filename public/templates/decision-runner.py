#!/usr/bin/env python3
"""Copyright © 2026 Christopher Snow.
A teaching HTTP comparison you can change. Python 3.10+, standard library only.
This loopback, sequential workload does not establish deployment capacity.
"""
import argparse
import hashlib
import json
import platform
import random
import statistics
import subprocess
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    service = sub.add_parser("serve")
    service.add_argument("--port", type=int, required=True)
    service.add_argument("--variant", choices=["loop", "builtin"], required=True)
    run = sub.add_parser("compare")
    run.add_argument("--a", default="http://127.0.0.1:8011/sum")
    run.add_argument("--b", default="http://127.0.0.1:8012/sum")
    run.add_argument("--count", type=int, default=1000)
    run.add_argument("--repeats", type=int, default=5)
    run.add_argument("--requests", type=int, default=20)
    run.add_argument("--seed", type=int, default=42)
    run.add_argument("--timeout", type=float, default=5)
    run.add_argument("--output", default="comparison.json")
    args = parser.parse_args()
    if args.command == "serve":
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    if self.path != "/sum" or not 0 < length <= 2_000_000:
                        self.send_error(400)
                        return
                    values = json.loads(self.rfile.read(length))["values"]
                    if not isinstance(values, list) or any(type(v) is not int for v in values):
                        raise ValueError("Expected integer values")
                    if args.variant == "builtin":
                        answer = sum(values)
                    else:
                        answer = 0
                        for value in values:
                            answer += value
                    body = json.dumps({"answer": answer}).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except (ValueError, KeyError, TypeError):
                    self.send_error(400)

            def log_message(self, *_):
                pass
        server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
        print(f"Serving {args.variant} on http://127.0.0.1:{args.port}/sum", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
        return
    if not (1 <= args.count <= 100_000 and 2 <= args.repeats <= 100 and 1 <= args.requests <= 10_000 and args.timeout > 0):
        parser.error("count: 1..100000; repeats: 2..100; requests: 1..10000; timeout: positive")
    # Independent answer uses an arithmetic identity, rather than either service.
    values = list(range(args.count))
    expected = args.count * (args.count - 1) // 2
    body = json.dumps({"values": values}).encode()
    rng = random.Random(args.seed)
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        revision = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        revision = "unknown: record source revision in report"
    record = {"schema": "benchmarking-lab-capstone-v1", "run_id": str(uuid.uuid4()),
              "started_at": started, "config": vars(args), "revision": revision,
              "runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "environment": {"platform": platform.platform(), "python": platform.python_version()},
              "fixture": {"expected": expected, "body_sha256": hashlib.sha256(body).hexdigest()},
              "method": {"clock": "client time.perf_counter_ns", "timed_region": "HTTP submission through full response parsing and correctness check",
                         "arrival_model": "one closed-loop client, sequential requests; no offered-rate control",
                         "warmup": "one recorded request per option per repetition; excluded from summaries",
                         "boundary": "HTTP overhead and service included; service startup excluded",
                         "scope": "loopback teaching services, no server sizing or resilience claim"},
              "samples": [], "summary": {}}

    def request(option, endpoint, repetition, phase):
        start = time.perf_counter_ns()
        answer, error = None, None
        try:
            with urlopen(Request(endpoint, data=body, headers={"Content-Type": "application/json"}), timeout=args.timeout) as response:
                answer = json.load(response).get("answer")
                if type(answer) is not int or answer != expected:
                    error = "incorrect answer"
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, AttributeError) as exc:
            error = f"{type(exc).__name__}: {exc}"
        elapsed = (time.perf_counter_ns() - start) / 1e6
        record["samples"].append({"option": option, "repetition": repetition, "phase": phase,
                                   "elapsed_ms": elapsed, "correct": error is None,
                                   "answer": answer, "error": error})

    try:
        for repetition in range(args.repeats):
            order = [("A", args.a), ("B", args.b)]
            rng.shuffle(order)
            for option, endpoint in order:
                request(option, endpoint, repetition, "warmup")
                for _ in range(args.requests):
                    request(option, endpoint, repetition, "measured")
    except KeyboardInterrupt:
        record["interrupted"] = True
    finally:
        for option in ["A", "B"]:
            rows = [s for s in record["samples"] if s["option"] == option and s["phase"] == "measured"]
            good = [s["elapsed_ms"] for s in rows if s["correct"]]
            record["summary"][option] = {"attempted": len(rows), "expected_attempts": args.repeats * args.requests,
                                        "correct": len(good), "errors": len(rows) - len(good),
                                        "unfinished": args.repeats * args.requests - len(rows),
                                        "median_correct_ms": statistics.median(good) if good else None,
                                        "per_repetition_median_ms": [statistics.median(r) if r else None for i in range(args.repeats)
                                                                    for r in [[s["elapsed_ms"] for s in rows if s["repetition"] == i and s["correct"]]]]}
        record["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        Path(args.output).write_text(json.dumps(record, indent=2) + "\n")
        print(json.dumps(record["summary"], indent=2))
        print(f"Raw evidence written to {args.output}")
    if record.get("interrupted") or any(s["errors"] or s["unfinished"] for s in record["summary"].values()) or any(not s["correct"] for s in record["samples"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
