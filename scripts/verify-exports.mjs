// Build a tool-only harness against a separately checked-out Codex Press.
import { readFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
if (!process.argv[2])
  throw Error("Usage: node scripts/verify-exports.mjs CODEX_PRESS_CHECKOUT");
const root = await mkdtemp("/tmp/murmuration-reports-exports-");
const source = (await readFile("scripts/verify-exports.ts", "utf8")).replaceAll(
  "__CODEX_PRESS__",
  path.resolve(process.argv[2]),
);
await build({
  stdin: { contents: source, resolveDir: process.cwd(), loader: "ts" },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(root, "run.mjs"),
  logLevel: "silent",
  banner: {
    js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);",
  },
});
process.env.MURMURATION_REPORTS_EXPORT_ROOT = root;
if (process.argv[3]) {
  const fixture = path.resolve(process.argv[3]);
  if (
    !(
      await readFile(path.join(fixture, ".murmuration-reports-fixture"), "utf8")
    ).includes("Disposable synthetic")
  )
    throw Error("Only a marked disposable manager fixture is accepted");
  process.env.MURMURATION_REPORTS_MANAGER_FIXTURE = fixture;
}
process.env.MURMURATION_REPORTS_CODEX_SOURCE = execFileSync(
  "git",
  ["rev-parse", "HEAD"],
  { cwd: path.resolve(process.argv[2]), encoding: "utf8" },
).trim();
await import(pathToFileURL(path.join(root, "run.mjs")));
