// Watson proof: headless Chrome over CDP. The built app (served on 127.0.0.1)
// reads the LIVE connector and calls the watson-bridge running on 127.0.0.1.
// Opens the rail Research panel, asks ERIE, waits for Watson's conclusion.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9379;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-watson')}`,
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
const until = async (expr, ms = 120000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };

await send('Page.enable');
const report = {};
for (const [w, h] of [[1920, 1080], [1024, 768]]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/chat' });
  await until(`!!document.querySelector('.rail-nav')`);
  await sleep(1000);
  await run(`(() => { const hide = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'HIDE' || b.textContent.trim() === 'Hide'); if (hide) hide.click(); })()`);
  await run(`[...document.querySelectorAll('.rail-nav button')].find(b => (b.getAttribute('aria-label') || b.title || b.textContent).includes('Research')).click()`);
  await until(`!!document.querySelector('#research-q')`);
  await run(`(() => { const i = document.querySelector('#research-q'); i.value = 'a female of another sex, as hideous as myself'; i.form.requestSubmit(); })()`);
  const got = await until(`!!document.querySelector('.research-results .watson-conclusion') || !!document.querySelector('.research-results .error-state')`);
  await sleep(500);
  await run(`document.querySelector('.research-results .watson-conclusion')?.scrollIntoView({block: 'center'})`);
  await sleep(300);
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `watson-${w}.png`), Buffer.from(r.result.data, 'base64'));
  report[w] = await run(`({ ok: ${got}, hits: document.querySelectorAll('.research-hit').length,
    error: document.querySelector('.research-results .error-state')?.textContent ?? null,
    confidence: document.querySelector('.watson-confidence')?.textContent ?? null,
    claims: document.querySelectorAll('.watson-claim').length,
    kids: [...document.querySelectorAll('.watson-claim-kids')].map(n => n.textContent) })`);
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
