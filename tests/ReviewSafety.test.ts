import { test } from "node:test";
import { equal, deepEqual, rejects, match } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GenerationCoordinator } from "../src/reports/GenerationCoordinator";
import { digest, receiptPath } from "../src/reports/OutputOwnership";
import { MemoryVault, chart, table } from "./helpers/MemoryVault";
import { parseReceipt, tableMarker } from "../src/reports/OutputOwnership";
const path = "Definitions/Report.md";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test("portable path aliases and reserved/absolute names cannot bypass collisions", async () => {
  for (const output of [
    "C:/outside.svg",
    "Saved reports Ω./Trend.svg",
    "Saved reports Ω /Trend.svg",
    "Saved reports Ω/CON.svg",
  ]) {
    const v = new MemoryVault({ ...chart, output });
    equal(
      (await new GenerationCoordinator(v).generate(path)).status,
      "blocked",
    );
    equal(v.mutations.length, 0);
  }
  const v = new MemoryVault();
  v.note("Definitions/Other.md", {
    ...chart,
    output: chart.output.toUpperCase(),
  });
  equal((await new GenerationCoordinator(v).generate(path)).status, "blocked");
  const w = new MemoryVault({ ...chart, output: "PROTECTED/Trend.svg" });
  w.note("Definitions/Other.md", {
    ...chart,
    source: "Protected",
    output: "Other.svg",
  });
  equal((await new GenerationCoordinator(w).generate(path)).status, "blocked");
});
test("receipt paths and malformed real comments are rejected without conflating prose", () => {
  for (const definitionPath of [
    "",
    "../Other.md",
    "C:/Other.md",
    "Definitions/Other.md ",
  ]) {
    let invalid = false;
    try {
      parseReceipt(
        JSON.stringify({
          version: 1,
          definitionPath,
          outputPath: chart.output,
          digest: "a".repeat(64),
        }),
      );
    } catch {
      invalid = true;
    }
    equal(invalid, true);
  }
});
test("exact legacy table ownership survives CRLF and an omitted final newline", async () => {
  for (const ending of ["crlf", "eof"]) {
    const v = new MemoryVault(table);
    const g = new GenerationCoordinator(v);
    await g.generate(path);
    v.files.delete(receiptPath(table.output));
    const initial = v.files.get(table.output)!;
    const legacy =
      ending === "crlf" ? initial.replace(/\n/g, "\r\n") : initial.slice(0, -1);
    v.files.set(table.output, legacy);
    const result = await g.generate(path);
    equal(result.status, "replaced");
    equal(v.files.get(table.output), initial);
    equal(v.files.get(result.recoveryPaths![0]), legacy);
  }
});
test("former owner restored at the mutation callback blocks path repair", async () => {
  const v = new MemoryVault(table);
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const raw = v.files.get(path)!;
  v.files.delete(path);
  v.files.set("Definitions/New.md", raw);
  const old = v.files.get(table.output);
  const inspection = await g.inspectAdoption("Definitions/New.md");
  v.hook = (op, p) => {
    if (op === "replace" && p === table.output) v.files.set(path, raw);
  };
  equal((await g.adoptAndGenerate(inspection)).status, "blocked");
  equal(v.files.get(table.output), old);
});
test("definition and source edits at the conditional callback invalidate its input snapshot", async () => {
  for (const target of [path, "Data Ω/B.md"]) {
    const v = new MemoryVault();
    const g = new GenerationCoordinator(v);
    await g.generate(path);
    const old = v.files.get(chart.output);
    v.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
    v.hook = (op, p) => {
      if (op === "replace" && p === chart.output)
        v.note(
          target,
          target === path
            ? { ...chart, title: "Changed while write pending" }
            : { date: "2029-02-01", value: 4 },
        );
    };
    equal((await g.generate(path)).status, "blocked");
    equal(v.files.get(chart.output), old);
  }
});
test('an input edit after output commit prevents receipt writing and stale rollback',async()=>{
 const v=new MemoryVault();const g=new GenerationCoordinator(v);await g.generate(path);const old=v.files.get(chart.output);v.note('Data Ω/B.md',{date:'2029-02-01',value:3});
 v.hook=(op,p)=>{if(op==='replaced'&&p===chart.output)v.note(path,{...chart,title:'New author intent'});};
 const result=await g.generate(path);equal(result.status,'blocked');equal(v.files.get(result.recoveryPaths![0]),old);match(result.message,/retained/);
});
test("failed create must not delete a concurrently created byte-identical asset", async () => {
  const v = new MemoryVault();
  const expected = await readFile("examples/vault/" + chart.output, "utf8");
  v.hook = (op, p) => {
    if (op === "create" && p === chart.output) v.files.set(p, expected);
  };
  const r = await new GenerationCoordinator(v).generate(path);
  equal(r.status, "failed");
  equal(v.files.get(chart.output), expected);
});
test("failed replace must not roll back an uncommitted byte-identical concurrent edit", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
  const oracle = new MemoryVault();
  oracle.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
  await new GenerationCoordinator(oracle).generate(path);
  const expected = oracle.files.get(chart.output)!;
  v.hook = (op, p) => {
    if (op === "replace" && p === chart.output) v.files.set(p, expected);
  };
  const r = await g.generate(path);
  equal(r.status, "failed");
  equal(v.files.get(chart.output), expected);
});
test("ordinary marker words in a chart title do not break owned regeneration", async () => {
  const v = new MemoryVault({
    ...chart,
    title: "mwc-derived-artefact:state-table",
  });
  const g = new GenerationCoordinator(v);
  equal((await g.generate(path)).status, "created");
  equal((await g.generate(path)).status, "unchanged");
});
test('a real state-table marker cannot establish SVG ownership or be silently adopted',async()=>{
 const v=new MemoryVault();v.files.set(chart.output,'<svg></svg>\n'+tableMarker('Definitions/Other.md')+'\n');
 const g=new GenerationCoordinator(v);equal((await g.generate(path)).status,'blocked');await rejects(g.inspectAdoption(path),/conflicts/);equal(v.mutations.length,0);
});
test("ordinary marker words in a table label do not break owned regeneration", async () => {
  const v = new MemoryVault({
    ...table,
    parameters: [
      { property: "value", label: "mwc-derived-artefact:state-table" },
    ],
  });
  const g = new GenerationCoordinator(v);
  equal((await g.generate(path)).status, "created");
  equal((await g.generate(path)).status, "unchanged");
});
test("empty receipt owner cannot be treated as unowned and adopted", async () => {
  const v = new MemoryVault();
  v.files.set(chart.output, "<svg></svg>");
  v.files.set(
    receiptPath(chart.output),
    JSON.stringify({
      version: 1,
      definitionPath: "",
      outputPath: chart.output,
      digest: await digest("<svg></svg>"),
    }),
  );
  await rejects(new GenerationCoordinator(v).inspectAdoption(path), /receipt/i);
  equal(v.mutations.length, 0);
});
test("unreadable frontmatter with no cached metadata cannot hide a canonical source", async () => {
  const v = new MemoryVault({ ...chart, output: "Protected/Trend.svg" });
  v.folders.add("Protected");
  v.files.set(
    "Definitions/Broken.md",
    "---\nworld_entity: derived-artefact\nsource: Protected\nbad: [\n---\n",
  );
  const read = v.readDocument.bind(v);
  v.readDocument = async (p) => {
    if (p === "Definitions/Broken.md") throw Error("Malformed YAML");
    return read(p);
  };
  const r = await new GenerationCoordinator(v).generate(path);
  equal(r.status, "blocked");
  equal(v.files.has("Protected/Trend.svg"), false);
  equal(v.mutations.length, 0);
});
test("unload while conditional write is awaiting its callback prevents that write", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((r) => (entered = r)),
    gate = new Promise<void>((r) => (release = r));
  const replace = v.replace.bind(v);
  v.replace = async (p, old, next, ...args) => {
    if (p === chart.output) {
      entered();
      await gate;
    }
    return (replace as Function)(p, old, next, ...args);
  };
  const count = v.mutations.filter((m) => m.path === chart.output).length;
  const job = g.generate(path);
  await started;
  g.dispose();
  release();
  const r = await job;
  equal(r.status, "blocked");
  equal(v.mutations.filter((m) => m.path === chart.output).length, count);
});
test("re-enabled coordinator shares the old mutation barrier until recovery completes", async () => {
  const v = new MemoryVault();
  const queue = { tail: Promise.resolve() as Promise<unknown> };
  const make = () =>
    Reflect.construct(GenerationCoordinator, [
      v,
      queue,
    ]) as GenerationCoordinator;
  const old = make();
  await old.generate(path);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((r) => (entered = r)),
    gate = new Promise<void>((r) => (release = r));
  const replace = v.replace.bind(v);
  let first = true;
  v.replace = async (p, prev, next, ...args) => {
    if (p === chart.output && first) {
      first = false;
      entered();
      await gate;
    }
    return (replace as Function)(p, prev, next, ...args);
  };
  const a = old.generate(path);
  await started;
  old.dispose();
  const next = make();
  let settled = false;
  const b = next.generate(path).then((r) => {
    settled = true;
    return r;
  });
  await tick();
  equal(settled, false);
  release();
  await a;
  equal((await b).status, "replaced");
});
