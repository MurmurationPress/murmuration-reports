// Research-only harness. Requires an already installed Codex Press checkout.
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const [codexArg,fixtureArg,outputArg,...options]=process.argv.slice(2);
if(!codexArg || !fixtureArg || !outputArg) throw Error('Required checkout, fixtures and disposable output path');
const [codexRoot,fixtureRoot,outputRoot]=[codexArg,fixtureArg,outputArg].map(p=>resolve(p));
if (!codexRoot || !fixtureRoot || !outputRoot) throw Error('Usage: node run-publication.mjs CODEX_CHECKOUT FIXTURES OUTPUT');
const {build}=createRequire(join(codexRoot,'package.json'))('esbuild');
await mkdir(outputRoot,{recursive:true});
const content=(await readFile(new URL('./publish-fixtures.ts',import.meta.url),'utf8')).replaceAll('__CODEX_PRESS__',codexRoot);
const outfile=join(outputRoot,'research-harness.cjs');
await build({stdin:{contents:content,loader:'ts',resolveDir:codexRoot},bundle:true,platform:'node',format:'cjs',outfile,external:['obsidian']});
execFileSync(process.execPath,[outfile,fixtureRoot,outputRoot,...options],{stdio:'inherit'});
