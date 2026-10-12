import { test } from "node:test";
import { deepStrictEqual as equal, strictEqual, throws } from "node:assert";
import {
  patchDefinition,
  readEditable,
  newDefinition,
} from "../src/manager/DefinitionEditing";
import { ReportCatalogue, CatalogueHost } from "../src/manager/ReportCatalogue";
import { reconcile } from "../src/manager/ReportsView";
const raw = `---\n# author comment\nworld_entity: derived-artefact\nartefact_type: line-chart\nsource: Data\nx: date\ntitle: 'Old title' # keep inline\nseries:\n  - property: value # keep property comment\n    label: 'Old label'\n    custom: {unit: kg, author: 'A'} # unknown nested\noutput: Outputs/Chart.svg\ncustom_top: {what: yes}\n---\n\n# My note\nUnrelated body ![[Image.svg]]\n`;
test("patches scalar and nested series leaves without reserialising other bytes", () => {
  const data = structuredClone(readEditable(raw).data);
  data.title = "New title";
  (data.series as any[])[0].label = "New label";
  const next = patchDefinition(raw, data);
  strictEqual(
    next,
    raw
      .replace("'Old title'", '"New title"')
      .replace("'Old label'", '"New label"'),
  );
});
test("preserves CRLF comments, quote styles and body", () => {
  const crlf = raw.replace(/\n/g, "\r\n");
  const data = readEditable(crlf).data;
  data.title = "Changed";
  strictEqual(
    patchDefinition(crlf, data),
    crlf.replace("'Old title'", '"Changed"'),
  );
});
test("adds optional fields without losing unknown fields", () => {
  const data = readEditable(raw).data;
  data.subtitle = "Sub";
  data.window = "12 months";
  const next = patchDefinition(raw, data);
  equal(readEditable(next).data, data);
  strictEqual(
    next.includes("custom: {unit: kg, author: 'A'} # unknown nested"),
    true,
  );
  strictEqual(next.endsWith(raw.slice(raw.indexOf("\n---\n") + 1)), true);
});
test("adds and removes trailing block series, retaining existing nested extensions", () => {
  const data = readEditable(raw).data;
  (data.series as any[]).push({ property: "extra", label: "More" });
  const next = patchDefinition(raw, data);
  equal(readEditable(next).data, data);
  strictEqual(
    next.includes("custom: {unit: kg, author: 'A'} # unknown nested"),
    true,
  );
  const shrunk = readEditable(next).data;
  (shrunk.series as any[]).pop();
  equal(readEditable(patchDefinition(next, shrunk)).data, shrunk);
});
test("patches flow mapping leaves and flow list labels without reformatting", () => {
  const text = raw.replace(
    /series:[\s\S]*?output:/,
    "series: [{property: value, label: Old, extension: yes}] # series comment\noutput:",
  );
  const data = readEditable(text).data;
  (data.series as any[])[0].label = "Changed";
  strictEqual(
    patchDefinition(text, data),
    text.replace("label: Old", 'label: "Changed"'),
  );
});
test("rejects duplicate keys, aliases, tags and malformed YAML", () => {
  for (const yaml of [
    "title: A\ntitle: B",
    "a: &a test\nb: *a",
    "title: !!str hi",
    "title: [broken",
  ])
    throws(() => readEditable("---\n" + yaml + "\n---\nBody"));
});
test("new definitions round-trip through the guided schema", () =>
  equal(
    readEditable(newDefinition(readEditable(raw).data)).data,
    readEditable(raw).data,
  ));
test("explicit reconciliation preserves independent latest changes, refuses overlap", () => {
  equal(
    reconcile(
      { title: "Old", custom: "A" },
      { title: "New", custom: "A" },
      { title: "Old", custom: "B" },
    ),
    { title: "New", custom: "B" },
  );
  throws(
    () =>
      reconcile({ title: "Old" }, { title: "Draft" }, { title: "External" }),
    /Both versions/,
  );
});
function fixture() {
  let enumerations = 0,
    updates = 0;
  const docs = new Map<string, any>(),
    work: (() => void)[] = [];
  const kind = new Map<string, "file" | "folder">([["Data", "folder"]]);
  const host: CatalogueHost = {
    enumerate: () => {
      enumerations++;
      return [...docs.values()];
    },
    document: (path) => {
      updates++;
      return docs.get(path);
    },
    kind: (path) => kind.get(path) ?? null,
    schedule: (fn) => {
      work.push(fn);
      return fn;
    },
    cancel: (fn) => {
      const i = work.indexOf(fn as any);
      if (i >= 0) work.splice(i, 1);
    },
  };
  return {
    docs,
    kind,
    work,
    get counts() {
      return { enumerations, updates };
    },
    host,
  };
}
const definition = (path: string, extra: Record<string, unknown> = {}) => ({
  path,
  frontmatter: {
    world_entity: "derived-artefact",
    artefact_type: "line-chart",
    source: "Data",
    x: "date",
    title: "Shared",
    series: [{ property: "value", label: "Value" }],
    output: path + ".svg",
    ...extra,
  },
});
test("discovers invalid definitions and duplicate names, diagnostics and collisions", () => {
  const f = fixture();
  f.docs.set("A.md", definition("A.md"));
  f.docs.set("B.md", definition("B.md", { series: [], output: "A.md.svg" }));
  const c = new ReportCatalogue(f.host);
  const e = c.entries();
  strictEqual(e.length, 2);
  strictEqual(e[0].name, e[1].name);
  strictEqual(e[0].status, "collision");
  strictEqual(
    e[1].diagnostics.some((s) => s.startsWith("Invalid definition")),
    true,
  );
  equal(f.counts, { enumerations: 1, updates: 0 });
});
test("coalesces changed paths and processes at most 64 per turn, no repeated enumeration", () => {
  const f = fixture(),
    c = new ReportCatalogue(f.host);
  for (let i = 0; i < 180; i++) {
    f.docs.set(i + ".md", definition(i + ".md"));
    c.changed(i + ".md");
    c.changed(i + ".md");
  }
  strictEqual(f.work.length, 1);
  f.work.shift()!();
  equal(f.counts, { enumerations: 1, updates: 64 });
  while (f.work.length) f.work.shift()!();
  strictEqual(f.counts.updates, 180);
  strictEqual(c.entries().length, 180);
});
test("rename updates path projection and outcomes; dispose cancels queued refresh", () => {
  const f = fixture();
  f.docs.set("A.md", definition("A.md"));
  const c = new ReportCatalogue(f.host);
  c.result("A.md", "failed", "No write");
  f.docs.delete("A.md");
  f.docs.set("Moved.md", definition("Moved.md"));
  c.renamed("A.md", "Moved.md");
  f.work.shift()!();
  strictEqual(c.entries()[0].path, "Moved.md");
  strictEqual(c.outcomes.get("Moved.md")?.message, "No write");
  c.changed("Later.md");
  c.dispose();
  strictEqual(f.work.length, 0);
});
test("malformed metadata definitions remain in the projection until repaired or deleted", () => {
  const f = fixture(),
    c = new ReportCatalogue(f.host);
  c.seed("Unsafe.md", { world_entity: "derived-artefact" }, "Unreadable YAML");
  f.docs.set("Unsafe.md", {
    path: "Unsafe.md",
    frontmatter: { world_entity: "derived-artefact" },
    diagnostic: "Unreadable YAML",
  });
  f.work.shift()!();
  strictEqual(c.entries()[0].status, "invalid");
  strictEqual(c.entries()[0].name, "Unsafe");
  c.dispose();
});
test("incremental indices remove old claims and sources when declarations change", () => {
  const f = fixture();
  f.docs.set("A.md", definition("A.md", { output: "Shared.svg" }));
  f.docs.set("B.md", definition("B.md", { output: "Shared.svg" }));
  const c = new ReportCatalogue(f.host);
  strictEqual(c.entries()[0].status, "collision");
  f.docs.set("B.md", definition("B.md", { output: "Separate.svg" }));
  c.changed("B.md");
  f.work.shift()!();
  strictEqual(c.entries()[0].status, "missing-output");
  f.docs.delete("A.md");
  c.changed("A.md");
  f.work.shift()!();
  strictEqual(c.entries().length, 1);
  strictEqual(f.counts.enumerations, 1);
});
test("observed folder moves operate only on cached paths and retain per-report identity", () => {
  const f = fixture();
  f.docs.set("Definitions/A.md", definition("Definitions/A.md"));
  f.docs.set("Data/Other.md", { path: "Data/Other.md" });
  const c = new ReportCatalogue(f.host);
  deepFolder();
  function deepFolder() {
    for (const old of c.pathsUnder("Definitions")) {
      const next = old.replace("Definitions", "Moved");
      f.docs.set(next, { ...f.docs.get(old), path: next });
      f.docs.delete(old);
      c.renamed(old, next);
    }
  }
  while (f.work.length) f.work.shift()!();
  strictEqual(c.entries()[0].path, "Moved/A.md");
  strictEqual(f.counts.enumerations, 1);
});

test("batch outcomes publish once, without re-enumeration or per-report reconciliation", () => {
  const f = fixture(),
    c = new ReportCatalogue(f.host);
  let emissions = 0;
  c.subscribe(() => emissions++);
  c.results(
    Array.from({ length: 300 }, (_, i) => ({
      definitionPath: i + ".md",
      status: "blocked",
      message: "Explicit adoption required",
    })),
  );
  strictEqual(emissions, 1);
  strictEqual(c.outcomes.size, 300);
  equal(f.counts, { enumerations: 1, updates: 0 });
  c.dispose();
});
