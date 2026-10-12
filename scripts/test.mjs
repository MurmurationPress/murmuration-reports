import { readdir, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const tests = (await readdir("tests")).filter((p) => p.endsWith(".test.ts"));
await mkdir(".test-build", { recursive: true });
await build({
  entryPoints: tests.map((p) => "tests/" + p),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outdir: ".test-build",
  outExtension: { ".js": ".mjs" },
  logLevel: "silent",
  plugins: [
    {
      name: "obsidian-test-boundary",
      setup(builder) {
        builder.onResolve({ filter: /^obsidian$/ }, () => ({
          path: fileURLToPath(
            new URL("../tests/helpers/ObsidianStub.ts", import.meta.url),
          ),
        }));
      },
    },
  ],
});
// Run directly: Node 24's --test file runner can suppress individual bundled test counts.
for (const file of tests) {
  const r = spawnSync(
    process.execPath,
    [".test-build/" + file.replace(".ts", ".mjs")],
    { stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
