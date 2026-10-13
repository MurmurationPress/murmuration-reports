// Isolated evidence for the four-series fixed-domain decision, not an adapter implementation.
import {build} from 'esbuild';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {gzipSync} from 'node:zlib';
import * as echarts from 'echarts';
import * as vega from 'vega';
import {compile} from 'vega-lite';
const [repoArg,outArg]=process.argv.slice(2);if(!repoArg||!outArg)throw Error('Usage: node renderer-review.mjs REPORTS_CHECKOUT OUTPUT');
const repo=resolve(repoArg),out=resolve(outArg);await mkdir(out,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const names=['A','B','C','D'];const vals=[[-.8,-.3,.3,.7],[-.6,.1,.2,.5],[.8,.4,-.1,-.5],[.5,.2,-.4,-.8]];
const font='DejaVu Sans';const dashes=['solid','dashed','dotted',[12,5,2,5]];
function ec(){
 const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:720,height:620});
 chart.setOption({animation:false,textStyle:{fontFamily:font,fontSize:24},title:{text:'Four series with fixed Y bounds',left:45,top:8,textStyle:{fontFamily:font,fontSize:30}},grid:{left:100,right:45,top:80,bottom:220},xAxis:{type:'value',min:1,max:4,interval:1,axisLabel:{fontSize:24,fontFamily:font},axisLine:{lineStyle:{width:2}},axisTick:{lineStyle:{width:2}}},yAxis:{type:'value',min:-1,max:1,interval:.5,axisLabel:{fontSize:24,fontFamily:font},axisLine:{show:true,lineStyle:{width:2}},axisTick:{lineStyle:{width:2}}},legend:{orient:'vertical',left:95,top:430,itemWidth:45,itemHeight:12,textStyle:{fontFamily:font,fontSize:24},data:names},series:names.map((name,s)=>({name,type:'line',data:vals[s].map((y,i)=>[i+1,y]),symbol:['circle','rect','triangle','diamond'][s],symbolSize:12,lineStyle:{width:2,type:dashes[s],color:'#17212b'},itemStyle:{color:'#fff',borderColor:'#17212b',borderWidth:2}})),graphic:[{type:'text',left:95,top:568,style:{text:'Fixed −1…+1; synthetic signed assessments.',fontFamily:font,fontSize:24,fill:'#17212b'}},{type:'text',left:95,top:598,style:{text:'These values are not probabilities.',fontFamily:font,fontSize:24,fill:'#17212b'}}]});
 const svg=chart.renderToSVGString();chart.dispose();return svg;
}
const values=names.flatMap((series,s)=>vals[s].map((y,i)=>({series,x:i+1,y})));
const spec=compile({$schema:'https://vega.github.io/schema/vega-lite/v6.json',width:500,height:290,data:{values},title:{text:['Four series with fixed Y bounds','Signed assessments; not probabilities.'],font,fontSize:30,subtitleFont:font},mark:{type:'line',point:{filled:false,size:144,strokeWidth:2}},encoding:{x:{field:'x',type:'quantitative',scale:{domain:[1,4]},axis:{title:null,tickCount:4,format:'d',labelFont:font,labelFontSize:24,domainWidth:2,tickWidth:2}},y:{field:'y',type:'quantitative',scale:{domain:[-1,1]},axis:{title:null,values:[-1,-.5,0,.5,1],labelFont:font,labelFontSize:24,domainWidth:2,tickWidth:2}},detail:{field:'series'},strokeDash:{field:'series',type:'nominal',scale:{domain:names,range:[[],[12,6],[2,7],[12,5,2,5]]},legend:{orient:'bottom',title:null,labelFont:font,labelFontSize:24}},shape:{field:'series',type:'nominal',scale:{domain:names,range:['circle','square','triangle-up','diamond']},legend:{orient:'bottom',title:null,labelFont:font,labelFontSize:24}}},config:{font,axis:{grid:false},line:{stroke:'#17212b',strokeWidth:2},point:{stroke:'#17212b'},view:{stroke:null}}}).spec;
async function vg(){const v=new vega.View(vega.parse(spec),{renderer:'none'});await v.runAsync();const svg=await v.toSVG();v.finalize();return svg;}
// Bundle the unchanged production renderer into scratch output only.
const legacyPath=join(out,'legacy-renderer.cjs');await build({entryPoints:[join(repo,'src/core/LineChartSvg.ts')],bundle:true,platform:'node',format:'cjs',outfile:legacyPath});
const legacy=createRequire(import.meta.url)(legacyPath).renderLineChartSvg;
const data={definition:{title:'Four series with fixed Y bounds',source:'Synthetic',x:'measured_on',output:'Synthetic.svg',series:names.map((label,i)=>({property:'series'+i,label})),artefactType:'line-chart'},points:[0,1,2,3].map((i)=>({date:`2029-0${i+1}-01`,timestamp:Date.UTC(2029,i,1),sourcePath:`Synthetic/${i}.md`,values:vals.map(v=>v[i])}))};
const outputs={echarts:[ec(),ec()],vega:[await vg(),await vg()],legacyCustom:[legacy(data),legacy(data)]};
for(const [name,arr] of Object.entries(outputs))for(let i=0;i<arr.length;i++)await writeFile(join(out,`${name}-${i}.svg`),arr[i]);
// Probe cost is a hypothetical coexistence import, never a real Reports integration.
const probe={};for(const [name,extra] of Object.entries({baseline:'',echarts:'import {init,use} from "echarts/core";import {LineChart} from "echarts/charts";import {GridComponent,LegendComponent,TitleComponent,GraphicComponent} from "echarts/components";import {SVGRenderer} from "echarts/renderers";use([LineChart,GridComponent,LegendComponent,TitleComponent,GraphicComponent,SVGRenderer]);export {init};',vega:'export {compile} from "vega-lite";export {View,parse} from "vega";'})){
 const contents=`export {default as ReportsPlugin} from ${JSON.stringify(join(repo,'src/main.ts'))};${extra}`;
 const result=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,platform:'browser',format:'cjs',target:'es2018',minify:true,external:['obsidian'],write:false});const bytes=result.outputFiles[0].contents;probe[name]={rawBytes:bytes.length,gzipBytes:gzipSync(bytes).length};
}
for(const name of ['echarts','vega'])probe[name].rawDelta=probe[name].rawBytes-probe.baseline.rawBytes;
const result={node:process.version,environment:{TZ:process.env.TZ,LANG:process.env.LANG,REPORTS_RESEARCH_THEME:process.env.REPORTS_RESEARCH_THEME},scope:'Four synthetic series; fixed domain, caption, marker/dash identity. Legacy renderer is unchanged and lacks new features. Candidate outputs are not adapters or equivalent layouts.',outputs:Object.fromEntries(Object.entries(outputs).map(([name,arr])=>[name,{hashes:arr.map(hash),sameProcessExact:arr[0]===arr[1]}])),hypotheticalCoexistenceProbe:probe,integrationCost:'NOT MEASURED: production architecture/schema untouched. Probe includes retained engine exports alongside current code, no migration/adapter/banner. It is not an actual integration delta.'};await writeFile(join(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
