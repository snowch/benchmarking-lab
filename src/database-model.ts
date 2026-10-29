// Copyright © 2026 Christopher Snow
export const PACKAGES = {
  duckdb: "@duckdb/duckdb-wasm 1.32.0",
  pglite: "@electric-sql/pglite 0.5.13",
} as const;
export type Engine = keyof typeof PACKAGES;
export const ENGINES: Engine[] = ["duckdb", "pglite"];
export const NAMES: Record<Engine, string> = {
  duckdb: "DuckDB-Wasm",
  pglite: "PGlite (Postgres)",
};
export const SCHEMA = `CREATE TABLE orders (
  order_id INTEGER,
  month_id INTEGER,
  region_id INTEGER,
  amount_cents INTEGER
);`;
export const SETUP = "ANALYZE orders;";
// Kept as an exported function so the exact generator can be included in evidence.
export function generateOrders(count: number): number[][] {
  return Array.from({ length: count }, (_, offset) => {
    const id = offset + 1;
    return [
      id,
      (Math.floor(offset / 4) % 12) + 1,
      (offset % 4) + 1,
      ((id * 37) % 10000) + 100,
    ];
  });
}
export function loadStatements(rows: number[][]): string[] {
  const statements = ["BEGIN;", SCHEMA];
  for (let start = 0; start < rows.length; start += 500) {
    statements.push(
      `INSERT INTO orders VALUES ${rows
        .slice(start, start + 500)
        .map((row) => `(${row.join(",")})`)
        .join(",")};`,
    );
  }
  return [...statements, "COMMIT;"];
}
export function queries(count: number) {
  return {
    lookup: `SELECT order_id, month_id, region_id, amount_cents
FROM orders WHERE order_id = ${Math.floor(count / 2)};`,
    revenue: `SELECT month_id, region_id,
       CAST(SUM(amount_cents) AS BIGINT) AS revenue_cents
FROM orders
GROUP BY month_id, region_id
ORDER BY month_id, region_id;`,
  };
}
export type Query = keyof ReturnType<typeof queries>;
export const QUERY_NAMES: Record<Query, string> = {
  lookup: "One order lookup",
  revenue: "Revenue by month and region",
};
export type Rows = string[][];
// Independent JavaScript reference: no database or SQL evaluation involved.
export function expectedResults(
  rows: number[][],
  target: number,
): Record<Query, Rows> {
  const order = rows.find((row) => row[0] === target);
  if (!order) throw new Error("Reference order is missing");
  const totals = new Map<string, number>();
  for (const [, month, region, cents] of rows) {
    const key = `${month},${region}`;
    totals.set(key, (totals.get(key) ?? 0) + cents);
  }
  return {
    lookup: [order.map(String)],
    revenue: Array.from(totals, ([key, total]) => [
      ...key.split(","),
      String(total),
    ]).sort(
      (a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]),
    ),
  };
}
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
export type Request =
  | { id: number; operation: "start"; engine: Engine; assets: string }
  | { id: number; operation: "exec"; sql: string }
  | { id: number; operation: "query"; sql: string }
  | { id: number; operation: "close" };
export type Reply = {
  id: number;
  rows?: Rows;
  version?: string;
  error?: string;
};
export interface Sample {
  engine: Engine;
  query: Query;
  pair: number;
  position: number;
  elapsedMs: number;
  rows: Rows;
  verified: true;
}
export interface Phase {
  engine: Engine;
  phase: "startup" | "load" | "analyze" | "verification" | "warmup";
  elapsedMs: number;
}
export const METHOD = {
  queryBoundary:
    "Main-thread performance.now immediately before postMessage of one SQL query until its complete ordered result has been decoded to a plain string matrix and received on the main thread. Includes queueing, wrapper/worker messages, engine execution, result conversion and transfer. One query per request; no batches or amortisation.",
  setupBoundary:
    "Main-thread request dispatch through worker acknowledgement. Startup additionally includes worker creation, lazy imports, asset fetch, Wasm compilation, in-memory database creation and SELECT version(). Data loading includes BEGIN, table creation, identical 500-row INSERT statements and COMMIT. ANALYZE is a separate setup request; no indexes or constraints are created. Fixture generation is measured separately before engines start.",
  ordering:
    "Fresh engines every run. Startup/load/setup are sequential, DuckDB first. Both engines remain resident. Verify both queries, then run each once as warm-up per engine. For each query alternate first engine across measured pairs; invert the first pair for the second query. Every sample is checked after the timer stops. No concurrent queries.",
  configuration:
    "DuckDB MVP single-thread Wasm bundle, maximumThreads=1, :memory: database; PGlite single-thread Wasm, memory filesystem, initialMemory=128 MiB. One connection each, no persistence or extensions. No indexes or constraints; identical ANALYZE statements. Other engine defaults are retained; matching statements do not imply identical physical plans or resource use.",
  limits:
    "This is a sequential, warm in-memory browser comparison of these exact builds and wrappers. Request overhead can dominate short queries. Startup includes network and browser caching effects. Sequential setup, JIT, timer precision, thermal state, engine defaults and two resident engines can affect results. Does not measure native/server databases, disk durability, network clients or multiple users. No confidence interval or general winner is inferred.",
};
