// Copyright © 2026 Christopher Snow
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function csv(text: string, header: string): string[][] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((v) => v.trim()));
  if (lines.shift()?.join(",") !== header)
    throw new Error(`Use the exact header: ${header}`);
  if (!lines.length || lines.length > 10000)
    throw new Error("Supply 1–10,000 data rows.");
  const width = header.split(",").length;
  if (lines.some((row) => row.length !== width))
    throw new Error(
      "Every row must have the same number of columns; use plain CSV without quoted fields.",
    );
  return lines;
}
export function number(text: string, name: string, positive = false): number {
  const value = Number(text);
  if (
    text === "" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (positive && value === 0)
  )
    throw new Error(
      `${name} must be a finite ${positive ? "positive" : "non-negative"} number.`,
    );
  return value;
}
export interface Pair {
  run: string;
  a: number;
  b: number;
}
export function parsePairs(text: string): Pair[] {
  const rows = csv(text, "run,a_ms,b_ms").map(([run, a, b]) => ({
    run,
    a: number(a, "A time", true),
    b: number(b, "B time", true),
  }));
  if (
    new Set(rows.map((r) => r.run)).size !== rows.length ||
    rows.some((r) => !r.run)
  )
    throw new Error("Give each independent run a unique nonempty name.");
  if (rows.length < 2)
    throw new Error("Use at least two independent paired runs.");
  return rows;
}
const t95 = [
  0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08,
  2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
export function pairedEstimate(rows: Pair[]) {
  if (rows.length < 2) throw new Error("Two runs required.");
  const logs = rows.map((r) => {
    const ratio = r.a / r.b;
    if (!Number.isFinite(ratio) || ratio <= 0)
      throw new Error(
        "Run ratios exceed the numeric range. Check units and values.",
      );
    return Math.log(ratio);
  });
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const sd = Math.sqrt(
    logs.reduce((a, b) => a + (b - mean) ** 2, 0) / (logs.length - 1),
  );
  // For df > 30 use the conservative df=30 critical value rather than a normal shortcut.
  const margin =
    (t95[Math.min(logs.length - 1, 30)] * sd) / Math.sqrt(logs.length);
  const ratio = Math.exp(mean),
    low = Math.exp(mean - margin),
    high = Math.exp(mean + margin);
  if (![ratio, low, high].every((v) => Number.isFinite(v) && v > 0))
    throw new Error(
      "The uncertainty interval exceeds the numeric range. Check units and extreme values.",
    );
  return {
    ratio,
    low,
    high,
    sd,
    n: rows.length,
  };
}
export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export interface RequestRow {
  id: string;
  planned: number;
  sent: number | null;
  finished: number | null;
  status: string;
}
export function parseRequests(text: string, window: number): RequestRow[] {
  const rows = csv(text, "id,planned_ms,sent_ms,finished_ms,status").map(
    ([id, p, s, f, status]) => {
      const planned = number(p, "Planned time");
      const sent = s === "" ? null : number(s, "Sent time");
      const finished = f === "" ? null : number(f, "Finished time");
      if (!["ok", "error", "timeout", "pending"].includes(status))
        throw new Error("Status must be ok, error, timeout or pending.");
      if (
        planned >= window ||
        (sent !== null && (sent < planned || sent >= window)) ||
        (finished !== null &&
          (sent === null || finished < sent || finished > window))
      )
        throw new Error(
          "Use times inside the observation window, with planned ≤ sent ≤ finished.",
        );
      if (
        (status === "pending" && finished !== null) ||
        (status !== "pending" && (sent === null || finished === null))
      )
        throw new Error(
          "Completed outcomes need sent and finished times; pending work must have no finish.",
        );
      return { id, planned, sent, finished, status };
    },
  );
  if (
    new Set(rows.map((r) => r.id)).size !== rows.length ||
    rows.some((r) => !r.id)
  )
    throw new Error("Request IDs must be unique and nonempty.");
  return rows;
}
export function requestSummary(
  rows: RequestRow[],
  window: number,
  plannedBoundary: boolean,
) {
  const success = rows.filter((r) => r.status === "ok");
  const latencies = success.map(
    (r) => r.finished! - (plannedBoundary ? r.planned : r.sent!),
  );
  return {
    offered: rows.length,
    sent: rows.filter((r) => r.sent !== null).length,
    ok: success.length,
    errors: rows.filter((r) => r.status === "error").length,
    timeouts: rows.filter((r) => r.status === "timeout").length,
    pending: rows.filter((r) => r.status === "pending").length,
    goodput: success.length / (window / 1000),
    offeredRate: rows.length / (window / 1000),
    latencies,
    mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p50: percentile(latencies, 0.5),
    p99: percentile(latencies, 0.99),
  };
}
export interface LoadStep {
  option: string;
  offered: number;
  seconds: number;
  ok: number;
  errors: number;
  timeouts: number;
  start: number;
  end: number;
  p99: number;
  cpu: number;
  client: number;
}
export function parseSteps(text: string): LoadStep[] {
  return csv(
    text,
    "option,offered_rps,seconds,ok,error,timeout,start_pending,end_pending,p99_ms,server_cpu_pct,client_cpu_pct",
  ).map(([option, ...cells]) => {
    const n = cells.map((v, i) => number(v, `Column ${i + 2}`));
    const [
      offered,
      seconds,
      ok,
      errors,
      timeouts,
      start,
      end,
      p99,
      cpu,
      client,
    ] = n;
    if (
      !option ||
      offered <= 0 ||
      seconds <= 0 ||
      cpu > 100 ||
      client > 100 ||
      [ok, errors, timeouts, start, end].some((v) => !Number.isInteger(v))
    )
      throw new Error(
        "Use a name, positive rate/duration, integer counts and CPU percentages from 0 to 100.",
      );
    if (
      Math.abs(start + offered * seconds - ok - errors - timeouts - end) > 0.001
    )
      throw new Error(
        `Counts do not reconcile for ${option} at ${offered}/s: start + arrivals = ok + error + timeout + end.`,
      );
    if (ok === 0)
      throw new Error(
        "Each step needs successful requests for its supplied p99.",
      );
    return {
      option,
      offered,
      seconds,
      ok,
      errors,
      timeouts,
      start,
      end,
      p99,
      cpu,
      client,
    };
  });
}
export function qualifies(
  step: LoadStep,
  target: number,
  errorPercent: number,
) {
  return (
    step.p99 <= target &&
    (100 * (step.errors + step.timeouts)) / (step.offered * step.seconds) <=
      errorPercent &&
    step.end <= step.start
  );
}
