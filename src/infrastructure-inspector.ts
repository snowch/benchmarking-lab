import "./chapter";

type Event = {
  t: number;
  kind: string;
  object_id?: number;
  record_id?: number | null;
};
type Trace = {
  schema: string;
  mode: "broker" | "pipeline";
  run_id: string;
  summary: Record<string, number | boolean | null>;
  observations: Event[];
};
const root = document.querySelector<HTMLElement>("#trace-inspector");
if (root) {
  const input = root.querySelector<HTMLTextAreaElement>("#trace-json")!;
  const file = root.querySelector<HTMLInputElement>("#trace-file")!;
  const notes = root.querySelector<HTMLTextAreaElement>("#trace-notes")!;
  const result = root.querySelector<HTMLElement>("#trace-result")!;
  const chart = root.querySelector<HTMLElement>("#trace-chart")!;
  const download = root.querySelector<HTMLButtonElement>("#trace-download")!;
  const storageKey = `infrastructure-review:${location.pathname}`;
  const maxBytes = 5 * 1024 * 1024;
  let inspected: Trace | null = null;
  let generation = 0;
  let source = "User-supplied trace";
  let redraw: (() => void) | undefined;
  new ResizeObserver(() => redraw?.()).observe(chart);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as {
      draft?: string;
      notes?: string;
      source?: string;
    } | null;
    if (saved) {
      input.value = saved.draft || "";
      notes.value = saved.notes || "";
      if (saved.source === "Recorded local functional example")
        source = saved.source;
    }
  } catch {
    /* Storage may be unavailable. */
  }
  const save = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ draft: input.value, notes: notes.value, source }),
      );
    } catch {
      /* Large drafts or private browsing may prevent storage. */
    }
  };
  const invalidate = (message: string) => {
    redraw = undefined;
    inspected = null;
    chart.replaceChildren();
    download.disabled = true;
    result.textContent = message;
  };
  const integer = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const parse = (raw: string): Trace => {
    if (new TextEncoder().encode(raw).length > maxBytes)
      throw new Error("Evidence exceeds the 5 MB limit.");
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Expected an evidence object.");
    const trace = data as Record<string, unknown>;
    if (
      trace.schema !== "benchmarking-lab-infrastructure-v1" ||
      !["broker", "pipeline"].includes(String(trace.mode)) ||
      typeof trace.run_id !== "string" ||
      !trace.run_id.trim() ||
      !trace.summary ||
      typeof trace.summary !== "object" ||
      Array.isArray(trace.summary) ||
      !Array.isArray(trace.observations)
    )
      throw new Error(
        "Expected a harness trace with a mode, run ID, summary and observations.",
      );
    const summary = trace.summary as Record<string, unknown>;
    for (const key of [
      "offered",
      "expected_records",
      "received",
      "processed_unique",
      "missing",
      "extra",
      "wrong_values",
      "duplicate_receipts",
      "errors",
      "verification_polls",
    ])
      if (!integer(summary[key]))
        throw new Error(`Invalid summary count: ${key}.`);
    if (summary.verified_objects !== null && !integer(summary.verified_objects))
      throw new Error("Invalid verified object count.");
    for (const key of ["verification_seconds", "elapsed_seconds"])
      if (
        typeof summary[key] !== "number" ||
        !Number.isFinite(summary[key]) ||
        summary[key] < 0
      )
        throw new Error(`Invalid summary duration: ${key}.`);
    if (typeof summary.ordered_receipts !== "boolean")
      throw new Error("Invalid ordering result.");
    const kinds = new Set([
      "offered",
      "ack",
      "receipt",
      "processed",
      "upload_ack",
      "ingest_read",
      "ingest_done",
      "verified",
      "error",
    ]);
    for (const item of trace.observations) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        throw new Error("Invalid observation.");
      const e = item as Record<string, unknown>;
      if (
        typeof e.t !== "number" ||
        !Number.isFinite(e.t) ||
        e.t < 0 ||
        typeof e.kind !== "string" ||
        !kinds.has(e.kind)
      )
        throw new Error("Invalid observation time or kind.");
      if (e.kind !== "error" && !integer(e.object_id))
        throw new Error("Observation needs a nonnegative object ID.");
      if (e.object_id !== undefined && !integer(e.object_id))
        throw new Error("Invalid object ID.");
      if (
        e.record_id !== undefined &&
        e.record_id !== null &&
        !integer(e.record_id)
      )
        throw new Error("Invalid record ID.");
      if (
        trace.mode === "pipeline" &&
        ["ack", "receipt", "processed"].includes(e.kind) &&
        !integer(e.record_id)
      )
        throw new Error("Pipeline record observation needs a record ID.");
    }
    return trace as unknown as Trace;
  };
  const render = () => {
    invalidate("Inspecting user-supplied evidence…");
    try {
      const trace = parse(input.value);
      const ordered = [...trace.observations].sort((a, b) => a.t - b.t);
      const offered = new Set<number>();
      const completed = new Set<number>();
      const points: Array<{ t: number; count: number; event: Event }> = [];
      let outstanding = 0;
      for (const event of ordered) {
        const id = event.object_id;
        if (id !== undefined && event.kind === "offered" && !offered.has(id)) {
          offered.add(id);
          if (!completed.has(id)) outstanding++;
        }
        if (
          id !== undefined &&
          event.kind ===
            (trace.mode === "pipeline" ? "verified" : "processed") &&
          !completed.has(id)
        ) {
          completed.add(id);
          if (offered.has(id)) outstanding--;
        }
        points.push({ t: event.t, count: outstanding, event });
      }
      inspected = trace;
      const s = trace.summary;
      result.textContent = `${source} · ${trace.run_id} · ${trace.mode} · offered ${s.offered} · received ${s.received} · missing ${s.missing} · duplicate receipts ${s.duplicate_receipts} · errors ${s.errors}`;
      const heading = document.createElement("h3");
      heading.textContent =
        trace.mode === "broker"
          ? "Broker inputs awaiting processing"
          : "Uploaded objects awaiting verification";
      const description = document.createElement("p");
      description.textContent =
        "Outstanding unique IDs over elapsed seconds. Each completion is counted once; the evidence table below lists exact event times.";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("role", "img");
      svg.setAttribute(
        "aria-label",
        `${heading.textContent} against elapsed seconds; exact observations are in the table below`,
      );
      const maxTime = points.reduce((max, point) => Math.max(max, point.t), 1);
      const maxCount = points.reduce(
        (max, point) => Math.max(max, point.count),
        1,
      );
      const ns = "http://www.w3.org/2000/svg";
      redraw = () => {
        const width = svg.clientWidth;
        if (!width) return;
        svg.setAttribute("viewBox", `0 0 ${width} 230`);
        svg.replaceChildren();
        const left = 48,
          right = width - 10,
          bottom = 188;
        const line = document.createElementNS(ns, "polyline");
        let previousY = bottom;
        const coords = [`${left},${bottom}`];
        for (const point of points) {
          const x = left + ((right - left) * point.t) / maxTime;
          const y = bottom - (150 * point.count) / maxCount;
          coords.push(`${x},${previousY}`, `${x},${y}`);
          previousY = y;
        }
        line.setAttribute("points", coords.join(" "));
        line.setAttribute("class", "trace-line");
        svg.append(line);
        for (const [x, y, text, anchor] of [
          [left, 218, "0 s", "start"],
          [right, 218, `${Number(maxTime.toPrecision(4))} s`, "end"],
          [left - 8, 42, String(maxCount), "end"],
          [left - 8, bottom + 4, "0", "end"],
        ] as Array<[number, number, string, string]>) {
          const label = document.createElementNS(ns, "text");
          label.setAttribute("x", String(x));
          label.setAttribute("y", String(y));
          label.setAttribute("text-anchor", anchor);
          label.textContent = text;
          svg.append(label);
        }
      };
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Show exact event observations";
      details.append(summary);
      const region = document.createElement("div");
      region.className = "trace-table-scroll";
      region.tabIndex = 0;
      region.setAttribute("role", "region");
      region.setAttribute(
        "aria-label",
        "Exact trace observations; scroll to read",
      );
      const table = document.createElement("table");
      const header = table.createTHead().insertRow();
      for (const label of [
        "Elapsed seconds",
        "Milestone",
        "Object ID",
        "Record ID",
        "Outstanding unique IDs",
      ]) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = label;
        header.append(th);
      }
      const body = table.createTBody();
      for (const point of points) {
        const row = body.insertRow();
        for (const value of [
          point.t,
          point.event.kind,
          point.event.object_id ?? "—",
          point.event.record_id ?? "—",
          point.count,
        ])
          row.insertCell().textContent = String(value);
      }
      region.append(table);
      details.append(region);
      chart.append(heading, description, svg, details);
      redraw();
      download.disabled = false;
      save();
    } catch (error) {
      invalidate(
        `Cannot inspect: ${error instanceof Error ? error.message : "invalid JSON"}`,
      );
    }
  };
  root
    .querySelector<HTMLButtonElement>("#trace-inspect")!
    .addEventListener("click", render);
  input.addEventListener("input", () => {
    generation++;
    source = "User-supplied trace";
    invalidate("Draft changed. Inspect it again before export.");
    save();
  });
  notes.addEventListener("input", save);
  const example = root.querySelector<HTMLButtonElement>("#trace-example");
  example?.addEventListener("click", async () => {
    const current = ++generation;
    invalidate("Loading a recorded local functional example…");
    try {
      const response = await fetch(
        new URL(example.dataset.example!, location.href),
      );
      if (!response.ok)
        throw new Error(`Example download failed (${response.status}).`);
      const text = await response.text();
      if (current !== generation) return;
      input.value = text;
      source = "Recorded local functional example";
      render();
    } catch (error) {
      if (current === generation)
        invalidate(`Cannot load example: ${String(error)}`);
    }
  });
  file.addEventListener("change", async () => {
    const current = ++generation;
    source = "User-supplied trace";
    invalidate("Loading user-supplied evidence…");
    try {
      const selected = file.files?.[0];
      if (!selected) {
        invalidate("No file selected.");
        return;
      }
      if (selected.size > maxBytes)
        throw new Error("Evidence exceeds the 5 MB limit.");
      const text = await selected.text();
      if (current !== generation) return;
      input.value = text;
      save();
      render();
    } catch (error) {
      if (current === generation)
        invalidate(
          `Cannot import: ${error instanceof Error ? error.message : "file read failed"}`,
        );
    }
  });
  download.addEventListener("click", () => {
    if (!inspected) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { evidence: inspected, notes: notes.value, source },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "infrastructure-review.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}
