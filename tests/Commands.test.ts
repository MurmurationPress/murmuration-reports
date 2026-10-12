import { test } from "node:test";
import { deepEqual, equal } from "node:assert/strict";
import { installReportCommands } from "../src/commands/ReportCommands";
import {
  CapabilityHost,
  registerCapability,
  ReportsCapability,
} from "../src/obsidian/ReportsCapability";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test("commands resolve capability at invocation, capture active path, and handle disable/re-enable", async () => {
  const commands = new Map<string, () => void>();
  const shared: CapabilityHost = {};
  const calls: string[] = [];
  const notices: string[] = [];
  let active: string | null = "Definitions/One.md";
  installReportCommands({
    addCommand: (c) => commands.set(c.id, c.callback),
    capabilityHost: shared,
    activePath: () => active,
    notice: (m) => notices.push(m),
    showResults: (r) => calls.push("shown:" + r.length),
    adopt: async (p) => {
      calls.push("adopt:" + p);
    },
  });
  deepEqual(
    [...commands.keys()],
    [
      "generate-derived-artefact",
      "generate-all-derived-artefacts",
      "adopt-report-output",
    ],
  );
  commands.get("generate-derived-artefact")!();
  await tick();
  equal(notices.length, 1);
  const capability: ReportsCapability = {
    version: 1,
    generateDefinition: async (p) => {
      await tick();
      calls.push(p);
      return { definitionPath: p, status: "created", message: "ok" };
    },
    generateAll: async () => [],
    showResults: () => {},
  };
  const unload = registerCapability(shared, capability);
  commands.get("generate-derived-artefact")!();
  active = "Definitions/Two.md";
  await tick();
  await tick();
  deepEqual(calls, ["Definitions/One.md", "shown:1"]);
  unload();
  commands.get("generate-all-derived-artefacts")!();
  await tick();
  equal(notices.length, 2);
  registerCapability(shared, capability);
  commands.get("generate-all-derived-artefacts")!();
  await tick();
  equal(calls.at(-1), "shown:0");
});
test("capability registration cleanup never deletes another owner", () => {
  const shared: CapabilityHost = {};
  const c: ReportsCapability = {
    version: 1,
    generateDefinition: async (p) => ({
      definitionPath: p,
      status: "created",
      message: "ok",
    }),
    generateAll: async () => [],
    showResults: () => {},
  };
  const remove = registerCapability(shared, c);
  shared.murmurationReports = { ...c };
  remove();
  equal(!!shared.murmurationReports, true);
});
test("Reports-first loading and non-Markdown active files", async () => {
  const shared: CapabilityHost = {};
  let generated = 0;
  registerCapability(shared, {
    version: 1,
    generateDefinition: async (p) => {
      generated++;
      return { definitionPath: p, status: "created", message: "ok" };
    },
    generateAll: async () => [],
    showResults: () => {},
  });
  const commands = new Map<string, () => void>();
  let notice = "";
  installReportCommands({
    addCommand: (c) => commands.set(c.id, c.callback),
    activePath: () => null,
    capabilityHost: shared,
    showResults: () => {},
    notice: (m) => {
      notice = m;
    },
    adopt: async () => {},
  });
  commands.get("generate-derived-artefact")!();
  await tick();
  equal(generated, 0);
  equal(notice, "Open a report definition note first.");
});
