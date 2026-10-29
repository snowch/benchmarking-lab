// Copyright © 2026 Christopher Snow
import {
  generateOrders,
  expectedResults,
  queries,
  type Rows,
} from "./database-model";

// Fixture rows are independent orders: repeated monetary values are intentional.
export const EDGE_ROWS: (number | null)[][] = [
  [1, 1, 1, 100],
  [2, 1, 1, 100],
  [3, 1, 2, null],
  [4, 1, 2, 0],
  [5, 2, 1, 700],
  [6, 2, 1, -100],
  [7, 12, 2, 900],
  [8, 1, 1, 250],
];
export const EDGE_SCHEMA =
  "CREATE TABLE orders (order_id INTEGER, month_id INTEGER, region_id INTEGER, amount_cents INTEGER);";
export const EDGE_LOAD = [
  EDGE_SCHEMA,
  `INSERT INTO orders VALUES ${EDGE_ROWS.map((row) => `(${row.map((value) => (value === null ? "NULL" : value)).join(",")})`).join(",")};`,
];
export const FAIR_SQL = {
  incomplete: `SELECT region_id, CAST(COUNT(amount_cents) AS BIGINT) AS order_count, CAST(COALESCE(SUM(DISTINCT amount_cents),0) AS BIGINT) AS revenue_cents FROM orders WHERE month_id <= 2 GROUP BY region_id ORDER BY region_id;`,
  repaired: `SELECT region_id, CAST(COUNT(*) AS BIGINT) AS order_count, CAST(COALESCE(SUM(amount_cents),0) AS BIGINT) AS revenue_cents FROM orders WHERE month_id = 1 GROUP BY region_id ORDER BY region_id;`,
};
export function fairReference(): Rows {
  const groups = new Map<number, { count: number; total: number }>();
  for (const [, month, region, amount] of EDGE_ROWS) {
    if (month !== 1) continue;
    const value = groups.get(region!) ?? { count: 0, total: 0 };
    value.count++;
    value.total += amount ?? 0;
    groups.set(region!, value);
  }
  return [...groups]
    .sort((a, b) => a[0] - b[0])
    .map(([region, value]) => [
      String(region),
      String(value.count),
      String(value.total),
    ]);
}
export function workload(count: number, shape: string) {
  const rows = generateOrders(count);
  if (shape === "hotspot")
    rows.forEach((row, index) => {
      row[2] = index % 10 !== 0 ? 1 : 2 + (Math.floor(index / 10) % 3);
    });
  const sql = queries(count);
  const expected = expectedResults(rows, Math.floor(count / 2));
  return { rows, sql, expected };
}
export function equalRows(actual: Rows, expected: Rows) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
export function trace(lookups: number): ("lookup" | "revenue")[] {
  // A ten-request trace, evenly interleaved; no random seed is needed.
  return Array.from({ length: 10 }, (_, i) =>
    Math.floor(((i + 1) * lookups) / 10) > Math.floor((i * lookups) / 10)
      ? "lookup"
      : "revenue",
  );
}
