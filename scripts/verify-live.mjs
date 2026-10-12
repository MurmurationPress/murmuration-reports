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
const root = await mkdtemp("/tmp/murmuration-reports-live-"),
  vault = path.join(root, "vault"),
  profile = path.join(root, "profile");
execFileSync(process.execPath, ["scripts/create-fixture.mjs", vault], {
  cwd: reports,
});
await mkdir(profile);
for (const [id, source, assets] of [
  ["murmuration-reports", reports, ["main.js", "manifest.json"]],
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
async function launch() {
  child = spawn(
    "/opt/Obsidian/obsidian",
    [
      `--user-data-dir=${profile}`,
      "--no-sandbox",
      "--disable-gpu",
      "--remote-debugging-port=19359",
    ],
    { stdio: "ignore" },
  );
  let page;
  for (let i = 0; i < 150 && !page; i++) {
    await pause(200);
    try {
      page = (
        await (await fetch("http://127.0.0.1:19359/json/list")).json()
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
      `const trust=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Trust author'));if(trust)trust.click();return app.workspace.layoutReady;`,
    );
    if (ready) {
      await ev(`app.setting.close();return true;`);
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
  const rect = await ev(
    `const b=reportQuery('.modal button').find(b=>b.textContent===${JSON.stringify(label)});if(!b)throw Error('Button missing');const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};`,
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
    await ev(`return app.commands.executeCommandById(${JSON.stringify(id)});`),
  );
}
async function open(p) {
  await ev(
    `await app.workspace.getLeaf().openFile(app.vault.getAbstractFileByPath(${JSON.stringify(p)}));return true;`,
  );
  await pause(150);
}
async function stop() {
  try { await ev(`setTimeout(()=>window.close(),50);return true;`); } catch {}
  await pause(500);
  ws?.close();
  child?.kill("SIGTERM");
  await pause(900);
}
try {
  await launch();
  for (
    let i = 0;
    i < 100 && !(await ev("return !!app.murmurationReports;"));
    i++
  )
    await pause(100);
  assert(await ev("return app.murmurationReports?.version===1;"));
  await ev(
    `globalThis.reportQuery=selector=>{const search=root=>[...root.querySelectorAll(selector),...[...root.querySelectorAll('*')].flatMap(el=>el.shadowRoot?search(el.shadowRoot):[])];return search(app.workspace.containerEl.ownerDocument);};return true;`,
  );
  const assetBefore = await hash("Saved reports Ω/Trend.svg");
  await pause(500);
  assert.equal(await hash("Saved reports Ω/Trend.svg"), assetBefore);
  checks.push("Reports-only startup performs no regeneration");
  await open("Definitions/Trend.md");
  await command("murmuration-reports:generate-derived-artefact");
  assert((await waitModal("Report generation results")).includes("unchanged"));
  await click("Close");
  checks.push("standalone active command and structured result");
  await ev(
    `await app.vault.delete(app.vault.getAbstractFileByPath('Saved reports Ω/Trend.svg.murmuration-report.json'));await app.vault.modify(app.vault.getAbstractFileByPath('Saved reports Ω/Trend.svg'),'<svg><text>Legacy fixture</text></svg>');return true;`,
  );
  await command("murmuration-reports:adopt-report-output");
  await waitModal("Adopt output and generate");
  await click("Cancel");
  assert.equal(
    await readFile(path.join(vault, "Saved reports Ω/Trend.svg"), "utf8"),
    "<svg><text>Legacy fixture</text></svg>",
  );
  checks.push("native adoption Cancel preserves legacy output");
  await command("murmuration-reports:adopt-report-output");
  await waitModal("Adopt output and generate");
  await ev(
    `await app.vault.modify(app.vault.getAbstractFileByPath('Saved reports Ω/Trend.svg'),'<svg><text>Concurrent fixture</text></svg>');return true;`,
  );
  await click("Adopt and generate");
  assert((await waitModal("Report generation results")).includes("blocked"));
  await click("Close");
  checks.push("concurrent change expires native adoption consent");
  await command("murmuration-reports:adopt-report-output");
  await waitModal("Adopt output and generate");
  await click("Adopt and generate");
  assert((await waitModal("Report generation results")).includes("replaced"));
  await click("Close");
  assert.equal(await hash("Saved reports Ω/Trend.svg"), assetBefore);
  checks.push(
    "native adoption regenerates byte-compatible SVG with receipt and recovery",
  );
  await ev(
    `await app.plugins.enablePluginAndSave('murmuration-writing-companion');return true;`,
  );
  await pause(1000);
  await command("murmuration-writing-companion:generate-derived-artefact");
  await waitModal("Report generation results");
  await click("Close");
  checks.push("Reports-first then MWC bridge");
  await ev(
    `await app.plugins.disablePluginAndSave('murmuration-reports');return true;`,
  );
  assert.equal(await ev("return !!app.murmurationReports;"), false);
  await command("murmuration-writing-companion:generate-derived-artefact");
  await pause(200);
  assert(
    await ev(
      `return document.body.textContent.includes('Enable Murmuration Reports');`,
    ),
  );
  checks.push("MWC-only unavailable capability notice");
  await ev(
    `await app.plugins.enablePluginAndSave('murmuration-reports');return true;`,
  );
  assert(await ev("return app.murmurationReports?.version===1;"));
  await command("murmuration-writing-companion:generate-all-derived-artefacts");
  await waitModal("Report generation results");
  await click("Close");
  checks.push("MWC-first then Reports re-enable and batch bridge");
  const tableBefore=await hash('Saved reports Ω/State.md');
  const tableReceiptBefore=await hash('Saved reports Ω/State.md.murmuration-report.json');
  await ev(`await app.fileManager.renameFile(app.vault.getAbstractFileByPath('Definitions/State.md'),'Definitions/Moved State.md');return true;`);
  await pause(400);
  assert.equal(await hash('Saved reports Ω/State.md'),tableBefore);
  assert.equal(await hash('Saved reports Ω/State.md.murmuration-report.json'),tableReceiptBefore);
  await open('Definitions/Moved State.md');
  await command('murmuration-reports:generate-derived-artefact');
  assert((await waitModal('Report generation results')).includes('blocked'));await click('Close');
  await command('murmuration-reports:adopt-report-output');await waitModal('Adopt output and generate');await click('Adopt and generate');
  assert((await waitModal('Report generation results')).includes('replaced'));await click('Close');
  checks.push('observed definition move preserves assets until explicit path repair');
  await ev(`await app.plugins.disablePluginAndSave('murmuration-reports');await app.fileManager.renameFile(app.vault.getAbstractFileByPath('Definitions/Moved State.md'),'Definitions/State.md');return true;`);
  await pause(300);
  assert.notEqual(await hash('Saved reports Ω/State.md'),tableBefore);
  await ev(`await app.plugins.enablePluginAndSave('murmuration-reports');return true;`);
  await open('Definitions/State.md');await command('murmuration-reports:generate-derived-artefact');
  assert((await waitModal('Report generation results')).includes('blocked'));await click('Close');
  await command('murmuration-reports:adopt-report-output');await waitModal('Adopt output and generate');await click('Adopt and generate');
  assert((await waitModal('Report generation results')).includes('replaced'));await click('Close');
  assert.equal(await hash('Saved reports Ω/State.md'),tableBefore);
  checks.push('move while disabled is discovered on re-enable without guessing ownership');
  await ev(
    `await app.plugins.disablePluginAndSave('murmuration-reports');await app.plugins.disablePluginAndSave('murmuration-writing-companion');return true;`,
  );
  assert.equal(await ev("return !!app.murmurationReports;"), false);
  await open("Book/Report.md");
  await ev(
    `await app.workspace.getMostRecentLeaf().setViewState({type:'markdown',state:{file:'Book/Report.md',mode:'preview'}});return true;`,
  );
  await pause(700);
  assert(
    await ev(
      `return !!document.querySelector('.markdown-preview-view img')&&document.querySelector('.markdown-preview-view')?.textContent.includes('Measured value');`,
    ),
  );
  checks.push("both plugins disabled: native SVG/table embeds render");
  let savedDisabled=false;
  for(let i=0;i<50;i++){
    try {savedDisabled=JSON.parse(await readFile(path.join(vault,'.obsidian/community-plugins.json'),'utf8')).length===0;}catch{}
    if(savedDisabled)break;await pause(100);
  }
  assert(savedDisabled,'Obsidian did not persist both plugins disabled before restart');
  await stop();
  await launch();
  assert.equal(await ev("return !!app.murmurationReports;"), false);
  assert.deepEqual(await Promise.all(preserved.map(hash)), before);
  await pause(500);
  assert.equal(await hash("Saved reports Ω/Trend.svg"), assetBefore);
  checks.push("disabled restart preserves sources and assets");
  const environment = await ev("return navigator.userAgent;");
  const bundles={reports:createHash('sha256').update(await readFile(path.join(reports,'main.js'))).digest('hex'),mwc:createHash('sha256').update(await readFile(path.join(mwc,'main.js'))).digest('hex')};
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify({ checks, environment, bundles, root }, null, 2),
  );
  console.log(JSON.stringify({ checks, environment, bundles, root }, null, 2));
} catch (error) {
  try {
    await writeFile(
      path.join(root, "failure.json"),
      JSON.stringify(
        {
          checks,
          error: String(error),
          state: await ev(
            `return {body:document.body.textContent,command:String(app.commands.commands['murmuration-reports:generate-derived-artefact']?.callback),active:app.workspace.getActiveFile()?.path,plugins:Object.keys(app.plugins.plugins)};`,
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
