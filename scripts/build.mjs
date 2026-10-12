import { build, context } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
export const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  minify: true,
  banner: {
    js:
      "/*\n" +
      license +
      "\nExtracted from MWC d7c2e6e625e98fade7004a064ab081670e607d4e.\n*/",
  },
};
if (process.argv.includes("--watch")) {
  await (await context({ ...options, minify: false, sourcemap: true })).watch();
} else {
  const result = await build({ ...options, metafile: true });
  const js = await readFile("main.js");
  const thirdPartyInputs = Object.keys(result.metafile.inputs).filter((p) =>
    p.includes("node_modules"),
  );
  const imports = Object.values(result.metafile.outputs).flatMap(
    (o) => o.imports,
  );
  if (
    thirdPartyInputs.length ||
    Object.keys(result.metafile.inputs).some(p=>p.startsWith('tests/')||p.startsWith('scripts/')) ||
    imports.some((i) => i.external && i.path !== "obsidian")
  )
    throw Error("Unexpected bundled dependency or runtime external");
  await writeFile(
    "build-report.json",
    JSON.stringify(
      {
        rawBytes: js.length,
        gzipBytes: gzipSync(js).length,
        thirdPartyInputs,
        imports,
      },
      null,
      2,
    ),
  );
  console.log(
    `${js.length} raw / ${gzipSync(js).length} gzip bytes; Obsidian is the only runtime external.`,
  );
}
