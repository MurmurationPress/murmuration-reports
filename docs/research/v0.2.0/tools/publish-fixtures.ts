import {readFile,writeFile,mkdir,copyFile,stat,rm} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createPdfBuildPlanWithAssets} from '__CODEX_PRESS__/src/exporters/pdf/pdf-plan';
import {executePdfBuild} from '__CODEX_PRESS__/src/exporters/pdf/pdf-executor';
import {NodePdfCommandRunner} from '__CODEX_PRESS__/src/obsidian/node-pdf-command-runner';
import {createEpubBuildPlanWithAssets} from '__CODEX_PRESS__/src/exporters/epub/epub-plan';
import {executeEpubBuild} from '__CODEX_PRESS__/src/exporters/epub/epub-executor';
async function main(){
const source=resolve(process.argv[2]);const root=resolve(process.argv[3]);await mkdir(root,{recursive:true});
const markdown=(await readFile(join(source,'publication.md'),'utf8')).replace(/^---\n[\s\S]*?\n---\n/, '');
const book:any={id:'reports-research',kind:'book',title:'Reporting Research Fixtures',sourcePath:'Book.md',folderPath:'',metadata:{title:'Reporting Research Fixtures',author:'Murmuration Press',lang:'en-GB'},markdown:'',sections:[],diagnostics:[],rootDocuments:[{id:'fixtures',kind:'document',title:'Fixtures',sourcePath:'publication.md',metadata:{},markdown}]};
const fs:any={vaultRoot:()=>root,exists:async(p:string)=>!!await stat(join(root,p)).catch(()=>null),ensureDirectory:async(p:string)=>{await mkdir(join(root,p),{recursive:true})},removeDirectory:async(p:string)=>{await rm(join(root,p),{recursive:true,force:true})},writeText:async(p:string,c:string)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),c)},readBinary:(p:string)=>readFile(join(root,p)),writeBinary:async(p:string,c:Uint8Array)=>{await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),c)},copyVaultFile:async(s:string,t:string)=>{await mkdir(dirname(join(root,t)),{recursive:true});await copyFile(join(source,s),join(root,t))},publishFile:async(s:string,t:string)=>{await mkdir(dirname(join(root,t)),{recursive:true});await copyFile(join(root,s),join(root,t))}};
const gateway={resolveLink:async(_s:string,t:string)=>await stat(join(source,t)).then(()=>t).catch(()=>null)};const runner=new NodePdfCommandRunner();
const pdf=await createPdfBuildPlanWithAssets(gateway,book,{mode:'publish',layoutProfile:'kdp_6x9',pdfTarget:'kdp',colourTreatment:'automatic',outputFolder:'Output',pandocCommand:'pandoc',xelatexCommand:'xelatex',mermaidCommand:'mmdc',svgConverterCommand:'rsvg-convert'});
const pdfResult=await executePdfBuild(pdf,fs,runner,{keepWorkingDirectoryOnSuccess:true});
console.log(JSON.stringify({format:'pdf',...pdfResult,conversionCount:pdf.conversionTasks?.length}));
const extracted=execFileSync('pdftotext',[join(root,pdfResult.outputPath),'-'],{encoding:'utf8'});await writeFile(join(root,'pdf-text.txt'),extracted);
const counts=Array.from({length:80},(_,i)=>({marker:`ROW${String(i+1).padStart(3,'0')}`,count:(extracted.match(new RegExp(`ROW${String(i+1).padStart(3,'0')}`,'g'))||[]).length}));
await writeFile(join(root,'row-counts.json'),JSON.stringify(counts,null,2));if(counts.some(x=>x.count!==1))throw Error('Missing/duplicate row marker');
const epub=await createEpubBuildPlanWithAssets(gateway,book,{mode:'publish',outputFolder:'Output',pandocCommand:'pandoc',mermaidCommand:'mmdc',validatorCommand:'epubcheck',validatorArgs:[]});
const epubResult=await executeEpubBuild(epub,fs,runner,{keepWorkingDirectoryOnSuccess:true});console.log(JSON.stringify({format:'epub',...epubResult}));
await writeFile(join(root,'results.json'),JSON.stringify({pdf:pdfResult,epub:epubResult,conversionCount:pdf.conversionTasks?.length,rowMarkersAllOnce:true},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
