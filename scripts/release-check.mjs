import { readFile, access } from "node:fs/promises";
import assert from "node:assert/strict";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const [m, p, l, v, r] = await Promise.all(
  [
    "manifest.json",
    "package.json",
    "package-lock.json",
    "versions.json",
    "build-report.json",
  ].map(json),
);
assert.equal(m.id, "murmuration-reports");
assert.equal(m.name, "Murmuration Reports");
assert.equal(m.version, p.version);
assert.equal(m.version, l.version);
assert.equal(m.version, l.packages[""].version);
assert.equal(v[m.version], m.minAppVersion);
assert.equal(m.isDesktopOnly, true);
assert(
  r.thirdPartyInputs.length > 0 &&
    r.thirdPartyInputs.every((p) => p.startsWith("node_modules/yaml/")),
);

const js = await readFile("main.js", "utf8");
const license = await readFile("LICENSE", "utf8");
assert(js.includes(license.trim()));
assert(
  js.includes((await readFile("node_modules/yaml/LICENSE", "utf8")).trim()),
);
assert.equal(p.dependencies.yaml, "2.9.1");
await access("styles.css");
assert(
  (await readFile("THIRD_PARTY_NOTICES.md", "utf8")).includes("YAML 2.9.1"),
);
assert.equal(
  r.installed.total.raw,
  r.rawBytes +
    Buffer.byteLength(await readFile("styles.css")) +
    Buffer.byteLength(await readFile("manifest.json")),
);
assert(js.includes("d7c2e6e625e98fade7004a064ab081670e607d4e"));
assert(!js.includes("sourceMappingURL"));
assert.equal(Buffer.byteLength(js), r.rawBytes);
for (const unwanted of ["main.js.map", "metafile.json"]) {
  await assert.rejects(access(unwanted));
}
console.log(
  "Packaging, MIT attribution, dependency boundaries and version mapping pass. General release remains gated on Stage 2 and export qualification.",
);
