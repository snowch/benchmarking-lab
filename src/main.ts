// Copyright © 2026 Christopher Snow
import "./chapter";
import original from "./kernel.wat?raw";
import { median } from "./stats";
import type { Result, Settings } from "./benchmark";

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const size = el<HTMLSelectElement>("size");
const samples = el<HTMLSelectElement>("samples");
const source = el<HTMLTextAreaElement>("source");
const notes = el<HTMLTextAreaElement>("notes");
const settings = el<HTMLFieldSetElement>("settings");
const status = el("status");
const storageKey = "benchmarking-lab:chapter-01:v1";
source.value = original;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  if (saved && typeof saved === "object") {
    if (["64", "256", "1024", "2048"].includes(saved.n)) size.value = saved.n;
    if (["10", "20", "40"].includes(saved.samples))
      samples.value = saved.samples;
    if (typeof saved.source === "string" && saved.source.length <= 20000)
      source.value = saved.source;
    if (typeof saved.notes === "string" && saved.notes.length <= 10000)
      notes.value = saved.notes;
  }
} catch {
  el("save-status").textContent =
    "Saved work could not be read. You can still run experiments and download your notes.";
}

function save() {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        n: size.value,
        samples: samples.value,
        source: source.value,
        notes: notes.value,
      }),
    );
    el("save-status").textContent =
      "Source, settings and notes saved in this browser. Download run records before reloading.";
  } catch {
    el("save-status").textContent =
      "Browser storage is unavailable. Download your notes and run record to keep them.";
  }
}
const step = el<HTMLInputElement>("step");
function renderTrace() {
  const order = document.querySelector<HTMLInputElement>(
    'input[name="order"]:checked',
  )!.value;
  const read = Number(step.value);
  const indices = Array.from({ length: 16 }, (_, i) =>
    order === "row" ? i : (i % 4) * 4 + Math.floor(i / 4),
  );
  const index = indices[read];
  el("grid").innerHTML = Array.from(
    { length: 16 },
    (_, i) =>
      `<span class="${i === index ? "current" : indices.slice(0, read).includes(i) ? "visited" : ""}">${i}</span>`,
  ).join("");
  el("grid").setAttribute(
    "aria-label",
    `Array indices in row-major order. Current read: index ${index}, row ${Math.floor(index / 4)}, column ${index % 4}.`,
  );
  el("trace-readout").textContent =
    `Read ${read + 1} of 16 · array index ${index} · byte offset ${index * 4}`;
  el("pseudocode").textContent =
    order === "row"
      ? "for (row = 0; row < n; row++)\n  for (col = 0; col < n; col++)\n    sum += data[row * n + col];"
      : "for (col = 0; col < n; col++)\n  for (row = 0; row < n; row++)\n    sum += data[row * n + col];";
  el<HTMLButtonElement>("step-back").disabled = read === 0;
  el<HTMLButtonElement>("step-next").disabled = read === 15;
}
el<HTMLFieldSetElement>("trace-controls").disabled = false;
step.disabled = false;
step.oninput = renderTrace;
document.querySelectorAll('input[name="order"]').forEach((input) =>
  input.addEventListener("change", () => {
    step.value = "0";
    renderTrace();
  }),
);
el("step-back").onclick = () => {
  step.value = String(Number(step.value) - 1);
  renderTrace();
};
el("step-next").onclick = () => {
  step.value = String(Number(step.value) + 1);
  renderTrace();
};
renderTrace();

let result: Result | undefined;
let worker: Worker | undefined;
let timeout: ReturnType<typeof setTimeout>;
const currentSettings = (): Settings => ({
  n: Number(size.value),
  samples: Number(samples.value),
  source: source.value,
});
const number = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
function changed() {
  save();
  el("stale").hidden =
    !result ||
    JSON.stringify(result.settings) === JSON.stringify(currentSettings());
}
for (const input of [size, samples, source])
  input.addEventListener("input", changed);
notes.addEventListener("input", save);
el("restore").onclick = () => {
  source.value = original;
  changed();
};
function finish(message: string, error = false) {
  worker?.terminate();
  worker = undefined;
  clearTimeout(timeout);
  settings.disabled = false;
  el("cancel").hidden = true;
  status.textContent = message;
  status.classList.toggle("error", error);
  el("experiment").setAttribute("aria-busy", "false");
}
function renderChart(value: Result) {
  const row = value.samples
    .filter((s) => s.order === "row")
    .map((s) => s.msPerPass);
  const column = value.samples
    .filter((s) => s.order === "column")
    .map((s) => s.msPerPass);
  const rowMedian = median(row),
    columnMedian = median(column);
  const max = Math.max(...row, ...column) * 1.08;
  const width = Math.max(220, Math.min(640, el("chart").clientWidth));
  const left = width < 500 ? 90 : 120;
  const right = width - (width < 500 ? 30 : 25);
  const ticks = width < 500 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
  const x = (v: number) => left + (v / max) * (right - left);
  const marks = (values: number[], y: number, klass: string) =>
    values
      .map(
        (v, i) =>
          `<circle class="${klass}" cx="${x(v)}" cy="${y + ((i % 5) - 2) * 4}" r="4"><title>Sample ${i + 1}: ${v.toFixed(6)} milliseconds per pass</title></circle>`,
      )
      .join("");
  el("chart").innerHTML =
    `<svg viewBox="0 0 ${width} 165" role="img" aria-label="Individual samples on a shared linear time scale. Row median ${number(rowMedian)} milliseconds; column median ${number(columnMedian)} milliseconds. All values are in the sample table."><line x1="${left}" x2="${right}" y1="130" y2="130" class="axis"/><text x="5" y="49">Across rows</text><text x="5" y="99">Down columns</text>${ticks.map((t) => `<line x1="${x(max * t)}" x2="${x(max * t)}" y1="20" y2="134" class="guide"/><text x="${x(max * t)}" y="155" text-anchor="middle">${number(max * t)}</text>`).join("")}${marks(row, 45, "row-mark")}${marks(column, 95, "column-mark")}<path d="M${x(rowMedian)} 29v32" class="median-line"/><path d="M${x(columnMedian)} 79v32" class="median-line"/></svg>`;
}
let chartWidth = 0;
new ResizeObserver((entries) => {
  const width = entries[0].contentRect.width;
  if (result && width !== chartWidth) {
    chartWidth = width;
    renderChart(result);
  }
}).observe(el("chart"));
function renderResult(value: Result) {
  result = value;
  el("results").hidden = false;
  el("stale").hidden = true;
  const row = value.samples
    .filter((s) => s.order === "row")
    .map((s) => s.msPerPass);
  const column = value.samples
    .filter((s) => s.order === "column")
    .map((s) => s.msPerPass);
  const rowMedian = median(row),
    columnMedian = median(column);
  el("summary").innerHTML =
    `<div><span class="small-label">Across rows · median</span><strong>${number(rowMedian)} <small>ms / pass</small></strong></div><div><span class="small-label">Down columns · median</span><strong>${number(columnMedian)} <small>ms / pass</small></strong></div>`;
  renderChart(value);
  el("comparison").textContent =
    `The column median divided by the row median is ${(columnMedian / rowMedian).toFixed(2)}× for this run. Compare the spread before drawing a conclusion.`;
  el("run-details").textContent =
    `${value.settings.n.toLocaleString()} × ${value.settings.n.toLocaleString()} grid · ${value.settings.samples} pairs · ${value.passes.toLocaleString()} passes per batch · checksum ${value.expectedChecksum} verified after every batch. Recorded ${new Date(value.timestamp).toLocaleString()}.`;
  el("raw").innerHTML = value.samples
    .map(
      (s) =>
        `<tr><td>${s.pair}</td><td>${s.order === "row" ? "Across rows" : "Down columns"}</td><td>${s.elapsedMs.toFixed(6)}</td><td>${s.msPerPass.toFixed(6)}</td><td>${s.checksum}</td></tr>`,
    )
    .join("");
}
el("run").onclick = () => {
  if (worker) return;
  if (document.hidden) {
    status.textContent = "Keep this tab visible to run a benchmark.";
    return;
  }
  save();
  settings.disabled = true;
  status.classList.remove("error");
  status.textContent = "Starting the benchmark worker…";
  el("cancel").hidden = false;
  el("experiment").setAttribute("aria-busy", "true");
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event) => {
      if (event.data.type === "progress")
        status.textContent = event.data.message;
      if (event.data.type === "error") finish(event.data.message, true);
      if (event.data.type === "result") {
        renderResult(event.data.result);
        finish(
          "Run complete. Both traversal orders returned the expected checksum.",
        );
      }
    };
    worker.onerror = () =>
      finish(
        "The benchmark worker could not run. Reload and try again; check that this browser supports WebAssembly and workers.",
        true,
      );
    timeout = setTimeout(
      () =>
        finish(
          "Stopped after 30 seconds. No result was accepted from this attempt. Try a smaller grid or restore the original source.",
          true,
        ),
      30000,
    );
    worker.postMessage(currentSettings());
  } catch (error) {
    finish(`Could not start: ${String(error)}`, true);
  }
};
el("cancel").onclick = () =>
  finish("Stopped. No result was accepted from this attempt.");
document.addEventListener("visibilitychange", () => {
  if (document.hidden && worker)
    finish(
      "Stopped because the tab became hidden. Keep it visible and run again.",
    );
});
window.addEventListener("pagehide", () => worker?.terminate());
settings.disabled = false;

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el("download").onclick = () => {
  if (result)
    download(
      JSON.stringify(
        { schemaVersion: 1, experiment: "memory-order", ...result },
        null,
        2,
      ),
      `benchmark-${result.settings.n}-${result.timestamp.replaceAll(":", "-")}.json`,
      "application/json",
    );
};
el("download-notes").onclick = () =>
  download(notes.value, "benchmarking-lab-notes.txt", "text/plain");
const hints = [
  "Change only the grid size. Keep the original source and the same number of sample pairs.",
  "A complete pass visits every value. The larger grid does more work, so compare the column-to-row ratio within each run.",
  "The small grid occupies 16 KiB; the large one occupies 16 MiB. Cache capacities vary by device.",
  "Repeat both runs. If the spreads overlap or the ordering changes, include that uncertainty in your explanation.",
  "Write: “At size … the medians were … and …; at size … they were … and …. On a repeat …. This supports … for this device, but does not establish ….” Fill the gaps from your own results.",
];
let hintIndex = 0;
el("hint").onclick = () => {
  const li = document.createElement("li");
  li.textContent = hints[hintIndex++];
  el("hints-list").append(li);
  el("hint").textContent =
    hintIndex === 5
      ? "All five hints shown"
      : `Show hint · ${hintIndex + 1} of 5`;
  el<HTMLButtonElement>("hint").disabled = hintIndex === 5;
};
