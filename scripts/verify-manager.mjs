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
const root = await mkdtemp("/tmp/murmuration-reports-manager-"),
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
      `const trust=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Trust author'));if(trust)trust.click();return !!app.workspace?.layoutReady;`,
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
  for (
    let i = 0;
    i < 100 && !(await ev("return !!app.murmurationReports;"));
    i++
  )
    await pause(100);
  await ev(
    String.raw`globalThis.reportQuery=selector=>{const search=root=>[...root.querySelectorAll(selector),...[...root.querySelectorAll('*')].flatMap(el=>el.shadowRoot?search(el.shadowRoot):[])];return search(app.workspace.containerEl.ownerDocument);};return true;`,
  );
  const actualSources = await ev(
    String.raw`return app.vault.getMarkdownFiles().filter(f=>f.path.startsWith('Data Ω/')).map(f=>f.path);`,
  );
  const sourcesBefore = await Promise.all(actualSources.map(hash));
  const originalChart = await hash("Saved reports Ω/Trend.svg");
  await ev(
    String.raw`app.commands.executeCommandById('murmuration-reports:open-reports');app.commands.executeCommandById('murmuration-reports:open-reports');return true;`,
  );
  await waitText("Reports");
  await command("murmuration-reports:open-reports");
  assert.equal(
    await ev(
      String.raw`return app.workspace.getLeavesOfType('murmuration-reports-manager').length;`,
    ),
    1,
  );
  await report("Definitions/Trend.md");
  await waitText("Saved output available");
  assert(
    await ev(String.raw`return reportQuery('.mr-preview img').length===1;`),
  );
  assert.equal(await hash("Saved reports Ω/Trend.svg"), originalChart);
  checks.push(
    "reusable populated tab and saved image preview never regenerate",
  );
  await report("Definitions/State.md");
  await waitText("Saved output available");
  assert(
    await ev(String.raw`return reportQuery('.mr-preview table').length===1;`),
  );
  checks.push("static table preview without Markdown processors");
  await ev(
    String.raw`globalThis.definitionOriginals={};for(const path of ['Definitions/Trend.md','Definitions/State.md']){const f=app.vault.getAbstractFileByPath(path);definitionOriginals[path]=await app.vault.read(f);await app.vault.modify(f,definitionOriginals[path].replace('derived-artefact','fixture-disabled'));}return true;`,
  );
  await waitText("No reports yet.");
  checks.push("ordinary empty state and create action");
  await ev(
    String.raw`for(const [path,raw]of Object.entries(definitionOriginals))await app.vault.modify(app.vault.getAbstractFileByPath(path),raw);return true;`,
  );
  await pause(250);
  await click("Create report");
  await field("Name / title", "Manager chart Ω");
  await field("Dataset folder", "Data Ω");
  await field("Numeric property 1", "value");
  await field("Label 1", "Measured value");
  await field("Start date (optional)", "2029-01-01");
  await field("End date (optional)", "2029-02-01");
  await field("Window (optional, e.g. 12 months)", "1 year");
  await field("X axis label (optional)", "Observation day");
  await field("Y axis label (optional)", "Measured units");
  await click("Suggest dataset properties");
  await waitText("Suggestions from");
  await click("Save definition");
  await waitText("Definition saved. No output was generated.");
  assert.equal(
    await ev(
      String.raw`return !!app.vault.getAbstractFileByPath('Reports/Outputs/Manager chart Ω.svg');`,
    ),
    false,
  );
  checks.push(
    "guided chart save-only writes definition, not observations or outputs",
  );
  await click("Save and generate");
  await waitText("created:");
  assert(
    await ev(
      String.raw`return !!app.vault.getAbstractFileByPath('Reports/Outputs/Manager chart Ω.svg');`,
    ),
  );
  await click("Back to saved output");
  await waitText("Saved output available");
  await click("Open definition");
  assert.equal(
    await ev(String.raw`return app.workspace.getActiveFile()?.path;`),
    "Reports/Definitions/Manager chart Ω.md",
  );
  await command("murmuration-reports:open-reports");
  await click("Open output");
  assert.equal(
    await ev(String.raw`return app.workspace.getActiveFile()?.path;`),
    "Reports/Outputs/Manager chart Ω.svg",
  );
  await command("murmuration-reports:open-reports");
  await click("Open dataset folder");
  await command("murmuration-reports:open-reports");
  checks.push(
    "chart explicit generation and definition/output/folder navigation",
  );
  await ev(
    String.raw`const f=app.vault.getAbstractFileByPath('Reports/Definitions/Manager chart Ω.md');await app.vault.modify(f,(await app.vault.read(f)).replace('title:','custom: {unit: kg} # preserve unknown\n# author comment\ntitle:')+'\n# unrelated body\n');return true;`,
  );
  await pause(300);
  await click("Edit definition");
  await field("Subtitle (optional)", "Draft subtitle");
  await ev(
    String.raw`const f=app.vault.getAbstractFileByPath('Reports/Definitions/Manager chart Ω.md');await app.vault.modify(f,(await app.vault.read(f)).replace('custom: {unit: kg}','custom: {unit: g}'));return true;`,
  );
  await pause(200);
  await click("Save definition");
  await waitText("Your draft is retained");
  assert.equal(
    await ev(
      String.raw`return reportQuery('.mr-field').find(e=>e.textContent.includes('Subtitle'))?.querySelector('input').value;`,
    ),
    "Draft subtitle",
  );
  await click("Reconcile with latest");
  await click("Save definition");
  await waitText("Definition saved.");
  assert(
    await ev(
      String.raw`const raw=await app.vault.read(app.vault.getAbstractFileByPath('Reports/Definitions/Manager chart Ω.md'));return raw.includes('custom: {unit: g} # preserve unknown')&&raw.includes('# author comment')&&raw.includes('# unrelated body')&&raw.includes('Draft subtitle');`,
    ),
  );
  checks.push(
    "external edit preserves draft; explicit reconciliation preserves comments, unknowns and body",
  );
  await field("Subtitle (optional)", "Moved draft");
  await ev(
    String.raw`await app.vault.rename(app.vault.getAbstractFileByPath('Reports/Definitions/Manager chart Ω.md'),'Reports/Definitions/Moved chart Ω.md');return true;`,
  );
  await pause(250);
  await click("Save definition");
  await waitText("draft remains bound to its old path");
  await click("Reconcile with latest");
  await click("Save definition");
  await waitText("Definition saved.");
  await click("Back to saved output");
  await waitText("Explicit ownership repair");
  await click("Generate");
  await waitText("blocked");
  await click("Inspect adoption / repair");
  await waitModal("Adopt output and generate");
  await click("Adopt and generate");
  await waitText("Saved output available");
  checks.push(
    "rename while editing retains draft and requires explicit former-path repair",
  );
  await click("Create report");
  await ev(
    String.raw`const s=reportQuery('select').find(s=>s.getAttribute('aria-label')==='Report type'&&!s.disabled&&s.closest('form'));s.value='state-table';s.dispatchEvent(new Event('change',{bubbles:true}));return true;`,
  );
  await field("Name / title", "Manager state Ω");
  await field("Endpoint (optional)", "2029-02-01");
  await field("Dataset folder", "Data Ω");
  await field("Numeric property 1", "value");
  await field("Label 1", "Measured value");
  await click("Save and generate");
  await waitText("created:");
  await click("Back to saved output");
  await waitText("Saved output available");
  assert(
    await ev(String.raw`return reportQuery('.mr-preview table').length===1;`),
  );
  await click("Edit definition");
  await field("Label 1", "Saved label");
  await click("Save and generate");
  await waitText("replaced:");
  await click("Back to saved output");
  await waitText("Saved label");
  checks.push("guided state-table creation, editing and explicit regeneration");
  await ev(
    String.raw`const f=app.vault.getAbstractFileByPath('Reports/Outputs/Manager state Ω.md');await app.vault.modify(f,(await app.vault.read(f))+'External edit\n');return true;`,
  );
  const altered = await hash("Reports/Outputs/Manager state Ω.md");
  await pause(150);
  await click("Generate");
  await waitText("failed");
  assert.equal(await hash("Reports/Outputs/Manager state Ω.md"), altered);
  await click("Generate all");
  await waitText("Generation results (this session)");
  assert.equal(await hash("Reports/Outputs/Manager state Ω.md"), altered);
  checks.push(
    "individual and batch failure retain externally changed assets and persistent outcomes",
  );
  await ev(
    String.raw`await app.vault.create('Definitions/Invalid.md','---\nworld_entity: derived-artefact\nartefact_type: line-chart\ntitle: Invalid report\nsource: Missing dataset\noutput: Outputs/Invalid.svg\n---\n');return true;`,
  );
  await pause(300);
  await report("Definitions/Invalid.md");
  await waitText("Invalid definition");
  await click("Edit definition");
  await field("Date property", "date");
  await click("Save definition");
  await waitText("series");
  checks.push(
    "invalid definition and missing-source diagnostics retain repair navigation",
  );
  await ev(
    String.raw`await app.vault.create('Definitions/Unsafe.md','---\nworld_entity: derived-artefact\ntitle: Bad YAML\nseries: [broken\n---\nBody remains\n');return true;`,
  );
  await pause(400);
  await report("Definitions/Unsafe.md");
  await waitText("unreadable");
  await click("Edit definition");
  await waitText("Unsafe YAML");
  checks.push(
    "malformed YAML remains discoverable and guided editing offers source repair",
  );
  await command("murmuration-reports:open-reports");
  await ev(
    String.raw`app.workspace.getLeavesOfType('murmuration-reports-manager')[0].view.showSelected();return true;`,
  );
  await report("Reports/Definitions/Moved chart Ω.md");
  await click("Edit definition");
  const rect = await ev(
    String.raw`const e=reportQuery('.mr-field input')[0];e.blur();const r=e.getBoundingClientRect();return{x:r.x+20,y:r.y+r.height/2};`,
  );
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...rect,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...rect,
  });
  assert(
    await ev(
      String.raw`return reportQuery('.mr-field input')[0]===document.activeElement;`,
    ),
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Tab",
    code: "Tab",
    windowsVirtualKeyCode: 9,
  });
  assert(
    await ev(
      String.raw`return document.activeElement?.closest('.murmuration-reports-manager')!==null;`,
    ),
  );
  await click("Refresh");
  assert(
    await ev(
      String.raw`return document.activeElement?.closest('.murmuration-reports-manager')!==null;`,
    ),
  );
  checks.push(
    "first pointer click focuses editor; keyboard navigation and refresh retain draft",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: 650,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause(250);
  assert(
    await ev(
      String.raw`const p=reportQuery('.mr-panes')[0];return getComputedStyle(p).gridTemplateColumns.split(' ').length===1;`,
    ),
  );
  checks.push("narrow desktop layout stacks list and details");
  await ev(
    String.raw`await app.plugins.disablePluginAndSave('murmuration-reports');return true;`,
  );
  assert.equal(
    await ev(
      String.raw`return app.workspace.getLeavesOfType('murmuration-reports-manager').length;`,
    ),
    0,
  );
  await ev(
    String.raw`await app.plugins.enablePluginAndSave('murmuration-reports');return true;`,
  );
  await command("murmuration-reports:open-reports");
  await report("Reports/Definitions/Moved chart Ω.md");
  await waitText("Saved output available");
  checks.push(
    "disable disposes manager tab/listeners; re-enable reconstructs Markdown catalogue",
  );
  assert.deepEqual(await Promise.all(actualSources.map(hash)), sourcesBefore);
  checks.push("all dataset observations remain byte-identical");
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(root, "manager-narrow.png"),
    Buffer.from(screenshot.data, "base64"),
  );
  const environment = await ev("return navigator.userAgent;");
  const bundles = {
    reports: createHash("sha256")
      .update(await readFile(path.join(reports, "main.js")))
      .digest("hex"),
  };
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
