// Copyright © 2026 Christopher Snow
// Reading marks are manual and independent of benchmark results and saved work.
const PREFIX = "benchmarking-lab:v1:lesson-complete:";

function initCompletion() {
  const checkbox = document.querySelector<HTMLInputElement>("#lesson-done");
  const panel = document.querySelector<HTMLElement>(".lesson-progress");
  const note = document.querySelector<HTMLElement>("#lesson-progress-note");
  if (!checkbox || !panel || !note) return;

  const entries = new Map<
    string,
    { link: HTMLAnchorElement; mark: HTMLElement }
  >();
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    'nav[aria-label="Book chapters"] a',
  )) {
    const number = link.firstElementChild?.textContent?.trim();
    const id = /^\d{2}$/.test(number ?? "")
      ? number!
      : new URL(link.href).pathname.endsWith("/start-here.html")
        ? "introduction"
        : undefined;
    if (!id) continue;
    const mark = document.createElement("span");
    mark.className = "chapter-complete-mark";
    mark.hidden = true;
    const tick = document.createElement("span");
    tick.textContent = "✓";
    tick.setAttribute("aria-hidden", "true");
    const accessible = document.createElement("span");
    accessible.className = "sr-only";
    accessible.textContent = "Completed";
    mark.append(tick, accessible);
    link.append(mark);
    entries.set(id, { link, mark });
  }
  const current = [...entries].find(([, { link }]) =>
    link.hasAttribute("aria-current"),
  )?.[0];
  if (!current) return;

  const completed = new Set<string>();
  const unsaved = new Set<string>();
  let readable = true;
  function read(id: string) {
    try {
      if (localStorage.getItem(PREFIX + id) === "true") completed.add(id);
      else completed.delete(id);
    } catch {
      readable = false;
    }
  }
  for (const id of entries.keys()) read(id);

  function render(
    message = "Your reading progress stays in this browser. Untick to undo.",
  ) {
    for (const [id, { link, mark }] of entries) {
      const done = completed.has(id);
      link.dataset.complete = String(done);
      mark.hidden = !done;
    }
    checkbox!.checked = completed.has(current!);
    panel!.dataset.complete = String(checkbox!.checked);
    note!.textContent =
      !readable || unsaved.has(current!)
        ? "Progress could not be saved. This mark is only available on this page."
        : message;
  }
  checkbox.addEventListener("change", () => {
    const done = checkbox.checked;
    if (done) completed.add(current);
    else completed.delete(current);
    try {
      // One key per lesson keeps concurrent tabs from overwriting other marks.
      localStorage.setItem(PREFIX + current, String(done));
      unsaved.delete(current);
      readable = true;
    } catch {
      unsaved.add(current);
    }
    render(
      done
        ? "Lesson marked as done. Saved in this browser."
        : "Mark removed. Saved in this browser.",
    );
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== null && !event.key.startsWith(PREFIX)) return;
    try {
      if (event.storageArea && event.storageArea !== localStorage) return;
    } catch {
      return;
    }
    for (const id of entries.keys()) {
      if (event.key !== null && event.key !== PREFIX + id) continue;
      // Read the latest stored value, since older storage events can be queued.
      read(id);
      unsaved.delete(id);
    }
    render();
  });
  window.addEventListener("pageshow", () => {
    // Refresh marks when the browser restores this document from its back cache.
    for (const id of entries.keys()) if (!unsaved.has(id)) read(id);
    render();
  });
  render();
  panel.closest(".chapter-pagination")?.classList.add("has-completion");
  panel.hidden = false;
  checkbox.disabled = false;
}

initCompletion();
