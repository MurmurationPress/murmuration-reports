import { test } from "node:test";
import { equal, deepEqual, match, throws, rejects } from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseLineChartDefinition, parseStateTableDefinition, parseDerivedArtefactDefinition } from "../src/core/DerivedArtefactDefinition";
import { normaliseLineChartData, FrontmatterRecord } from "../src/core/LineChartData";
import { renderLineChartSvg } from "../src/core/LineChartSvg";
import { normaliseStateTableData } from "../src/core/StateTableData";
import { renderStateTableMarkdown } from "../src/core/StateTableMarkdown";
import { patchDefinition, newDefinition, readEditable } from "../src/manager/DefinitionEditing";
import { GenerationCoordinator } from "../src/reports/GenerationCoordinator";
import { receiptPath, parseReceipt, tableMarker } from "../src/reports/OutputOwnership";
import { MemoryVault, chart, table } from "./helpers/MemoryVault";

const publication = {...chart, presentation:"publication", y_min:-1, y_max:1, caption:"Signed assessments, not probabilities."};
const chartRecords = [
  {path:"Data Ω/A.md",frontmatter:{date:"2029-01-01",value:-1}},
  {path:"Data Ω/B.md",frontmatter:{date:"2029-02-01",value:1}}
];
const pair = {...table,comparison:{mode:"explicit-pair",current:"Data Ω/June.md",previous:"Data Ω/May.md"}};
const pairRecords = [
  {path:"Data Ω/May.md",frontmatter:{date:"2029-05-29",value:10}},
  {path:"Data Ω/June.md",frontmatter:{date:"2029-06-30",value:15}}
];
const svg = (fm: Record<string, unknown>, records: readonly FrontmatterRecord[] = chartRecords) => renderLineChartSvg(normaliseLineChartData(parseLineChartDefinition(fm),records));
const state = (fm: Record<string, unknown> = pair, records: readonly FrontmatterRecord[] = pairRecords) => normaliseStateTableData(parseStateTableDefinition(fm), records);

test("legacy render and comparison bytes match ten independently captured merged-main goldens", () => {
  const ledger = JSON.parse(readFileSync("tests/fixtures/legacy-bytes.json","utf8"));
  equal(ledger.sourceCommit,"c15efbe2f79809fd0139ea14ed69268862a04543");
  for (const c of ledger.cases) {
    const d = parseDerivedArtefactDefinition(c.definition);
    const output = d.artefactType === "line-chart" ? renderLineChartSvg(normaliseLineChartData(d,c.records)) : renderStateTableMarkdown(normaliseStateTableData(d,c.records));
    equal(createHash("sha256").update(output).digest("hex"),c.sha256,c.name);
  }
});
test("only exact publication opt-in activates opaque fields", () => {
  const legacy = svg(chart);
  for (const presentation of [undefined,"legacy","custom",{opaque:true}]) equal(svg({...chart,presentation,y_min:"bad",y_max:null,caption:{opaque:true}}),legacy);
  for (const change of [{y_min:undefined},{y_max:undefined},{y_min:null},{y_min:"-1"},{y_max:Infinity},{y_min:1,y_max:1},{y_min:2},{caption:"x".repeat(241)}]) throws(()=>parseLineChartDefinition({...publication,...change}),/Publication|caption/);
});
test("fixed domains block selected outliers while preserving whole-source validation", () => {
  match(svg(publication),/Y range -1 to 1/);
  throws(()=>svg(publication,[...chartRecords,{path:"Data Ω/Bad.md",frontmatter:{date:"2029-01-15",value:1.01}}]),/Bad.md: value=1.01.*outside fixed Y bounds/);
  const outside = {path:"Data Ω/Old.md",frontmatter:{date:"2020-01-01",value:99}};
  svg({...publication,start:"2029-01-01"},[...chartRecords,outside]);
  throws(()=>svg({...publication,start:"2029-01-01"},[...chartRecords,{...outside,frontmatter:{date:"2020-01-01",value:"99"}}]),/Old.md.*finite number/);
});
test("automatic publication and fixed tiny ranges have finite geometry and distinct bounded ticks", () => {
  for (const values of [[1,2],[4,4],[-.000008,.000007],[Number.MIN_VALUE,Number.MIN_VALUE*2]]) {
    const records=chartRecords.map((r,i)=>({...r,frontmatter:{...r.frontmatter,value:values[i]}}));
    const output=svg({...publication,y_min:values[0]===values[1]?undefined:Math.min(...values),y_max:values[0]===values[1]?undefined:Math.max(...values)},records);
    equal(/NaN|Infinity/.test(output),false);
    const labels=[...output.matchAll(/text-anchor="end">([^<]+)<\/text>/g)].map(m=>m[1]);
    equal(new Set(labels).size,labels.length);
  }
});
test("publication wraps escaped text, preserves descriptive caption, rejects unsupported/unfit layouts", () => {
  const caption="An assessment & response <value> is not a probability. Read the observations and their limits.";
  const output=svg({...publication,title:"Synthetic assessment across two monitoring periods",caption});
  equal(output,svg({...publication,title:"Synthetic assessment across two monitoring periods",caption},chartRecords.slice().reverse()));
  match(output,/&amp; response &lt;value&gt;/);
  match(output,/Signed assessments|An assessment/);
  equal(output.includes('font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif"'),true);
  for (const change of [{title:"word".repeat(40)},{caption:"Unsupported 🦉"},{title:"a ".repeat(100)},{subtitle:"漢字"},{caption:"e\u0301"}]) throws(()=>svg({...publication,...change}),/Publication.*Shorten or restructure/);
});
test("four series and their legends share four colour-independent patterns and markers", () => {
  const series=[0,1,2,3].map(i=>({property:"s"+i,label:"Site "+i}));
  const records=chartRecords.map(r=>({...r,frontmatter:{...r.frontmatter,s0:-.8,s1:-.2,s2:.2,s3:.8}}));
  const output=svg({...publication,series},records);
  for (const identity of ["solid/circle","dashed/square","dotted/triangle","dash-dot/diamond"]) {
    equal((output.match(new RegExp('data-style="'+identity+'"','g'))||[]).length,4);
  }
  for (const dash of ["14 8","3 9","14 6 3 6"]) equal((output.match(new RegExp('<(?:polyline|line data-legend)[^>]*stroke-dasharray="'+dash+'"','g'))||[]).length,2);
  equal((output.match(/data-legend=/g)||[]).length,8);
});
test("explicit pair remains +5 after insertion, while canonical predecessor changes to +3", () => {
  const inserted={path:"Data Ω/Middle.md",frontmatter:{date:"2029-06-15",value:12}};
  equal(state().rows[0].delta,5);
  const data=state(pair,[...pairRecords,inserted]);equal(data.rows[0].delta,5);
  equal(state(table,[...pairRecords,inserted]).rows[0].delta,3);
  equal(state({...pair,comparison:{...pair.comparison,previous:inserted.path}},[...pairRecords,inserted]).rows[0].delta,3);
  match(renderStateTableMarkdown(data),/current \(2029-06-30\).*previous \(2029-05-29\)/);
  match(renderStateTableMarkdown(data),/Explicit-pair comparison: current Data Ω\/June.md; previous Data Ω\/May.md/);
});
test("pair reference validation rejects unsafe paths, outside folders, identical aliases and unknown modes", () => {
  for (const comparison of [null,{},"pair",{...pair.comparison,mode:"nearest"},{...pair.comparison,current:"Data Ω/May.md"},{...pair.comparison,current:"DATA Ω/MAY.MD"},{...pair.comparison,current:"Data Ω-old/June.md"},{...pair.comparison,current:"Data Ω/../June.md"},{...pair.comparison,current:"Data Ω/June"},{...pair.comparison,current:"[[Data Ω/June.md]]"},{...pair.comparison,current:"Data Ω/June.md#heading"},{...pair.comparison,current:"Data Ω/CON.md"},{...pair.comparison,current:"Data Ω/June.md\u2028"}]) throws(()=>parseStateTableDefinition({...pair,comparison}));
  for (const change of [{start:"2029-01-01"},{window:"1 year"}]) throws(()=>parseStateTableDefinition({...pair,...change}),/do not support/);
});
test("pairs reject missing, renamed, ambiguous, reversed, equal-date and contradictory endpoint observations", () => {
  throws(()=>state(pair,pairRecords.slice(1)),/comparison.previous.*missing or renamed.*never substituted/);
  throws(()=>state(pair,pairRecords.map(r=>r.path.includes("May")?{...r,path:"Data Ω/Renamed.md"}:r)),/missing or renamed/);
  throws(()=>state(pair,[...pairRecords,{...pairRecords[0],path:"Data Ω/MAY.md"}]),/ambiguous/);
  for (const date of ["2029-06-30","2029-07-01"]) throws(()=>state(pair,pairRecords.map((r,i)=>i? r:{...r,frontmatter:{...r.frontmatter,date}})),/strictly earlier/);
  throws(()=>state({...pair,end:"2029-06-29"}),/must equal explicit current date/);
  const aliases=state({...pair,comparison:{...pair.comparison,current:"DATA Ω/JUNE.md"}});equal(aliases.current.sourcePath,"Data Ω/June.md");
  throws(()=>state(pair,[...pairRecords,{path:"Data Ω/Unselected.md",frontmatter:{date:"2020-01-01",value:"bad"}}]),/finite number/);
});
test("pair path labels escape Markdown metacharacters and allow finite zero/negative deltas", () => {
  const path="Data Ω/June_[a].md",fm={...pair,comparison:{...pair.comparison,current:path}};
  const records=pairRecords.map((r,i)=>({...r,path:i?path:r.path,frontmatter:{...r.frontmatter,value:i?-2:0}}));
  const output=renderStateTableMarkdown(state(fm,records));match(output,/\|-2.00\|\+0.00\|-2.00\|/);match(output,/June\\_\\\[a\\\].md/);
});
test("source-preserving publication/pair edits retain comments, CRLF, unknown fields and body", () => {
  for (const fm of [publication,{...pair,comparison:{...pair.comparison,custom:"keep"}}]) {
    const raw=newDefinition({...fm,unknown:{keep:"yes"}}).replace(/\n/g,"\r\n")+"Body remains exact\r\n";
    const values=readEditable(raw).data;
    if (fm.artefact_type==="line-chart") {values.caption="Changed caption";values.y_min=-2;} else (values.comparison as Record<string,unknown>).previous="Data Ω/Other.md";
    const changed=patchDefinition(raw,values);
    equal(changed.endsWith("Body remains exact\r\n"),true);deepEqual(readEditable(changed).data.unknown,{keep:"yes"});
    if (fm.artefact_type==="state-table") equal((readEditable(changed).data.comparison as Record<string,unknown>).custom,"keep");
  }
});
function pairVault() {
  const vault=new MemoryVault(pair);vault.files.delete("Data Ω/A.md");vault.files.delete("Data Ω/B.md");
  for (const r of pairRecords) vault.note(r.path,r.frontmatter);
  return vault;
}
test("production coordinator persists explicit pairs and retains receipt/asset after rename, ambiguity or invalid data", async () => {
  const v=pairVault(),g=new GenerationCoordinator(v),path="Definitions/Report.md";
  equal((await g.generate(path)).status,"created");
  const output=v.files.get(table.output)!,receipt=v.files.get(receiptPath(table.output))!,definition=v.files.get(path)!;
  match(output,new RegExp(tableMarker(path).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  equal(parseReceipt(receipt).version,1);
  v.note("Data Ω/Middle.md",{date:"2029-06-15",value:12});equal((await g.generate(path)).status,"unchanged");
  const mutations=v.mutations.length;
  v.files.set("Data Ω/Renamed.md",v.files.get("Data Ω/May.md")!);v.files.delete("Data Ω/May.md");
  equal((await g.generate(path)).status,"failed");equal(v.mutations.length,mutations);
  equal(v.files.get(table.output),output);equal(v.files.get(receiptPath(table.output)),receipt);equal(v.files.get(path),definition);
  v.files.set("Data Ω/May.md",v.files.get("Data Ω/Renamed.md")!);v.files.delete("Data Ω/Renamed.md");
  v.note("data ω/MAY.md",pairRecords[0].frontmatter);equal((await g.generate(path)).status,"failed");equal(v.files.get(table.output),output);
});
test("new features fail before writes and retain existing outputs under collisions, edits and lifecycle cancellation", async () => {
  const path="Definitions/Report.md";
  for (const defect of ["bounds","layout","asset","receipt","collision","disable"]) {
    const v=new MemoryVault(publication);v.note("Data Ω/A.md",chartRecords[0].frontmatter);v.note("Data Ω/B.md",chartRecords[1].frontmatter);
    const g=new GenerationCoordinator(v);equal((await g.generate(path)).status,"created");
    if (defect==="bounds") v.note("Data Ω/B.md",{date:"2029-02-01",value:2});
    if (defect==="layout") v.note(path,{...publication,caption:"🦉"});
    if (defect==="asset") v.files.set(chart.output,"External edit");
    if (defect==="receipt") v.files.set(receiptPath(chart.output),"Invalid");
    if (defect==="collision") v.note("Definitions/Competitor.md",publication);
    if (defect==="disable") g.dispose();
    const before=new Map(v.files),mutations=v.mutations.length;
    if (defect==="disable") await rejects(g.generate(path),/disabled/);else equal((await g.generate(path)).status,["bounds","layout"].includes(defect)?"failed":"blocked",defect);
    deepEqual(v.files,before);equal(v.mutations.length,mutations);
  }
});
test("publication replacement retains verified recovery and pair source callback edits block mutation", async () => {
  const v=new MemoryVault(publication);for(const r of chartRecords)v.note(r.path,r.frontmatter);
  const g=new GenerationCoordinator(v);await g.generate("Definitions/Report.md");const old=v.files.get(chart.output)!;
  v.note("Definitions/Report.md",{...publication,caption:"Updated explanation."});const result=await g.generate("Definitions/Report.md");equal(result.status,"replaced");equal(v.files.get(result.recoveryPaths![0]),old);
  const p=pairVault(),c=new GenerationCoordinator(p);await c.generate("Definitions/Report.md");const saved=p.files.get(table.output);
  p.note("Data Ω/June.md",{date:"2029-06-30",value:16});
  p.hook=(op,path)=>{if(op==="replace" && path===table.output)p.note("Data Ω/May.md",{date:"2029-05-29",value:9});};
  equal((await c.generate("Definitions/Report.md")).status,"blocked");equal(p.files.get(table.output),saved);
});
test("dated pair tables retain explicit adoption/repair after a definition move", async () => {
  const v=pairVault(),g=new GenerationCoordinator(v);await g.generate("Definitions/Report.md");
  const original=v.files.get(table.output)!;
  v.files.set("Definitions/Moved.md",v.files.get("Definitions/Report.md")!);v.files.delete("Definitions/Report.md");
  equal((await g.generate("Definitions/Moved.md")).status,"blocked");
  const inspection=await g.inspectAdoption("Definitions/Moved.md");equal(inspection.content,original);
  const result=await g.adoptAndGenerate(inspection);equal(result.status,"replaced");
  equal(v.files.get(result.recoveryPaths![0]),original);
  equal(parseReceipt(v.files.get(receiptPath(table.output))!).definitionPath,"Definitions/Moved.md");
});
test("publication rejects invalid XML property characters and oversized total layout before writing", () => {
  throws(()=>svg({...publication,series:[{property:"bad\u0001",label:"Value"}]},chartRecords.map(r=>({...r,frontmatter:{...r.frontmatter,["bad\u0001"]:0}}))),/invalid XML character/);
  const words=(count:number)=>Array(count).fill("word").join(" ");
  const series=[0,1,2,3].map(i=>({property:"s"+i,label:words(7)}));
  const records=chartRecords.map(r=>({...r,frontmatter:{...r.frontmatter,s0:0,s1:.1,s2:.2,s3:.3}}));
  throws(()=>svg({...publication,title:words(12),subtitle:words(8),x_axis_label:words(8),y_axis_label:words(8),caption:words(24),series},records),/Publication layout.*height.*exceeds/);
});
test("pair membership is the actual source subtree and empty source errors name the exact reference", () => {
  throws(()=>state(pair,[]),/comparison.current: Data Ω\/June.md.*never substituted/);
  throws(()=>state(pair,pairRecords.map(r=>({...r,path:r.path.replace('Data Ω/','data ω/')}))),/outside source/);
});
test("publication rejects glyphs outside shared fallback coverage and budgets wide Latin digraphs", () => {
  for (const caption of ["Nonbreaking hyphen \u2011", "Archaic Greek \u0370", "Rare punctuation \u2027"]) throws(()=>svg({...publication,caption}),/unsupported glyph/);
  throws(()=>svg({...publication,title:"\u01c4".repeat(20)}),/unbreakable word/);
  match(svg({...publication,caption:"Latin Ǆ and Greek Ω μ; value ≤ 1."}),/Latin Ǆ/);
});
test("explicit absolute differences fail closed on numeric overflow", () => {
  throws(()=>state(pair,pairRecords.map((r,i)=>({...r,frontmatter:{...r.frontmatter,value:i?Number.MAX_VALUE:-Number.MAX_VALUE}}))),/delta exceeds the finite numeric range/);
});
