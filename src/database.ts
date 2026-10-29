// Copyright © 2026 Christopher Snow
import {
  ENGINES,
  NAMES,
  PACKAGES,
  SCHEMA,
  SETUP,
  METHOD,
  QUERY_NAMES,
  generateOrders,
  loadStatements,
  queries,
  expectedResults,
  median,
  type Engine,
  type Query,
  type Rows,
  type Reply,
  type Sample,
  type Phase,
  type Request,
} from "./database-model";
import fixtureSource from "./database-model.ts?raw";
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const size = element<HTMLSelectElement>("db-size");
const repeats = element<HTMLSelectElement>("db-repeats");
const runButton = element<HTMLButtonElement>("db-run");
const stopButton = element<HTMLButtonElement>("db-stop");
const download = element<HTMLButtonElement>("db-download");
const status = element("db-status");
const notes = element<HTMLTextAreaElement>("db-notes");
const claim = element<HTMLTextAreaElement>("db-claim");
const history = element<HTMLSelectElement>("db-history");
interface RunRecord {
  format: "benchmarking-lab-databases-v1";
  startedAt: string;
  completedAt: string;
  build: string;
  settings: {
    rows: number;
    repeats: number;
    sql: ReturnType<typeof queries>;
    schema: string;
    setup: string;
  };
  fixture: {
    source: string;
    loadSql: string[];
    loadSqlSha256: string;
    generationMs: number;
    expected: Record<Query, Rows>;
  };
  engines: Partial<Record<Engine, { package: string; runtimeVersion: string }>>;
  assets: unknown;
  environment: {
    userAgent: string;
    language: string;
    hardwareConcurrency: number;
    timeOrigin: number;
    crossOriginIsolated: boolean;
    timezone: string;
  };
  method: typeof METHOD;
  phases: Phase[];
  samples: Sample[];
  notesAtStart: string;
}
const records: RunRecord[] = [];
let active = false;
let interrupted = false;
let runController: AbortController | undefined;
let clients: Client[] = [];
let selected: RunRecord | undefined;
const DRAFT_KEY = "benchmarking-lab-databases-draft-v1";
try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
  if (draft) {
    if (["2000", "20000"].includes(draft.size)) size.value = draft.size;
    if (["5", "9"].includes(draft.repeats)) repeats.value = draft.repeats;
    notes.value = typeof draft.notes === "string" ? draft.notes : "";
    claim.value = typeof draft.claim === "string" ? draft.claim : "";
  }
} catch {
  /* Storage is optional. */
}
function persist() {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        size: size.value,
        repeats: repeats.value,
        notes: notes.value,
        claim: claim.value,
      }),
    );
  } catch {
    /* Storage is optional. */
  }
}
function updateSource() {
  const sql = queries(Number(size.value));
  element("db-lookup-sql").textContent = sql.lookup;
  element("db-revenue-sql").textContent = sql.revenue;
  const rows = generateOrders(Number(size.value));
  const expected = expectedResults(rows, Math.floor(Number(size.value) / 2));
  element("db-expected").textContent = JSON.stringify(expected, null, 2);
  element("db-load-sql").textContent = loadStatements(rows).join("\n");
  element("db-stale").hidden =
    !selected ||
    (selected.settings.rows === Number(size.value) &&
      selected.settings.repeats === Number(repeats.value));
  persist();
}
for (const control of [size, repeats])
  control.addEventListener("change", updateSource);
for (const input of [notes, claim]) input.addEventListener("input", persist);
updateSource();
runButton.disabled = false;
type Command = Request extends infer T
  ? T extends Request
    ? Omit<T, "id">
    : never
  : never;
class Client {
  worker: Worker;
  nextId = 0;
  pending = new Map<
    number,
    { reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  constructor() {
    this.worker = new Worker(new URL("./database.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  async request(
    command: Command,
    timeout = 15000,
  ): Promise<{ reply: Reply; elapsedMs: number }> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      let started = 0;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Time limit reached (${timeout / 1000}s) during ${command.operation}. Stop other work and retry with the smaller dataset.`,
          ),
        );
      }, timeout);
      this.pending.set(id, { reject, timer });
      const onMessage = (event: MessageEvent<Reply>) => {
        if (event.data.id !== id) return;
        const elapsedMs = performance.now() - started;
        clearTimeout(timer);
        this.pending.delete(id);
        this.worker.removeEventListener("message", onMessage);
        this.worker.removeEventListener("error", onError);
        if (event.data.error) reject(new Error(event.data.error));
        else resolve({ reply: event.data, elapsedMs });
      };
      const onError = (event: ErrorEvent) => {
        clearTimeout(timer);
        this.pending.delete(id);
        this.worker.removeEventListener("message", onMessage);
        this.worker.removeEventListener("error", onError);
        reject(new Error(event.message || "Database worker failed to load"));
      };
      this.worker.addEventListener("message", onMessage);
      this.worker.addEventListener("error", onError);
      started = performance.now();
      this.worker.postMessage({ ...command, id });
    });
  }
  terminate() {
    this.worker.terminate();
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(
        new Error(
          "Stopped. Database workers and in-memory data were discarded.",
        ),
      );
    }
    this.pending.clear();
  }
}
function stop() {
  if (!active) return;
  interrupted = true;
  runController?.abort();
  clients.forEach((client) => client.terminate());
  status.textContent =
    "Stopped. Database workers and in-memory data were discarded. You can run again.";
}
stopButton.addEventListener("click", stop);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && active) {
    stop();
    status.textContent =
      "Stopped because the page became hidden. Keep this tab visible during measurement, then run again. No partial record was accepted.";
  }
});
window.addEventListener("pagehide", () => {
  runController?.abort();
  clients.forEach((client) => client.terminate());
});
function assertRows(
  actual: Rows | undefined,
  expected: Rows,
  engine: Engine,
  query: Query,
) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Incorrect result from ${NAMES[engine]} for ${QUERY_NAMES[query]}. No comparison was accepted.`,
    );
  }
}
const formatMs = (value: number) => value.toFixed(3);
function addRow(body: HTMLElement, cells: string[]) {
  const tr = document.createElement("tr");
  for (const text of cells) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.append(td);
  }
  body.append(tr);
}
function showRecord(record: RunRecord) {
  selected = record;
  element("db-results").hidden = false;
  element("db-run-label").textContent =
    `${record.settings.rows.toLocaleString()} orders · ${record.settings.repeats} measured pairs per query · ${new Date(record.completedAt).toLocaleString()}`;
  const summary = element("db-summary");
  const phases = element("db-phases");
  const samples = element("db-samples");
  summary.replaceChildren();
  phases.replaceChildren();
  samples.replaceChildren();
  for (const query of Object.keys(record.settings.sql) as Query[]) {
    for (const engine of ENGINES) {
      const values = record.samples
        .filter((sample) => sample.query === query && sample.engine === engine)
        .map((sample) => sample.elapsedMs);
      addRow(summary, [
        QUERY_NAMES[query],
        NAMES[engine],
        formatMs(median(values)),
        `${formatMs(Math.min(...values))}–${formatMs(Math.max(...values))}`,
        String(values.length),
      ]);
    }
  }
  for (const phase of record.phases)
    addRow(phases, [
      NAMES[phase.engine],
      phase.phase,
      formatMs(phase.elapsedMs),
    ]);
  for (const sample of record.samples)
    addRow(samples, [
      QUERY_NAMES[sample.query],
      String(sample.pair),
      String(sample.position),
      NAMES[sample.engine],
      formatMs(sample.elapsedMs),
      `${sample.rows.length} rows · verified`,
    ]);
  element("db-versions").textContent = ENGINES.map(
    (engine) =>
      `${NAMES[engine]} — ${record.engines[engine]!.package}; runtime: ${record.engines[engine]!.runtimeVersion}`,
  ).join("\n");
  download.disabled = false;
  updateSource();
}
history.addEventListener("change", () => {
  const record = records[Number(history.value)];
  if (record) showRecord(record);
});
async function sha256(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
runButton.addEventListener("click", async () => {
  if (active) return;
  if (document.hidden) {
    status.textContent =
      "Keep this tab visible during measurement, then run again.";
    return;
  }
  active = true;
  interrupted = false;
  runController = new AbortController();
  runButton.disabled = true;
  stopButton.disabled = false;
  size.disabled = true;
  repeats.disabled = true;
  clients = [];
  const rowCount = Number(size.value);
  const sql = queries(rowCount);
  status.textContent =
    "Preparing the shared fixture and independent expected answers…";
  try {
    const startedAt = new Date().toISOString();
    const generationStart = performance.now();
    const rows = generateOrders(rowCount);
    const expected = expectedResults(rows, Math.floor(rowCount / 2));
    const loadSql = loadStatements(rows);
    const generationMs = performance.now() - generationStart;
    const loadSqlSha256 = await sha256(loadSql.join("\n"));
    if (interrupted) return;
    const manifestResponse = await fetch(
      `${import.meta.env.BASE_URL}engines/manifest.json`,
      {
        signal: AbortSignal.any([
          runController.signal,
          AbortSignal.timeout(15000),
        ]),
      },
    );
    if (!manifestResponse.ok)
      throw new Error(
        "Engine assets are unavailable. Rebuild with npm run build, then reload.",
      );
    const assets: unknown = await manifestResponse.json();
    if (interrupted) return;
    const record: RunRecord = {
      format: "benchmarking-lab-databases-v1",
      startedAt,
      completedAt: "",
      build: __BUILD__,
      settings: {
        rows: rowCount,
        repeats: Number(repeats.value),
        sql,
        schema: SCHEMA,
        setup: SETUP,
      },
      fixture: {
        source: fixtureSource,
        loadSql,
        loadSqlSha256,
        generationMs,
        expected,
      },
      engines: {},
      assets,
      environment: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        timeOrigin: performance.timeOrigin,
        crossOriginIsolated,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      method: METHOD,
      phases: [],
      samples: [],
      notesAtStart: notes.value,
    };
    const byEngine = {} as Record<Engine, Client>;
    for (const engine of ENGINES) {
      status.textContent = `Starting ${NAMES[engine]}… First-run engine assets total about 54 MiB. Startup limit: 60 seconds per engine.`;
      const startupStart = performance.now();
      const client = new Client();
      clients.push(client);
      byEngine[engine] = client;
      const result = await client.request(
        {
          operation: "start",
          engine,
          assets: new URL(`${import.meta.env.BASE_URL}engines/`, location.href)
            .href,
        },
        60000,
      );
      record.phases.push({
        engine,
        phase: "startup",
        elapsedMs: performance.now() - startupStart,
      });
      record.engines[engine] = {
        package: PACKAGES[engine],
        runtimeVersion: result.reply.version!,
      };
      status.textContent = `Loading ${rowCount.toLocaleString()} identical orders into ${NAMES[engine]}…`;
      const load = await client.request(
        { operation: "exec", sql: loadSql.join("\n") },
        30000,
      );
      record.phases.push({ engine, phase: "load", elapsedMs: load.elapsedMs });
      status.textContent = `Collecting planner statistics in ${NAMES[engine]} (ANALYZE, no index)…`;
      const setup = await client.request({ operation: "exec", sql: SETUP });
      record.phases.push({
        engine,
        phase: "analyze",
        elapsedMs: setup.elapsedMs,
      });
    }
    for (const phase of ["verification", "warmup"] as const) {
      for (const engine of ENGINES) {
        let elapsedMs = 0;
        for (const query of Object.keys(sql) as Query[]) {
          status.textContent = `${phase === "verification" ? "Verifying" : "Warming up"} ${NAMES[engine]} · ${QUERY_NAMES[query]}…`;
          const result = await byEngine[engine].request({
            operation: "query",
            sql: sql[query],
          });
          elapsedMs += result.elapsedMs;
          assertRows(result.reply.rows, expected[query], engine, query);
        }
        record.phases.push({ engine, phase, elapsedMs });
      }
    }
    for (const [queryIndex, query] of (Object.keys(sql) as Query[]).entries()) {
      for (let pair = 1; pair <= record.settings.repeats; pair++) {
        const order =
          (pair + queryIndex) % 2 === 1 ? ENGINES : [...ENGINES].reverse();
        for (const [index, engine] of order.entries()) {
          status.textContent = `Measuring ${QUERY_NAMES[query]} · pair ${pair}/${record.settings.repeats} · ${NAMES[engine]}…`;
          const result = await byEngine[engine].request({
            operation: "query",
            sql: sql[query],
          });
          assertRows(result.reply.rows, expected[query], engine, query);
          record.samples.push({
            engine,
            query,
            pair,
            position: index + 1,
            elapsedMs: result.elapsedMs,
            rows: result.reply.rows!,
            verified: true,
          });
        }
      }
    }
    status.textContent =
      "All measured answers verified. Closing engines and terminating workers…";
    await Promise.allSettled(
      clients.map((client) => client.request({ operation: "close" }, 3000)),
    );
    clients.forEach((client) => client.terminate());
    clients = [];
    if (interrupted) return;
    record.completedAt = new Date().toISOString();
    records.unshift(record);
    if (records.length > 4) records.pop();
    history.replaceChildren();
    records.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${item.settings.rows.toLocaleString()} orders · ${new Date(item.completedAt).toLocaleTimeString()}`;
      history.append(option);
    });
    history.value = "0";
    showRecord(record);
    status.textContent = `Run complete. Both engines matched the independent reference in every check. ${record.samples.length} measured requests retained. Database workers terminated.`;
  } catch (error) {
    if (!interrupted)
      status.textContent = `Run failed: ${error instanceof Error ? error.message : String(error)} No completed record was added. Previous records remain available.`;
  } finally {
    clients.forEach((client) => client.terminate());
    clients = [];
    runController = undefined;
    active = false;
    runButton.disabled = false;
    stopButton.disabled = true;
    size.disabled = false;
    repeats.disabled = false;
  }
});
download.addEventListener("click", () => {
  if (!selected) return;
  const evidence = {
    ...selected,
    interpretation: {
      notes: notes.value,
      conditionalClaimAndNextCheck: claim.value,
      savedAt: new Date().toISOString(),
      note: "Interpretation is the current draft at export time; measured inputs and samples above are the original run snapshot.",
    },
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `database-comparison-${selected.settings.rows}-${selected.startedAt.replace(/[:.]/g, "-")}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
