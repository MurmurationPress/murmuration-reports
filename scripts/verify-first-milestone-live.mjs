// Linux diagnostic only. Every launch uses a new disposable vault and profile.
import { spawn, execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const reports = process.cwd(),
  mwc = path.resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw Error(
    "Usage: node scripts/verify-live.mjs BUILT_MWC_TRANSITION_CHECKOUT",
  );
const root = await mkdtemp("/tmp/murmuration-reports-milestone-"),
  vault = path.join(root, "vault"),
  profile = path.join(root, "profile");
execFileSync(process.execPath, ["scripts/create-fixture.mjs", vault], {
  cwd: reports,
});
await mkdir(profile);
for (const [id, source, assets] of [
  ["murmuration-reports", reports, ["main.js", "manifest.json", "styles.css"]],
  [
    "murmuration-writing-companion",
    mwc,
    ["main.js", "manifest.json", "styles.css"],
  ],
]) {
  const dir = path.join(vault, ".obsidian/plugins", id);
  await mkdir(dir, { recursive: true });
  for (const f of assets)
    await copyFile(path.join(source, f), path.join(dir, f));
}
await writeFile(
  path.join(vault, ".obsidian/community-plugins.json"),
  JSON.stringify(["murmuration-reports"]),
);
await writeFile(
  path.join(vault, ".obsidian/workspace.json"),
  JSON.stringify({
    main: {
      id: "root",
      type: "split",
      direction: "vertical",
      children: [
        {
          id: "tabs",
          type: "tabs",
          children: [
            {
              id: "editor",
              type: "leaf",
              state: {
                type: "markdown",
                state: { file: "Definitions/Trend.md", mode: "source" },
              },
            },
          ],
        },
      ],
    },
    active: "editor",
    lastOpenFiles: ["Definitions/Trend.md"],
  }),
);
await writeFile(
  path.join(profile, "obsidian.json"),
  JSON.stringify({
    vaults: { reportsstage10001: { path: vault, ts: 1, open: true } },
  }),
);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
let ws, child;
const hash = async (p) =>
  createHash("sha256")
    .update(await readFile(path.join(vault, p)))
    .digest("hex");
const preserved = [
  "Definitions/Trend.md",
  "Definitions/State.md",
  "Data Ω/A.md",
  "Data Ω/B.md",
];
const before = await Promise.all(preserved.map(hash));
async function launch(trustPlugins = true) {
  child = spawn(
    "/opt/Obsidian/obsidian",
    [
      `--user-data-dir=${profile}`,
      "--no-sandbox",
      "--disable-gpu",
      "--remote-debugging-port=19361",
    ],
    { stdio: "ignore" },
  );
  let page;
  for (let i = 0; i < 150 && !page; i++) {
    await pause(200);
    try {
      page = (
        await (await fetch("http://127.0.0.1:19361/json/list")).json()
      ).find((p) => p.url === "app://obsidian.md/index.html");
    } catch {}
  }
  assert(page, "Obsidian page did not open");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      console.error("Native exception", JSON.stringify(m.params));
    if (pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  globalThis.send = async (method, params) => {
    const id = ++seq;
    const p = new Promise((r) => pending.set(id, r));
    ws.send(JSON.stringify({ id, method, params }));
    const m = await p;
    if (m.error) throw Error(JSON.stringify(m.error));
    return m.result;
  };
  await send("Runtime.enable", {});
  globalThis.ev = async (code) => {
    const r = await send("Runtime.evaluate", {
      expression: `(async()=>{if(!globalThis.app)return null;if(app.vault.adapter.basePath!==${JSON.stringify(vault)})throw Error('Wrong vault');${code}})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  for (let i = 0; i < 150; i++) {
    const ready = await ev(
      `const trust=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Trust author'));if(trust && ${trustPlugins} && !globalThis.reportsResearchTrusted){globalThis.reportsResearchTrusted=true;trust.click();}return !!app.workspace?.layoutReady;`,
    );
    if (ready) {
      await ev(String.raw`app.setting.close();return true;`);
      await pause(250);
      await send("Page.bringToFront", {});
      await ev(
        `app.workspace.containerEl.ownerDocument.defaultView.focus();return true;`,
      );
      await send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        button: "left",
        buttons: 1,
        clickCount: 1,
        x: 600,
        y: 200,
      });
      await send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        button: "left",
        buttons: 0,
        clickCount: 1,
        x: 600,
        y: 200,
      });
      return;
    }
    await pause(200);
  }
  throw Error("Layout not ready");
}
async function click(label) {
  for (let i = 0; i < 100; i++) {
    if (
      await ev(
        String.raw`return reportQuery('.modal button, .murmuration-reports-manager button').some(b=>b.textContent===${JSON.stringify(label)}&&!b.disabled);`,
      )
    )
      break;
    await pause(100);
  }
  const rect = await ev(
    `const b=reportQuery('.modal button, .murmuration-reports-manager button').find(b=>b.textContent===${JSON.stringify(label)});if(!b)throw Error('Button missing');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};`,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    buttons: 1,
    clickCount: 1,
    ...rect,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    buttons: 0,
    clickCount: 1,
    ...rect,
  });
  await pause(150);
}
async function waitModal(heading) {
  for (let i = 0; i < 100; i++) {
    const text = await ev(
      `return reportQuery('.modal-content').map(e=>e.textContent).join('\\n');`,
    );
    if (text?.includes(heading)) return text;
    await pause(100);
  }
  throw Error("Modal not found: " + heading);
}
async function command(id) {
  assert(
    await ev(
      String.raw`return app.commands.executeCommandById(${JSON.stringify(id)});`,
    ),
  );
}
async function open(p) {
  await ev(
    `await app.workspace.getLeaf().openFile(app.vault.getAbstractFileByPath(${JSON.stringify(p)}));return true;`,
  );
  await pause(150);
}
async function stop() {
  try {
    await ev(String.raw`setTimeout(()=>window.close(),50);return true;`);
  } catch {}
  await pause(500);
  ws?.close();
  child?.kill("SIGTERM");
  await pause(900);
}
async function waitText(text) {
  for (let i = 0; i < 100; i++) {
    if (
      await ev(
        String.raw`return reportQuery('.murmuration-reports-manager').some(e=>e.textContent.includes(${JSON.stringify(text)}));`,
      )
    )
      return;
    await pause(100);
  }
  throw Error("Manager text missing: " + text);
}
async function field(label, value) {
  await ev(
    String.raw`const el=reportQuery('.mr-field').find(e=>e.querySelector('span')?.textContent===${JSON.stringify(label)})?.querySelector('input')??reportQuery('input').find(e=>e.getAttribute('aria-label')===${JSON.stringify(label)});if(!el)throw Error('Field missing: '+${JSON.stringify(label)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));return true;`,
  );
}
async function report(path) {
  for (let i = 0; i < 100; i++) {
    if (
      await ev(
        String.raw`return reportQuery('.mr-list button').some(b=>b.dataset.report===${JSON.stringify(path)});`,
      )
    ) {
      await ev(
        String.raw`reportQuery('.mr-list button').find(b=>b.dataset.report===${JSON.stringify(path)}).click();return true;`,
      );
      await pause(250);
      return;
    }
    await pause(100);
  }
  throw Error("Report missing: " + path);
}

try {
  await launch();
  for (let i=0;i<100 && !(await ev("return !!app.murmurationReports;"));i++) await pause(100);
  await ev(String.raw`globalThis.reportQuery=selector=>{const search=root=>[...root.querySelectorAll(selector),...[...root.querySelectorAll('*')].flatMap(el=>el.shadowRoot?search(el.shadowRoot):[])];return search(app.workspace.containerEl.ownerDocument);};return true;`);
  // All runtime mutations are confined to the new marked synthetic vault.
  await ev(String.raw`
    await app.vault.createFolder('Publication data');
    for(const [name,date,value,a,b,c,d] of [
      ['May','2029-05-29',10,-.8,-.6,.8,.5],
      ['June','2029-06-30',15,.7,.5,-.5,-.8]
    ]) {
      const fm={date,value,a,b,c,d,boundary_orientation:a,completedPages:value*10,mixedProbe:name==='May'?4:'4'};for(let i=1;i<=80;i++)fm['metric'+i]=value+i;
      await app.vault.create('Publication data/'+name+'.md','---\n'+Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nSynthetic public observation.\n');
    }
    const deep={date:'2029-04-29',value:8,a:.2,b:-.1,c:.3,d:-.2,boundary_orientation:.2,completedPages:80,mixedProbe:2,deepOnly:'nested'};for(let i=1;i<=80;i++)deep['metric'+i]=8+i;
    await app.vault.createFolder('Publication data/Nested');await app.vault.create('Publication data/Nested/Deep.md','---\n'+Object.entries(deep).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nSynthetic nested observation.\n');
    const chart={world_entity:'derived-artefact',artefact_type:'line-chart',source:'Publication data',x:'date',title:'Publication assessment',subtitle:'Four synthetic series',series:['a','b','c','d'].map((property,i)=>({property,label:'Site '+String.fromCharCode(65+i),unknown:'keep'})),x_axis_label:'Observation date',y_axis_label:'Assessment',output:'Saved reports Ω/Publication.svg',custom:'keep'};
    const table={world_entity:'derived-artefact',artefact_type:'state-table',source:'Publication data',x:'date',parameters:Array.from({length:80},(_,i)=>({property:'metric'+(i+1),label:'ROW'+String(i+1).padStart(3,'0')})),output:'Saved reports Ω/Explicit.md',custom:'keep'};
    for(const [name,fm] of [['Publication',chart],['Explicit',table]])await app.vault.create('Definitions/'+name+'.md','---\n# keep author comment\n'+Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nBody remains exact.\n');
    return true;
  `);
  await pause(500);
  await command('murmuration-reports:open-reports');
  await report('Definitions/Publication.md');await click('Edit definition');
  await ev(String.raw`const el=reportQuery('select').find(e=>e.getAttribute('aria-label')==='Chart presentation');el.value='publication';el.dispatchEvent(new Event('change',{bubbles:true}));return true;`);
  await field('Fixed Y minimum (both or neither)','-1');await field('Fixed Y maximum (both or neither)','1');
  await field('Caption (plain text, up to 240 characters)','Signed assessments from minus one to plus one. Values are not probabilities.');
  await click('Save and generate');await waitText('saved output verified');await click('Back to saved output');await waitText('Saved output available');
  assert(await ev(String.raw`const el=reportQuery('.mr-preview img')[0];return !!el && el.complete && el.naturalWidth===960;`));
  const generated=await readFile(path.join(vault,'Saved reports Ω/Publication.svg'),'utf8');
  for(const identity of ['solid/circle','dashed/square','dotted/triangle','dash-dot/diamond'])assert(generated.includes(identity));
  assert(generated.includes('Y range -1 to 1'));assert(generated.includes('Values are not probabilities.'));
  const chartDefinition=await readFile(path.join(vault,'Definitions/Publication.md'),'utf8');assert(chartDefinition.includes('# keep author comment'));assert(chartDefinition.includes('"unknown":"keep"'));assert(chartDefinition.endsWith('Body remains exact.\n'));
  checks.push('native manager publication opt-in, fixed bounds, caption and four identities; saved preview; comments/body/unknown fields retained');
  await report('Definitions/Explicit.md');await click('Edit definition');
  await ev(String.raw`const el=reportQuery('select').find(e=>e.getAttribute('aria-label')==='Comparison selection');el.value='explicit-pair';el.dispatchEvent(new Event('change',{bubbles:true}));return true;`);
  await field('Current observation path','Publication data/June.md');await field('Previous observation path','Publication data/May.md');
  await click('Save and generate');await waitText('saved output verified');await click('Back to saved output');await waitText('Saved output available');
  assert(await ev(String.raw`return reportQuery('.mr-preview tbody tr').length===80 && reportQuery('.mr-preview th').some(e=>e.textContent==='previous (2029-05-29)') && reportQuery('.mr-preview p').some(e=>e.textContent.includes('Publication data/May.md'));`));
  const savedTable=await hash('Saved reports Ω/Explicit.md'),savedReceipt=await hash('Saved reports Ω/Explicit.md.murmuration-report.json');
  const sourcesBefore=await Promise.all(['May','June'].map(name=>hash('Publication data/'+name+'.md')));
  await ev(String.raw`const fm={date:'2029-06-15',value:12,a:-.3,b:.1,c:.4,d:.2,boundary_orientation:-.3,completedPages:120};for(let i=1;i<=80;i++)fm['metric'+i]=12+i;await app.vault.create('Publication data/Middle.md','---\n'+Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nSynthetic inserted observation.\n');return true;`);
  assert.equal((await ev(String.raw`return await app.murmurationReports.generateDefinition('Definitions/Explicit.md');`)).status,'unchanged');
  assert.equal(await hash('Saved reports Ω/Explicit.md'),savedTable);
  await ev(String.raw`await app.vault.rename(app.vault.getAbstractFileByPath('Publication data/May.md'),'Publication data/Renamed.md');return true;`);
  const missing=await ev(String.raw`return await app.murmurationReports.generateDefinition('Definitions/Explicit.md');`);assert.equal(missing.status,'failed');assert(missing.message.includes('never substituted'));
  assert.equal(await hash('Saved reports Ω/Explicit.md'),savedTable);assert.equal(await hash('Saved reports Ω/Explicit.md.murmuration-report.json'),savedReceipt);
  await ev(String.raw`await app.vault.rename(app.vault.getAbstractFileByPath('Publication data/Renamed.md'),'Publication data/May.md');return true;`);
  assert.deepEqual(await Promise.all(['May','June'].map(name=>hash('Publication data/'+name+'.md'))),sourcesBefore);
  checks.push('native explicit-pair manager controls, 80 rows/provenance preview, intermediate insertion unchanged, renamed reference fails without asset/receipt writes');
  // Regenerate chart explicitly to include the intermediate observation, keeping a backup.
  const regeneration=await ev(String.raw`return await app.murmurationReports.generateDefinition('Definitions/Publication.md');`);assert.equal(regeneration.status,'replaced');assert(regeneration.recoveryPaths.length>0);
  let chartHash=await hash('Saved reports Ω/Publication.svg');
  if(process.env.REPORTS_CHART_USABILITY==='1'){
    const v2={world_entity:'derived-artefact',artefact_type:'line-chart',source:'Publication data',x:'date',title:'Synthetic chart usability',presentation:'publication-v2',x_axis_label:'Observation Date',y_axis_label:'Boundary Orientation',y_axis_unit:'score',y_axis:{minimum:-1,maximum:1,ticks:{step:.5}},caption:'Synthetic values from two dated observations.',description:'Four measures at two dates.',series:['a','b','c','d'].map((property,i)=>({property,label:i?'Measure '+String.fromCharCode(65+i):''})),output:'Saved reports Ω/PublicationV2.svg',custom:'preserved'};
    const paired={...v2,title:'Synthetic paired-bound compatibility',output:'Saved reports Ω/PublicationV2Paired.svg',series:v2.series.map(s=>({...s})),y_min:-1,y_max:1};delete paired.y_axis;
    await ev(String.raw`const fm=${JSON.stringify(paired)};await app.vault.create('Definitions/PublicationV2Paired.md','---\n'+Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nSynthetic paired bounds definition.\n');return true;`);
    await pause(300);await command('murmuration-reports:open-reports');await report('Definitions/PublicationV2Paired.md');await click('Edit definition');
    assert(await ev(String.raw`const text=reportQuery('.mr-editor-group').map(e=>e.textContent).join('\n');return text.includes('compatible paired y_min/y_max bounds')&&!reportQuery('.mr-editor-group select').some(e=>e.getAttribute('aria-label')==='Y tick policy');`),'paired y_min/y_max compatibility was not surfaced in the editor');
    await click('Save and generate');await waitText('saved output verified');
    const pairedDefinition=await readFile(path.join(vault,'Definitions/PublicationV2Paired.md'),'utf8');assert(pairedDefinition.includes('y_min: -1'));assert(pairedDefinition.includes('y_max: 1'));assert(!pairedDefinition.includes('y_axis:'));
    checks.push('native v2 editor preserves paired y_min/y_max and requires deliberate source-note removal before independent policy controls appear');
    await ev(String.raw`const fm=${JSON.stringify(v2)};await app.vault.create('Definitions/PublicationV2.md','---\n# usability comment\n'+Object.entries(fm).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\nSynthetic usability definition body.\n');return true;`);
    await pause(300);await command('murmuration-reports:open-reports');await report('Definitions/PublicationV2.md');await click('Edit definition');
    assert(await ev(String.raw`const legends=[...reportQuery('.mr-editor-group legend')].map(e=>e.textContent);return legends.some(x=>x.startsWith('Data'))&&legends.includes('Axes')&&legends.includes('Appearance')&&legends.includes('Publication')&&legends.includes('Output and definition');`),'grouped editor fields missing');
    assert(await ev(String.raw`return [...reportQuery('.mr-editor-group select')].every(s=>s.closest('label')?.textContent.includes(s.getAttribute('aria-label')));`),'grouped editor selects lack visible labels');
    await click('Discover dataset properties');await waitText('A — a');await waitText('Metric1 — metric1');await waitText('Deep Only — deepOnly');
    assert(await ev(String.raw`const status=reportQuery('.mr-editor-group [role=status]')[0]?.textContent??'';const lists=[...reportQuery('.mr-editor-group datalist')];return status.includes('Mixed Probe — mixedProbe: number / string')&&status.includes('1 missing')&&lists.every(list=>list.id!==reportQuery('input[aria-label^="Y series property"]')[0]?.list.id||![...list.options].some(o=>o.value==='mixedProbe'));`),'mixed/incompatible property was misreported or offered as a numeric series');
    assert.equal(await ev(String.raw`const p=reportQuery('input[aria-label="Y series property 1"]')[0],l=reportQuery('input[aria-label="Series label 1"]')[0];p.value='completedPages';p.dispatchEvent(new Event('input',{bubbles:true}));return l.value;`),'Completed Pages');
    assert.equal(await ev(String.raw`const p=reportQuery('input[aria-label="Y series property 1"]')[0],l=reportQuery('input[aria-label="Series label 1"]')[0];l.value='Custom score';l.dispatchEvent(new Event('input',{bubbles:true}));p.value='boundary_orientation';p.dispatchEvent(new Event('input',{bubbles:true}));return l.value;`),'Custom score');
    await field('Y tick step','0');await click('Save and generate');await waitText('positive finite step');assert(await ev(String.raw`const e=reportQuery('.mr-editor-group label').find(x=>x.textContent.includes('Y tick step'))?.querySelector('input');return !!e&&e.getAttribute('aria-invalid')==='true'&&document.activeElement===e;`),'invalid tick error did not expose/focus its field');
    await field('Y tick step','0.5');
    await click('Save and generate');await waitText('saved output verified');
    const v2Svg=await readFile(path.join(vault,'Saved reports Ω/PublicationV2.svg'),'utf8');
    for(const expected of ['Y range -1 to 1','data-axis-title="x"','data-axis-title="y"','>Boundary</','>Orientation</','>(score)</','>Observation</','>Date</','Custom score','Synthetic values from two dated observations.','solid/circle','dashed/square','dotted/triangle','dash-dot/diamond'])assert(v2Svg.includes(expected),`v2 SVG missing ${expected}`);
    const v2Definition=await readFile(path.join(vault,'Definitions/PublicationV2.md'),'utf8');assert(v2Definition.includes('# usability comment'));assert(v2Definition.includes('custom: "preserved"'));assert(v2Definition.endsWith('Synthetic usability definition body.\n'));
    await copyFile(path.join(vault,'Saved reports Ω/PublicationV2.svg'),path.join(vault,'Saved reports Ω/Publication.svg'));chartHash=await hash('Saved reports Ω/Publication.svg');
    checks.push('native grouped editor fieldsets and visible labels; recursive property discovery; v2 SVG/titles/units/caption/series identity; comments/body/unknown fields retained');
  }
  // Native persisted embeds, with both plugins disabled/absent and no receipt dependency.
  await ev(String.raw`
    await app.vault.create('Publication book.md','---\ntype: book\ntitle: Generated publication reports\n---\n');
    await app.vault.create('Publication view.md','# Feature-generated persistent reports\n\n![[Saved reports Ω/Publication.svg]]\n\n![[Saved reports Ω/Explicit.md]]\n');
    await app.plugins.disablePluginAndSave('murmuration-reports');return true;
  `);
  assert.equal(await ev('return !!app.murmurationReports;'),false);
  assert.equal(await ev("return !!app.plugins.plugins['murmuration-writing-companion'];"),false);
  await open('Publication view.md');
  await ev(String.raw`await app.workspace.getMostRecentLeaf().setViewState({type:'markdown',state:{file:'Publication view.md',mode:'preview'}});return true;`);await pause(700);
  assert(await ev(String.raw`return [...document.querySelectorAll('img')].some(i=>i.complete&&i.naturalWidth===960) && [...document.querySelectorAll('table')].some(t=>t.textContent.includes('ROW080'));`));
  assert.equal(await hash('Saved reports Ω/Publication.svg'),chartHash);assert.equal(await hash('Saved reports Ω/Explicit.md'),savedTable);
  checks.push('native disabled-plugin SVG and Markdown transclusion retain generated bytes and all 80 rows');
  let persistedDisabled=false;
  for(let i=0;i<50;i++){const config=JSON.parse(await readFile(path.join(vault,'.obsidian/community-plugins.json'),'utf8'));if(!config.includes('murmuration-reports')){persistedDisabled=true;break;}await pause(100);}
  assert(persistedDisabled,'Obsidian did not persist disabled plugins before restart');
  await stop();await launch(false);await open('Publication view.md');
  await ev(String.raw`await app.workspace.getMostRecentLeaf().setViewState({type:'markdown',state:{file:'Publication view.md',mode:'preview'}});return true;`);await pause(800);
  assert.equal(await ev('return !!app.murmurationReports;'),false);
  assert(await ev(String.raw`return [...document.querySelectorAll('img')].some(i=>i.complete&&i.naturalWidth===960) && [...document.querySelectorAll('table')].some(t=>t.textContent.includes('ROW080'));`));
  checks.push('disabled restart reopens persisted generated SVG and table without Reports/MWC');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(root,'disabled-embeds.png'),Buffer.from(screenshot.data,'base64'));
  const environment=await ev('return navigator.userAgent;');const bundles={reports:createHash('sha256').update(await readFile(path.join(reports,'main.js'))).digest('hex')};
  await writeFile(path.join(root,'evidence.json'),JSON.stringify({checks,environment,bundles,root,generatedAssets:['Saved reports Ω/Publication.svg','Saved reports Ω/Explicit.md']},null,2));
  console.log(JSON.stringify({checks,environment,bundles,root},null,2));

} catch (error) {
  try {
    await writeFile(
      path.join(root, "failure.json"),
      JSON.stringify(
        {
          checks,
          error: String(error),
          state: await ev(
            `const view=app.workspace.getLeavesOfType('murmuration-reports-manager')[0]?.view;return {view:view?{keys:Object.keys(view),content:!!view.contentEl,open:String(view.onOpen),constructor:view.constructor.name,html:view.containerEl?.outerHTML}:null,body:document.body.textContent,command:String(app.commands.commands['murmuration-reports:generate-derived-artefact']?.callback),active:app.workspace.getActiveFile()?.path,plugins:Object.keys(app.plugins.plugins)};`,
          ),
        },
        null,
        2,
      ),
    );
    console.error("Retained live failure evidence at", root);
  } catch {}
  throw error;
} finally {
  await stop();
}
