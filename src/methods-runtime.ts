// Copyright © 2026 Christopher Snow
import "./chapter";
import {
  ENGINES,
  NAMES,
  PACKAGES,
  loadStatements,
  median,
  type Engine,
  type Reply,
  type Request,
  type Rows,
} from "./database-model";
import {
  EDGE_ROWS,
  EDGE_LOAD,
  FAIR_SQL,
  fairReference,
  workload,
  trace,
  equalRows,
} from "./methods-model";
import modelSource from "./methods-model.ts?raw";
import sharedModelSource from "./database-model.ts?raw";
import runtimeSource from "./methods-runtime.ts?raw";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const chapter = document.body.dataset.method!;
const controls = [
  ...document.querySelectorAll<HTMLSelectElement>("[data-method-setting]"),
];
const runButton = $<HTMLButtonElement>("methods-run");
const stopButton = $<HTMLButtonElement>("methods-stop");
const downloadButton = $<HTMLButtonElement>("methods-download");
const status = $("methods-status");
const notes = $<HTMLTextAreaElement>("methods-notes");
const storageKey = `benchmarking-methods-${chapter}-v1`;
let busy = false;
let stopped = false;
let clients: Client[] = [];
let record: Evidence | undefined;
let manifestController: AbortController | undefined;
type Sample = {
  engine: Engine;
  query: string;
  elapsedMs: number;
  rows: Rows;
  verified: boolean;
  position: number;
  [key: string]: unknown;
};
type Evidence = {
  format: string;
  chapter: string;
  createdAt: string;
  build: string;
  settings: Record<string, string>;
  environment: Record<string, unknown>;
  method: Record<string, string>;
  assets?: unknown;
  source: { model: string; sharedModel: string; runner: string };
  workItems?: {
    position: number;
    intendedMs: number;
    enqueuedMs: number;
    submittedMs?: number;
    completedMs?: number;
    error?: string;
  }[];
  versions: Partial<Record<Engine, { package: string; runtime: string }>>;
  phases: { engine: Engine; phase: string; elapsedMs: number }[];
  samples: Sample[];
  fixture?: unknown;
  sql?: unknown;
  expected?: unknown;
  outcome?: string;
  error?: string;
  accounting?: {
    offered: number;
    submitted: number;
    completed: number;
    errors: number;
    pending: number;
  };
};
class Client {
  worker = new Worker(new URL("./database.worker.ts", import.meta.url), {
    type: "module",
  });
  sequence = 0;
  waiting = new Map<
    number,
    {
      resolve: (value: { reply: Reply; elapsedMs: number }) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      start: number;
    }
  >();
  constructor() {
    this.worker.onmessage = (event: MessageEvent<Reply>) => {
      const pending = this.waiting.get(event.data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.waiting.delete(event.data.id);
      if (event.data.error) pending.reject(new Error(event.data.error));
      else
        pending.resolve({
          reply: event.data,
          elapsedMs: performance.now() - pending.start,
        });
    };
    this.worker.onerror = () => this.terminate("The database worker failed.");
  }
  call(
    request:
      | Omit<Extract<Request, { operation: "start" }>, "id">
      | Omit<Extract<Request, { operation: "exec" }>, "id">
      | Omit<Extract<Request, { operation: "query" }>, "id">
      | { operation: "close" },
  ) {
    if (stopped) return Promise.reject(new Error("Stopped."));
    const id = ++this.sequence;
    return new Promise<{ reply: Reply; elapsedMs: number }>(
      (resolve, reject) => {
        const start = performance.now();
        const timer = setTimeout(
          () =>
            this.terminate(`Time limit exceeded during ${request.operation}.`),
          request.operation === "start"
            ? 60000
            : request.operation === "exec"
              ? 30000
              : 15000,
        );
        this.waiting.set(id, { resolve, reject, timer, start });
        this.worker.postMessage({ ...request, id });
      },
    );
  }
  terminate(reason = "Worker released.") {
    this.worker.terminate();
    for (const pending of this.waiting.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.waiting.clear();
  }
}
function settings() {
  return Object.fromEntries(
    controls.map((control) => [
      control.id.replace("methods-", ""),
      control.value,
    ]),
  );
}
function save() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ settings: settings(), notes: notes.value }),
    );
  } catch {
    /* Local drafts are optional. */
  }
}
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  if (saved) {
    notes.value = saved.notes ?? "";
    for (const control of controls) {
      const value = saved.settings?.[control.id.replace("methods-", "")];
      if ([...control.options].some((option) => option.value === value))
        control.value = value;
    }
  }
} catch {
  /* Continue with the visible defaults. */
}
function source() {
  const options = settings();
  let value = "";
  if (chapter === "3")
    value = `${EDGE_LOAD.join("\n")}\n${options.index === "yes" ? "CREATE INDEX orders_month ON orders(month_id);\n" : ""}ANALYZE orders;\n\n-- Candidate SQL\n${FAIR_SQL[options.candidate as keyof typeof FAIR_SQL]}\n\n-- Expected ordered rows (independent reference)\n${JSON.stringify(fairReference())}`;
  else {
    const fixture = workload(
      Number(options.size ?? 20000),
      options.shape ?? "uniform",
    );
    value = `${loadStatements(fixture.rows)[1]}\n-- ${fixture.rows.length} deterministic rows; the download contains all INSERT statements.\nANALYZE orders;\n\n${fixture.sql.lookup}\n\n${fixture.sql.revenue}\n\n-- ${chapter === "4" ? `Ten-request order: ${trace(Number(options.mix)).join(", ")}` : "Twelve lookup requests. One connection, one request in flight."}`;
  }
  $("methods-sql").textContent = value;
}
for (const control of controls)
  control.addEventListener("change", () => {
    save();
    source();
    if (record)
      $("methods-stale").hidden =
        JSON.stringify(record.settings) === JSON.stringify(settings());
  });
notes.addEventListener("input", save);
source();
runButton.disabled = false;
function paragraph(text: string) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}
function table(
  caption: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const wrapper = document.createElement("div");
  wrapper.className = "methods-table";
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", caption);
  const table = document.createElement("table");
  const cap = document.createElement("caption");
  cap.textContent = caption;
  table.append(cap);
  const head = document.createElement("thead");
  const tr = document.createElement("tr");
  for (const label of headers) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    tr.append(th);
  }
  head.append(tr);
  table.append(head);
  const body = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const value of row) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  wrapper.append(table);
  return wrapper;
}
const ms = (value: number) => value.toFixed(3);
function comparison(
  title: string,
  values: { label: string; value: number }[],
  unit = "ms",
) {
  const figure = document.createElement("figure");
  figure.className = "methods-comparison";
  const caption = document.createElement("figcaption");
  caption.textContent = title;
  figure.append(caption);
  const maximum = Math.max(...values.map((item) => item.value));
  const scale = paragraph(
    `Shared scale: 0–${ms(maximum)} ${unit}. Lower is shorter.`,
  );
  scale.className = "methods-comparison-scale";
  figure.append(scale);
  for (const item of values) {
    const row = document.createElement("div");
    row.className = "methods-comparison-row";
    const heading = document.createElement("div");
    heading.className = "methods-comparison-heading";
    const label = document.createElement("span");
    label.textContent = item.label;
    const value = document.createElement("span");
    value.textContent = `${ms(item.value)} ${unit}`;
    heading.append(label, value);
    const track = document.createElement("div");
    track.className = "methods-comparison-track";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("div");
    bar.className = "methods-comparison-bar";
    bar.style.width = `${maximum > 0 ? (100 * item.value) / maximum : 0}%`;
    track.append(bar);
    row.append(heading, track);
    figure.append(row);
  }
  return figure;
}
function render(value: Evidence) {
  const area = $("methods-results");
  area.hidden = false;
  area.replaceChildren();
  const summary = document.createElement("div");
  summary.className = "methods-result";
  summary.append(paragraph(value.outcome ?? value.error ?? "Run ended."));
  area.append(summary);
  if (chapter === "3") {
    area.append(
      table(
        "Every measured answer is checked against the January contract. Failed answers cannot support a speed claim.",
        ["Engine", "Request", "Time ms", "Answer"],
        value.samples.map((s) => [
          NAMES[s.engine],
          s.position,
          ms(s.elapsedMs),
          s.verified ? "Pass" : "FAIL: different work",
        ]),
      ),
    );
    const comparison = document.createElement("pre");
    comparison.className = "methods-source";
    comparison.textContent = `Expected: ${JSON.stringify(value.expected)}\n${ENGINES.map((engine) => `${NAMES[engine]}: ${JSON.stringify(value.samples.find((s) => s.engine === engine)?.rows ?? [])}`).join("\n")}`;
    area.append(comparison);
    area.append(
      table(
        "Preparation is measured separately; a tiny fixture cannot establish an index benefit.",
        ["Engine", "Phase", "Elapsed ms"],
        value.phases.map((p) => [NAMES[p.engine], p.phase, ms(p.elapsedMs)]),
      ),
    );
  } else if (chapter === "4" && value.samples.length && !value.error) {
    const mix = Number(value.settings.mix) / 10;
    const summaryRows: (string | number)[][] = [];
    const comparisons: {
      label: string;
      lookup: number;
      report: number;
      weighted: number;
    }[] = [];
    for (const engine of ENGINES) {
      const values = (query: string) =>
        value.samples
          .filter((s) => s.engine === engine && s.query === query)
          .map((s) => s.elapsedMs);
      const lookup = values("lookup"),
        revenue = values("revenue");
      const weighted = median(lookup) * mix + median(revenue) * (1 - mix);
      comparisons.push({
        label: NAMES[engine],
        lookup: median(lookup),
        report: median(revenue),
        weighted,
      });
      summaryRows.push([
        NAMES[engine],
        ms(median(lookup)),
        ms(median(revenue)),
        ms(weighted),
        ms(
          value.samples
            .filter((s) => s.engine === engine)
            .reduce((sum, s) => sum + s.elapsedMs, 0),
        ),
      ]);
    }
    const completeVerified =
      value.samples.length === 20 &&
      value.samples.every(
        (sample) =>
          sample.verified &&
          Number.isFinite(sample.elapsedMs) &&
          sample.elapsedMs >= 0,
      ) &&
      ENGINES.every(
        (engine) =>
          value.samples.filter((sample) => sample.engine === engine).length ===
          10,
      ) &&
      comparisons.every((item) =>
        [item.lookup, item.report, item.weighted].every(Number.isFinite),
      );
    if (completeVerified) {
      area.append(
        paragraph(
          "Observed medians from this complete, verified run. Each job has its own scale; compare the two engines within that job.",
        ),
        comparison(
          "Observed lookup median",
          comparisons.map((item) => ({
            label: item.label,
            value: item.lookup,
          })),
        ),
        comparison(
          "Observed report median",
          comparisons.map((item) => ({
            label: item.label,
            value: item.report,
          })),
        ),
        comparison(
          `Calculated mix summary, not separately measured · ${mix * 100}% lookups, ${100 - mix * 100}% reports`,
          comparisons.map((item) => ({
            label: item.label,
            value: item.weighted,
          })),
          "ms/request",
        ),
      );
    }
    area.append(
      table(
        "Observed class medians and a calculated mix summary. Lower times are faster; classes remain visible.",
        [
          "Engine",
          "Lookup median ms",
          "Report median ms",
          "Weighted ms/request",
          "Trace sum ms",
        ],
        summaryRows,
      ),
    );
    area.append(
      paragraph(
        "Weighted value = lookup share × lookup median + report share × report median. It is a calculated planning summary from this run, not a separately measured transaction or capacity result. Trace sum adds the ten actual request durations for that engine; it excludes intervening requests to the other engine.",
      ),
    );
    area.append(
      table(
        "Every actual request, in execution order. All returned rows are retained in the JSON.",
        ["Engine", "Position", "Job", "Time ms", "Check"],
        value.samples.map((s) => [
          NAMES[s.engine],
          s.position,
          s.query,
          ms(s.elapsedMs),
          s.verified ? "Pass" : "FAIL",
        ]),
      ),
    );
  } else if (chapter === "5") {
    const counts = value.accounting!;
    area.append(
      table(
        "Work accounting at the end of this observation. Pending includes offered work without a completed response or recorded error.",
        ["Offered", "Submitted", "Completed", "Errors", "Pending"],
        [
          [
            counts.offered,
            counts.submitted,
            counts.completed,
            counts.errors,
            counts.pending,
          ],
        ],
      ),
    );
    area.append(
      table(
        "Actual timestamps are offsets from the observation start, in milliseconds. Total starts at the intended arrival.",
        [
          "Request",
          "Intended",
          "Enqueued",
          "Submitted",
          "Completed",
          "Request ms",
          "Total ms",
        ],
        value.samples.map((s) => [
          s.position,
          ms(Number(s.intendedMs)),
          ms(Number(s.enqueuedMs)),
          ms(Number(s.submittedMs)),
          ms(Number(s.completedMs)),
          ms(s.elapsedMs),
          ms(Number(s.completedMs) - Number(s.intendedMs)),
        ]),
      ),
    );
    if (value.samples.length) {
      const last = Math.max(...value.samples.map((s) => Number(s.completedMs)));
      area.append(
        paragraph(
          `Completed ${counts.completed} requests in ${(last / 1000).toFixed(3)} seconds from the first intended arrival: ${(counts.completed / (last / 1000)).toFixed(1)} verified responses/second for this short observation. This is achieved work under the selected runner, not engine capacity.`,
        ),
      );
    }
  }
  const details = document.createElement("details");
  const title = document.createElement("summary");
  title.textContent = "Inspect the complete measured record";
  details.append(title);
  const pre = document.createElement("pre");
  pre.className = "methods-source";
  pre.textContent = JSON.stringify(
    {
      ...value,
      source: "Full source is included in the download.",
      fixture: "Full fixture is included in the download.",
    },
    null,
    2,
  );
  details.append(pre);
  area.append(details);
  downloadButton.disabled = false;
}
async function startEngine(engine: Engine, sql: string[], index = false) {
  status.textContent = `Starting ${NAMES[engine]}. First use can download about 54 MiB across both engines; keep this tab visible.`;
  const client = new Client();
  clients.push(client);
  const started = await client.call({
    operation: "start",
    engine,
    assets: new URL(`${import.meta.env.BASE_URL}engines/`, location.origin)
      .href,
  });
  record!.versions[engine] = {
    package: PACKAGES[engine],
    runtime: started.reply.version!,
  };
  record!.phases.push({
    engine,
    phase: "startup",
    elapsedMs: started.elapsedMs,
  });
  status.textContent = `Loading and preparing ${NAMES[engine]}.`;
  for (const [phase, statement] of [
    ["load", sql.join("\n")],
    ...(index
      ? [["index", "CREATE INDEX orders_month ON orders(month_id);"]]
      : []),
    ["analyze", "ANALYZE orders;"],
  ]) {
    const result = await client.call({ operation: "exec", sql: statement });
    record!.phases.push({ engine, phase, elapsedMs: result.elapsedMs });
  }
  return client;
}
async function measured(
  client: Client,
  engine: Engine,
  sql: string,
  expected: Rows,
  query: string,
  position: number,
) {
  const result = await client.call({ operation: "query", sql });
  const sample = {
    engine,
    query,
    position,
    elapsedMs: result.elapsedMs,
    rows: result.reply.rows!,
    verified: equalRows(result.reply.rows!, expected),
  };
  record!.samples.push(sample);
  return sample;
}
async function fair(options: Record<string, string>) {
  record!.fixture = { rows: EDGE_ROWS, loadSql: EDGE_LOAD };
  record!.sql = FAIR_SQL[options.candidate as keyof typeof FAIR_SQL];
  record!.expected = fairReference();
  const engines = new Map<Engine, Client>();
  for (const engine of ENGINES)
    engines.set(
      engine,
      await startEngine(engine, EDGE_LOAD, options.index === "yes"),
    );
  status.textContent =
    "Executing candidate SQL and checking every returned value.";
  for (let repeat = 0; repeat < 3; repeat++)
    for (const engine of repeat % 2 ? [...ENGINES].reverse() : ENGINES)
      await measured(
        engines.get(engine)!,
        engine,
        String(record!.sql),
        fairReference(),
        "January report",
        repeat + 1,
      );
  record!.outcome = record!.samples.every((s) => s.verified)
    ? "Contract passed in both engines: two ordered region totals match all six measured answers. These times describe correct January reports on this fixture."
    : "Contract FAILED: the candidate returns different work. The clock ran, but these timings cannot support a comparison of January reports. Repair the SQL and run again.";
}
async function representative(options: Record<string, string>) {
  const fixture = workload(Number(options.size), options.shape);
  const loads = loadStatements(fixture.rows);
  record!.fixture = { rows: fixture.rows, loadSql: loads };
  record!.sql = fixture.sql;
  record!.expected = fixture.expected;
  const engines = new Map<Engine, Client>();
  for (const engine of ENGINES) {
    const client = await startEngine(engine, loads);
    engines.set(engine, client);
    for (const query of ["lookup", "revenue"] as const) {
      const result = await client.call({
        operation: "query",
        sql: fixture.sql[query],
      });
      if (!equalRows(result.reply.rows!, fixture.expected[query]))
        throw new Error("Warm-up answer failed verification.");
    }
  }
  const sequence = trace(Number(options.mix));
  status.textContent =
    "Executing the ten-request workload in both engines; all answers must match.";
  for (let i = 0; i < sequence.length; i++)
    for (const engine of i % 2 ? [...ENGINES].reverse() : ENGINES) {
      const query = sequence[i];
      const sample = await measured(
        engines.get(engine)!,
        engine,
        fixture.sql[query],
        fixture.expected[query],
        query,
        i + 1,
      );
      if (!sample.verified)
        throw new Error(
          "Measured answer failed verification; this run is invalid.",
        );
    }
  record!.outcome = `Run complete: ${fixture.rows.length.toLocaleString()} orders, ${options.shape} regions, ${options.mix} of ten requests are lookups. Every measured answer matched. Compare each job before interpreting the mix summary.`;
}
const delay = (duration: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, duration)));
async function runner(options: Record<string, string>) {
  const engine = options.engine as Engine;
  const fixture = workload(20000, "uniform");
  const loads = loadStatements(fixture.rows);
  record!.fixture = { rows: fixture.rows, loadSql: loads };
  record!.sql = fixture.sql.lookup;
  record!.expected = fixture.expected.lookup;
  const client = await startEngine(engine, loads);
  const warm = await client.call({
    operation: "query",
    sql: fixture.sql.lookup,
  });
  if (!equalRows(warm.reply.rows!, fixture.expected.lookup))
    throw new Error("Warm-up answer failed verification.");
  const counts = {
    offered: 0,
    submitted: 0,
    completed: 0,
    errors: 0,
    pending: 0,
  };
  record!.accounting = counts;
  const beginning = performance.now();
  const pause = Number(options.pause);
  let chain = Promise.resolve();
  const handle = async (
    position: number,
    intendedMs: number,
    enqueuedMs: number,
  ) => {
    if (stopped) throw new Error("Stopped.");
    await delay(pause);
    if (stopped) throw new Error("Stopped.");
    const submittedMs = performance.now() - beginning;
    const workItem = record!.workItems!.find(
      (item) => item.position === position,
    )!;
    workItem.submittedMs = submittedMs;
    counts.submitted++;
    try {
      const result = await client.call({
        operation: "query",
        sql: fixture.sql.lookup,
      });
      const completedMs = performance.now() - beginning;
      workItem.completedMs = completedMs;
      if (!equalRows(result.reply.rows!, fixture.expected.lookup))
        throw new Error("Incorrect response.");
      counts.completed++;
      counts.pending--;
      record!.samples.push({
        engine,
        query: "lookup",
        position,
        elapsedMs: result.elapsedMs,
        rows: result.reply.rows!,
        verified: true,
        intendedMs,
        enqueuedMs,
        submittedMs,
        completedMs,
      });
      status.textContent = `Offered ${counts.offered}; submitted ${counts.submitted}; completed ${counts.completed}; errors ${counts.errors}; pending ${counts.pending}.`;
    } catch (error) {
      workItem.error = error instanceof Error ? error.message : String(error);
      counts.errors++;
      counts.pending--;
      throw error;
    }
  };
  status.textContent = "Starting the twelve-request observation.";
  if (options.arrival === "scheduled") {
    // Arrivals enqueue independently of completion; the single client drains FIFO.
    // Always settle the drain before releasing this run, including Stop during a pause.
    let arrivalError: unknown;
    try {
      for (let i = 0; i < 12; i++) {
        const target = beginning + i * 5;
        // Timers may truncate fractional delays; recheck the actual monotonic clock.
        while (performance.now() < target)
          await delay(target - performance.now());
        if (stopped) throw new Error("Stopped.");
        counts.offered++;
        counts.pending++;
        const enqueuedMs = performance.now() - beginning;
        record!.workItems!.push({
          position: i + 1,
          intendedMs: i * 5,
          enqueuedMs,
        });
        chain = chain.then(() => handle(i + 1, i * 5, enqueuedMs));
        // Register a handler immediately, while retaining rejection for the final await.
        void chain.catch(() => {});
      }
    } catch (error) {
      arrivalError = error;
    }
    try {
      await chain;
    } catch (error) {
      if (!arrivalError) throw error;
    }
    if (arrivalError) throw arrivalError;
  } else {
    for (let i = 0; i < 12; i++) {
      const intendedMs = performance.now() - beginning;
      counts.offered++;
      counts.pending++;
      record!.workItems!.push({
        position: i + 1,
        intendedMs,
        enqueuedMs: intendedMs,
      });
      await handle(i + 1, intendedMs, intendedMs);
    }
  }
  record!.outcome = `Run complete: ${counts.completed} correct responses; ${counts.errors} errors; ${counts.pending} pending. ${options.arrival === "scheduled" ? "Arrivals were intended every 5 ms, independent of completion. Inspect the gap from intended arrival to submission." : "Each next arrival waited for the previous response. Offered demand therefore slowed with the client and database."} The ${pause} ms client pause is deliberate runner behaviour; query responses are measured from the real engine.`;
}
runButton.addEventListener("click", async () => {
  if (busy) return;
  busy = true;
  stopped = false;
  clients = [];
  downloadButton.disabled = true;
  runButton.disabled = true;
  stopButton.disabled = false;
  controls.forEach((c) => (c.disabled = true));
  $("methods-stale").hidden = true;
  $("methods-results").hidden = true;
  record = {
    format: "benchmarking-lab-methods-v1",
    chapter,
    createdAt: new Date().toISOString(),
    build: __BUILD__,
    settings: settings(),
    environment: {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      visibility: document.visibilityState,
      timeOrigin: performance.timeOrigin,
    },
    method: {
      boundary:
        "Main-thread performance.now immediately before sending SQL to receipt of all ordered string rows. Includes wrapper, worker messages, execution and conversion. Verification follows the timer.",
      setup:
        "Fresh workers and in-memory databases each run. Single execution thread and one connection per engine. Setup and indexes are outside measured requests; runtime versions and separate phase times are retained.",
      limits:
        "Browser builds and wrappers only. No network database, persistence, crash recovery, production capacity, or confidence claim. A browser query is not a durability test.",
      order:
        chapter === "5"
          ? "One warm-up lookup, then one connection with at most one request in flight."
          : chapter === "4"
            ? "Start DuckDB then PGlite; verify/warm each query once per engine. Alternate first engine at each trace position."
            : "Start DuckDB then PGlite; three candidate requests per engine, alternating first engine. These are first-use request samples, with no separate query warm-up.",
    },
    source: {
      model: modelSource,
      sharedModel: sharedModelSource,
      runner: runtimeSource,
    },
    versions: {},
    phases: [],
    samples: [],
    accounting:
      chapter === "5"
        ? { offered: 0, submitted: 0, completed: 0, errors: 0, pending: 0 }
        : undefined,
    workItems: chapter === "5" ? [] : undefined,
  };
  try {
    if (document.visibilityState !== "visible")
      throw new Error("Keep the tab visible before running.");
    manifestController = new AbortController();
    const manifest = await fetch(
      `${import.meta.env.BASE_URL}engines/manifest.json`,
      { signal: manifestController.signal },
    );
    if (!manifest.ok)
      throw new Error("Engine asset manifest could not be loaded.");
    record.assets = await manifest.json();
    if (chapter === "3") await fair(record.settings);
    else if (chapter === "4") await representative(record.settings);
    else await runner(record.settings);
    status.textContent =
      "Run complete. Inspect the evidence and download the record before leaving.";
    for (const client of clients) await client.call({ operation: "close" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record.error = message;
    record.outcome = `${stopped ? "Stopped" : "Run failed"}: ${message} Completed samples and work accounting are retained as an incomplete record; they do not establish a successful comparison.`;
    status.textContent = record.outcome;
  } finally {
    clients.forEach((client) => client.terminate());
    clients = [];
    manifestController = undefined;
    busy = false;
    runButton.disabled = false;
    stopButton.disabled = true;
    controls.forEach((c) => (c.disabled = false));
    render(record);
  }
});
function stop(reason: string) {
  if (!busy) return;
  stopped = true;
  manifestController?.abort();
  status.textContent = reason;
  clients.forEach((client) => client.terminate(reason));
}
stopButton.addEventListener("click", () => stop("Stopped by reader."));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop("Stopped because the tab became hidden.");
});
window.addEventListener("pagehide", () => stop("Page closed."));
downloadButton.addEventListener("click", () => {
  if (!record) return;
  const blob = new Blob(
    [
      JSON.stringify(
        {
          ...record,
          interpretation: {
            notes: notes.value,
            exportedAt: new Date().toISOString(),
          },
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `chapter-${chapter}-evidence-${record.createdAt.replace(/[:.]/g, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
