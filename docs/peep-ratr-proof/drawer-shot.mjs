// PEEP / RATR drawer proof: headless Chrome over CDP against the built app
// (served locally, reading the live TRIFACTA API). Saves the PEEP tab with
// the Darren city trace and the RATR tab with the acct-001 witness log, at
// 1920x1080 and 1024x768. One POST /ask per size (TRIFACTA logs each ask).
// Usage: node drawer-shot.mjs <appOrigin> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9373;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-peep')}`,
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
const until = async (expr, ms = 90000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64'));
};

await send('Page.enable');
const report = {};
for (const [w, h] of [[1920, 1080], [1024, 768]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/chat` });
  await until(`!!document.querySelector('.insp-pair')`);
  await sleep(800);
  await shot(`0-header-${w}.png`);
  await run(`document.querySelector('[data-open="peep"]').click()`);
  await run(`document.querySelector('.peep-form').requestSubmit()`);
  const peep = await until(`document.querySelectorAll('.peep-hit').length > 0 || !!document.querySelector('.peep .insp-error')`);
  await sleep(300);
  await shot(`1-peep-${w}.png`);
  report[`peep-${w}`] = await run(`({ ok: ${peep}, hits: [...document.querySelectorAll('.peep-hit-top')].map(n => n.textContent), error: document.querySelector('.peep .insp-error')?.textContent ?? null })`);
  await run(`document.querySelector('.insp-tab[data-tab="ratr"]').click()`);
  const ratr = await until(`document.querySelectorAll('.ratr-table tbody tr').length > 0 || !!document.querySelector('.ratr .insp-error')`);
  await sleep(300);
  await shot(`2-ratr-${w}.png`);
  report[`ratr-${w}`] = await run(`({ ok: ${ratr}, rows: document.querySelectorAll('.ratr-table tbody tr').length, meta: document.querySelector('.ratr-log .insp-meta')?.textContent ?? null, error: document.querySelector('.ratr .insp-error')?.textContent ?? null, drawer: (r => [r.width, r.height])(document.querySelector('.insp-drawer').getBoundingClientRect()) })`);
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
