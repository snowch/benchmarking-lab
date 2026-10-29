// Copyright © 2026 Christopher Snow
import {
  ENGINES,
  NAMES,
  QUERY_NAMES,
  median,
  type Query,
  type Sample,
} from "./database-model";

const NS = "http://www.w3.org/2000/svg";
function node(
  tag: string,
  attributes: Record<string, string | number> = {},
  text?: string,
) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes))
    element.setAttribute(name, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
const ms = (value: number) => value.toFixed(3);
const queries = Object.keys(QUERY_NAMES) as Query[];

export function comparisonFinding(samples: Sample[]): string {
  const winners = queries.map((query) => {
    const times = ENGINES.map((engine) =>
      median(
        samples
          .filter(
            (sample) => sample.query === query && sample.engine === engine,
          )
          .map((sample) => sample.elapsedMs),
      ),
    );
    return ms(times[0]) === ms(times[1])
      ? undefined
      : ENGINES[times[0] < times[1] ? 0 : 1];
  });
  if (winners[0] && winners.every((winner) => winner === winners[0]))
    return `${NAMES[winners[0]]} had the lower median for both queries in this browser run.`;
  return queries
    .map((query, index) => {
      const job = query === "lookup" ? "order lookup" : "revenue query";
      return winners[index]
        ? `For the ${job}, ${NAMES[winners[index]]} had the lower median in this browser run.`
        : `For the ${job}, both medians were equal at the displayed precision in this browser run.`;
    })
    .join(" ");
}

function draw(svg: SVGSVGElement, samples: Sample[], query: Query) {
  const width = svg.clientWidth;
  if (!width) return;
  const observedMax = Math.max(...samples.map((sample) => sample.elapsedMs));
  // A zero baseline and one shared scale for both engines in this query.
  const step =
    observedMax > 0 ? 10 ** Math.floor(Math.log10(observedMax)) / 2 : 1;
  const maximum =
    observedMax > 0 ? Math.ceil((observedMax * 1.12) / step) * step : 1;
  const left = 10,
    right = width - 10;
  const x = (value: number) => left + (value / maximum) * (right - left);
  svg.setAttribute("viewBox", `0 0 ${width} 238`);
  svg.dataset.maximumMs = String(maximum);
  svg.replaceChildren();
  const titleId = `db-plot-${query}-title`,
    descriptionId = `db-plot-${query}-description`;
  svg.setAttribute("aria-labelledby", `${titleId} ${descriptionId}`);
  svg.append(
    node(
      "title",
      { id: titleId },
      `${QUERY_NAMES[query]}: warm request times in milliseconds. Lower is faster.`,
    ),
  );
  const description: string[] = [];
  const ticks = width < 420 ? 2 : 4;
  for (let tick = 0; tick <= ticks; tick++) {
    const value = (maximum * tick) / ticks;
    svg.append(
      node("line", {
        x1: x(value),
        x2: x(value),
        y1: 44,
        y2: 198,
        class: "db-plot-grid",
      }),
    );
    svg.append(
      node(
        "text",
        {
          x: x(value),
          y: 221,
          "text-anchor":
            tick === 0 ? "start" : tick === ticks ? "end" : "middle",
          class: "db-plot-tick",
        },
        String(Number(value.toPrecision(3))),
      ),
    );
  }
  ENGINES.forEach((engine, engineIndex) => {
    const requests = samples.filter((sample) => sample.engine === engine);
    const values = requests.map((sample) => sample.elapsedMs);
    const middle = median(values),
      min = Math.min(...values),
      max = Math.max(...values);
    const y = 62 + engineIndex * 96;
    const group = node("g", {
      "data-engine": engine,
      class: `db-plot-engine db-plot-${engine}`,
    });
    group.append(
      node(
        "text",
        { x: 0, y: y - 42, class: "db-plot-engine-name" },
        NAMES[engine],
      ),
    );
    group.append(
      node(
        "text",
        {
          x: width,
          y: y - 24,
          "text-anchor": "end",
          class: "db-plot-median-label",
        },
        `Median ${ms(middle)} ms`,
      ),
    );
    group.append(
      node("line", {
        x1: x(min),
        x2: x(max),
        y1: y,
        y2: y,
        class: "db-plot-range",
      }),
    );
    for (const value of [min, max])
      group.append(
        node("line", {
          x1: x(value),
          x2: x(value),
          y1: y - 5,
          y2: y + 5,
          class: "db-plot-range",
        }),
      );
    requests.forEach((sample, index) => {
      const circle = node("circle", {
        cx: x(sample.elapsedMs),
        cy: y + (index - (requests.length - 1) / 2) * 2.8,
        r: 3.5,
        class: "db-plot-sample",
        "data-elapsed-ms": sample.elapsedMs,
        "data-pair": sample.pair,
      });
      circle.append(
        node(
          "title",
          {},
          `${NAMES[engine]}, pair ${sample.pair}, position ${sample.position}: ${ms(sample.elapsedMs)} ms`,
        ),
      );
      group.append(circle);
    });
    const center = x(middle);
    const medianY = y + 25;
    const mark = node("path", {
      d: `M ${center} ${medianY - 9} l 6 9 l -6 9 l -6 -9 Z`,
      class: "db-plot-median",
      "data-median-ms": middle,
    });
    mark.append(node("title", {}, `Median: ${ms(middle)} ms`));
    group.append(mark);
    svg.append(group);
    description.push(
      `${NAMES[engine]}: median ${ms(middle)} ms, observed range ${ms(min)} to ${ms(max)} ms, ${requests.length} requests.`,
    );
  });
  svg.append(
    node(
      "desc",
      { id: descriptionId },
      `${description.join(" ")} Small dots are requests, diamonds are medians, and lines show observed ranges. Dots are offset vertically to keep repeated values visible; vertical position has no measured meaning. Exact values are available in the tables below.`,
    ),
  );
}

export function createComparisonCharts(container: HTMLElement) {
  let selectedSamples: Sample[] = [];
  const charts = queries.map((query) => {
    const figure = document.createElement("figure");
    figure.className = "db-comparison-plot";
    figure.dataset.query = query;
    const caption = document.createElement("figcaption");
    const heading = document.createElement("h4");
    heading.textContent = QUERY_NAMES[query];
    caption.append(heading);
    const svg = node("svg", { role: "img", height: 238 }) as SVGSVGElement;
    figure.append(caption, svg);
    container.append(figure);
    return { svg, query };
  });
  function redraw() {
    if (!selectedSamples.length) return;
    for (const { svg, query } of charts)
      draw(
        svg,
        selectedSamples.filter((sample) => sample.query === query),
        query,
      );
  }
  new ResizeObserver(redraw).observe(container);
  return (samples: Sample[]) => {
    selectedSamples = samples;
    redraw();
  };
}
