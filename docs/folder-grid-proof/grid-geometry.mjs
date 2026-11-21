// Geometry check for the folder grid in real Chrome (headless), over CDP.
// Usage: node grid-geometry.mjs <url> <outDir>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const url = process.argv[2];
const outDir = process.argv[3];
mkdirSync(outDir, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9333;
const profile = join(outDir, '..', 'chrome-profile-grid');
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--hide-scrollbars=false', '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* not up yet */ }
    await sleep(200);
  }
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id; pending.set(n, (msg) => msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
async function size(w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name), Buffer.from(r.data, 'base64'));
}
const measure = (sel) => evaluate(`(() => {
  const t = document.querySelector(${JSON.stringify(sel)});
  const folder = document.querySelector('.ktie-folder');
  const wrap = t ? t.closest('.entry-grid-wrap') : null;
  const ths = t ? [...t.querySelectorAll('thead th')] : [];
  if (!t) return null;
  const chPx = (() => { const cs = getComputedStyle(t); const s = document.createElement('span'); s.style.fontFamily = cs.fontFamily; s.style.fontSize = cs.fontSize; s.style.position='absolute'; s.textContent='0'.repeat(100); t.parentElement.appendChild(s); const w = s.getBoundingClientRect().width / 100; s.remove(); return w; })();
  const defined = [...t.querySelectorAll('col')].map((c) => parseFloat(c.style.width));
  const rows = [...t.querySelectorAll('tbody tr')];
  const overflowing = [...t.querySelectorAll('tbody .cell')].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.className + ': ' + c.textContent);
  return {
    chPx: +chPx.toFixed(3),
    defined,
    scale: +(t.getBoundingClientRect().width / (defined.reduce((a, b) => a + b, 0) * chPx)).toFixed(3),
    cols: ths.map((th) => +(th.getBoundingClientRect().width / chPx).toFixed(2)),
    folderCh: folder ? +(folder.clientWidth / chPx).toFixed(1) : null,
    colsPx: ths.map((th) => +th.getBoundingClientRect().width.toFixed(1)),
    tablePx: +t.getBoundingClientRect().width.toFixed(1),
    folderPx: folder ? folder.clientWidth : null,
    wrapClient: wrap.clientWidth, wrapScroll: wrap.scrollWidth,
    rowHeights: [...new Set(rows.map((r) => +r.getBoundingClientRect().height.toFixed(1)))],
    overflowing,
    pageScroll: { h: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight, w: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth },
    head: ths.map((th) => th.textContent),
    kids: rows.map((r) => r.querySelector('.kid').textContent),
    sort: ths.map((th) => th.getAttribute('aria-sort')),
    longest: Object.fromEntries(['time','kid','subject','state','authority','evidence','reason'].map((k) => [k, Math.max(...[...t.querySelectorAll('tbody .cell-' + k)].map((c) => c.textContent.length))])),
  };
})()`);

async function mouse(type, x, y) {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
}
async function click(sel) {
  await evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`); await sleep(150);
  const box = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await mouse('mousePressed', box[0], box[1]); await mouse('mouseReleased', box[0], box[1]); await sleep(150);
}

const report = {};
try {
  await connect();
  await send('Page.enable'); await send('Runtime.enable');
  await size(1920, 1080);
  await send('Page.navigate', { url });
  for (let i = 0; i < 120; i++) { if (await evaluate(`!!document.querySelector('.hour-did table')`)) break; await sleep(500); }
  await sleep(800);
  const did = '.hour-did table';
  report.a1920 = await measure(did);
  report.believed1920 = await measure('.hour-believed table');
  await evaluate(`document.querySelector('.hour-did').scrollIntoView({ block: 'start' })`); await sleep(200);
  await shot('01-grid-1920.png');

  // A2: a longer value scrolls inside its cell; nothing moves.
  await evaluate(`(() => { const c = document.querySelector('.hour-did tbody .cell-reason'); window.__old = c.textContent; c.textContent = c.textContent + ' — and a much longer reason that runs well past its column'; })()`);
  report.longValue = await measure(did);
  report.longValueScrolls = await evaluate(`(() => { const c = document.querySelector('.hour-did tbody .cell-reason'); const before = c.scrollLeft; c.scrollLeft = 200; return { scrollWidth: c.scrollWidth, clientWidth: c.clientWidth, scrolled: c.scrollLeft > before }; })()`);
  await shot('02-long-value-scrolls-in-cell.png');
  await evaluate(`document.querySelector('.hour-did tbody .cell-reason').textContent = window.__old`);

  // A4: sort KID desc then asc; believed list stays in record order.
  await click(`${did} th.col-kid .sort-button`);
  report.kidAsc = await measure(did);
  await click(`${did} th.col-kid .sort-button`);
  report.kidDesc = await measure(did);
  await shot('03-sorted-kid-descending.png');

  // A3: drag the Subject|State edge 6ch right.
  await evaluate(`document.querySelector('.hour-did').scrollIntoView({ block: 'start' })`); await sleep(200);
  const before = await measure(did);
  const grip = await evaluate(`(() => { const r = document.querySelector('${did} th.col-subject .col-grip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await mouse('mousePressed', grip[0], grip[1]);
  for (let s = 1; s <= 6; s++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: grip[0] + s * before.chPx, y: grip[1], button: 'left', buttons: 1 }); await sleep(30); }
  await mouse('mouseReleased', grip[0] + 6 * before.chPx, grip[1]);
  await sleep(150);
  report.dragged = await measure(did);
  // Drag far left: Subject cannot go under 4ch.
  const g2 = await evaluate(`(() => { const r = document.querySelector('${did} th.col-subject .col-grip').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await mouse('mousePressed', g2[0], g2[1]);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: g2[0] - 800, y: g2[1], button: 'left', buttons: 1 });
  await mouse('mouseReleased', g2[0] - 800, g2[1]); await sleep(150);
  report.draggedToMin = await measure(did);
  await shot('04-subject-dragged-to-min.png');

  // A5: open another hour inside the app, come back: sort + widths hold.
  await evaluate(`(() => { const a = [...document.querySelectorAll('a')].find((x) => /Back to/.test(x.textContent)); a.click(); })()`);
  await sleep(1500);
  await evaluate(`(() => { const a = [...document.querySelectorAll('.hour-list a')].find((x) => x.textContent === '23'); a.click(); })()`);
  for (let i = 0; i < 40; i++) { if (await evaluate(`!!document.querySelector('.hour-did table')`)) break; await sleep(250); }
  await sleep(500);
  report.afterNavigate = await measure(did);
  // The believed list sorts on its own: open 00:00 next day (27 live), still record order.
  await send('Runtime.evaluate', { expression: `history.pushState({}, '', '/calendar/2026-11-21/00'); dispatchEvent(new PopStateEvent('popstate'))` });
  for (let i = 0; i < 40; i++) { if (await evaluate(`!!document.querySelector('.hour-believed table')`)) break; await sleep(250); }
  await sleep(500);
  report.believedOwnOrder = await measure('.hour-believed table');
  await evaluate(`document.querySelector('.hour-believed').scrollIntoView({ block: 'start' })`); await sleep(200);
  await shot('05-believed-list-own-order.png');
  // Fresh load: record order + default widths.
  await send('Page.navigate', { url });
  for (let i = 0; i < 120; i++) { if (await evaluate(`!!document.querySelector('.hour-did table')`)) break; await sleep(500); }
  await sleep(800);
  report.afterReload = await measure(did);

  // A8: 1024x768.
  await size(1024, 768);
  report.a1024 = await measure(did);
  await evaluate(`document.querySelector('.hour-did').scrollIntoView({ block: 'start' })`); await sleep(200);
  await shot('06-grid-1024-scrolls-sideways.png');
  await size(1920, 1080);
} catch (e) {
  report.error = String(e.stack || e);
} finally {
  writeFileSync(join(outDir, 'geometry.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1));
  try { ws.close(); } catch {}
  proc.kill();
}
