// Curator page proof: real headless Chrome over CDP. Opens /curator, asks
// the catalog the given questions, measures page scroll and the boxes at
// 1920x1080 and 1024x768, and saves shots.
// Usage: node curator-geometry.mjs <appOrigin> <outDir> <prefix> [question ...]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [origin, outDir, prefix, ...questions] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9351;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(outDir, '..', `chrome-${prefix}`)}`,
  '--no-first-run', '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    if (page) {
      const sock = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((r) => sock.addEventListener('open', r));
      ws = sock;
    }
  } catch { /* not up yet */ }
  if (!ws) await sleep(200);
}
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const waitFor = async (expr, ms = 30000) => { for (let t = 0; t < ms; t += 250) { if (await evaluate(expr)) return true; await sleep(250); } return false; };
const size = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(500); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const measure = () => evaluate(`(() => {
  const se = document.scrollingElement;
  const T = (s) => [...document.querySelectorAll(s)].map((n) => n.textContent);
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const b = e.querySelector('.curator-box-body'); return { y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), scrolls: b ? b.scrollHeight > b.clientHeight : null }; };
  return {
    pageScroll: { h: se.scrollHeight - se.clientHeight, w: se.scrollWidth - se.clientWidth },
    head: document.querySelector('.curator-head')?.textContent,
    leftHead: document.querySelector('.left-record h2')?.textContent,
    leftHasFolderSubjects: /curator-folder/.test(document.querySelector('.left-folders')?.textContent ?? ''),
    label: document.querySelector('.curator-catalog .curator-label')?.textContent,
    folders: document.querySelectorAll('.curator-folder').length,
    firstFolder: document.querySelector('.curator-folder-head')?.textContent,
    catalog: box('.curator-catalog'), chat: box('.curator-chat'),
    answers: [...document.querySelectorAll('.curator-turn')].map((t) => [t.dataset.state, t.querySelector('.curator-question')?.textContent, (t.querySelector('.curator-answer, .curator-cannot, .error-state')?.textContent ?? '').split('\\n')[0]]),
  };
})()`);

const report = {};
try {
  await size(1920, 1080);
  await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/curator` });
  await waitFor(`!!document.querySelector('.curator-folder, .curator-catalog .empty-state, .curator-catalog .error-state')`, 90000);
  await waitFor(`!!document.querySelector('.left-folders .folder, .left-folders .empty-state, .left-folders .error-state')`, 30000);
  for (const q of questions) {
    const before = await evaluate(`document.querySelectorAll('.curator-turn').length`);
    await evaluate(`(() => { const i = document.querySelector('#curator-q'); i.value = ${JSON.stringify(q)}; document.querySelector('.curator-composer').requestSubmit(); })()`);
    await waitFor(`document.querySelectorAll('.curator-turn').length > ${before}`, 30000);
  }
  await sleep(500);
  report.at1920 = await measure();
  await shot(`${prefix}-1920.png`);
  await size(1024, 768);
  report.at1024 = await measure();
  await shot(`${prefix}-1024.png`);
} catch (e) {
  report.error = String(e.stack || e);
} finally {
  writeFileSync(join(outDir, `${prefix}-geometry.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  ws.close();
  proc.kill();
}
