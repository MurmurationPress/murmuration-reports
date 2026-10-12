// Create a new synthetic vault only; never writes into an existing directory.
import { mkdir, writeFile, readFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw Error("Usage: node scripts/create-fixture.mjs NEW_DIRECTORY");
await mkdir(root);
const tmp = await mkdtemp("/tmp/murmuration-reports-fixture-builder-");
const module = path.join(tmp, "fixture.mjs");
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
 import {MemoryVault,chart,table} from './tests/helpers/MemoryVault';
 import {GenerationCoordinator} from './src/reports/GenerationCoordinator';
 const v=new MemoryVault();v.files.delete('Definitions/Report.md');v.note('Definitions/Trend.md',chart);v.note('Definitions/State.md',table);
 const result=await new GenerationCoordinator(v).generateAll();if(result.some(r=>r.status!=='created'))throw Error(JSON.stringify(result));
 export const files=[...v.files].map(([p,c])=>{if(p.startsWith('Definitions/')||p.startsWith('Data Ω/')){const fm=JSON.parse(c);c='---\\n'+Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\\n')+'\\n---\\n\\nSynthetic public fixture.\\n';}return[p,c];});
 `,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: module,
  logLevel: "silent",
});
const { files } = await import(pathToFileURL(module));
files.push(
  ["Book.md", "---\ntype: book\ntitle: Persistent Reports Fixture\n---\n"],
  [
    "Book/Report.md",
    '---\ntype: scene\nparent: "[[Book]]"\nmanuscript_order_key: "5000000000"\n---\n\n# Saved reports\n\n![[Saved reports Ω/Trend.svg]]\n\n![[Saved reports Ω/State.md]]\n',
  ],
);
for (const [p, c] of files) {
  await mkdir(path.dirname(path.join(root, p)), { recursive: true });
  await writeFile(path.join(root, p), c);
}
await writeFile(
  path.join(root, ".murmuration-reports-fixture"),
  "Disposable synthetic Murmuration Reports fixture\n",
);
await writeFile(
  path.join(root, "README.md"),
  "Synthetic public dataset. Definitions and saved outputs remain independent of both plugins.\n",
);
console.log(root);
