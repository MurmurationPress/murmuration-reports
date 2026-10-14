import { test } from "node:test";
import {
  strictEqual as equal,
  deepStrictEqual as deep,
  throws,
  match,
} from "node:assert";
import { parseLineChartDefinition } from "../src/core/DerivedArtefactDefinition";
import { normaliseLineChartData } from "../src/core/LineChartData";
import { renderLineChartSvg } from "../src/core/LineChartSvg";
import { readableYAxis, parseYAxis } from "../src/core/ReadableYAxis";
import { discoverProperties } from "../src/core/PropertyDiscovery";
import { humanisePropertyKey } from "../src/core/PropertyLabels";
import { patchDefinition, readEditable } from "../src/manager/DefinitionEditing";
import { chart } from "./helpers/MemoryVault";

const definition = (extra: Record<string, unknown> = {}) =>
  parseLineChartDefinition({
    ...chart,
    presentation: "publication-v2",
    ...extra,
  });
const data = (
  values: number[],
  policy: unknown = { minimum: "zero", maximum: "auto", ticks: "auto" },
) =>
  normaliseLineChartData(
    definition({ y_axis: policy }),
    values.map((value, i) => ({
      path: `Data Ω/${i}.md`,
      frontmatter: { date: `2029-0${i + 1}-01`, value },
    })),
  );

test("Y-axis policy defaults, independent endpoints and strict malformed values", () => {
  deep(parseYAxis(undefined), {
    minimum: "auto",
    maximum: "auto",
    ticks: "auto",
  });
  deep(parseYAxis({ minimum: 0, maximum: "auto", ticks: { step: 0.25 } }), {
    minimum: 0,
    maximum: "auto",
    ticks: { step: 0.25 },
  });
  for (const value of [
    null,
    { minimum: null },
    { maximum: null },
    { ticks: { step: 0 } },
    { ticks: { step: Infinity } },
    { ticks: { step: 1, extra: true } },
    { mimimum: 0 },
    { minimum: 1, maximum: 1 },
    { minimum: "zero", maximum: -1 },
  ])
    throws(() => parseYAxis(value));
});
test("publication v2 preserves paired legacy bounds until y_axis is explicitly supplied", () => {
  const legacyPair = parseLineChartDefinition({
    ...chart,
    presentation: "publication-v2",
    y_min: -1,
    y_max: 1,
  });
  equal(legacyPair.yMin, -1);
  equal(legacyPair.yMax, 1);
  equal(legacyPair.yAxis, undefined);
  throws(
    () =>
      parseLineChartDefinition({
        ...chart,
        presentation: "publication-v2",
        y_min: -1,
        y_max: 1,
        y_axis: { minimum: "auto" },
      }),
    /conflicts with paired/,
  );
  equal(
    parseLineChartDefinition({
      ...chart,
      presentation: "publication",
      y_min: -1,
      y_max: 1,
    }).yAxis,
    undefined,
  );
});
test("independent fixed endpoints reject outliers and automatic endpoints round outward", () => {
  const normalized = data([0.18, 0.96]);
  const y = readableYAxis(normalized);
  equal(y.min, 0);
  equal(y.max, 1);
  deep(y.ticks, [0, 0.2, 0.4, 0.6, 0.8, 1]);
  const minOnly = readableYAxis(
    normaliseLineChartData(
      definition({ y_axis: { minimum: 0, maximum: "auto", ticks: "auto" } }),
      [0.18, 0.96].map((value, i) => ({
        path: `Data Ω/${i}.md`,
        frontmatter: { date: `2029-0${i + 1}-01`, value },
      })),
    ),
  );
  equal(minOnly.min, 0);
  equal(minOnly.max, 1);
  throws(
    () => data([0.18, 1.01], { minimum: "auto", maximum: 1, ticks: "auto" }),
    /above the explicit y_axis maximum/,
  );
  throws(
    () => data([0.18, 0.96], { minimum: 0.2, maximum: "auto", ticks: "auto" }),
    /below the explicit y_axis minimum/,
  );
});
test("include-zero keeps mixed signs and extends the automatic end for all-negative data", () => {
  const mixed = readableYAxis(data([-2, 0.7]));
  equal(mixed.min <= -2, true);
  equal(mixed.max >= 0.7, true);
  equal(mixed.ticks.includes(0), true);
  const negative = readableYAxis(data([-9, -2]));
  equal(negative.min <= -9, true);
  equal(negative.max, 0);
  equal(negative.ticks.at(-1), 0);
  const positive = readableYAxis(data([0.18, 0.96]));
  equal(positive.min, 0);
});
test("integer and explicit steps select labels without altering fractional observations", () => {
  const integer = data([0.18, 0.96], {
    minimum: "zero",
    maximum: "auto",
    ticks: "integer",
  });
  deep(readableYAxis(integer).ticks, [0, 1]);
  equal(integer.points[0].values[0], 0.18);
  deep(
    readableYAxis(
      data([0, 12.5], { minimum: "zero", maximum: "auto", ticks: "integer" }),
    ).ticks,
    [0, 5, 10],
  );
  const step = data([0.1, 0.9], {
    minimum: 0,
    maximum: 1,
    ticks: { step: 0.25 },
  });
  deep(readableYAxis(step).ticks, [0, 0.25, 0.5, 0.75, 1]);
  equal(step.points[0].values[0], 0.1);
  throws(
    () => data([0, 1], { minimum: 0, maximum: 1, ticks: { step: 0.01 } }),
    /exceeds nine/,
  );
});
test("constant/single data gets readable padding while extreme unrepresentable domains diagnose", () => {
  const constant = readableYAxis(data([4]));
  equal(constant.min < 4, true);
  equal(constant.max > 4, true);
  const tiny = readableYAxis(data([1e-200]));
  equal(tiny.min < 1e-200, true);
  equal(tiny.max > 1e-200, true);
  const large = readableYAxis(data([1e200]));
  equal(large.min < 1e200, true);
  equal(large.max > 1e200, true);
  throws(() => data([Number.MIN_VALUE]), /interval|representable|range/);
  throws(() => data([Number.MAX_VALUE]), /readable|representable|range/);
});
test("publication v2 places axis titles and units separately and deterministically", () => {
  const d = definition({
    title: "Synthetic monitoring",
    x_axis_label: "Observation date",
    y_axis_label: "Boundary Orientation",
    x_axis_unit: "date",
    y_axis_unit: "degrees",
    y_axis: { minimum: "zero", maximum: "auto", ticks: "auto" },
  });
  const input = [
    { path: "Data Ω/A.md", frontmatter: { date: "2029-01-01", value: 0.18 } },
    { path: "Data Ω/B.md", frontmatter: { date: "2029-02-01", value: 0.96 } },
  ];
  const a = renderLineChartSvg(normaliseLineChartData(d, input)),
    b = renderLineChartSvg(normaliseLineChartData(d, input));
  equal(a, b);
  match(a, /data-axis-title="y"/);
  match(a, /data-axis-title="x"/);
  match(a, />Boundary</);
  match(a, />Orientation</);
  match(a, />\(degrees\)</);
  match(a, />Observation date</);
  match(a, />(\(date\))</);
  match(a, /Y range 0 to 1/);
});
test("property labels preserve acronyms, numbers, punctuation and exact keys", () => {
  equal(humanisePropertyKey("boundary_orientation"), "Boundary Orientation");
  equal(humanisePropertyKey("completedPages"), "Completed Pages");
  equal(humanisePropertyKey("HTTPStatus2"), "HTTP Status2");
  equal(humanisePropertyKey("NO3-N"), "NO3-N");
});
test("property discovery covers every scoped note and reports missing/mixed/invalid values without coercion", () => {
  const result = discoverProperties("Data Ω", [
    {
      path: "Data Ω/A.md",
      frontmatter: {
        boundary_orientation: 10,
        completedPages: 4,
        date: "2029-01-01",
        stringNumber: "3",
      },
    },
    {
      path: "Data Ω/Nested/B.md",
      frontmatter: {
        boundary_orientation: 11,
        completedPages: null,
        date: "2029-02-01",
        stringNumber: 3,
        mixed: true,
      },
    },
    { path: "Data Ω-old/C.md", frontmatter: { foreign: 1 } },
  ]);
  equal(
    result.some((p) => p.key === "foreign"),
    false,
  );
  const orientation = result.find((p) => p.key === "boundary_orientation")!;
  equal(orientation.label, "Boundary Orientation");
  equal(orientation.present, 2);
  equal(orientation.missing, 0);
  equal(orientation.compatible, true);
  const pages = result.find((p) => p.key === "completedPages")!;
  equal(pages.missing, 1);
  equal(pages.compatible, false);
  const strings = result.find((p) => p.key === "stringNumber")!;
  deep(strings.types, ["number", "string"]);
  equal(strings.compatible, false);
  const date = result.find((p) => p.key === "date")!;
  deep(date.types, ["date/string"]);
  equal(date.compatible, true);
});
test("editing a v2 axis leaf preserves YAML comments, extensions and body bytes", () => {
  const raw = `---\nworld_entity: derived-artefact\nartefact_type: line-chart\npresentation: publication-v2\nsource: Data\nx: date\nseries:\n  - property: value\n    label: Value\ny_axis:\n  minimum: zero # include zero without clipping\n  maximum: auto\n  ticks: {step: 0.2}\n  custom_extension: {keep: yes}\nunknown_top_level: retain\noutput: Charts/value.svg\n---\nBody stays exact.\n`;
  const values = readEditable(raw).data;
  (values.y_axis as Record<string, unknown>).maximum = 1;
  const updated = patchDefinition(raw, values);
  equal(updated.includes("minimum: zero # include zero without clipping"), true);
  equal(updated.includes("custom_extension: {keep: yes}"), true);
  equal(updated.includes("unknown_top_level: retain"), true);
  equal(updated.endsWith("Body stays exact.\n"), true);
  equal((readEditable(updated).data.y_axis as Record<string, unknown>).maximum, 1);
});
