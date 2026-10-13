// Research-only harness. Requires an already installed Codex Press checkout.
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const [codexRoot,fixtureRoot,outputRoot]=process.argv.slice(2).map(p=>resolve(p));
if (!codexRoot || !fixtureRoot || !outputRoot) throw Error('Usage: node run-publication.mjs CODEX_CHECKOUT FIXTURES OUTPUT');
const {build}=createRequire(join(codexRoot,'package.json'))('esbuild');
await mkdir(outputRoot,{recursive:true});
const content=(await readFile(new URL('./publish-fixtures.ts',import.meta.url),'utf8')).replaceAll('__CODEX_PRESS__',codexRoot);
const outfile=join(outputRoot,'research-harness.cjs');
await build({stdin:{contents:content,loader:'ts',resolveDir:codexRoot},bundle:true,platform:'node',format:'cjs',outfile,external:['obsidian']});
execFileSync(process.execPath,[outfile,fixtureRoot,outputRoot],{stdio:'inherit'});
