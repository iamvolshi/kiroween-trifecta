// Curator panel proof: headless Chrome over CDP. The built app (127.0.0.1)
// reads a local connector (the bots branch) whose record came back through
// the record store after a wiped-dir restart, holding one dog folder.
// Shots: the sidebar at 1920x1080, a phone (390x844), and the Curator page.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9381;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-panel')}`,
  '--no-first-run', '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; }
  } catch { /* not up yet */ }
  if (!ws) await sleep(200);
}
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 60000) => { for (let t = 0; t < ms; t += 300) { if (await run(expr)) return true; await sleep(300); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };

await send('Page.enable');
const report = {};
for (const [name, w, h, mobile] of [['desktop', 1920, 1080, false], ['phone', 390, 844, true]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await send('Page.navigate', { url: origin + '/chat' });
  await until(`!!document.querySelector('.left-folders .curator-row, .left-folders .empty-state')`);
  await sleep(800);
  await run(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^hide$/i.test(x.textContent.trim())); if (b) b.click(); })()`);
  await sleep(300);
  report[name] = await run(`({ rows: [...document.querySelectorAll('.curator-row')].map(r => [r.querySelector('.curator-row-name').textContent, r.querySelector('.curator-row-count').textContent, r.querySelector('.curator-row-value').textContent, r.getAttribute('href')]),
    cards: document.querySelectorAll('.left-folders .subject-folder').length,
    seedInPanel: /frankenstein/.test(document.querySelector('.left-folders').textContent),
    rowHeight: document.querySelector('.curator-row')?.getBoundingClientRect().height ?? null })`);
  await shot(`panel-${name}.png`);
  // Tap the row: the page changes.
  const before = await run('location.pathname');
  await run(`document.querySelector('.curator-row').click()`);
  await until(`location.pathname !== ${JSON.stringify(before)}`, 10000);
  await sleep(800);
  report[name].tapGoesTo = await run('location.pathname');
  await shot(`tap-${name}.png`);
}
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: origin + '/curator' });
await until(`!!document.querySelector('.curator-folder .subject-folder')`);
await sleep(800);
report.curatorPage = await run(`({ cards: document.querySelectorAll('.curator-folder .subject-folder').length,
  value: document.querySelector('.curator-folder .folder-value')?.textContent, history: document.querySelector('.curator-folder .folder-history')?.textContent,
  count: document.querySelector('.curator-folder .curator-count')?.textContent })`);
await shot('curator-page.png');
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
