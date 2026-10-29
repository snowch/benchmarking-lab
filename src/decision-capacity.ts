// Copyright © 2026 Christopher Snow
import "./chapter";
import {
  examplePlan,
  validatePlan,
  capacityResult,
  planGaps,
  type CapacityPlan,
  type CapacityOption,
} from "./decision-model";
const root = document.getElementById("capacity-planner")!;
const key = "benchmarking-lab-capacity-v1";
let plan = examplePlan();
let storageNotice = "";
try {
  const saved = localStorage.getItem(key);
  if (saved) plan = validatePlan(JSON.parse(saved));
} catch {
  storageNotice =
    "Saved data could not be read. The illustrative example is shown; import a backup if needed.";
}
function make<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = make("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const form = make("form");
form.noValidate = true;
const status = make(
  "p",
  storageNotice ||
    "Illustrative planning inputs. Changes save locally in this browser.",
);
status.id = "capacity-status";
status.setAttribute("role", "status");
const output = make("div");
output.id = "capacity-results";
const controls: {
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  group: number;
  property: string;
  numeric: boolean;
}[] = [];
function field(
  grid: HTMLElement,
  label: string,
  property: string,
  value: string | number,
  group = -1,
  kind = "text",
) {
  const wrapper = make("label", label);
  const input =
    kind === "textarea"
      ? make("textarea")
      : kind === "select"
        ? make("select")
        : make("input");
  input.id = `capacity-${group < 0 ? "common" : group}-${property}`;
  if (input instanceof HTMLInputElement) {
    input.type = kind === "number" ? "number" : kind;
    if (kind === "number") {
      input.min = "0";
      input.step = "any";
      input.required = true;
    }
  }
  if (input instanceof HTMLSelectElement)
    for (const text of [
      "illustration",
      "measurement",
      "assumption",
      "vendor claim",
    ]) {
      const o = make("option", text);
      o.value = text;
      input.append(o);
    }
  input.value = String(value);
  wrapper.append(input);
  grid.append(wrapper);
  controls.push({ input, group, property, numeric: typeof value === "number" });
}
const common = make("fieldset");
common.append(make("legend", "1 · Same demand, targets and horizon"));
const grid = make("div");
grid.className = "decision-grid";
common.append(grid);
for (const [label, prop, kind] of [
  ["Peak useful demand / second", "peak", "number"],
  ["Average offered demand / second", "average", "number"],
  ["Headroom left unused (%)", "headroomPct", "number"],
  ["Whole groups unavailable to plan for", "spare", "number"],
  ["Horizon (months)", "months", "number"],
  ["Hours per month (730 = annual average)", "hoursPerMonth", "number"],
  ["Service targets and correctness contract", "target", "textarea"],
  ["Demand forecast source and uncertainty", "demandSource", "textarea"],
  ["Region", "region", "text"],
  ["Price date", "priceDate", "date"],
  ["Currency or example unit", "currency", "text"],
  ["Discounts / commitment conditions", "discount", "text"],
] as const)
  field(grid, label, prop, plan[prop], -1, kind);
form.append(common);
const optionFields = [
  ["Option name", "name", "text"],
  [
    "Sustainable correct, timely results / second per complete group",
    "rate",
    "number",
  ],
  ["Capacity provenance", "provenance", "select"],
  [
    "Capacity evidence: run ID, target checks, duration, tested build",
    "evidence",
    "textarea",
  ],
  ["What exactly is one measured and priced group?", "topology", "textarea"],
  ["Compute per complete group / hour (all replicas)", "unitHourly", "number"],
  [
    "Physical billable storage GB per group (all copies + backups)",
    "storageGB",
    "number",
  ],
  ["Storage price per GB-month", "storagePrice", "number"],
  [
    "Millions of billable operations per deployment / month",
    "operationsMillion",
    "number",
  ],
  ["Price per million operations", "operationPrice", "number"],
  ["Billable network GB per deployment / month", "egressGB", "number"],
  ["Network price per GB", "egressPrice", "number"],
  ["Licences + support per group / month", "licenseMonthly", "number"],
  [
    "Workers, connectors + monitoring per deployment / month",
    "workersMonthly",
    "number",
  ],
  ["Operating effort hours per deployment / month", "laborHours", "number"],
  ["Fully loaded cost per operating hour", "laborHourly", "number"],
  ["One-time migration + setup per deployment", "setup", "number"],
  ["Projected correct results among offered (%)", "correctPct", "number"],
  ["Projected on-time among correct results (%)", "onTimePct", "number"],
  [
    "Price + quantity sources, assumptions and billing rules",
    "priceSource",
    "textarea",
  ],
  ["Exclusions / costs included elsewhere", "exclusions", "textarea"],
] as const;
plan.options.forEach((option, i) => {
  const set = make("fieldset");
  set.append(make("legend", `${i + 2} · ${option.name}`));
  const fields = make("div");
  fields.className = "decision-grid";
  for (const [label, prop, kind] of optionFields)
    field(fields, label, prop, option[prop], i, kind);
  set.append(fields);
  form.append(set);
});
const actions = make("div");
actions.className = "decision-actions";
const calculate = make("button", "Calculate and save");
calculate.type = "submit";
const exportButton = make("button", "Download plan JSON");
exportButton.type = "button";
const reset = make("button", "Load illustrative example");
reset.type = "button";
actions.append(calculate, exportButton, reset);
form.append(actions);
const importLabel = make(
  "label",
  "Import a capacity plan JSON (replaces these inputs)",
);
const upload = make("input");
upload.type = "file";
upload.accept = ".json,application/json";
upload.id = "capacity-import";
importLabel.append(upload);
form.append(importLabel);
root.append(form, status, output);
const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });
function table(headers: string[], rows: (string | number)[][]) {
  const wrapper = make("div");
  wrapper.className = "decision-scroll";
  const t = make("table");
  t.className = "decision-table";
  const head = make("thead");
  const tr = make("tr");
  for (const h of headers) tr.append(make("th", h));
  head.append(tr);
  t.append(head);
  const body = make("tbody");
  for (const row of rows) {
    const tr = make("tr");
    row.forEach((v, i) => {
      const cell = make(i === 0 ? "th" : "td", String(v));
      if (i === 0) cell.setAttribute("scope", "row");
      tr.append(cell);
    });
    body.append(tr);
  }
  t.append(body);
  wrapper.append(t);
  return wrapper;
}
function comparison(title: string, values: (number | null)[], unit: string) {
  const figure = make("figure");
  figure.className = "decision-comparison";
  figure.append(make("figcaption", title));
  const finite = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  const maximum = Math.max(0, ...finite);
  const scale = make(
    "p",
    finite.length
      ? `Planning estimates · shared scale: 0–${fmt(maximum)} ${unit}.`
      : "Planning estimates · no defined finite values to plot.",
  );
  scale.className = "decision-comparison-scale";
  figure.append(scale);
  values.forEach((value, index) => {
    const row = make("div");
    row.className = "decision-comparison-row";
    const heading = make("div");
    heading.className = "decision-comparison-heading";
    heading.append(
      make("span", plan.options[index].name),
      make(
        "span",
        value === null
          ? "Undefined: zero useful results"
          : Number.isFinite(value)
            ? `${fmt(value)} ${unit}`
            : "Unavailable: outside numeric range",
      ),
    );
    row.append(heading);
    if (value !== null && Number.isFinite(value)) {
      const track = make("div");
      track.className = "decision-comparison-track";
      track.setAttribute("aria-hidden", "true");
      const bar = make("div");
      bar.className = "decision-comparison-bar";
      bar.style.width = `${maximum > 0 ? (100 * value) / maximum : 0}%`;
      track.append(bar);
      row.append(track);
    }
    figure.append(row);
  });
  return figure;
}
function render() {
  output.replaceChildren();
  const results = plan.options.map((o) => capacityResult(plan, o));
  const summary = make(
    "p",
    `Planning estimate in ${plan.currency}, ${plan.region}, prices dated ${plan.priceDate}, ${plan.months} months. These are calculations from the declared inputs, not observed deployment results.`,
  );
  summary.className = "decision-summary";
  output.append(summary);
  const currency = plan.currency || "currency units";
  output.append(
    comparison(
      `Total cost over ${plan.months} months`,
      results.map((result) => result.total),
      currency,
    ),
    comparison(
      "Cost per million correct on-time results",
      results.map((result) => result.perMillion),
      `${currency} / million results`,
    ),
  );
  const rows: (string | number)[][] = [
    ["Metric", ...plan.options.map((o) => o.name)],
    ["Groups carrying peak load", ...results.map((r) => r.activeUnits)],
    [
      "Total priced groups (including failure reserve)",
      ...results.map((r) => r.units),
    ],
    [
      "Usable rate per group after headroom",
      ...results.map((r) => fmt(r.usableRate)),
    ],
  ];
  output.append(table(rows.shift()!.map(String), rows));
  const costs = Object.keys(
    results[0].monthly,
  ) as (keyof (typeof results)[0]["monthly"])[];
  const labels: Record<string, string> = {
    compute: "Compute / month",
    storage: "Physical storage / month",
    operations: "Storage + service operations / month",
    network: "Network + egress / month",
    licenses: "Licences + support / month",
    workers: "Workers + connectors + monitoring / month",
    operationsLabor: "Operating effort / month",
  };
  output.append(
    table(
      ["Cost / output", ...plan.options.map((o) => o.name)],
      [
        ...costs.map((c) => [
          labels[c],
          ...results.map((r) => fmt(r.monthly[c])),
        ]),
        ["One-time costs", ...plan.options.map((o) => fmt(o.setup))],
        ["Total over horizon", ...results.map((r) => fmt(r.total))],
        [
          "Projected correct on-time results",
          ...results.map((r) => fmt(r.useful)),
        ],
        [
          "Projected incorrect / failed",
          ...results.map((r) => fmt(r.incorrect)),
        ],
        [
          "Projected correct but late",
          ...results.map((r) => fmt(r.correctLate)),
        ],
        [
          "Cost per million correct on-time results",
          ...results.map((r) =>
            r.perMillion === null
              ? "Undefined: zero useful results"
              : fmt(r.perMillion),
          ),
        ],
      ],
    ),
  );
  output.append(
    make("h3", "Sensitivity: which assumption changes the decision?"),
  );
  const scenarios: [string, number, number, number][] = [
    ["Base inputs", 1, 1, 1],
    ["Demand −20%", 0.8, 1, 1],
    ["Demand +20%", 1.2, 1, 1],
    ["Capacity per group −20%", 1, 0.8, 1],
    ["All costs +20%", 1, 1, 1.2],
  ];
  output.append(
    table(
      [
        "Scenario",
        ...plan.options.map((o) => `${o.name}: groups / total cost`),
      ],
      scenarios.map(([label, d, p, c]) => [
        label,
        ...plan.options.map((o) => {
          const r = capacityResult(plan, o, d, p, c);
          return `${r.units} / ${fmt(r.total)}`;
        }),
      ]),
    ),
  );
  output.append(
    make(
      "p",
      "Demand scenarios scale peak, average, operations and network together. Storage, labour and shared workers stay fixed; capacity changes only group count; price scenarios scale every cost including setup. These are explicit simplifications. Edit retention and shared services separately when the workload changes.",
    ),
  );
  output.append(make("h3", "Evidence still needed"));
  const ul = make("ul");
  for (const gap of planGaps(plan)) ul.append(make("li", gap));
  output.append(ul);
  output.append(
    make(
      "p",
      "Projected useful output = average offered rate × seconds × months × correct fraction × on-time fraction among correct. Failed and late results remain visible above. Fractions are planning assumptions; validate them against acceptance criteria, even when lower cost per useful result looks attractive.",
    ),
  );
}
function read() {
  const draft = structuredClone(plan);
  for (const c of controls) {
    if (c.numeric && !c.input.value.trim())
      throw new Error(
        `${c.input.parentElement?.firstChild?.textContent}: enter a number, including explicit zero if excluded.`,
      );
    const target = (c.group < 0
      ? draft
      : draft.options[c.group]) as unknown as Record<string, unknown>;
    target[c.property] = c.numeric ? Number(c.input.value) : c.input.value;
  }
  return validatePlan(draft);
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(plan));
    status.textContent =
      "Plan saved locally. Download JSON to keep a portable backup.";
  } catch {
    status.textContent =
      "Calculated successfully, but browser storage is unavailable or full. Download JSON to keep this plan.";
  }
}
function compute() {
  try {
    plan = read();
    render();
    save();
    return true;
  } catch (error) {
    status.textContent = `Calculation blocked: ${(error as Error).message}`;
    output.replaceChildren(
      make("p", "No current result. Correct the inputs and calculate again."),
    );
    return false;
  }
}
form.addEventListener("submit", (e) => {
  e.preventDefault();
  compute();
});
form.addEventListener("input", (event) => {
  if (!controls.some((c) => c.input === event.target)) return;
  status.textContent =
    "Inputs changed. Calculate to update the result and saved plan.";
  output.replaceChildren(
    make("p", "Results need recalculation for the edited inputs."),
  );
});
exportButton.addEventListener("click", () => {
  if (compute()) download("capacity-plan.json", plan);
});
function populate() {
  for (const c of controls)
    c.input.value = String(
      (
        (c.group < 0 ? plan : plan.options[c.group]) as unknown as Record<
          string,
          unknown
        >
      )[c.property],
    );
  render();
  save();
}
reset.addEventListener("click", () => {
  plan = examplePlan();
  populate();
});
upload.addEventListener("change", async () => {
  const file = upload.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4 * 1024 * 1024)
      throw new Error("File is larger than 4 MB.");
    const imported = validatePlan(JSON.parse(await file.text()));
    plan = imported;
    populate();
    status.textContent =
      "Capacity plan imported and saved locally. Check all provenance and billing assumptions.";
  } catch (error) {
    status.textContent = `Import rejected; existing plan retained. ${(error as Error).message}`;
  }
  upload.value = "";
});
render();
