import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
// Proof shots: the corpus views and one answered question, against the real Sherlock service
// (Gutenberg #84 stand-in corpus), then the same page with Sherlock stopped.
const [origin, outDir, stopCmd] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9382;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-sherlock')}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 30000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const report = {};
for (const tab of ['overview', 'nouns', 'graph']) {
  await send('Page.navigate', { url: `${origin}/research/${tab}` });
  await until(`!!document.querySelector('.corpus-body .corpus-table, .corpus-body svg, .corpus-body .error-state')`);
  await sleep(1500);
  await shot(`sherlock-${tab}-1920.png`);
  report[tab] = await run(`({ rows: document.querySelectorAll('.corpus-table tbody tr').length, nodes: document.querySelectorAll('.cg-node').length, edges: document.querySelectorAll('.cg-edge').length, err: document.querySelector('.corpus-body .error-state')?.textContent ?? null })`);
}
// An answered question, asked through the rail Research search box.
await send('Page.navigate', { url: `${origin}/research` });
await until(`!!document.querySelector('.rail-button')`); await sleep(1500);
await run(`document.querySelector('.rail-button[data-rail="research"]').click()`); await sleep(800);
await run(`(() => { const i = document.querySelector('#research-q'); i.value = 'Who created the creature and where did he study?'; i.form.requestSubmit(); })()`);
await until(`!!document.querySelector('.research-hit') || !!document.querySelector('.shell-left .error-state')`); await sleep(1200);
await shot('sherlock-answer-1920.png');
report.answer = await run(`({ hits: document.querySelectorAll('.research-hit').length, first: document.querySelector('.research-hit')?.textContent.slice(0, 160) })`);
if (stopCmd) {
  execSync(stopCmd); await sleep(1500);
  await send('Page.navigate', { url: `${origin}/research/overview` });
  await until(`!!document.querySelector('.corpus-body .error-state')`); await sleep(1000);
  await shot('sherlock-down-1920.png');
  report.down = await run(`document.querySelector('.corpus-body .error-state')?.textContent ?? null`);
}
writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
ws.close(); proc.kill();