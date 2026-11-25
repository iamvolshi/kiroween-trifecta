import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9381;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-rail')}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 30000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const state = `({ path: location.pathname, nav: document.querySelectorAll('nav').length, panel: document.querySelector('.shell-left')?.dataset.panel,
  icons: [...document.querySelectorAll('.rail-button')].map(b => ({ k: b.dataset.rail, color: getComputedStyle(b).color, pressed: b.getAttribute('aria-pressed') })),
  rows: document.querySelectorAll('.shell-left .curator-row').length, empty: document.querySelector('.shell-left .empty-state')?.textContent ?? null })`;
await send('Page.enable');
const report = {};
for (const [w, h, mobile, tag] of [[1920, 1080, false, 'desktop'], [390, 844, true, 'phone']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await send('Page.navigate', { url: origin + '/chat' });
  await until(`!!document.querySelector('.rail-button')`);
  await sleep(2500);
  await shot(`rail-chat-${tag}.png`);
  report[`${tag}-chat`] = await run(state);
  for (const key of ['audit', 'research', 'lessons']) {
    await run(`document.querySelector('.rail-button[data-rail="${key}"]').click()`); await sleep(1500);
    await shot(`rail-${key}-${tag}.png`);
  }
  await run(`document.querySelector('.rail-button[data-rail="curator"]').click()`);
  await until(`location.pathname === '/curator'`); await sleep(2500);
  await shot(`rail-curator-${tag}.png`);
  report[`${tag}-curator`] = await run(state);
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
ws.close(); proc.kill();