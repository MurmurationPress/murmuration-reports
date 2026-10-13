// Linux diagnostic only. Every launch uses a new disposable vault and profile.
import { spawn, execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  copyFile,
  cp,
  stat,
} from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const reports = process.cwd(),
  codex = path.resolve(process.argv[2] ?? ""), native = path.resolve(process.argv[3] ?? "");
if (!process.argv[2] || !process.argv[3]) throw Error("Usage: CODEX_CHECKOUT MARKED_NATIVE_VAULT");
if (execFileSync('git',['rev-parse','HEAD'],{cwd:codex,encoding:'utf8'}).trim() !== '394cf109f035194b440e3b37d75de06e49fe074d') throw Error('Wrong compiler commit');
if (!(await readFile(path.join(native,'.murmuration-reports-fixture'),'utf8')).includes('Disposable synthetic')) throw Error('Only marked disposable input is accepted');
const root = await mkdtemp("/tmp/murmuration-reports-publishing-ui-"),
  vault = path.join(root, "vault"),
  profile = path.join(root, "profile");
execFileSync(process.execPath, ["scripts/create-fixture.mjs", vault], {
  cwd: reports,
});
await mkdir(profile);
for(const dir of ['Publication data','Definitions','Saved reports Ω']) await cp(path.join(native,dir),path.join(vault,dir),{recursive:true});
const pluginDirectory=path.join(vault,'.obsidian/plugins/codex-press');await mkdir(pluginDirectory,{recursive:true});
for(const file of ['main.js','manifest.json','styles.css'])await copyFile(path.join(codex,file),path.join(pluginDirectory,file));
await writeFile(
  path.join(vault, ".obsidian/community-plugins.json"),
  JSON.stringify(["codex-press"]),
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
      "--remote-debugging-port=19363",
    ],
    { stdio: "ignore" },
  );
  let page;
  for (let i = 0; i < 150 && !page; i++) {
    await pause(200);
    try {
      page = (
        await (await fetch("http://127.0.0.1:19363/json/list")).json()
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
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") console.error("Native console error",JSON.stringify(m.params.args));
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
 for(let i=0;i<100 && !(await ev("return !!app.plugins.plugins['codex-press'];"));i++)await pause(100);
 await ev(String.raw`globalThis.reportQuery=selector=>{const search=root=>[...root.querySelectorAll(selector),...[...root.querySelectorAll('*')].flatMap(el=>el.shadowRoot?search(el.shadowRoot):[])];return search(app.workspace.containerEl.ownerDocument);};const plugin=app.plugins.plugins['codex-press'];plugin.settings.svgConverterPath='/tmp/reports-rsvg-reference';plugin.settings.epubValidatorCommand='epubcheck';plugin.settings.epubValidatorArgs='';plugin.settings.outputFolder='Native Output';plugin.settings.keepPdfWorkingFiles=true;plugin.settings.keepEpubWorkingFiles=true;await plugin.saveSettings();return true;`);
 assert.equal(await ev("return !!app.murmurationReports || !!app.plugins.plugins['murmuration-writing-companion'];"),false);
 const savedHashes=await Promise.all(['Saved reports Ω/Publication.svg','Saved reports Ω/Explicit.md'].map(hash));
 await ev(String.raw`
   await app.vault.createFolder('Publication book');
   await app.vault.create('Publication book.md','---\ntype: book\ntitle: Native publishing reports\nauthor: Synthetic fixture\nlang: en-GB\n---\n');
   await app.vault.create('Publication book/Generated.md','---\ntype: scene\nparent: "[[Publication book]]"\nmanuscript_order_key: I000000000\n---\n# Feature-generated saved reports\n\n![Generated four-series assessment — synthetic fixture](<Saved reports Ω/Publication.svg>){width=4.1in}\n\n![[Saved reports Ω/Explicit.md]]\n');return true;
 `);
 let metadataReady=false;
 for(let i=0;i<200;i++){
  if(await ev(String.raw`const f=app.vault.getAbstractFileByPath('Publication book.md'),scene=app.vault.getAbstractFileByPath('Publication book/Generated.md');return app.metadataCache.getFileCache(f)?.frontmatter?.type==='book' && app.metadataCache.getFileCache(scene)?.frontmatter?.manuscript_order_key==='I000000000';`)){metadataReady=true;break;}
  await pause(100);
 }
 assert(metadataReady,'Native publishing metadata did not resolve');await open('Publication book/Generated.md');
 const setOption=async(label,value)=>ev(`const s=reportQuery('.modal .setting-item').find(e=>e.querySelector('.setting-item-name')?.textContent===${JSON.stringify(label)})?.querySelector('select');if(!s)throw Error('Missing compiler setting');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));return true;`);
 for(const format of ['pdf','epub']){
  await command('codex-press:compile-book');await pause(300);await waitModal('Native publishing reports');await click('Choose output');await waitModal('Choose output');
  await setOption('Output',format);await setOption('Mode','publish');
  if(format==='pdf'){await setOption('PDF layout','kdp_6x9');await setOption('PDF target','kdp');}
  await click('Review compile');await waitModal('Review compile');
  const summary=await ev("return reportQuery('.modal-content')[0].textContent;");assert(!summary.includes('ERROR:'));
  await click('Confirm');
  const expected=format==='pdf'?'Native Output/Native publishing reports - Publish KDP.pdf':'Native Output/Native publishing reports - Publish.epub';
  let created=false;for(let i=0;i<600;i++){if(await stat(path.join(vault,expected)).catch(()=>null)){created=true;break;}await pause(100);}
  assert(created,format+' UI compile did not publish');
  checks.push('native Codex Press '+format.toUpperCase()+' command: actual project discovery/assembly, options/preflight/confirm and publication with Reports/MWC absent');
 }
 assert.deepEqual(await Promise.all(['Saved reports Ω/Publication.svg','Saved reports Ω/Explicit.md'].map(hash)),savedHashes);
 const pdfPath=path.join(vault,'Native Output/Native publishing reports - Publish KDP.pdf');const text=execFileSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});
 for(let i=1;i<=80;i++)assert.equal((text.match(new RegExp('ROW'+String(i).padStart(3,'0'),'g'))||[]).length,1);
 assert.equal((text.match(/\+5\.00/g)||[]).length,80);
 checks.push('native compiler PDF preserves all 80 generated rows/deltas and input assets unchanged');
 const evidence={checks,root,compilerCommit:'394cf109f035194b440e3b37d75de06e49fe074d',compilerBundleSha256:createHash('sha256').update(await readFile(path.join(codex,'main.js'))).digest('hex'),sourceAssetSha256:savedHashes,pdf:'Native Output/Native publishing reports - Publish KDP.pdf',epub:'Native Output/Native publishing reports - Publish.epub',environment:await ev('return navigator.userAgent;')};
 await writeFile(path.join(root,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));

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
