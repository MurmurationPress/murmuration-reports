// Research/qualification harness only; reads a marked, feature-generated native vault.
import {readFile, mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const [codexArg,vaultArg,outputArg,...options]=process.argv.slice(2);
if(!codexArg||!vaultArg||!outputArg)throw Error('Usage: CODEX_CHECKOUT MARKED_NATIVE_VAULT NEW_OUTPUT [WIDTH PROFILE --pdf-only]');
const codex=resolve(codexArg),vault=resolve(vaultArg),output=resolve(outputArg);
if(!(await readFile(join(vault,'.murmuration-reports-fixture'),'utf8')).includes('Disposable synthetic'))throw Error('Only a marked disposable vault is allowed');
const compiler=execFileSync('git',['rev-parse','HEAD'],{cwd:codex,encoding:'utf8'}).trim();
if(compiler!=='394cf109f035194b440e3b37d75de06e49fe074d')throw Error('Use the exact merged #145 compiler commit');
await mkdir(output); // Refuse existing output, never overwrite a real vault.
const source=(await readFile(new URL('./verify-first-milestone-publication.ts',import.meta.url),'utf8')).replaceAll('__CODEX_PRESS__',codex);
const outfile=join(output,'publication.cjs');
await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile,external:['obsidian']});
execFileSync(process.execPath,[outfile,vault,output,compiler,...options],{stdio:'inherit'});
