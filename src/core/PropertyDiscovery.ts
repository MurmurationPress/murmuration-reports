import { within } from "../reports/PathSafety";
import { humanisePropertyKey } from "./PropertyLabels";
import { parseIsoDate } from "./DerivedArtefactDefinition";

export interface DiscoveryRecord {
  readonly path: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
}
export interface DiscoveredProperty {
  readonly key: string;
  readonly label: string;
  readonly types: readonly string[];
  readonly present: number;
  readonly missing: number;
  readonly invalid: readonly string[];
  readonly compatible: boolean;
}

function valueType(value: unknown): string {
  if (value === null || value === undefined) return "missing";
  if (typeof value === "number")
    return Number.isFinite(value) ? "number" : "invalid number";
  if (typeof value === "string") {
    try {
      parseIsoDate(value, "date property");
      return "date/string";
    } catch {
      return "string";
    }
  }
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  return "object";
}

/** Summarise every note in the declared physical subtree without coercion. */
export function discoverProperties(
  source: string,
  records: readonly DiscoveryRecord[],
): DiscoveredProperty[] {
  const scoped = records.filter(
    (record) =>
      within(record.path, source) && record.path.startsWith(`${source}/`),
  );
  const keys = new Set<string>();
  for (const record of scoped)
    for (const key of Object.keys(record.frontmatter))
      if (key !== "position") keys.add(key);
  return [...keys]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((key) => {
      const types = new Set<string>(),
        invalid: string[] = [];
      let present = 0,
        missing = 0;
      for (const record of scoped) {
        const value = record.frontmatter[key],
          type = valueType(value);
        if (type === "missing") {
          missing++;
          continue;
        }
        present++;
        types.add(type);
        if (type === "invalid number")
          invalid.push(`${record.path}: ${key} is not finite.`);
      }
      const allNumeric =
        types.size === 1 &&
        types.has("number") &&
        !invalid.length &&
        missing === 0;
      const allDate =
        types.size === 1 && types.has("date/string") && missing === 0;
      return {
        key,
        label: humanisePropertyKey(key),
        types: [...types].sort(),
        present,
        missing,
        invalid,
        compatible: allNumeric || allDate,
      };
    });
}
