import { test } from "node:test";
import { equal, rejects } from "node:assert/strict";
import type { App } from "obsidian";
import { reportVault } from "../src/obsidian/VaultAdapter";
import Reports from "../src/main";
import { Modal, TFile } from "./helpers/ObsidianStub";
import { MemoryVault, chart } from "./helpers/MemoryVault";
import { CapabilityHost } from "../src/obsidian/ReportsCapability";
import { mutationQueueFor } from "../src/obsidian/MutationQueue";
import { validateSvgAdoption } from "../src/obsidian/AssetValidation";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test("adapter refuses a file present on disk before it reaches the vault cache", async () => {
  let writes = 0;
  const app = {
    vault: {
      getAbstractFileByPath: () => null,
      adapter: { exists: async () => true },
      create: async () => {
        writes++;
      },
    },
  } as unknown as App;
  await rejects(reportVault(app).create("out.svg", "new"), /exists/);
  equal(writes, 0);
});
test("adapter rechecks cancellation inside Vault.process after its async read", async () => {
  let callback!: (raw: string) => string;
  let resolve!: () => void;
  let writes = 0;
  let live = true;
  const app = {
    vault: {
      getAbstractFileByPath: () => new TFile("out.svg"),
      process: async (_f: unknown, change: (raw: string) => string) => {
        callback = change;
        await new Promise<void>((r) => (resolve = r));
        callback("old");
        writes++;
      },
    },
  } as unknown as App;
  const job = reportVault(app).replace("out.svg", "old", "new", () => {
    if (!live) throw Error("cancelled");
  });
  live = false;
  resolve();
  await rejects(job, /cancelled/);
  equal(writes, 0);
});
test("vault events advance input guards without starting generation", () => {
  const handlers = new Map<string, Function>();
  const refs: unknown[] = [];
  const app = {
    vault: {
      on: (event: string, handler: Function) => {
        handlers.set(event, handler);
        return {};
      },
    },
  } as unknown as App;
  const v = reportVault(app, (ref) => refs.push(ref));
  equal(refs.length, 4);
  equal(v.version!("Data/A.md"), 0);
  handlers.get("modify")!(new TFile("Data/A.md"));
  equal(v.version!("Data/A.md"), 1);
  handlers.get("rename")!(new TFile("Data/B.md"), "Data/A.md");
  equal(v.version!("Data/A.md"), 2);
  equal(v.version!("Data/B.md"), 1);
});
function appFixture() {
  const v = new MemoryVault();
  const commandMap = new Map<string, () => void>();
  const app = {
    commandMap,
    workspace: {
      getActiveFile: () => new TFile("Definitions/Report.md"),
      openLinkText: async () => {},
    },
    metadataCache: { getFileCache: () => ({}) },
    vault: {
      getMarkdownFiles: () => v.documents().map((d) => new TFile(d.path)),
      getAbstractFileByPath: (p: string) =>
        v.files.has(p) ? new TFile(p) : v.folders.has(p) ? {} : null,
      adapter: { exists: async (p: string) => v.kind(p) !== null },
      read: (f: TFile) => v.read(f.path),
      create: (p: string, c: string) => v.create(p, c),
      createFolder: (p: string) => v.createFolder(p),
      process: async (f: TFile, change: (raw: string) => string) => {
        const old = await v.read(f.path);
        await v.replace(f.path, old, change(old));
      },
    },
  };
  return {
    v,
    app: app as unknown as App &
      CapabilityHost & { commandMap: typeof commandMap },
  };
}
test("native XML adoption validation rejects parser errors and foreign roots", () => {
  const original = globalThis.DOMParser;
  try {
    for (const valid of [true, false]) {
      globalThis.DOMParser = class {
        parseFromString() {
          return {
            getElementsByTagName: () => (valid ? [] : [{}]),
            documentElement: {
              localName: "svg",
              namespaceURI: "http://www.w3.org/2000/svg",
            },
          };
        }
      } as unknown as typeof DOMParser;
      let rejected = false;
      try {
        validateSvgAdoption("<svg/>");
      } catch {
        rejected = true;
      }
      equal(rejected, !valid);
    }
  } finally {
    globalThis.DOMParser = original;
  }
});
test("actual plugin unload closes adoption dialogs and never accepts an old approval", async () => {
  const { app, v } = appFixture();
  v.files.set(chart.output, "<svg></svg>");
  const original = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString() {
      return {
        getElementsByTagName: () => [],
        documentElement: { localName: "svg", namespaceURI: null },
      };
    }
  } as unknown as typeof DOMParser;
  const plugin = new Reports(app, { id: "murmuration-reports" } as any);
  try {
    await plugin.onload();
    app.commandMap.get("murmuration-reports:adopt-report-output")!();
    for (let i = 0; i < 100 && !Modal.openDialogs.size; i++) await tick();
    equal(Modal.openDialogs.size, 1);
    plugin.unload();
    equal(Modal.openDialogs.size, 0);
    equal(app.murmurationReports, undefined);
    equal(v.mutations.length, 0);
  } finally {
    plugin.unload();
    globalThis.DOMParser = original;
  }
});
test("actual plugin suppresses delayed result presentation after unload, retaining its barrier on re-enable", async () => {
  const { app, v } = appFixture();
  const plugin = new Reports(app, { id: "murmuration-reports" } as any);
  await plugin.onload();
  const capability = app.murmurationReports!;
  const queue = mutationQueueFor(app as any);
  let release!: () => void;
  queue.tail = new Promise<void>((r) => (release = r));
  const job = capability.generateDefinition("Definitions/Report.md");
  plugin.unload();
  release();
  await rejects(job, /disabled/);
  capability.showResults([]);
  equal(Modal.openDialogs.size, 0);
  const second = new Reports(app, { id: "murmuration-reports" } as any);
  await second.onload();
  equal(mutationQueueFor(app as any), queue);
  equal(
    (await app.murmurationReports!.generateDefinition("Definitions/Report.md"))
      .status,
    "created",
  );
  second.unload();
  equal(v.files.has(chart.output), true);
});
test("valid empty frontmatter on an unrelated note does not block generation", async () => {
  const { app, v } = appFixture();
  v.files.set("Empty.md", "---\n\n---\nOrdinary unrelated prose.");
  equal(
    Object.keys((await reportVault(app).readDocument("Empty.md")).frontmatter!)
      .length,
    0,
  );
  const plugin = new Reports(app, { id: "murmuration-reports" } as any);
  await plugin.onload();
  try {
    equal(
      (
        await app.murmurationReports!.generateDefinition(
          "Definitions/Report.md",
        )
      ).status,
      "created",
    );
  } finally {
    plugin.unload();
  }
});
