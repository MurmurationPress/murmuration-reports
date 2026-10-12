import { test } from "node:test";
import { deepEqual, equal, match, rejects } from "node:assert/strict";
import { GenerationCoordinator } from "../src/reports/GenerationCoordinator";
import {
  digest,
  markerOwner,
  parseReceipt,
  receiptPath,
  tableMarker,
} from "../src/reports/OutputOwnership";
import { DerivedArtefactService } from "./helpers/LegacyService";
import { MemoryVault, chart, table } from "./helpers/MemoryVault";
import { readFile } from "node:fs/promises";
const path = "Definitions/Report.md";
test("checked-in SVG and Markdown goldens remain byte-identical", async () => {
  const v = new MemoryVault();
  v.files.delete(path);
  v.note("Definitions/Trend.md", chart);
  v.note("Definitions/State.md", table);
  await new GenerationCoordinator(v).generateAll();
  for (const output of [chart.output, table.output])
    equal(
      v.files.get(output),
      await readFile("examples/vault/" + output, "utf8"),
    );
});
function original(v: MemoryVault) {
  return [...v.files].filter(
    ([p]) => p.startsWith("Data Ω/") || p.startsWith("Definitions/"),
  );
}
test("new charts and tables equal the extracted MWC oracle byte-for-byte, preserving sources", async () => {
  for (const def of [chart, table]) {
    const v = new MemoryVault(def);
    const before = original(v);
    const g = new GenerationCoordinator(v);
    const result = await g.generate(path);
    equal(result.status, "created");
    deepEqual(original(v), before);
    const old = new DerivedArtefactService({
      markdownDocuments: () => v.documents(),
      entryKind: (p) => (p === def.output ? null : v.kind(p)),
      createFolder: async () => {},
      create: async () => {},
      modify: async () => {},
      read: (p) => v.read(p),
    });
    equal((await old.generate(path)).content, v.files.get(def.output));
    const receipt = parseReceipt(v.files.get(receiptPath(def.output))!);
    equal(receipt.digest, await digest(v.files.get(def.output)!));
    equal(receipt.definitionPath, path);
    equal((await g.generate(path)).status, "unchanged");
  }
});
test("owned replacement keeps a verified original recovery copy", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(chart.output);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
  const result = await g.generate(path);
  equal(result.status, "replaced");
  equal(v.files.get(result.recoveryPaths![0]), old);
  deepEqual(original(v).length, 3);
});
test("legacy SVG requires explicit adoption; cancelling inspection performs no writes", async () => {
  const v = new MemoryVault();
  v.files.set(
    chart.output,
    '<svg xmlns="http://www.w3.org/2000/svg"><text>Legacy</text></svg>',
  );
  const g = new GenerationCoordinator(v);
  equal((await g.generate(path)).status, "blocked");
  const before = [...v.files];
  await g.inspectAdoption(path);
  deepEqual([...v.files], before);
  equal(v.mutations.length, 0);
});
test("adoption binds inspected bytes, preserves recovery, and cannot reuse approval", async () => {
  const v = new MemoryVault();
  const old =
    '<svg xmlns="http://www.w3.org/2000/svg"><text>Legacy</text></svg>';
  v.files.set(chart.output, old);
  const g = new GenerationCoordinator(v);
  const inspection = await g.inspectAdoption(path);
  const result = await g.adoptAndGenerate(inspection);
  equal(result.status, "replaced");
  equal(v.files.get(result.recoveryPaths![0]), old);
  equal((await g.adoptAndGenerate(inspection)).status, "blocked");
});
test("external changes after inspection expire consent without replacing output", async () => {
  const v = new MemoryVault();
  v.files.set(chart.output, "<svg></svg>");
  const g = new GenerationCoordinator(v);
  const i = await g.inspectAdoption(path);
  v.files.set(chart.output, "<svg><text>Changed</text></svg>");
  equal((await g.adoptAndGenerate(i)).status, "blocked");
  equal(v.files.get(chart.output), "<svg><text>Changed</text></svg>");
});
test("definition changes while adoption is open expire consent", async () => {
  const v = new MemoryVault();
  v.files.set(chart.output, "<svg></svg>");
  const g = new GenerationCoordinator(v);
  const i = await g.inspectAdoption(path);
  v.note(path, { ...chart, title: "Changed title" });
  equal((await g.adoptAndGenerate(i)).status, "blocked");
  equal(v.files.get(chart.output), "<svg></svg>");
});
test("exact single trailing canonical legacy marker is recognised", async () => {
  const v = new MemoryVault(table);
  v.files.set(
    table.output,
    `|parameter|current|previous|Δ|\n|---|---:|---:|---:|\n|Measured value|+1.00|—|—|\n\n${tableMarker(path)}\n`,
  );
  equal((await new GenerationCoordinator(v).generate(path)).status, "replaced");
  for (const content of [
    `prefix ${tableMarker(path)} suffix`,
    `${tableMarker(path)}\n${tableMarker(path)}\n`,
    `${tableMarker(path).replace("%2F", "%2f")}\n`,
  ])
    await rejects(Promise.resolve().then(() => markerOwner(content)));
});
test("receipts reject unsupported versions and malformed digests", () => {
  for (const r of [
    "null",
    "[]",
    "{}",
    JSON.stringify({
      version: 2,
      definitionPath: path,
      outputPath: chart.output,
      digest: "a".repeat(64),
    }),
  ]) {
    let failed = false;
    try {
      parseReceipt(r);
    } catch {
      failed = true;
    }
    equal(failed, true);
  }
});
test("externally modified owned assets cannot be generated or adopted", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  v.files.set(chart.output, "<svg><text>Manual edit</text></svg>");
  equal((await g.generate(path)).status, "blocked");
  await rejects(g.inspectAdoption(path), /Receipt does not match/);
});
test("conflicting marker/receipt cannot be adopted", async () => {
  const v = new MemoryVault(table);
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const changed = v.files
    .get(table.output)!
    .replace(tableMarker(path), tableMarker("Other.md"));
  v.files.set(table.output, changed);
  const r = parseReceipt(v.files.get(receiptPath(table.output))!);
  v.files.set(
    receiptPath(table.output),
    JSON.stringify({ ...r, digest: await digest(changed) }),
  );
  await rejects(g.inspectAdoption(path), /conflicting owners/);
});
test("competing definitions block both jobs and adoption", async () => {
  const v = new MemoryVault();
  v.note("Definitions/Other.md", chart);
  v.files.set(chart.output, "<svg></svg>");
  const g = new GenerationCoordinator(v);
  equal((await g.generate(path)).status, "blocked");
  await rejects(g.inspectAdoption(path), /Competing/);
  equal(v.mutations.length, 0);
});
test("trimmed declarations and lagging metadata caches cannot hide competitors", async () => {
  const v = new MemoryVault();
  v.note("Definitions/Other.md", {
    ...chart,
    output: " " + chart.output + " ",
  });
  const actual = v.documents.bind(v);
  v.documents = () => actual().map((d) => ({ ...d, frontmatter: undefined }));
  const results = await new GenerationCoordinator(v).generateAll();
  equal(results.length, 2);
  equal(
    results.every((r) => r.status === "blocked"),
    true,
  );
  equal(v.mutations.length, 0);
});
test("non-canonical encoding and marker substrings never establish ownership", async () => {
  await rejects(
    Promise.resolve().then(() =>
      markerOwner("\n" + tableMarker(path).replace("%2F", "%2f") + "\n"),
    ),
  );
  const v = new MemoryVault(table);
  v.files.set(table.output, "unrelated " + tableMarker(path));
  equal((await new GenerationCoordinator(v).generate(path)).status, "failed");
  equal(v.mutations.length, 0);
});
test("unconfirmed receipt write retains the pair and both original recovery copies", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const output = v.files.get(chart.output),
    receipt = v.files.get(receiptPath(chart.output));
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 6 });
  let fail = true;
  v.hook = (op, p) => {
    if (op === "replaced" && p === receiptPath(chart.output) && fail) {
      fail = false;
      throw Error("receipt post-write failure");
    }
  };
  const r = await g.generate(path);
  equal(r.status, "failed");
  equal(v.files.get(r.recoveryPaths![0]), output);
  equal(v.files.get(r.recoveryPaths![1]), receipt);
  equal(r.recoveryPaths!.length, 2);
  match(r.message, /uncertain/);
});
test("unverified recovery copy prevents replacement", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(chart.output);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 7 });
  v.hook = (op, p) => {
    if (op === "created" && p.includes("backup"))
      v.files.set(p, "incomplete backup");
  };
  const r = await g.generate(path);
  equal(r.status, "failed");
  equal(v.files.get(chart.output), old);
});
test("invalid other definition still protects its declared output and source", async () => {
  const v = new MemoryVault();
  v.note("Definitions/Invalid.md", { ...chart, series: [] });
  equal((await new GenerationCoordinator(v).generate(path)).status, "blocked");
  const w = new MemoryVault({ ...chart, output: "Protected/Trend.svg" });
  w.folders.add("Protected");
  w.note("Definitions/Invalid.md", {
    ...chart,
    source: "Protected",
    output: "Elsewhere.svg",
    series: [],
  });
  equal((await new GenerationCoordinator(w).generate(path)).status, "blocked");
});
test("invalid paths, missing sources, folders and source/definition collisions never mutate", async () => {
  for (const def of [
    { ...chart, output: "../Trend.svg" },
    { ...chart, source: "../Data" },
    { ...chart, output: "Data Ω/Trend.svg" },
    { ...table, output: path },
    { ...chart, output: "/Trend.svg" },
    { ...chart, output: "Saved\nreports/Trend.svg" },
  ]) {
    const v = new MemoryVault(def);
    const before = [...v.files];
    const r = await new GenerationCoordinator(v).generate(path);
    equal(["blocked", "failed"].includes(r.status), true);
    deepEqual([...v.files], before);
  }
  const v = new MemoryVault();
  v.folders.delete(chart.source);
  equal((await new GenerationCoordinator(v).generate(path)).status, "blocked");
  const w = new MemoryVault();
  w.folders.add(chart.output);
  equal((await new GenerationCoordinator(w).generate(path)).status, "blocked");
});
test("malformed observations preserve a previously generated asset and receipt", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(chart.output),
    r = v.files.get(receiptPath(chart.output));
  v.note("Data Ω/B.md", { date: "bad", value: 2 });
  equal((await g.generate(path)).status, "failed");
  equal(v.files.get(chart.output), old);
  equal(v.files.get(receiptPath(chart.output)), r);
});
test("mixed batches isolate invalid reports and return structured results", async () => {
  const v = new MemoryVault();
  v.note("Definitions/State.md", table);
  v.note("Definitions/Invalid.md", {
    ...chart,
    series: [],
    output: "Invalid.svg",
  });
  const results = await new GenerationCoordinator(v).generateAll();
  deepEqual(
    results.map((r) => r.status),
    ["failed", "created", "created"],
  );
  equal(
    results.every((r) => !!r.definitionPath && !!r.message),
    true,
  );
});
test("receipt failure compensates output and retains original recovery", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(chart.output),
    receipt = v.files.get(receiptPath(chart.output));
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 3 });
  let fail = true;
  v.hook = (op, p) => {
    if (op === "replace" && p === receiptPath(chart.output) && fail) {
      fail = false;
      throw Error("receipt failure");
    }
  };
  const result = await g.generate(path);
  equal(result.status, "failed");
  equal(v.files.get(chart.output), old);
  equal(v.files.get(receiptPath(chart.output)), receipt);
  equal(v.files.get(result.recoveryPaths![0]), old);
});
test("failed first receipt retains new files instead of attempting unsafe deletion", async () => {
  const v = new MemoryVault();
  v.hook = (op, p) => {
    if (op === "create" && p === receiptPath(chart.output))
      throw Error("receipt failure");
  };
  const result = await new GenerationCoordinator(v).generate(path);
  equal(result.status, "failed");
  equal(v.files.has(chart.output), true);
  match(result.message, /retained/);
  equal(v.files.has(receiptPath(chart.output)), false);
});
test("unconfirmed output failure preserves the old recovery copy without guessing rollback ownership", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(chart.output);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 4 });
  let fail = true;
  v.hook = (op, p) => {
    if (op === "replaced" && p === chart.output && fail) {
      fail = false;
      throw Error("post-write failure");
    }
  };
  const result = await g.generate(path);
  equal(result.status, "failed");
  equal(v.files.get(result.recoveryPaths![0]), old);
  match(result.message, /uncertain/);
});
test("failed compensation exposes a verified recovery copy", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(chart.output);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 4 });
  let outputWrites = 0;
  v.hook = (op, p) => {
    if (op === "replace" && p === chart.output && ++outputWrites > 1)
      throw Error("rollback unavailable");
    if (op === "replace" && p === receiptPath(chart.output))
      throw Error("receipt unavailable");
  };
  const r = await g.generate(path);
  equal(r.status, "failed");
  match(r.message, /recovery needed/);
  equal(v.files.get(r.recoveryPaths![0]), old);
});
test("concurrent output edit is never overwritten by compensation", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  v.note("Data Ω/B.md", { date: "2029-02-01", value: 5 });
  v.hook = (op, p) => {
    if (op === "replaced" && p === chart.output)
      v.files.set(p, "external edit");
  };
  const r = await g.generate(path);
  equal(r.status, "failed");
  equal(v.files.get(chart.output), "external edit");
  equal(!!r.recoveryPaths?.length, true);
});
test("source content and added observations are rechecked at mutation boundary", async () => {
  for (const add of [false, true]) {
    const v = new MemoryVault();
    let triggered = false;
    v.hook = (op, p) => {
      if (op === "read" && p === "Data Ω/B.md" && !triggered) {
        triggered = true;
        queueMicrotask(() =>
          v.note(add ? "Data Ω/C.md" : "Data Ω/B.md", {
            date: "2029-03-01",
            value: 10,
          }),
        );
      }
    };
    const r = await new GenerationCoordinator(v).generate(path);
    equal(r.status, "blocked");
    equal(v.files.has(chart.output), false);
  }
});
test("rename, disabled move and changed output require explicit handling without automatic mutations", async () => {
  const v = new MemoryVault(table);
  let g = new GenerationCoordinator(v);
  await g.generate(path);
  const old = v.files.get(table.output);
  const def = v.files.get(path)!;
  v.files.delete(path);
  v.files.set("Definitions/Moved.md", def);
  g = new GenerationCoordinator(v);
  const before = [...v.files];
  equal((await g.generate("Definitions/Moved.md")).status, "blocked");
  deepEqual([...v.files], before);
  const inspection = await g.inspectAdoption("Definitions/Moved.md");
  equal((await g.adoptAndGenerate(inspection)).status, "replaced");
  match(v.files.get(table.output)!, /Definitions%2FMoved.md/);
  equal(
    v.files.get([...v.files.keys()].find((p) => p.includes("backup"))!),
    old,
  );
  v.note("Definitions/Moved.md", {
    ...table,
    output: "Saved reports Ω/New.md",
  });
  equal((await g.generate("Definitions/Moved.md")).status, "created");
  equal(v.files.has(table.output), true);
});
test("cannot adopt another existing definition owner", async () => {
  const v = new MemoryVault(table);
  const g = new GenerationCoordinator(v);
  await g.generate(path);
  v.note("Definitions/New.md", table);
  await rejects(g.inspectAdoption("Definitions/New.md"), /Competing/);
});
test("queued generations are serialised and unload cancels pending mutations", async () => {
  const v = new MemoryVault();
  const g = new GenerationCoordinator(v);
  const r = await Promise.all([g.generate(path), g.generate(path)]);
  deepEqual(
    r.map((x) => x.status),
    ["created", "unchanged"],
  );
  g.dispose();
  await rejects(g.generate(path), /disabled/);
});
