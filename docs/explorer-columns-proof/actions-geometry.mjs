// Explorer columns proof: real headless Chrome over CDP. Opens /actions,
// measures the State column's x on every row (it must be one value), drags
// the Subject|State edge, re-measures, and saves shots at 1920x1080.
// Usage: node actions-geometry.mjs <appOrigin> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [origin, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const port = 9361;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(outDir, '..', 'chrome-actions')}`,
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
const waitFor = async (expr, ms = 60000) => { for (let t = 0; t < ms; t += 250) { if (await evaluate(expr)) return true; await sleep(250); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const measure = () => evaluate(`(() => {
  const se = document.scrollingElement;
  const table = document.querySelector('.action-list table');
  const rows = [...table.querySelectorAll('tbody tr.log-line')].filter((r) => !r.hidden);
  const xs = (k) => [...new Set(rows.map((r) => Math.round(r.querySelector('.cell-' + k).getBoundingClientRect().x)))];
  return {
    pageScroll: { h: se.scrollHeight - se.clientHeight, w: se.scrollWidth - se.clientWidth },
    rows: rows.length,
    states: [...new Set(rows.map((r) => r.querySelector('.cell-state').textContent))],
    subjectLengths: [...new Set(rows.map((r) => r.querySelector('.card-toggle').textContent.length))].sort((a, b) => a - b),
    stateX: xs('state'), authorityX: xs('authority'), inspectX: xs('inspect'),
    cols: [...table.querySelectorAll('col')].map((c) => c.style.width),
    colsPx: [...table.querySelectorAll('thead th')].map((th) => Math.round(th.getBoundingClientRect().width)),
    tablePx: Math.round(table.getBoundingClientRect().width),
    rowHeights: [...new Set(rows.slice(0, 60).map((r) => Math.round(r.getBoundingClientRect().height)))],
  };
})()`);

const report = {};
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: `${origin}/actions` });
  await waitFor(`!!document.querySelector('.action-list tbody tr')`, 90000);
  await sleep(800);
  report.before = await measure();
  await shot('01-actions-1920-state-column-straight.png');
  // Open one row: its details sit in the row under it.
  await evaluate(`document.querySelectorAll('.action-list tbody tr.log-line')[1].querySelector('.card-toggle').click()`);
  await sleep(200);
  report.opened = await evaluate(`(() => { const d = document.querySelector('.action-list .card-details:not([hidden])'); return d ? d.textContent.slice(0, 160) : null; })()`);
  // Drag the Subject|State edge 12ch left (the state slides left, Authority stays).
  const grip = await evaluate(`(() => { const r = document.querySelector('.action-list th.col-subject .col-grip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  const chPx = report.before.colsPx[1] / parseFloat(report.before.cols[1]);
  await mouse('mousePressed', grip[0], grip[1]);
  for (let s = 1; s <= 12; s++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip[0] - s * chPx, y: grip[1], button: 'left', buttons: 1 }); await sleep(20); }
  await mouse('mouseReleased', grip[0] - 12 * chPx, grip[1]);
  await sleep(200);
  report.dragged = await measure();
  await shot('02-actions-1920-subject-edge-dragged.png');
  // 1024x768: the page still never scrolls.
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  report.at1024 = await measure();
  await shot('03-actions-1024.png');
} catch (e) {
  report.error = String(e.stack || e);
} finally {
  writeFileSync(join(outDir, 'geometry.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  ws.close();
  proc.kill();
}
