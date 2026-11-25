import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9382;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-density')}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 30000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const state0 = `({ path: location.pathname, nav: document.querySelectorAll('nav').length, panel: document.querySelector('.shell-left')?.dataset.panel,
  icons: [...document.querySelectorAll('.rail-button')].map(b => ({ k: b.dataset.rail, color: getComputedStyle(b).color, pressed: b.getAttribute('aria-pressed') })),
  rows: document.querySelectorAll('.shell-left .curator-row').length, empty: document.querySelector('.shell-left .empty-state')?.textContent ?? null })`;
await send('Page.enable');
const report = {};
const pages = ['chat', 'calendar', 'research', 'lessons', 'curator'];
for (const [w, h, mobile, tag] of [[1920, 1080, false, 'desktop'], [390, 844, true, 'phone']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  let entry = null;
  for (const p of pages) {
    await send('Page.navigate', { url: origin + '/' + p });
    await until(`!!document.querySelector('.rail-button')`);
    await sleep(4000);
    await shot(`${p}-${tag}.png`);
    report[`${tag}-${p}`] = await run(`({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, text: document.body.innerText.slice(0, 1500) })`);
    if (!entry) entry = await run(`(document.querySelector('a[href^="/entry/"]')||{}).getAttribute?.('href')`);
  }
  await run(`document.querySelector('.rail-button[data-rail="audit"]').click()`); await sleep(2000);
  await shot(`audit-${tag}.png`);
  entry = await run(`(document.querySelector('a[href^="/entry/"]')||{}).getAttribute?.('href')`) || entry;
  if (entry) { await send('Page.navigate', { url: origin + entry }); await sleep(4000); await shot(`entry-${tag}.png`); report[`${tag}-entry`] = { entry, text: await run(`document.body.innerText.slice(0,2500)`) }; }
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('done');
ws.close(); proc.kill();
