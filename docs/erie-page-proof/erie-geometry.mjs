// ERIE page proof: real headless Chrome over CDP. Opens /chat, optionally
// sends chat turns, taps the Research icon, measures page scroll and the
// three boxes at 1920x1080 and 1024x768, and saves shots.
// Usage: node erie-geometry.mjs <appOrigin> <outDir> <prefix> [message ...]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [origin, outDir, prefix, ...messages] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9341;
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
      await new Promise((r) => sock.addEventListener('open', r)); // listen before it can fire
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
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const b = e.querySelector('.erie-box-body'); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), scrolls: b ? b.scrollHeight > b.clientHeight || b.scrollWidth > b.clientWidth : null }; };
  return {
    pageScroll: { h: se.scrollHeight - se.clientHeight, w: se.scrollWidth - se.clientWidth },
    head: document.querySelector('.erie-head')?.textContent,
    headColor: getComputedStyle(document.querySelector('.erie-name')).color,
    labels: [...document.querySelectorAll('.erie-label')].map((l) => l.textContent),
    pool: box('.erie-pool'), retrieval: box('.erie-retrieval'), injection: box('.erie-injection'),
    poolRows: document.querySelectorAll('.erie-pool tbody tr').length,
    cannot: [...document.querySelectorAll('.erie-cannot')].map((c) => c.textContent),
    lessons: { injected: document.querySelectorAll('.erie-lesson.is-injected').length, held: document.querySelectorAll('.erie-lesson.is-held').length },
    promptWord: /prompt/i.test(document.querySelector('.erie-page').textContent),
    leftPanel: document.querySelector('.shell-left')?.dataset.panel,
    search: !!document.querySelector('.shell-left #research-q'),
    path: location.pathname,
  };
})()`);

const report = {};
try {
  await size(1920, 1080);
  await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/chat` });
  report.chips = await waitFor(`!!document.querySelector('.voice-chip')`);
  if (messages.length) {
    await evaluate(`document.querySelector('.voice-chip[data-voice="book"]').click()`);
    for (const m of messages) {
      const before = await evaluate(`document.querySelectorAll('.chat-transcript > *').length`);
      await evaluate(`(() => { const i = document.querySelector('#chat-message'); i.value = ${JSON.stringify(m)}; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.chat-composer').requestSubmit(); })()`);
      const ok = await waitFor(`document.querySelectorAll('.chat-transcript > *').length > ${before} || !!document.querySelector('.chat-error .error-state')`, 60000);
      report.chat = (report.chat ?? []).concat([{ ok, error: await evaluate(`document.querySelector('.chat-error')?.textContent ?? ''`), turns: await evaluate(`document.querySelectorAll('.chat-transcript > *').length`) }]);
      await sleep(500);
    }
  }
  await evaluate(`document.querySelector('.rail-button[data-rail="research"]').click()`);
  await waitFor(`!!document.querySelector('.erie-pool tbody tr, .erie-pool .empty-state, .erie-pool .error-state')`, 60000);
  await sleep(800);
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
