// Copyright © 2026 Christopher Snow
import "./chapter";
import {
  briefFields,
  emptyReport,
  validateReport,
  reportGaps,
  reportMarkdown,
  type Report,
  type Attachment,
} from "./decision-model";
const root = document.getElementById("report-builder")!;
const key = "benchmarking-lab-report-v1";
let report = emptyReport();
let firstStatus =
  "Your draft saves locally in this browser. Download project JSON to keep the text and embedded evidence together.";
try {
  const value = localStorage.getItem(key);
  if (value) report = validateReport(JSON.parse(value));
} catch {
  firstStatus =
    "Saved draft could not be read. A blank project is shown; import a backup if available.";
}
function make<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
const status = make("p", firstStatus);
status.id = "report-status";
status.setAttribute("role", "status");
const editor = make("div");
const titleLabel = make("label", "Report title");
const title = make("input");
title.id = "report-title";
title.value = report.title;
titleLabel.append(title);
editor.append(titleLabel);
const inputs = new Map<string, HTMLTextAreaElement>();
for (const [key, label, hint] of briefFields) {
  const wrapper = make("label", label);
  const help = make("small", hint);
  const input = make("textarea");
  input.id = `report-${key}`;
  input.maxLength = 100000;
  input.value = report.fields[key];
  input.setAttribute("aria-describedby", `report-${key}-help`);
  help.id = `report-${key}-help`;
  wrapper.append(help, input);
  editor.append(wrapper);
  inputs.set(key, input);
}
const attachSet = make("fieldset");
attachSet.append(
  make(
    "legend",
    "Evidence register: attach records or reference artifact paths",
  ),
);
const importLabel = make(
  "label",
  "Attach evidence JSON (Chapter 2, infrastructure run, capacity plan or your own record)",
);
const attach = make("input");
attach.type = "file";
attach.accept = ".json,application/json";
attach.id = "report-evidence";
importLabel.append(attach);
attachSet.append(importLabel);
const referenceGrid = make("div");
referenceGrid.className = "decision-grid";
const nameLabel = make("label", "Artifact name");
const nameInput = make("input");
nameInput.id = "report-reference-name";
nameLabel.append(nameInput);
const sourceLabel = make("label", "Artifact path / source URL + revision");
const sourceInput = make("input");
sourceInput.id = "report-reference-source";
sourceLabel.append(sourceInput);
referenceGrid.append(nameLabel, sourceLabel);
attachSet.append(referenceGrid);
const addReference = make("button", "Add external artifact reference");
addReference.type = "button";
attachSet.append(addReference);
const register = make("div");
register.id = "report-register";
attachSet.append(register);
const actions = make("div");
actions.className = "decision-actions";
const project = make("button", "Download project JSON");
project.id = "report-download";
const markdown = make("button", "Download report Markdown");
markdown.id = "report-markdown";
const refresh = make("button", "Review report");
refresh.id = "report-review";
actions.append(refresh, project, markdown);
const restoreLabel = make(
  "label",
  "Restore project JSON (replaces the current draft)",
);
const restore = make("input");
restore.type = "file";
restore.accept = ".json,application/json";
restore.id = "report-import";
restoreLabel.append(restore);
const checks = make("div");
checks.id = "report-checks";
const previewDetails = make("details");
previewDetails.append(make("summary", "Read the generated report"));
const preview = make("pre");
preview.id = "report-preview";
previewDetails.append(preview);
root.append(
  status,
  editor,
  attachSet,
  actions,
  restoreLabel,
  checks,
  previewDetails,
);
function read() {
  report.title = title.value;
  for (const [key] of briefFields) report.fields[key] = inputs.get(key)!.value;
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(report));
    status.textContent =
      "Draft saved locally. Download project JSON for a portable backup.";
  } catch {
    status.textContent =
      "Draft is available in this tab; browser storage is unavailable or full. Download project JSON now to preserve it.";
  }
}
function review() {
  read();
  preview.textContent = reportMarkdown(report);
  checks.replaceChildren(make("h3", "Evidence review before making a claim"));
  const gaps = reportGaps(report);
  if (gaps.length) {
    const ul = make("ul");
    for (const gap of gaps) ul.append(make("li", gap));
    checks.append(ul);
  } else
    checks.append(
      make(
        "p",
        "Every required field contains text and every evidence item has a source and relevance note. This is a completeness check. A reviewer must still check the facts, methods, fairness and reproducibility.",
      ),
    );
}
function nextId() {
  let i = 1;
  while (report.attachments.some((a) => a.id === `E${i}`)) i++;
  return `E${i}`;
}
function renderRegister() {
  register.replaceChildren();
  for (const item of report.attachments) {
    const card = make("div");
    card.className = "decision-attachment";
    card.append(
      make("strong", `${item.id} · ${item.name}`),
      make("p", `Type: ${item.kind} · Source: ${item.source || "Missing"}`),
    );
    const label = make("label", `Relevance and limits for ${item.id}`);
    const note = make("textarea");
    note.value = item.note;
    note.maxLength = 100000;
    note.id = `report-note-${item.id}`;
    note.addEventListener("input", () => {
      item.note = note.value;
      review();
      save();
    });
    label.append(note);
    card.append(label);
    if (item.payload !== null) {
      const details = make("details");
      details.append(make("summary", "Inspect embedded record"));
      details.append(make("pre", JSON.stringify(item.payload, null, 2)));
      card.append(details);
    }
    const remove = make("button", `Remove ${item.id}`);
    remove.addEventListener("click", () => {
      report.attachments = report.attachments.filter((a) => a !== item);
      renderRegister();
      review();
      save();
    });
    card.append(remove);
    register.append(card);
  }
}
function add(item: Attachment) {
  if (report.attachments.length >= 100)
    throw new Error("Keep at most 100 evidence items per project.");
  if (
    new TextEncoder().encode(
      JSON.stringify({ ...report, attachments: [...report.attachments, item] }),
    ).byteLength >
    24 * 1024 * 1024
  )
    throw new Error(
      "Keep embedded project evidence under 24 MB. Reference larger artifacts by path and checksum.",
    );
  report.attachments.push(item);
  renderRegister();
  review();
  save();
}
editor.addEventListener("input", () => {
  review();
  save();
});
refresh.addEventListener("click", () => {
  review();
  save();
});
addReference.addEventListener("click", () => {
  if (!nameInput.value.trim() || !sourceInput.value.trim()) {
    status.textContent =
      "Give the artifact a name and a source path or URL before adding it.";
    return;
  }
  try {
    add({
      id: nextId(),
      name: nameInput.value,
      source: sourceInput.value,
      kind: "external artifact",
      note: "",
      payload: null,
    });
    nameInput.value = "";
    sourceInput.value = "";
  } catch (error) {
    status.textContent = (error as Error).message;
  }
});
attach.addEventListener("change", async () => {
  const file = attach.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4 * 1024 * 1024)
      throw new Error(
        "Each evidence file must be no larger than 4 MB. Reference larger raw artifacts by path and checksum.",
      );
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder().decode(bytes);
    const payload: unknown = JSON.parse(text);
    if (payload === null || typeof payload !== "object")
      throw new Error("Evidence must be a JSON object or array.");
    const record = payload as Record<string, unknown>;
    const format = String(record.format ?? record.schema ?? "custom");
    const kind =
      format === "benchmarking-lab-databases-v1"
        ? "browser run"
        : format === "benchmarking-lab-infrastructure-v1"
          ? "infrastructure run"
          : format === "benchmarking-lab-capacity-v1"
            ? "capacity plan"
            : "custom record";
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    add({
      id: nextId(),
      name: file.name,
      source: `Uploaded file ${file.name}; SHA-256 of original file bytes: ${digest}`,
      kind,
      note: "",
      payload,
    });
    status.textContent = `Attached ${file.name} as ${kind}. Add its relevance and limits, then cite its evidence ID in your report.`;
  } catch (error) {
    status.textContent = `Evidence not attached: ${(error as Error).message}`;
  }
  attach.value = "";
});
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = make("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
project.addEventListener("click", () => {
  review();
  save();
  download(
    "benchmark-project.json",
    JSON.stringify(report, null, 2),
    "application/json",
  );
});
markdown.addEventListener("click", () => {
  review();
  save();
  download("benchmark-report.md", reportMarkdown(report), "text/markdown");
});
restore.addEventListener("change", async () => {
  const file = restore.files?.[0];
  if (!file) return;
  try {
    if (file.size > 32 * 1024 * 1024)
      throw new Error(
        "Project is larger than 32 MB. Keep large raw artifacts as external references.",
      );
    const imported = validateReport(JSON.parse(await file.text()));
    report = imported;
    title.value = report.title;
    for (const [key] of briefFields)
      inputs.get(key)!.value = report.fields[key];
    renderRegister();
    review();
    save();
  } catch (error) {
    status.textContent = `Project not imported; existing draft retained. ${(error as Error).message}`;
  }
  restore.value = "";
});
renderRegister();
review();
