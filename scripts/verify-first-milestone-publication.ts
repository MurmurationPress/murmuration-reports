// No plugins loaded. Saved assets came from native Reports generation, not hand-authored SVGs.
import {readFile,writeFile,mkdir,copyFile,stat,rm,readdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {expandMarkdownTransclusions} from '__CODEX_PRESS__/src/compiler/markdown-transclusion';
import {createPdfBuildPlanWithAssets} from '__CODEX_PRESS__/src/exporters/pdf/pdf-plan';
import {executePdfBuild} from '__CODEX_PRESS__/src/exporters/pdf/pdf-executor';
import {createEpubBuildPlanWithAssets} from '__CODEX_PRESS__/src/exporters/epub/epub-plan';
import {executeEpubBuild} from '__CODEX_PRESS__/src/exporters/epub/epub-executor';
import {NodePdfCommandRunner} from '__CODEX_PRESS__/src/obsidian/node-pdf-command-runner';
async function main(){
 const [source,root]=process.argv.slice(2,4).map(p=>resolve(p)),width=Number(process.argv[5]||'4.1'),profile=process.argv[6]||'kdp_6x9';
 // Commit is a token, not a filesystem path.
 const compilerCommit=process.argv[4];
 assert([3.5,4.1,5.5].includes(width));
 const svgPath='Saved reports Ω/Publication.svg',tablePath='Saved reports Ω/Explicit.md';
 const files=new Map<string,Buffer>();
 const collect=async(directory:string):Promise<void>=>{for(const entry of await readdir(join(source,directory),{withFileTypes:true})){const relative=directory+'/'+entry.name;if(entry.isDirectory())await collect(relative);else if(entry.isFile())files.set(relative,await readFile(join(source,relative)));}};
 for(const directory of ['Publication data','Definitions','Saved reports Ω'])await collect(directory);
 assert(files.get(svgPath)!.toString().includes('data-style="dash-dot/diamond"'));
 assert(files.get(svgPath)!.toString().includes('Y range -1 to 1'));
 assert(files.get(tablePath)!.toString().includes('previous (2029-05-29)'));
 const gateway={readMarkdown:async(p:string)=>(await readFile(join(source,p))).toString(),resolveLink:async(_s:string,p:string)=>await stat(join(source,p)).then(()=>p).catch(()=>null)};
 const authored=`# Feature-generated reports\n\n![Generated four-series assessment — synthetic fixture](<${svgPath}>){width=${width}in}\n\n![[${tablePath}]]\n`;
 const expanded=await expandMarkdownTransclusions(gateway,authored,'Publication view.md');assert.deepEqual(expanded.diagnostics,[]);assert(expanded.markdown.includes('ROW080'));
 await writeFile(join(root,'expanded.md'),expanded.markdown);
 const book:any={id:'first-milestone',kind:'book',title:'Generated publication reports',sourcePath:'Publication book.md',folderPath:'',metadata:{title:'Generated publication reports',author:'Synthetic fixture',lang:'en-GB'},markdown:'',sections:[],diagnostics:[],rootDocuments:[{id:'generated',kind:'document',title:'Saved assets',sourcePath:'Publication view.md',metadata:{},markdown:expanded.markdown}]};
 const fs:any={vaultRoot:()=>root,exists:async(p:string)=>!!await stat(join(root,p)).catch(()=>null),ensureDirectory:async(p:string)=>{await mkdir(join(root,p),{recursive:true})},removeDirectory:async(p:string)=>{await rm(join(root,p),{recursive:true,force:true})},writeText:async(p:string,c:string)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),c)},readBinary:(p:string)=>readFile(join(root,p)),writeBinary:async(p:string,c:Uint8Array)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),c)},copyVaultFile:async(s:string,t:string)=>{await mkdir(dirname(join(root,t)),{recursive:true});await copyFile(join(source,s),join(root,t))},publishFile:async(s:string,t:string)=>{await mkdir(dirname(join(root,t)),{recursive:true});await copyFile(join(root,s),join(root,t))}};
 const runner=new NodePdfCommandRunner();
 const plan=await createPdfBuildPlanWithAssets(gateway,book,{mode:'publish',layoutProfile:profile as any,pdfTarget:'kdp',colourTreatment:'automatic',outputFolder:'Output',pandocCommand:'pandoc',xelatexCommand:'xelatex',svgConverterCommand:process.env.REPORTS_RESEARCH_SVG_CONVERTER||'rsvg-convert'});
 const pdf=await executePdfBuild(plan,fs,runner,{keepWorkingDirectoryOnSuccess:true});
 const text=execFileSync('pdftotext',[join(root,pdf.outputPath),'-'],{encoding:'utf8'});await writeFile(join(root,'pdf-text.txt'),text);
 const rows=Array.from({length:80},(_,i)=>({marker:`ROW${String(i+1).padStart(3,'0')}`,count:(text.match(new RegExp(`ROW${String(i+1).padStart(3,'0')}`,'g'))||[]).length}));assert(rows.every(r=>r.count===1));
 await writeFile(join(root,'row-counts.json'),JSON.stringify(rows,null,2));
 let epub;
 if(!process.argv.includes('--pdf-only')){
  const ep=await createEpubBuildPlanWithAssets(gateway,book,{mode:'publish',outputFolder:'Output',pandocCommand:'pandoc',mermaidCommand:'mmdc',validatorCommand:'epubcheck',validatorArgs:[]});epub=await executeEpubBuild(ep,fs,runner,{keepWorkingDirectoryOnSuccess:true});
  const names=execFileSync('unzip',['-Z1',join(root,epub.outputPath)],{encoding:'utf8'}).split('\n').filter(n=>n.endsWith('.svg'));assert.equal(names.length,1);assert.deepEqual(execFileSync('unzip',['-p',join(root,epub.outputPath),names[0]]),files.get(svgPath));
 }
 for(const [p,bytes] of files)assert.deepEqual(await readFile(join(source,p)),bytes,p+' changed');
 const ledger={compilerCommit,nativeSourceVault:source,pluginsLoaded:false,widthInches:width,layoutProfile:profile,pdf,epub,rowMarkersAllOnce:true,svgPath,tablePath,inputSha256:Object.fromEntries([...files].map(([p,bytes])=>[p,createHash('sha256').update(bytes).digest('hex')]))};
 await writeFile(join(root,'results.json'),JSON.stringify(ledger,null,2));console.log(JSON.stringify(ledger,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
