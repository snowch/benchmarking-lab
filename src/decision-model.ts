// Copyright © 2026 Christopher Snow
/** Planning arithmetic only: no engine timing or vendor pricing is inferred. */
export type Provenance =
  "illustration" | "measurement" | "assumption" | "vendor claim";
export interface CapacityOption {
  name: string;
  rate: number;
  provenance: Provenance;
  evidence: string;
  topology: string;
  unitHourly: number;
  storageGB: number;
  storagePrice: number;
  operationsMillion: number;
  operationPrice: number;
  egressGB: number;
  egressPrice: number;
  licenseMonthly: number;
  workersMonthly: number;
  laborHours: number;
  laborHourly: number;
  setup: number;
  correctPct: number;
  onTimePct: number;
  priceSource: string;
  exclusions: string;
}
export interface CapacityPlan {
  format: "benchmarking-lab-capacity-v1";
  peak: number;
  average: number;
  headroomPct: number;
  spare: number;
  months: number;
  hoursPerMonth: number;
  target: string;
  region: string;
  priceDate: string;
  currency: string;
  demandSource: string;
  discount: string;
  options: [CapacityOption, CapacityOption];
}
export function examplePlan(): CapacityPlan {
  const common = {
    provenance: "illustration" as const,
    evidence: "",
    topology:
      "One complete three-replica service group; hourly compute includes all three replicas. No scaling or failover evidence yet.",
    storageGB: 600,
    storagePrice: 0.08,
    operationsMillion: 80,
    operationPrice: 0.5,
    egressGB: 1000,
    egressPrice: 0.06,
    licenseMonthly: 0,
    workersMonthly: 180,
    laborHours: 8,
    laborHourly: 75,
    setup: 1200,
    correctPct: 100,
    onTimePct: 100,
    priceSource:
      "Invented teaching prices in example credits; replace with dated quotes and quantities.",
    exclusions:
      "Taxes and financing excluded in this illustration. Confirm backups, cross-zone replication, recovery traffic, support and retention in each quote.",
  };
  return {
    format: "benchmarking-lab-capacity-v1",
    peak: 1800,
    average: 600,
    headroomPct: 25,
    spare: 1,
    months: 12,
    hoursPerMonth: 730,
    target:
      "Correct useful responses; p99 ≤ 200 ms; no growing backlog at peak; one complete service group unavailable.",
    region: "Illustrative region — choose the deployment region",
    priceDate: "2026-10-01",
    currency: "credits",
    demandSource:
      "Illustrative demand forecast; replace with arrival trace and planning horizon.",
    discount: "No discount; no reserved commitment in this illustration.",
    options: [
      { ...common, name: "Option A", rate: 900, unitHourly: 0.6 },
      { ...common, name: "Option B", rate: 1500, unitHourly: 1 },
    ],
  };
}
export interface CapacityResult {
  activeUnits: number;
  units: number;
  usableRate: number;
  monthly: Record<string, number>;
  total: number;
  offered: number;
  useful: number;
  incorrect: number;
  correctLate: number;
  perMillion: number | null;
}
export function capacityResult(
  plan: CapacityPlan,
  option: CapacityOption,
  demand = 1,
  performance = 1,
  price = 1,
): CapacityResult {
  const usableRate = option.rate * performance * (1 - plan.headroomPct / 100);
  const activeUnits = Math.ceil((plan.peak * demand) / usableRate);
  const units = activeUnits + plan.spare;
  const monthly = {
    compute: units * option.unitHourly * plan.hoursPerMonth,
    storage: units * option.storageGB * option.storagePrice,
    operations: option.operationsMillion * demand * option.operationPrice,
    network: option.egressGB * demand * option.egressPrice,
    licenses: units * option.licenseMonthly,
    workers: option.workersMonthly,
    operationsLabor: option.laborHours * option.laborHourly,
  };
  const total =
    (Object.values(monthly).reduce((a, b) => a + b, 0) * plan.months +
      option.setup) *
    price;
  const offered =
    plan.average * demand * plan.hoursPerMonth * 3600 * plan.months;
  const correct = (offered * option.correctPct) / 100;
  const useful = (correct * option.onTimePct) / 100;
  return {
    activeUnits,
    units,
    usableRate,
    monthly,
    total,
    offered,
    useful,
    incorrect: offered - correct,
    correctLate: correct - useful,
    perMillion: useful > 0 ? (total / useful) * 1e6 : null,
  };
}
const optionNumbers = [
  "rate",
  "unitHourly",
  "storageGB",
  "storagePrice",
  "operationsMillion",
  "operationPrice",
  "egressGB",
  "egressPrice",
  "licenseMonthly",
  "workersMonthly",
  "laborHours",
  "laborHourly",
  "setup",
  "correctPct",
  "onTimePct",
] as const;
const optionStrings = [
  "name",
  "evidence",
  "topology",
  "priceSource",
  "exclusions",
] as const;
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected a JSON object.");
  return input as Record<string, unknown>;
}
function numberValue(
  value: unknown,
  label: string,
  min = 0,
  max = 1e15,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${label} must be a finite number from ${min} to ${max}.`);
  return value;
}
function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 100000)
    throw new Error(`${label} must be text (up to 100,000 characters).`);
  return value;
}
export function validatePlan(input: unknown): CapacityPlan {
  const p = object(input);
  if (p.format !== "benchmarking-lab-capacity-v1")
    throw new Error(
      "Use a capacity-v1 plan. A browser run is evidence for a report, not a server capacity plan.",
    );
  const result = examplePlan();
  for (const key of [
    "peak",
    "average",
    "headroomPct",
    "spare",
    "months",
    "hoursPerMonth",
  ] as const)
    result[key] = numberValue(
      p[key],
      key,
      0,
      key === "headroomPct"
        ? 95
        : key === "months"
          ? 1200
          : key === "hoursPerMonth"
            ? 744
            : 1e12,
    );
  if (
    result.peak <= 0 ||
    result.average <= 0 ||
    result.months <= 0 ||
    result.hoursPerMonth <= 0
  )
    throw new Error(
      "Demand, horizon and monthly hours must be greater than zero.",
    );
  if (result.average > result.peak)
    throw new Error("Average demand cannot exceed peak demand.");
  if (!Number.isInteger(result.spare))
    throw new Error("Unavailable service groups must be a whole number.");
  for (const key of [
    "target",
    "region",
    "priceDate",
    "currency",
    "demandSource",
    "discount",
  ] as const)
    result[key] = stringValue(p[key], key);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result.priceDate) ||
    Number.isNaN(Date.parse(result.priceDate)) ||
    new Date(result.priceDate).toISOString().slice(0, 10) !== result.priceDate
  )
    throw new Error("Record the price date as YYYY-MM-DD.");
  if (!Array.isArray(p.options) || p.options.length !== 2)
    throw new Error("A plan requires exactly two options.");
  result.options = p.options.map((raw: unknown) => {
    const o = object(raw);
    const option = { ...examplePlan().options[0] };
    for (const key of optionNumbers)
      option[key] = numberValue(
        o[key],
        key,
        0,
        key.endsWith("Pct") ? 100 : 1e15,
      );
    if (option.rate <= 0)
      throw new Error("Capacity must be greater than zero.");
    for (const key of optionStrings) option[key] = stringValue(o[key], key);
    if (
      !["illustration", "measurement", "assumption", "vendor claim"].includes(
        String(o.provenance),
      )
    )
      throw new Error("Choose the capacity input provenance.");
    option.provenance = o.provenance as Provenance;
    return option;
  }) as [CapacityOption, CapacityOption];
  for (const option of result.options) {
    const r = capacityResult(result, option);
    if (
      !Number.isFinite(r.total) ||
      !Number.isFinite(r.offered) ||
      !Number.isSafeInteger(r.units)
    )
      throw new Error("Inputs exceed the supported calculation range.");
  }
  return result;
}
export function planGaps(plan: CapacityPlan): string[] {
  const gaps: string[] = [];
  if (!plan.region.trim() || !plan.currency.trim())
    gaps.push("Region or currency is missing.");
  if (!plan.demandSource.trim())
    gaps.push("Demand forecast source is missing.");
  if (!plan.discount.trim())
    gaps.push("Discount and commitment assumptions are missing.");
  if (!plan.target.trim()) gaps.push("Service targets are missing.");
  for (const option of plan.options) {
    if (option.provenance !== "measurement")
      gaps.push(
        `${option.name}: capacity is ${option.provenance}; deployment performance remains unverified.`,
      );
    if (!option.evidence.trim())
      gaps.push(
        `${option.name}: attach a native/server run ID, workload, duration and service-level checks.`,
      );
    if (!option.topology.trim())
      gaps.push(
        `${option.name}: define the priced and measured service group.`,
      );
    if (!option.priceSource.trim())
      gaps.push(`${option.name}: price and quantity sources are missing.`);
  }
  gaps.push(
    "Model assumes independent service groups scale linearly and loss of the stated group count is tolerated. Validate the proposed whole deployment under load and failure; arithmetic does not verify either assumption.",
  );
  return gaps;
}
export const briefFields = [
  [
    "question",
    "Customer decision",
    "Who chooses what, for which business outcome, by when?",
  ],
  [
    "acceptance",
    "Acceptance criteria",
    "Units, workload, latency point/percentile, errors, correctness, recovery and cost limits; define pass/fail before execution.",
  ],
  [
    "workload",
    "Workload and guarantees",
    "Dataset/generator, skew, query/event mix, arrivals, concurrency, durability, replicas, retention and semantic equivalence.",
  ],
  [
    "setup",
    "Reproducible setup",
    "Repository URL and revision, pinned versions, host/region/resources, configuration, dependencies and exact setup/reset commands.",
  ],
  [
    "runner",
    "Runner and timing",
    "Exact run/collect/verify commands, seed, repeats, run order, warmup, duration, arrival model, timing boundaries and cancellation.",
  ],
  [
    "correctness",
    "Correctness and accounting",
    "Expected answers/IDs, independent oracle, missing/duplicate/wrong/late counts, unfinished work and how a failing run is retained.",
  ],
  [
    "analysis",
    "Results and uncertainty",
    "Run IDs, raw data pointers, useful throughput, latency distribution, failures, per-run variability and repeatable analysis commands.",
  ],
  [
    "cost",
    "Capacity and cost",
    "Complete topology, measured capacity, service targets, headroom, failure reserve, dated regional prices, exclusions and sensitivity.",
  ],
  [
    "claim",
    "Customer-facing recommendation",
    "Conditional finding with workload, tested builds, conditions and magnitude; link the exact evidence IDs.",
  ],
  [
    "limits",
    "Limits and next decision",
    "What was not measured, unresolved risks, likely crossover, decision-changing next test and owner.",
  ],
  [
    "review",
    "Review a published comparison",
    "Public URL/title/date, exact claim, evidence supplied, missing conditions, commercial context and a fair follow-up with changed variable and success criterion.",
  ],
] as const;
export type BriefKey = (typeof briefFields)[number][0];
export interface Attachment {
  id: string;
  name: string;
  source: string;
  kind: string;
  note: string;
  payload: unknown;
}
export interface Report {
  format: "benchmarking-lab-report-v1";
  title: string;
  fields: Record<BriefKey, string>;
  attachments: Attachment[];
}
export function emptyReport(): Report {
  return {
    format: "benchmarking-lab-report-v1",
    title: "My benchmark recommendation",
    fields: Object.fromEntries(briefFields.map(([k]) => [k, ""])) as Record<
      BriefKey,
      string
    >,
    attachments: [],
  };
}
export function validateReport(input: unknown): Report {
  const raw = object(input);
  if (raw.format !== "benchmarking-lab-report-v1")
    throw new Error(
      "Choose a report-v1 project to replace the draft. Use “Attach evidence” for individual run records.",
    );
  const result = emptyReport();
  result.title = stringValue(raw.title, "Title");
  const fields = object(raw.fields);
  for (const [key, label] of briefFields)
    result.fields[key] = stringValue(fields[key], label);
  if (!Array.isArray(raw.attachments) || raw.attachments.length > 100)
    throw new Error("A report supports up to 100 evidence items.");
  const ids = new Set<string>();
  result.attachments = raw.attachments.map((a: unknown) => {
    const item = object(a);
    const result = {
      id: stringValue(item.id, "Evidence ID"),
      name: stringValue(item.name, "Evidence name"),
      source: stringValue(item.source, "Evidence source"),
      kind: stringValue(item.kind, "Evidence kind"),
      note: stringValue(item.note, "Evidence note"),
      payload: item.payload ?? null,
    };
    if (!result.id.trim() || ids.has(result.id))
      throw new Error("Evidence IDs must be nonempty and unique.");
    ids.add(result.id);
    return result;
  });
  return result;
}
export function reportGaps(report: Report): string[] {
  const gaps = briefFields
    .filter(([key]) => !report.fields[key].trim())
    .map(([, label]) => `${label} is missing.`);
  if (!report.title.trim()) gaps.unshift("Report title is missing.");
  if (!report.attachments.length) gaps.push("No evidence is attached.");
  for (const a of report.attachments) {
    if (!a.source.trim())
      gaps.push(`${a.id}: source or artifact path is missing.`);
    if (!a.note.trim())
      gaps.push(
        `${a.id}: explain which claim this evidence supports and its limits.`,
      );
    if (a.kind === "browser run")
      gaps.push(
        `${a.id}: browser-engine evidence supports the tested browser builds only; it cannot establish server capacity or infrastructure cost.`,
      );
  }
  return gaps;
}
export function reportMarkdown(report: Report): string {
  const lines = [
    `# ${report.title}`,
    "",
    "Draft recommendation — author review required. Text and attachments are supplied by the author; field completeness does not verify claims.",
    "",
  ];
  for (const [key, label] of briefFields)
    lines.push(
      `## ${label}`,
      "",
      report.fields[key].trim() ||
        "[Missing — supply evidence before making a claim.]",
      "",
    );
  lines.push("## Evidence register", "");
  for (const a of report.attachments)
    lines.push(
      `### ${a.id}: ${a.name}`,
      "",
      `Type: ${a.kind}`,
      `Source: ${a.source || "[missing]"}`,
      "",
      a.note || "[Explain relevance and limits.]",
      "",
      a.payload === null
        ? "External reference: package the referenced artifact separately."
        : "Payload is embedded in the companion report JSON export.",
      "",
    );
  const gaps = reportGaps(report);
  lines.push(
    "## Open evidence checks",
    "",
    ...(gaps.length
      ? gaps.map((g) => `- ${g}`)
      : [
          "All required fields contain text. A reviewer must still check the evidence and reproduce the result.",
        ]),
    "",
  );
  return lines.join("\n");
}
