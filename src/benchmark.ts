// Copyright © 2026 Christopher Snow
import wabtFactory from "wabt";

export type Order = "row" | "column";
export interface Settings {
  n: number;
  samples: number;
  source: string;
}
export interface Sample {
  pair: number;
  order: Order;
  elapsedMs: number;
  msPerPass: number;
  checksum: number;
}
export interface Result {
  settings: Settings;
  samples: Sample[];
  passes: number;
  expectedChecksum: number;
  warmupPairs: number;
  firstOrder: Order;
  timestamp: string;
  userAgent: string;
  timerResolutionMs: number | null;
  sourceSha256: string;
  wasmSha256: string;
  build: string;
}
export async function compile(source: string, n: number) {
  const wabt = await wabtFactory();
  const module = wabt.parseWat("grid.wat", source);
  let bytes: Uint8Array;
  try {
    module.resolveNames();
    module.validate();
    bytes = new Uint8Array(module.toBinary({}).buffer);
  } finally {
    module.destroy();
  }
  const memory = new WebAssembly.Memory({
    initial: Math.ceil((n * n * 4) / 65536),
    maximum: 256,
  });
  const { instance } = await WebAssembly.instantiate(
    bytes as Uint8Array<ArrayBuffer>,
    { env: { memory } },
  );
  if (typeof instance.exports.scan !== "function")
    throw new Error(
      "Export a function named scan with the four parameters shown in the original.",
    );
  const data = new Uint32Array(memory.buffer, 0, n * n);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    data[i] = i % 251;
    sum = (sum + data[i]) >>> 0;
  }
  const scan = instance.exports.scan as (
    n: number,
    passes: number,
    inner: number,
    outer: number,
  ) => number;
  return { bytes, sum, scan };
}
async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return [...new Uint8Array(hash)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function benchmark(
  settings: Settings,
  progress: (message: string) => void,
): Promise<Result> {
  const { n, samples, source } = settings;
  if (
    ![64, 256, 1024, 2048].includes(n) ||
    ![10, 20, 40].includes(samples) ||
    source.length > 20000
  )
    throw new Error(
      "Choose a supported grid size and sample count; source is limited to 20,000 characters.",
    );
  progress("Compiling WebAssembly and preparing the grid…");
  const { bytes, sum, scan } = await compile(source, n);
  const check = (value: number, passes: number) => {
    const expected = Math.imul(sum, passes) >>> 0;
    if (value >>> 0 !== expected)
      throw new Error(
        `Incorrect result: expected checksum ${expected}, received ${value >>> 0}. Repair the loop before comparing its speed.`,
      );
  };
  const timed = (order: Order, passes: number) => {
    const start = performance.now();
    const value = scan(
      n,
      passes,
      order === "row" ? 1 : n,
      order === "row" ? n : 1,
    );
    const elapsedMs = performance.now() - start;
    check(value, passes); // The correctness check is outside the timed interval.
    return {
      order,
      elapsedMs,
      msPerPass: elapsedMs / passes,
      checksum: value >>> 0,
    };
  };
  progress("Warming both traversal orders…");
  const warmupStart = performance.now();
  let warmupPairs = 0;
  do {
    timed("row", 1);
    timed("column", 1);
    warmupPairs++;
  } while (
    (performance.now() - warmupStart < 100 || warmupPairs < 4) &&
    warmupPairs < 1000
  );
  progress("Choosing a common batch size…");
  let passes = 1;
  while (passes < 4096) {
    const a = timed("row", passes),
      b = timed("column", passes);
    if (
      Math.min(a.elapsedMs, b.elapsedMs) >= 8 ||
      Math.max(a.elapsedMs, b.elapsedMs) >= 150
    )
      break;
    passes *= 2;
  }
  let timerResolutionMs = Infinity;
  let last = performance.now();
  for (let i = 0; i < 10000; i++) {
    const now = performance.now(),
      delta = now - last;
    if (delta > 0) timerResolutionMs = Math.min(timerResolutionMs, delta);
    last = now;
  }
  const firstOrder: Order =
    crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? "row" : "column";
  const measured: Sample[] = [];
  for (let pair = 0; pair < samples; pair++) {
    const first: Order =
      pair % 2 ? (firstOrder === "row" ? "column" : "row") : firstOrder;
    for (const order of [first, first === "row" ? "column" : "row"] as Order[])
      measured.push({ pair: pair + 1, ...timed(order, passes) });
    progress(`Measured pair ${pair + 1} of ${samples}`);
  }
  if (measured.some((s) => s.elapsedMs <= 0))
    throw new Error("The timer could not resolve a batch. Try a larger grid.");
  return {
    settings,
    samples: measured,
    passes,
    expectedChecksum: Math.imul(sum, passes) >>> 0,
    warmupPairs,
    firstOrder,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    timerResolutionMs: Number.isFinite(timerResolutionMs)
      ? timerResolutionMs
      : null,
    sourceSha256: await sha256(new TextEncoder().encode(source)),
    wasmSha256: await sha256(bytes),
    build: __BUILD__,
  };
}
