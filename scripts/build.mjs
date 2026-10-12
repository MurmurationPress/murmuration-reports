import { build, context } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const yamlLicense = await readFile(
  new URL("../node_modules/yaml/LICENSE", import.meta.url),
  "utf8",
);
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
      "\nYAML 2.9.1 (ISC)\n" +
      yamlLicense +
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
  const styles = await readFile("styles.css");
  const manifest = await readFile("manifest.json");
  const imports = Object.values(result.metafile.outputs).flatMap(
    (o) => o.imports,
  );
  if (
    thirdPartyInputs.some((p) => !p.startsWith("node_modules/yaml/")) ||
    Object.keys(result.metafile.inputs).some(
      (p) => p.startsWith("tests/") || p.startsWith("scripts/"),
    ) ||
    imports.some((i) => i.external && i.path !== "obsidian")
  )
    throw Error("Unexpected bundled dependency or runtime external");
  await writeFile(
    "build-report.json",
    JSON.stringify(
      {
        rawBytes: js.length,
        gzipBytes: gzipSync(js).length,
        installed: {
          javascript: { raw: js.length, gzip: gzipSync(js).length },
          styles: { raw: styles.length, gzip: gzipSync(styles).length },
          manifest: { raw: manifest.length, gzip: gzipSync(manifest).length },
          total: {
            raw: js.length + styles.length + manifest.length,
            gzip:
              gzipSync(js).length +
              gzipSync(styles).length +
              gzipSync(manifest).length,
          },
        },
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
