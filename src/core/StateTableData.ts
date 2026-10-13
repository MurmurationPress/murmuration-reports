import { pathKey, within } from "../reports/PathSafety";
import { parseIsoDate, StateTableDefinition } from "./DerivedArtefactDefinition";
import { FrontmatterRecord } from "./LineChartData";

export interface StateTableObservation {
  readonly date: string;
  readonly timestamp: number;
  readonly values: readonly number[];
  readonly sourcePath: string;
}

export interface StateTableRow {
  readonly property: string;
  readonly label: string;
  readonly current: number;
  readonly previous: number | null;
  readonly delta: number | null;
}

export interface StateTableData {
  readonly definition: StateTableDefinition;
  readonly observations: readonly StateTableObservation[];
  readonly current: StateTableObservation;
  readonly previous: StateTableObservation | null;
  readonly rows: readonly StateTableRow[];
}

function numeric(value: unknown, property: string, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path}: ${property} must be a finite number.`);
  return value;
}

export function normaliseStateTableData(
  definition: StateTableDefinition,
  records: readonly FrontmatterRecord[]
): StateTableData {
  const observations = records.map((record) => {
    const rawDate = record.frontmatter[definition.x];
    if (rawDate === undefined || rawDate === null || rawDate === "") throw new Error(`${record.path}: missing ${definition.x}.`);
    let date: string;
    try { date = parseIsoDate(rawDate, definition.x)!; }
    catch (error) { throw new Error(`${record.path}: ${error instanceof Error ? error.message : String(error)}`); }
    return {
      date,
      timestamp: Date.parse(`${date}T00:00:00.000Z`),
      values: definition.parameters.map((parameter) => numeric(record.frontmatter[parameter.property], parameter.property, record.path)),
      sourcePath: record.path
    };
  }).sort((left, right) => (
    left.timestamp - right.timestamp
    || (left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0)
  ));
  if (observations.length === 0) {
    if (definition.comparison) throw Error(`comparison.current: ${definition.comparison.current} is missing; source ${definition.source} contains no Markdown observations. The canonical predecessor is never substituted.`);
    throw new Error("The source folder contains no Markdown observations.");
  }
  const endpoint = definition.end ?? observations[observations.length - 1].date;
  const available = observations.filter((observation) => observation.date <= endpoint);
  if (available.length === 0 && !definition.comparison) throw new Error("No current observation exists at or before the configured endpoint.");
  let current = available[available.length - 1];
  let previous = available[available.length - 2] ?? null;
  if (definition.comparison) {
    const resolve = (field: "current" | "previous") => {
      const requested = definition.comparison![field];
      const matches = observations.filter(item => pathKey(item.sourcePath) === pathKey(requested));
      if (matches.length !== 1) throw Error(`comparison.${field}: ${requested} is ${matches.length ? "ambiguous" : "missing or renamed"}. Edit the exact reference; the canonical predecessor is never substituted.`);
      if (!within(matches[0].sourcePath, definition.source) || !matches[0].sourcePath.startsWith(`${definition.source}/`)) throw Error(`comparison.${field}: ${requested} is outside source ${definition.source}.`);
      return matches[0];
    };
    current = resolve("current"); previous = resolve("previous");
    if (pathKey(current.sourcePath) === pathKey(previous.sourcePath)) throw Error("Explicit-pair references resolve to the same observation.");
    if (previous.date >= current.date) throw Error(`comparison.previous (${previous.date}) must be strictly earlier than comparison.current (${current.date}); no automatic swapping is performed.`);
    if (definition.end && definition.end !== current.date) throw Error(`end ${definition.end} must equal explicit current date ${current.date}.`);
  }
  const rows = definition.parameters.map((parameter, index) => ({
    property: parameter.property,
    label: parameter.label,
    current: current.values[index],
    previous: previous?.values[index] ?? null,
    delta: previous ? current.values[index] - previous.values[index] : null
  }));
  if (definition.comparison && rows.some(row => row.delta !== null && !Number.isFinite(row.delta))) throw Error("Explicit-pair absolute delta exceeds the finite numeric range; use bounded values.");
  return { definition, observations, current, previous, rows };
}
