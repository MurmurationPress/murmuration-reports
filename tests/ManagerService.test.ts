import { test } from "node:test";
import { strictEqual as equal, rejects, deepStrictEqual } from "node:assert";
import { TFile, TFolder } from "./helpers/ObsidianStub";
import { ManagerService, DefinitionDraft } from "../src/manager/ManagerService";
import { newDefinition, readEditable } from "../src/manager/DefinitionEditing";
import {
  digest,
  serialiseReceipt,
  tableMarker,
} from "../src/reports/OutputOwnership";
import { parse } from "yaml";
const values = {
  world_entity: "derived-artefact",
  artefact_type: "line-chart",
  source: "Data",
  x: "date",
  title: "Test",
  series: [{ property: "value", label: "Value", extension: "keep" }],
  output: "Outputs/Test.svg",
};
function fixture() {
  const files = new Map<string, string>([
      ["Definitions/Test.md", newDefinition(values)],
      ["Data/One.md", newDefinition({ date: "2026-01-01", value: 1 })],
    ]),
    folders = new Set(["Data", "Definitions", "Outputs"]),
    writes: string[] = [],
    events = new Set<Function>();
  let enumerations = 0,
    reads = 0,
    generate = 0;
  let before: (() => void) | undefined;
  const get = (path: string) =>
    files.has(path)
      ? new TFile(path)
      : folders.has(path)
        ? new TFolder(path)
        : null;
  const app: any = {
    metadataCache: {
      getFileCache: (file: TFile) => ({
        frontmatter: parse(files.get(file.path)!.split("---")[1] ?? ""),
      }),
      on: (_name: string, fn: Function) => {
        events.add(fn);
        return { off: () => events.delete(fn) };
      },
      offref: (ref: any) => ref.off(),
    },
    vault: {
      getAbstractFileByPath: get,
      getMarkdownFiles: () => {
        enumerations++;
        return [...files.keys()]
          .filter((p) => p.endsWith(".md"))
          .map((p) => new TFile(p));
      },
      getAllLoadedFiles: () => [...files.keys(), ...folders].map((p) => get(p)),
      read: async (file: TFile) => {
        reads++;
        return files.get(file.path)!;
      },
      adapter: {
        exists: async (path: string) => files.has(path) || folders.has(path),
      },
      create: async (path: string, raw: string) => {
        if (files.has(path)) throw Error("exists");
        files.set(path, raw);
        writes.push(path);
      },
      process: async (file: TFile, change: (raw: string) => string) => {
        before?.();
        const content = change(files.get(file.path)!);
        files.set(file.path, content);
        writes.push(file.path);
      },
      createFolder: async (path: string) => folders.add(path),
      on: (_name: string, fn: Function) => {
        events.add(fn);
        return { off: () => events.delete(fn) };
      },
      offref: (ref: any) => ref.off(),
    },
  };
  const coordinator: any = {
    generate: async (path: string) => {
      generate++;
      return { definitionPath: path, status: "created", message: "Saved" };
    },
    generateAll: async () => {
      generate++;
      return [];
    },
  };
  const queue = { tail: Promise.resolve() as Promise<unknown> };
  const service = new ManagerService(app, coordinator, queue);
  return {
    app,
    service,
    files,
    writes,
    events,
    queue,
    folders,
    set before(fn: (() => void) | undefined) {
      before = fn;
    },
    get counts() {
      return { enumerations, reads, generate };
    },
  };
}
test("startup catalogue and repeated renders never read outputs or generate", () => {
  const f = fixture();
  try {
    for (let i = 0; i < 50; i++) f.service.catalogue.entries();
    deepStrictEqual(f.counts, { enumerations: 1, reads: 0, generate: 0 });
  } finally {
    f.service.dispose();
  }
  equal(f.events.size, 0);
});
test("save-only edits definition preserving unknown fields and does not touch observations or output", async () => {
  const f = fixture();
  try {
    const before = f.files.get("Data/One.md");
    const d = await f.service.draft("Definitions/Test.md");
    d.values.title = "Changed";
    await f.service.save(d);
    deepStrictEqual(f.writes, ["Definitions/Test.md"]);
    equal(f.files.get("Data/One.md"), before);
    equal((d.values.series as any[])[0].extension, "keep");
    equal(f.counts.generate, 0);
  } finally {
    f.service.dispose();
  }
});
test("concurrent edit at process callback leaves external bytes and user draft intact", async () => {
  const f = fixture();
  try {
    const d = await f.service.draft("Definitions/Test.md");
    d.values.title = "User";
    const external = newDefinition({ ...values, title: "External" });
    f.before = () => f.files.set(d.path, external);
    await rejects(f.service.save(d), /changed/);
    equal(f.files.get(d.path), external);
    equal(d.values.title, "User");
    equal(f.writes.length, 0);
  } finally {
    f.service.dispose();
  }
});
test("latest read detects external edit before processing", async () => {
  const f = fixture();
  try {
    const d = await f.service.draft("Definitions/Test.md");
    d.values.title = "User";
    f.files.set(d.path, newDefinition({ ...values, title: "External" }));
    await rejects(f.service.save(d), /externally/);
    equal(d.values.title, "User");
    equal(!!d.conflict, true);
    equal(f.writes.length, 0);
  } finally {
    f.service.dispose();
  }
});
test("new definition refuses occupied destinations without renaming", async () => {
  const f = fixture();
  try {
    const d: DefinitionDraft = {
      path: "Definitions/Test.md",
      original: null,
      values: structuredClone(values),
    };
    await rejects(f.service.save(d), /occupied/);
    equal(f.writes.length, 0);
  } finally {
    f.service.dispose();
  }
});
test("source, definition, portable aliases and folder collisions perform no mutation", async () => {
  for (const [path, output] of [
    ["Data/New.md", "Outputs/New.svg"],
    ["Definitions/New.md", "Data/New.svg"],
    ["Definitions/New.md", "Definitions/New.md"],
    ["definitions/test.md", "Outputs/New.svg"],
    ["Definitions/New.md", "Outputs"],
    ["Definitions/New.md", "Outputs/CON.svg"],
  ]) {
    const f = fixture();
    try {
      await rejects(
        f.service.save({ path, original: null, values: { ...values, output } }),
      );
      equal(f.writes.length, 0);
    } finally {
      f.service.dispose();
    }
  }
});
test("competing output declarations prevent definition save", async () => {
  const f = fixture();
  try {
    f.files.set("Definitions/Other.md", newDefinition(values));
    f.service.catalogue.reset();
    await rejects(
      f.service.save({
        path: "Definitions/New.md",
        original: null,
        values: structuredClone(values),
      }),
      /Another report/,
    );
    equal(f.writes.length, 0);
  } finally {
    f.service.dispose();
  }
});
test("definition writes share the generation barrier and cancel after disposal", async () => {
  const f = fixture();
  let release!: () => void;
  f.queue.tail = new Promise<void>((r) => (release = r));
  const d = await f.service.draft("Definitions/Test.md");
  d.values.title = "Changed";
  const job = f.service.save(d);
  f.service.dispose();
  release();
  await rejects(job, /disabled/);
  equal(f.writes.length, 0);
  equal(f.events.size, 0);
});
test("form changes during pending save cannot change the authorised content or destination", async () => {
  const f = fixture();
  try {
    let release!: () => void;
    f.queue.tail = new Promise<void>((r) => (release = r));
    const d = await f.service.draft("Definitions/Test.md");
    d.values.title = "Authorised";
    const job = f.service.save(d);
    d.values.title = "Later draft";
    d.path = "Definitions/Other.md";
    release();
    await job;
    equal(
      parse(f.files.get("Definitions/Test.md")!.split("---")[1]).title,
      "Authorised",
    );
    equal(f.files.has("Definitions/Other.md"), false);
    equal(d.values.title, "Later draft");
  } finally {
    f.service.dispose();
  }
});
test("unowned matching path is not associated or previewed", async () => {
  const f = fixture();
  try {
    f.files.set(values.output, "<svg/>");
    const preview = await f.service.preview(f.service.catalogue.entries()[0]);
    equal(preview.state, "unverified");
    equal(preview.content, undefined);
    equal(f.counts.generate, 0);
  } finally {
    f.service.dispose();
  }
});
test("receipt-bound output is available and externally changed assets are rejected", async () => {
  const f = fixture();
  const original = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        getElementsByTagName: () => [],
        documentElement: { localName: "svg", namespaceURI: null },
      };
    }
  } as any;
  try {
    f.files.set(values.output, "<svg/>");
    f.files.set(
      values.output + ".murmuration-report.json",
      serialiseReceipt({
        version: 1,
        definitionPath: "Definitions/Test.md",
        outputPath: values.output,
        digest: await digest("<svg/>"),
      }),
    );
    const preview = await f.service.preview(f.service.catalogue.entries()[0]);
    equal(preview.state, "available");
    equal(preview.message, "Saved output available");
    f.files.set(values.output, "Changed");
    equal(
      (await f.service.preview(f.service.catalogue.entries()[0])).state,
      "error",
    );
  } finally {
    f.service.dispose();
    globalThis.DOMParser = original;
  }
});
test("stale catalogue destination cannot associate an unrelated output", async () => {
  const f = fixture();
  try {
    const entry = f.service.catalogue.entries()[0];
    f.files.set(
      "Definitions/Test.md",
      newDefinition({ ...values, output: "Outputs/Other.svg" }),
    );
    f.files.set(values.output, "<svg/>");
    equal((await f.service.preview(entry)).state, "unverified");
  } finally {
    f.service.dispose();
  }
});
test("exact legacy table marker permits saved table preview without generation", async () => {
  const f = fixture();
  try {
    const table = {
      ...values,
      artefact_type: "state-table",
      parameters: values.series,
      output: "Outputs/Test.md",
    };
    f.files.set("Definitions/Test.md", newDefinition(table));
    f.files.set(
      table.output,
      "|parameter|current|previous|Δ|\n|---|---:|---:|---:|\n|Value|+1.00|—|—|\n" +
        tableMarker("Definitions/Test.md") +
        "\n",
    );
    f.service.catalogue.reset();
    const result = await f.service.preview(f.service.catalogue.entries()[0]);
    equal(
      result.state,
      "available",
      JSON.stringify({ result, entry: f.service.catalogue.entries()[0] }),
    );
    equal(f.counts.generate, 0);
  } finally {
    f.service.dispose();
  }
});
test("explicit generation records durable per-report outcomes without blanket adoption", async () => {
  const f = fixture();
  try {
    await f.service.generate("Definitions/Test.md");
    equal(f.counts.generate, 1);
    equal(
      f.service.catalogue.outcomes.get("Definitions/Test.md")?.status,
      "created",
    );
  } finally {
    f.service.dispose();
  }
});

test("fresh declarations detect a competitor before its metadata catalogue update", async () => {
  const f = fixture();
  try {
    f.files.set(
      "Definitions/Lagging.md",
      newDefinition({ ...values, title: "Lagging" }),
    );
    await rejects(
      f.service.save({
        path: "Definitions/New.md",
        original: null,
        values: structuredClone(values),
      }),
      /Another report/,
    );
    equal(f.writes.length, 0);
  } finally {
    f.service.dispose();
  }
});
test("a declaration created while native processing is pending invalidates the write boundary", async () => {
  const f = fixture();
  try {
    const d = await f.service.draft("Definitions/Test.md");
    d.values.title = "Changed";
    f.before = () =>
      f.files.set(
        "Definitions/Concurrent.md",
        newDefinition({ ...values, title: "Concurrent" }),
      );
    await rejects(f.service.save(d), /declarations changed/);
    equal(f.writes.length, 0);
    equal(d.values.title, "Changed");
  } finally {
    f.service.dispose();
  }
});
test("new definitions cannot enter another canonical dataset folder", async () => {
  const f = fixture();
  try {
    f.folders.add("OtherData");
    f.files.set(
      "Definitions/Other.md",
      newDefinition({
        ...values,
        source: "OtherData",
        output: "Outputs/Other.svg",
      }),
    );
    await rejects(
      f.service.save({
        path: "OtherData/New.md",
        original: null,
        values: { ...values, output: "Outputs/New.svg" },
      }),
      /declared dataset/,
    );
    equal(f.writes.length, 0);
  } finally {
    f.service.dispose();
  }
});
test("guided publication saves preserve opaque options and reject newly requested unknown modes", async () => {
  const f=fixture();
  try {
    const d=await f.service.draft("Definitions/Test.md");
    d.values.presentation="custom-unimplemented";
    await rejects(f.service.save(d),/Unsupported requested presentation/);
    equal(f.writes.length,0);
    d.values.presentation="publication";d.values.y_min=-1;d.values.y_max=1;d.values.caption="Synthetic explanation.";
    await f.service.save(d);
    equal(readEditable(d.original!).data.presentation,"publication");
    equal((readEditable(d.original!).data.series as any[])[0].extension,"keep");
    d.values.y_max=-1;await rejects(f.service.save(d),/y_min < y_max/);
    d.values.y_max=1;d.values.presentation="legacy";await f.service.save(d);
    equal(readEditable(d.original!).data.y_min,-1);
    equal(f.counts.generate,0);
  } finally {f.service.dispose();}
});
test("guided editing can enable and change explicit pairs without losing nested extensions", async () => {
  const f=fixture();
  try {
    const d=await f.service.draft("Definitions/Test.md");
    d.values.artefact_type="state-table";d.values.output="Outputs/State.md";d.values.parameters=[{property:"value",label:"Value"}];
    d.values.comparison={mode:"explicit-pair",current:"Data/June.md",previous:"Data/May.md",extension:"keep"};
    await f.service.save(d);
    (d.values.comparison as any).previous="Data/April.md";await f.service.save(d);
    equal((readEditable(d.original!).data.comparison as any).extension,"keep");
    (d.values.comparison as any).current="Outside/June.md";await rejects(f.service.save(d),/must belong to source/);
    equal(f.counts.generate,0);
  } finally {f.service.dispose();}
});

test("guided saves retain an unchanged opaque legacy presentation and caption without activating them", async () => {
  const f=fixture();
  try {
    f.files.set("Definitions/Test.md",newDefinition({...values,presentation:{future:true},y_min:"opaque",caption:{extension:"keep"}}));
    const d=await f.service.draft("Definitions/Test.md");d.values.title="Changed legacy title";await f.service.save(d);
    deepStrictEqual(readEditable(d.original!).data.presentation,{future:true});
    deepStrictEqual(readEditable(d.original!).data.caption,{extension:"keep"});
  } finally {f.service.dispose();}
});

test("unrelated guided saves preserve absent, legacy, publication and v2 presentation state", async () => {
  const cases: Array<{
    name: string;
    fields: Record<string, unknown>;
    expected: Record<string, unknown>;
  }> = [
    {
      name: "absent",
      fields: { y_min: "opaque", caption: { keep: true } },
      expected: { y_min: "opaque", caption: { keep: true } },
    },
    {
      name: "legacy",
      fields: { presentation: "legacy", y_min: -1, y_max: 1, caption: "Saved" },
      expected: { presentation: "legacy", y_min: -1, y_max: 1, caption: "Saved" },
    },
    {
      name: "publication",
      fields: { presentation: "publication", y_min: -1, y_max: 1, caption: "Saved" },
      expected: { presentation: "publication", y_min: -1, y_max: 1, caption: "Saved" },
    },
    {
      name: "publication-v2",
      fields: {
        presentation: "publication-v2",
        y_axis: { minimum: "zero", maximum: 5, ticks: { step: 0.5 } },
        x_axis_unit: "months",
        description: "Saved description",
      },
      expected: {
        presentation: "publication-v2",
        y_axis: { minimum: "zero", maximum: 5, ticks: { step: 0.5 } },
        x_axis_unit: "months",
        description: "Saved description",
      },
    },
  ];
  for (const item of cases) {
    const f = fixture();
    try {
      const source = { ...values, ...item.fields, output: "Outputs/Keep.svg", custom: "retain" };
      f.files.set("Definitions/Test.md", newDefinition(source));
      const draft = await f.service.draft("Definitions/Test.md");
      draft.values.subtitle = "Unrelated edit";
      await f.service.save(draft);
      const saved = readEditable(draft.original!).data;
      for (const [key, value] of Object.entries(item.expected))
        deepStrictEqual(saved[key], value, `${item.name} ${key} changed`);
      if (!Object.prototype.hasOwnProperty.call(item.fields, "presentation"))
        equal(Object.prototype.hasOwnProperty.call(saved, "presentation"), false, "absent mode was migrated");
      equal(saved.output, "Outputs/Keep.svg", `${item.name} output path changed`);
      equal(saved.custom, "retain", `${item.name} extension was lost`);
      equal(f.counts.generate, 0, `${item.name} unrelated save generated output`);
      deepStrictEqual(f.writes, ["Definitions/Test.md"]);
    } finally {
      f.service.dispose();
    }
  }
});
