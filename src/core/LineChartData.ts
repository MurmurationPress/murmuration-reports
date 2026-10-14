import { readableYAxis } from "./ReadableYAxis";
import { LineChartDefinition, parseIsoDate } from "./DerivedArtefactDefinition";

export interface FrontmatterRecord { readonly path: string; readonly frontmatter: Record<string, unknown>; }
export interface LineChartPoint { readonly date: string; readonly timestamp: number; readonly values: readonly number[]; readonly sourcePath: string; }
export interface LineChartData { readonly definition: LineChartDefinition; readonly points: readonly LineChartPoint[]; }

function windowStart(endpoint: string, amount: number, unit: "months" | "years"): string {
  const [year, month, day] = endpoint.split("-").map(Number);
  const totalMonths = year * 12 + month - 1 - amount * (unit === "years" ? 12 : 1);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function numeric(value: unknown, property: string, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path}: ${property} must be a finite number.`);
  return value;
}

export function normaliseLineChartData(definition: LineChartDefinition, records: readonly FrontmatterRecord[]): LineChartData {
  const points: LineChartPoint[] = [];
  for (const record of records) {
    const rawDate = record.frontmatter[definition.x];
    if (rawDate === undefined || rawDate === null || rawDate === "") throw new Error(`${record.path}: missing ${definition.x}.`);
    let date: string;
    try { date = parseIsoDate(rawDate, definition.x)!; }
    catch (error) { throw new Error(`${record.path}: ${error instanceof Error ? error.message : String(error)}`); }
    points.push({
      date,
      timestamp: Date.parse(`${date}T00:00:00.000Z`),
      values: definition.series.map((series) => numeric(record.frontmatter[series.property], series.property, record.path)),
      sourcePath: record.path
    });
  }
  points.sort((left, right) => left.timestamp - right.timestamp || (left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0));
  if (points.length === 0) throw new Error("The source folder contains no Markdown observations.");
  const endpoint = definition.end ?? points[points.length - 1].date;
  const rollingStart = definition.window ? windowStart(endpoint, definition.window.amount, definition.window.unit) : undefined;
  const lowerBounds = [definition.start, rollingStart].filter((value): value is string => Boolean(value)).sort();
  const effectiveStart = lowerBounds[lowerBounds.length - 1];
  const selected = points.filter((point) => (!effectiveStart || point.date >= effectiveStart) && point.date <= endpoint);
  if (selected.length === 0) throw new Error("No observations fall within the configured date range.");
  if (definition.presentation === "publication" && definition.yMin !== undefined && definition.yMax !== undefined) {
    for (const point of selected) for (const [index, value] of point.values.entries()) {
      if (value < definition.yMin || value > definition.yMax) throw Error(`${point.sourcePath}: ${definition.series[index].property}=${value} is outside fixed Y bounds [${definition.yMin}, ${definition.yMax}]. Correct the data or explicitly change the limits; no clipping is performed.`);
    }
  }
  const data = { definition, points: selected };
  if (definition.presentation === "publication-v2") readableYAxis(data);
  return data;
}
