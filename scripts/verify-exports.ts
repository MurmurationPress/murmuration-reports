// Not plugin code. Executes Codex Press export plans without loading either plugin.
import {
  cp,
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  copyFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { expandMarkdownTransclusions } from "__CODEX_PRESS__/src/compiler/markdown-transclusion";
import { stripFrontmatter } from "__CODEX_PRESS__/src/core/frontmatter";
import { createPdfBuildPlanWithAssets } from "__CODEX_PRESS__/src/exporters/pdf/pdf-plan";
import { executePdfBuild } from "__CODEX_PRESS__/src/exporters/pdf/pdf-executor";
import { createEpubBuildPlanWithAssets } from "__CODEX_PRESS__/src/exporters/epub/epub-plan";
import { executeEpubBuild } from "__CODEX_PRESS__/src/exporters/epub/epub-executor";
import { createDocxBuildPlanWithAssets } from "__CODEX_PRESS__/src/exporters/docx/docx-plan";
import { executeDocxBuild } from "__CODEX_PRESS__/src/exporters/docx/docx-executor";
import { NodePdfCommandRunner } from "__CODEX_PRESS__/src/obsidian/node-pdf-command-runner";
const root = process.env.MURMURATION_REPORTS_EXPORT_ROOT!,
  vault = path.join(root, "vault");
await cp("examples/vault", vault, { recursive: true });
assert(!(await stat(path.join(vault, ".obsidian")).catch(() => null)));
async function inventory(dir: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const p = prefix + item.name;
    if (item.isDirectory())
      files.push(...(await inventory(path.join(dir, item.name), p + "/")));
    else files.push(p);
  }
  return files.sort();
}
const originals = new Map<string, Buffer>();
for (const p of await inventory(vault))
  originals.set(p, await readFile(path.join(vault, p)));
const gateway = {
  listMarkdownPaths: async () =>
    [...originals.keys()].filter((p) => p.endsWith(".md")),
  readMarkdown: (p: string) => readFile(path.join(vault, p), "utf8"),
  resolveLink: async (_s: string, target: string) => {
    for (const p of [target, target + ".md"])
      if (await stat(path.join(vault, p)).catch(() => null)) return p;
    return null;
  },
};
const authored = await gateway.readMarkdown("Book/Report.md");
const expanded = await expandMarkdownTransclusions(
  gateway,
  stripFrontmatter(authored),
  "Book/Report.md",
);
assert.deepEqual(expanded.diagnostics, []);
assert(expanded.markdown.includes("|Measured value|+2.00|+1.00|+1.00|"));
const document = {
  id: "report",
  kind: "document" as const,
  title: "Saved reports",
  sourcePath: "Book/Report.md",
  metadata: {},
  markdown: expanded.markdown,
};
const book = {
  id: "fixture",
  kind: "book" as const,
  title: "Persistent Reports Fixture",
  sourcePath: "Book.md",
  folderPath: "Book",
  metadata: {
    title: "Persistent Reports Fixture",
    author: "Synthetic fixture",
  },
  markdown: "",
  sections: [],
  rootDocuments: [document],
  diagnostics: [],
};
const fs = {
  vaultRoot: () => vault,
  exists: async (p: string) =>
    !!(await stat(path.join(vault, p)).catch(() => null)),
  ensureDirectory: async (p: string) => {
    await mkdir(path.join(vault, p), { recursive: true });
  },
  removeDirectory: async (p: string) => {
    await rm(path.join(vault, p), { recursive: true, force: true });
  },
  writeText: async (p: string, c: string) => {
    await mkdir(path.dirname(path.join(vault, p)), { recursive: true });
    await writeFile(path.join(vault, p), c);
  },
  readBinary: (p: string) => readFile(path.join(vault, p)),
  writeBinary: async (p: string, c: Uint8Array) => {
    await writeFile(path.join(vault, p), c);
  },
  copyVaultFile: async (s: string, t: string) => {
    await copyFile(path.join(vault, s), path.join(vault, t));
  },
  publishFile: async (s: string, t: string) => {
    await mkdir(path.dirname(path.join(vault, t)), { recursive: true });
    await copyFile(path.join(vault, s), path.join(vault, t));
  },
};
const options = {
  mode: "draft" as const,
  outputFolder: "Output",
  pandocCommand: "pandoc",
  mermaidCommand: "mmdc",
};
const pdf = await createPdfBuildPlanWithAssets(gateway, book, {
  ...options,
  layoutProfile: "kdp_6x9",
  pdfTarget: "kdp",
  colourTreatment: "automatic",
  xelatexCommand: "xelatex",
  svgConverterCommand: "rsvg-convert",
});
const runner = new NodePdfCommandRunner();
const pdfResult = await executePdfBuild(pdf, fs, runner, {
  keepWorkingDirectoryOnSuccess: true,
});
const pdfText = execFileSync(
  "pdftotext",
  [path.join(vault, pdfResult.outputPath), "-"],
  { encoding: "utf8" },
);
assert(pdfText.includes("Persistent chart"));
assert(pdfText.includes("Measured value"));
assert(pdfText.includes("+2.00"));
const epub = await createEpubBuildPlanWithAssets(gateway, book, options);
const epubResult = await executeEpubBuild(epub, fs, runner, {
  keepWorkingDirectoryOnSuccess: true,
});
const epubPath = path.join(vault, epubResult.outputPath);
const xhtml = execFileSync("unzip", ["-p", epubPath, "EPUB/text/*.xhtml"], {
  encoding: "utf8",
});
assert(xhtml.includes("Measured value"));
assert(xhtml.includes("+2.00"));
assert(xhtml.includes("<table"));
assert(xhtml.includes("<img"));
assert(
  execFileSync("unzip", ["-Z1", epubPath], { encoding: "utf8" }).includes(
    ".svg",
  ),
);
const docx = await createDocxBuildPlanWithAssets(gateway, book, options);
const docxResult = await executeDocxBuild(docx, fs, runner, {
  keepWorkingDirectoryOnSuccess: true,
});
const docxPath = path.join(vault, docxResult.outputPath);
const xml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], {
  encoding: "utf8",
});
assert(xml.includes("Measured value"));
assert(xml.includes("+2.00"));
assert(xml.includes("<w:tbl>"));
assert(xml.includes("drawing"));
assert(
  execFileSync("unzip", ["-Z1", docxPath], { encoding: "utf8" }).includes(
    "word/media/",
  ),
);
const missingTable = await expandMarkdownTransclusions(
  gateway,
  "![[Missing Ω table.md]]",
  "Book/Report.md",
);
assert(missingTable.diagnostics.some((d) => d.severity === "error"));
const missingDocument = { ...document, markdown: "![[Missing Ω chart.svg]]" };
const missingBook = { ...book, rootDocuments: [missingDocument] };
for (const plan of [
  await createPdfBuildPlanWithAssets(gateway, missingBook, {
    ...options,
    layoutProfile: "kdp_6x9",
    xelatexCommand: "xelatex",
    svgConverterCommand: "rsvg-convert",
  }),
  await createEpubBuildPlanWithAssets(gateway, missingBook, options),
  await createDocxBuildPlanWithAssets(gateway, missingBook, options),
])
  assert.equal(
    plan.canExecute,
    false,
    "Missing chart must block " + plan.format,
  );
for (const [p, c] of originals)
  assert.deepEqual(await readFile(path.join(vault, p)), c, p + " changed");
const evidence = {
  codexPressSource: process.env.MURMURATION_REPORTS_CODEX_SOURCE,
  outputs: [pdfResult.outputPath, epubResult.outputPath, docxResult.outputPath],
  checks: [
    "PDF vector chart text and numeric table",
    "EPUB SVG and table",
    "DOCX drawing and table",
    "missing chart blocks all three plans",
    "missing table blocks transclusion",
    "Unicode and spaces",
    "all original sources/assets/receipts byte-preserved",
    "no plugins loaded",
  ],
  root,
};
await writeFile(
  path.join(root, "evidence.json"),
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
