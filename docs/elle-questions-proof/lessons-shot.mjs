// ELLE question folders proof: headless Chrome over CDP. Opens /lessons,
// measures page scroll and the grey box, saves shots at 1920x1080 and 1024x768.
// Usage: node lessons-shot.mjs <appOrigin> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9371;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(outDir, '..', 'chrome-lessons')}`,
  '--no-first-run', '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; }
  } catch { /* not up yet */ }
  if (!ws) await sleep(200);
}
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const waitFor = async (expr, ms = 60000) => { for (let t = 0; t < ms; t += 250) { if (await evaluate(expr)) return true; await sleep(250); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const measure = () => evaluate(`(() => {
  const se = document.scrollingElement;
  return {
    pageScroll: { h: se.scrollHeight - se.clientHeight, w: se.scrollWidth - se.clientWidth },
    label: document.querySelector('.elle-grey .elle-label')?.textContent,
    folders: [...document.querySelectorAll('.elle-question')].map((f) => ({
      name: f.querySelector('.elle-question-name')?.textContent,
      state: f.querySelector('.elle-question-state')?.textContent ?? null,
      parts: [...f.querySelectorAll('.elle-question-part-head')].map((h) => h.textContent),
    })),
    grid: !!document.querySelector('.elle-page table, .elle-page th, .elle-page .col-grip'),
  };
})()`);

const report = {};
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/lessons` });
  await waitFor(`!!document.querySelector('.elle-question, .elle-grey .empty-state, .elle-grey .error-state')`);
  await sleep(800);
  report.at1920 = await measure();
  await shot('01-lessons-1920-question-folders.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  report.at1024 = await measure();
  await shot('02-lessons-1024.png');
} catch (e) {
  report.error = String(e.stack || e);
} finally {
  writeFileSync(join(outDir, 'geometry.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  ws.close();
  proc.kill();
}
