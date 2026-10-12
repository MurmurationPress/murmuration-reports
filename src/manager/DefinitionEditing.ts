import {
  isMap,
  isSeq,
  isScalar,
  isAlias,
  parseDocument,
  stringify,
  visit,
} from "yaml";
export type Properties = Record<string, unknown>;
interface Parsed {
  prefix: string;
  yaml: string;
  suffix: string;
  data: Properties;
  document: ReturnType<typeof parseDocument>;
  newline: string;
}
export function readEditable(raw: string): Parsed {
  const match = /^(\uFEFF?---\r?\n)([\s\S]*?)(^---[ \t]*(?:\r?\n|$))/m.exec(
    raw,
  );
  if (!match || match.index !== 0)
    throw Error(
      "Guided editing requires ordinary YAML frontmatter. Open the definition to repair it.",
    );
  const document = parseDocument(match[2], {
    keepSourceTokens: true,
    uniqueKeys: true,
  });
  if (document.errors.length)
    throw Error(
      "Unsafe YAML: " + document.errors.map((e) => e.message).join("; "),
    );
  visit(document, (_key, node) => {
    if (
      node &&
      typeof node === "object" &&
      (isAlias(node) ||
        ("anchor" in node && node.anchor) ||
        ("tag" in node && node.tag))
    )
      throw Error(
        "Aliases, anchors and explicit tags require editing in the definition note.",
      );
  });
  if (!isMap(document.contents)) throw Error("Frontmatter must be a mapping.");
  const data = document.toJS() as Properties;
  if (Object.prototype.hasOwnProperty.call(data, "<<"))
    throw Error("YAML merge keys require editing in the definition note.");
  return {
    prefix: match[1],
    yaml: match[2],
    suffix: raw.slice(match[1].length + match[2].length),
    data,
    document,
    newline: raw.includes("\r\n") ? "\r\n" : "\n",
  };
}
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, canonical(x)]),
        )
      : v;
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const object = (v: unknown): v is Properties =>
  !!v && typeof v === "object" && !Array.isArray(v);
/** Replace only changed value ranges. Existing key spelling, comments and body remain bytes. */
export function patchDefinition(raw: string, next: Properties): string {
  const p = readEditable(raw),
    edits: { start: number; end: number; text: string }[] = [];
  const encoded = (v: unknown) => JSON.stringify(v === undefined ? null : v);
  const patch = (node: any, before: unknown, after: unknown) => {
    if (equal(before, after)) return;
    if (isMap(node) && object(before) && object(after)) {
      for (const key of Object.keys(before))
        if (!(key in after))
          throw Error(
            "Removing whole mappings is unsupported; open the definition.",
          );
      for (const [key, value] of Object.entries(after)) {
        const pair = node.items.find(
          (i: any) => isScalar(i.key) && i.key.value === key,
        );
        if (pair) {
          if (!(pair.value as any)?.range)
            throw Error(
              "Empty YAML values need repair in the definition note.",
            );
          patch(pair.value, before[key], value);
        } else {
          if (node.flow) {
            const at = node.range![1] - 1;
            edits.push({
              start: at,
              end: at,
              text:
                (node.items.length ? ", " : "") +
                encoded(key) +
                ": " +
                encoded(value),
            });
          } else {
            const at = node.range?.[2] ?? p.yaml.length;
            const keyNode = node.items[0]?.key as any;
            const indent = keyNode?.range
              ? keyNode.range[0] -
                p.yaml.lastIndexOf("\n", keyNode.range[0] - 1) -
                1
              : 0;
            edits.push({
              start: at,
              end: at,
              text:
                (at && p.yaml[at - 1] !== "\n" ? p.newline : "") +
                " ".repeat(indent) +
                key +
                ": " +
                encoded(value) +
                p.newline,
            });
          }
        }
      }
    } else if (isSeq(node) && Array.isArray(before) && Array.isArray(after)) {
      for (let i = 0; i < Math.min(before.length, after.length); i++)
        patch(node.items[i], before[i], after[i]);
      if (after.length !== before.length) {
        if (node.flow)
          throw Error(
            "Adding/removing flow-list entries requires editing in the definition note. Existing entries can be edited here.",
          );
        const first = node.items[0] as any;
        if (!first?.range)
          throw Error("Unsupported list layout. Open the definition.");
        const line = p.yaml.lastIndexOf("\n", first.range[0] - 1) + 1;
        const dash = p.yaml.indexOf("-", line);
        const indent = dash - line;
        if (after.length < before.length) {
          const removed = node.items[after.length] as any;
          const at = p.yaml.lastIndexOf("\n", removed.range[0] - 1) + 1;
          edits.push({ start: at, end: node.range![2], text: "" });
        } else {
          const at = node.range![2];
          let text =
            stringify(after.slice(before.length))
              .trimEnd()
              .split("\n")
              .map((l) => " ".repeat(indent) + l)
              .join(p.newline) + p.newline;
          edits.push({ start: at, end: at, text });
        }
      }
    } else {
      if (!node?.range || !isScalar(node))
        throw Error(
          "Changing this YAML structure would lose formatting. Open the definition.",
        );
      edits.push({
        start: node.range![0],
        end: node.range![1],
        text: encoded(after),
      });
    }
  };
  patch(p.document.contents, p.data, next);
  let yaml = p.yaml;
  for (const e of edits.sort((a, b) => b.start - a.start))
    yaml = yaml.slice(0, e.start) + e.text + yaml.slice(e.end);
  const output = p.prefix + yaml + p.suffix;
  if (!equal(readEditable(output).data, next))
    throw Error(
      "The source-preserving patch could not represent this change safely. Open the definition.",
    );
  return output;
}
export function newDefinition(data: Properties): string {
  return "---\n" + stringify(data) + "---\n";
}
