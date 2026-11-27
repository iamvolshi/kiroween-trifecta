import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { request as hreq } from 'node:https';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
// usage: node shots.mjs <distDir> <outDir> [owner/repo] [question]. Serves the built app on :4178, forwards /api to the REAL Sherlock on Render (https).
// Serves the built app on :4178 and forwards /api to the local Sherlock on :8090 (one origin, no CORS needed).
const [dist, outDir, REPO = 'octocat/Spoon-Knife', QUESTION = 'How is the page styled?'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let sherlockUp = true;
const srv = createServer((q, r) => {
  if (q.url.startsWith('/api/')) {
    if (!sherlockUp) { q.destroy(); return; }
    const u = hreq({ host: 'sherlock-search-nwx7.onrender.com', path: q.url, method: q.method, headers: { ...q.headers, host: 'sherlock-search-nwx7.onrender.com', origin: 'https://sherlock-search-nwx7.onrender.com' } }, (res) => { r.writeHead(res.statusCode, res.headers); res.pipe(r); });
    u.on('error', () => { r.writeHead(502); r.end(); }); q.pipe(u); return;
  }
  const p = resolve(dist, '.' + decodeURIComponent(q.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(dist, 'index.html');
  r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(4178, '127.0.0.1');
const origin = 'http://127.0.0.1:4178';
const port = 9392;
import { tmpdir } from 'node:os';
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'chrome-gh-' + Date.now())}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 90000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const report = { steps: [] };
const note = (k, v) => { report[k] = v; console.log(k, JSON.stringify(v)); };
const setVal = (sel, v) => run(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); })()`);
async function attach(repo) {
  await run(`document.querySelector('.repo-attach-btn').click()`);
  await setVal('.repo-form input[name="repo"]', repo);
  await run(`document.querySelector('.repo-form').requestSubmit()`);
}
await send('Page.navigate', { url: `${origin}/chat` });
await until(`!!document.querySelector('.shell-left .repo-attach-btn')`); await sleep(800);
note('panel_in_left', await run(`!!document.querySelector('.shell-left .repo-slot')`));
note('panel_in_chat_column', await run(`!!document.querySelector('.chat-column .repo-slot, .chat-column .repo-bar, .chat-column .repo-form')`));
note('dock_children', await run(`[...document.querySelector('.chat-dock').children].map((c) => c.className)`));
await attach(REPO);
note('ready', await until(`document.querySelector('.shell-left .repo-progress')?.dataset.state === 'ready'`, 180000));
note('ready_text', await run(`document.querySelector('.repo-progress').textContent`));
// the form open in the column
await run(`document.querySelector('.repo-attach-btn').click()`);
await setVal('.repo-form input[name="repo"]', REPO);
await sleep(500);
note('metrics', await run(`(() => { const L = document.querySelector('.shell-left'); const s = L.querySelector('.repo-slot'); const b = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
  const over = [...s.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > L.getBoundingClientRect().right + 0.5 || e.scrollWidth > e.clientWidth + 1).map((e) => e.className || e.tagName);
  return { left: b(L), slot: b(s), viewport: [innerWidth, innerHeight], leftScrollTop: L.scrollTop, scrollW: L.scrollWidth, clientW: L.clientWidth, overflowing: over, fields: [...s.querySelectorAll('.repo-field, .repo-go')].map(b), inView: s.getBoundingClientRect().bottom < innerHeight }; })()`));
await shot('a-left-panel-form-open-1920.png');
await run(`document.querySelector('.repo-attach-btn').click()`);
// a repo question in the chat column
await setVal('#chat-message', QUESTION);
note('placeholder', await run(`document.querySelector('#chat-message').placeholder`));
await run(`document.querySelector('.chat-composer').requestSubmit()`);
note('answered', await until(`!!document.querySelector('.repo-citation') || !!document.querySelector('.chat-error .error-state')`, 120000));
await sleep(800); await shot('b-chat-repo-answer-1920.png');
note('answer', await run(`({ text: document.querySelector('.repo-turn .bubble-text')?.textContent, cites: [...document.querySelectorAll('.repo-citation')].map((c) => [c.querySelector('.repo-path').textContent, c.querySelector('.repo-kid')?.textContent ?? null]), placeholder: document.querySelector('#chat-message').placeholder })`));
// detach afterwards
await run(`document.querySelector('.repo-detach-btn').click()`);
note('detached', await until(`!document.querySelector('.repo-source')`, 30000));
note('after_detach', await run(`document.querySelector('.repo-attach-btn').textContent`));
writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
ws.close(); proc.kill(); srv.close(); process.exit(0);