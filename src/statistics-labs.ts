// Copyright © 2026 Christopher Snow
import "./chapter";
import {
  median,
  number,
  pairedEstimate,
  parsePairs,
  parseRequests,
  requestSummary,
  parseSteps,
  qualifies,
} from "./statistics-model";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = el<HTMLTextAreaElement>("statistics-input");
const output = el("statistics-output");
const status = el("statistics-status");
const notes = el<HTMLTextAreaElement>("statistics-notes");
const chapter = document.body.dataset.statistics!;
const key = `benchmarking-lab-statistics-${chapter}-v1`;
const initial = input.value;
let originals: unknown[] = [];
let provenance =
  "Authored illustrative exercise; these numbers are not measurements of a product.";
const fmt = (value: number, digits = 2) =>
  Number.isFinite(value)
    ? value.toFixed(digits)
    : "undefined (no successful requests)";
function para(text: string) {
  const p = document.createElement("p");
  p.textContent = text;
  output.append(p);
}
function table(headers: string[], rows: (string | number)[][]) {
  const wrap = document.createElement("div");
  wrap.className = "table-scroll";
  const t = document.createElement("table");
  const head = t.createTHead().insertRow();
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = h;
    head.append(th);
  });
  const body = t.createTBody();
  rows.forEach((row) => {
    const tr = body.insertRow();
    row.forEach((value) => {
      tr.insertCell().textContent = String(value);
    });
  });
  wrap.append(t);
  output.append(wrap);
}
function plot(title: string, labels: string[], values: number[], unit: string) {
  const figure = document.createElement("figure");
  figure.className = "statistics-chart";
  const caption = document.createElement("figcaption");
  caption.textContent = title;
  figure.append(caption);
  const max = Math.max(...values, 1);
  labels.forEach((name, i) => {
    const row = document.createElement("div");
    row.className = "statistics-chart-row";
    const heading = document.createElement("div");
    heading.className = "statistics-chart-heading";
    const label = document.createElement("span");
    label.className = "statistics-chart-label";
    label.textContent = name;
    const value = document.createElement("span");
    value.className = "statistics-chart-value";
    value.textContent = `${fmt(values[i])} ${unit}`;
    heading.append(label, value);
    const track = document.createElement("div");
    track.className = "statistics-chart-track";
    track.setAttribute("aria-hidden", "true");
    const bar = document.createElement("div");
    bar.className = "statistics-chart-bar";
    bar.style.width = `${(values[i] / max) * 100}%`;
    track.append(bar);
    row.append(heading, track);
    figure.append(row);
  });
  output.append(figure);
}
let current: unknown;
function calculate() {
  output.replaceChildren();
  try {
    if (chapter === "6") {
      const rows = parsePairs(input.value),
        estimate = pairedEstimate(rows);
      current = estimate;
      para(
        `${rows.length} paired independent runs. Geometric mean A/B time ratio: ${fmt(estimate.ratio)}×; approximate 95% interval ${fmt(estimate.low)}–${fmt(estimate.high)}×. A ratio above 1 means B took less time.`,
      );
      para(
        estimate.low > 1
          ? "The interval lies above parity for these run conditions. Check practical benefit and repeat across relevant conditions before recommending B."
          : estimate.high < 1
            ? "The interval lies below parity for these run conditions. Check practical benefit and repeat across relevant conditions before recommending A."
            : "The interval includes parity (1). These runs do not resolve the direction of the difference at this interval level.",
      );
      plot(
        "Time ratio for each independent paired run",
        rows.map((r) => r.run),
        rows.map((r) => r.a / r.b),
        "× A/B",
      );
      table(
        ["Run", "A (ms)", "B (ms)", "A/B"],
        rows.map((r) => [r.run, r.a, r.b, fmt(r.a / r.b, 4)]),
      );
    } else if (chapter === "7") {
      const window = number(
        el<HTMLInputElement>("statistics-window").value,
        "Observation window",
        true,
      );
      const boundary =
        el<HTMLSelectElement>("statistics-boundary").value === "planned";
      const rows = parseRequests(input.value, window),
        summary = requestSummary(rows, window, boundary);
      current = summary;
      para(
        `${summary.offered} planned = ${summary.ok} successful + ${summary.errors} errors + ${summary.timeouts} timeouts + ${summary.pending} pending. ${summary.sent} sent. Offered rate ${fmt(summary.offeredRate)}/s; successful throughput ${fmt(summary.goodput)}/s over ${fmt(window / 1000)} s.`,
      );
      para(
        `Successful-request population only (n=${summary.ok}); ${boundary ? "planned arrival" : "actual send"} → full response: mean ${fmt(summary.mean)} ms, p50 ${fmt(summary.p50)} ms, p99 ${fmt(summary.p99)} ms. Errors and timeouts are reported separately; pending requests have no completed latency.`,
      );
      if (summary.ok)
        plot(
          "Successful request response times",
          rows.filter((r) => r.status === "ok").map((r) => r.id),
          summary.latencies,
          "ms",
        );
      table(
        [
          "ID",
          "Status",
          "Before-send wait (ms)",
          "Outcome time − planned (ms)",
        ],
        rows.map((r) => [
          r.id,
          r.status,
          r.sent === null ? "not sent" : fmt(r.sent - r.planned),
          r.finished === null ? "unfinished" : fmt(r.finished - r.planned),
        ]),
      );
    } else {
      const target = number(
        el<HTMLInputElement>("statistics-target").value,
        "p99 target",
        true,
      );
      const error = number(
        el<HTMLInputElement>("statistics-errors").value,
        "Allowed failure percentage",
      );
      if (error > 100)
        throw new Error("Allowed failure percentage cannot exceed 100.");
      const rows = parseSteps(input.value);
      current = { target, error, rows };
      para(
        `Qualification rule: successful-request p99 ≤ ${target} ms; errors + timeouts ≤ ${error}% of offered arrivals; pending count does not grow. This screening rule needs repeated, long observations before a deployment capacity claim.`,
      );
      for (const option of new Set(rows.map((r) => r.option))) {
        const points = rows.filter((r) => r.option === option),
          passed = points.filter((r) => qualifies(r, target, error));
        para(
          `${option}: ${passed.length ? `highest supplied passing load ${Math.max(...passed.map((r) => r.offered))}/s` : "no supplied load passes"}. ${points.length} supplied points; the next untested load remains unknown.`,
        );
      }
      plot(
        "Successful throughput at each offered load",
        rows.map((r) => `${r.option} @ ${r.offered}/s`),
        rows.map((r) => r.ok / r.seconds),
        "/s",
      );
      table(
        [
          "Option / offered per s",
          "Successful /s",
          "p99 ms",
          "Failure %",
          "Pending change",
          "Rule",
        ],
        rows.map((r) => [
          `${r.option} / ${r.offered}`,
          fmt(r.ok / r.seconds),
          r.p99,
          fmt((100 * (r.errors + r.timeouts)) / (r.offered * r.seconds)),
          r.end - r.start,
          qualifies(r, target, error) ? "passes" : "fails",
        ]),
      );
    }
    status.textContent = `Analysis updated. ${provenance}`;
    status.classList.remove("error");
    el<HTMLButtonElement>("statistics-download").disabled = false;
  } catch (error) {
    current = undefined;
    status.textContent = error instanceof Error ? error.message : String(error);
    status.classList.add("error");
    el<HTMLButtonElement>("statistics-download").disabled = true;
  }
}
function save() {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        input: input.value,
        notes: notes.value,
        provenance,
        originals,
        controls: [
          ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
            "[data-statistics-control]",
          ),
        ].map((e) => [e.id, e.value]),
      }),
    );
  } catch {
    status.textContent +=
      " Browser storage unavailable; download your evidence.";
  }
}
try {
  const draft = JSON.parse(localStorage.getItem(key) ?? "null");
  if (draft && typeof draft.input === "string") {
    input.value = draft.input;
    notes.value = typeof draft.notes === "string" ? draft.notes : "";
    provenance =
      typeof draft.provenance === "string"
        ? draft.provenance
        : "Restored editable data; provenance unspecified.";
    originals = Array.isArray(draft.originals) ? draft.originals : [];
    for (const [id, value] of draft.controls ?? []) {
      const control = document.getElementById(id) as HTMLInputElement | null;
      if (control?.hasAttribute("data-statistics-control"))
        control.value = value;
    }
  }
} catch {
  /* Draft storage is optional. */
}
el("statistics-analyse").addEventListener("click", () => {
  calculate();
  save();
});
input.addEventListener("input", () => {
  provenance =
    "User-edited input. Verify and describe its source in your notes.";
  originals = [];
  current = undefined;
  el<HTMLButtonElement>("statistics-download").disabled = true;
  status.textContent = "Input changed. Analyse again to update the evidence.";
  save();
});
notes.addEventListener("input", save);
for (const control of document.querySelectorAll("[data-statistics-control]"))
  control.addEventListener("change", () => {
    calculate();
    save();
  });
el("statistics-reset").addEventListener("click", () => {
  input.value = initial;
  originals = [];
  provenance =
    "Authored illustrative exercise; these numbers are not measurements of a product.";
  calculate();
  save();
});
el("statistics-download").addEventListener("click", () => {
  if (current === undefined) return;
  const controls = Object.fromEntries(
    [
      ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-statistics-control]",
      ),
    ].map((e) => [e.id, e.value]),
  );
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "benchmarking-lab-statistics-v1",
          chapter,
          method:
            chapter === "6"
              ? "Geometric mean of independent paired run A/B time ratios; two-sided approximate 95% Student t interval on log ratios; df = n - 1, capped at 30 for conservative critical values."
              : chapter === "7"
                ? "Nearest-rank successful-request percentiles; declared planned or actual-send boundary; full-window planned and terminal-outcome accounting."
                : "Screen supplied load steps against p99, errors plus timeouts per offered arrivals and non-growing pending work; this is not a sustained capacity measurement.",
          savedAt: new Date().toISOString(),
          provenance,
          rawCsv: input.value,
          controls,
          analysis: current,
          notes: notes.value,
          originals,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `chapter-${chapter}-evidence.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
const file = el<HTMLInputElement>("statistics-import");
file?.addEventListener("change", async () => {
  try {
    const files = Array.from(file.files ?? []);
    if (files.length < 2)
      throw new Error(
        "Select at least two separate Chapter 2 run exports together.",
      );
    const data = await Promise.all(
      files.map(async (f) => JSON.parse(await f.text())),
    );
    const query = el<HTMLSelectElement>("statistics-query").value;
    const identities = new Set<string>();
    let signature = "";
    const rows = ["run,a_ms,b_ms"];
    for (const [index, run] of data.entries()) {
      if (
        run.format !== "benchmarking-lab-databases-v1" ||
        !run.completedAt ||
        !run.startedAt ||
        !Array.isArray(run.samples)
      )
        throw new Error("Each file must be a completed Chapter 2 export.");
      if (identities.has(run.startedAt))
        throw new Error(
          "Duplicate run: select each independent experiment once.",
        );
      identities.add(run.startedAt);
      const comparable = JSON.stringify({
        settings: run.settings,
        build: run.build,
        engines: run.engines,
        method: run.method,
        fixtureHash: run.fixture?.loadSqlSha256,
      });
      if (index === 0) signature = comparable;
      else if (signature !== comparable)
        throw new Error(
          "These runs differ in settings, build, engines, method or input hash. Analyse compatible runs together.",
        );
      const times = (engine: string) =>
        run.samples.filter(
          (s: Record<string, unknown>) =>
            s.engine === engine && s.query === query,
        );
      const a = times("duckdb"),
        b = times("pglite");
      if (
        a.length !== run.settings.repeats ||
        b.length !== a.length ||
        [...a, ...b].some(
          (s: Record<string, unknown>) =>
            s.verified !== true ||
            typeof s.elapsedMs !== "number" ||
            !Number.isFinite(s.elapsedMs) ||
            s.elapsedMs <= 0,
        )
      )
        throw new Error(
          "Each selected query needs a complete set of positive, verified times for both engines.",
        );
      rows.push(
        `run-${index + 1},${median(a.map((s: { elapsedMs: number }) => s.elapsedMs))},${median(b.map((s: { elapsedMs: number }) => s.elapsedMs))}`,
      );
    }
    input.value = rows.join("\n");
    originals = data;
    provenance = `Imported ${data.length} Chapter 2 exports for ${query}. A = DuckDB-Wasm, B = PGlite; one median per engine per fresh run. Independence remains your experimental responsibility.`;
    calculate();
    save();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.classList.add("error");
  }
});
calculate();
