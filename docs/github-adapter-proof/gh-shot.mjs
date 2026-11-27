import { spawn } from 'node:child_process';
import { createServer, request as hreq } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
// usage: node gh-shot.mjs <distDir> <outDir> [owner/repo] [question]
// Serves the built app on :4178 and forwards /api to the local Sherlock on :8090 (one origin, no CORS needed).
const [dist, outDir, REPO = 'octocat/Spoon-Knife', QUESTION = 'How is the page styled?'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let sherlockUp = true;
const srv = createServer((q, r) => {
  if (q.url.startsWith('/api/')) {
    if (!sherlockUp) { q.destroy(); return; }
    const u = hreq({ host: '127.0.0.1', port: 8090, path: q.url, method: q.method, headers: q.headers }, (res) => { r.writeHead(res.statusCode, res.headers); res.pipe(r); });
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
await until(`!!document.querySelector('.repo-attach-btn')`); await sleep(800);
note('control_text', await run(`document.querySelector('.repo-attach-btn').textContent`));
await attach(REPO);
// (a) catch it while it works
const t0 = Date.now(); let seen = null;
while (Date.now() - t0 < 60000) {
  const st = await run(`document.querySelector('.repo-progress')?.dataset.state ?? (document.querySelector('.repo-progress') ? 'sending' : '')`);
  if (st && st !== 'ready') { seen = st; await shot('a-attach-in-progress-1920.png'); break; }
  if (st === 'ready') break;
  await sleep(30);
}
note('a_state_seen', { state: seen, text: await run(`document.querySelector('.repo-progress')?.textContent ?? null`) });
// (b) ready
note('b_ready', await until(`document.querySelector('.repo-progress')?.dataset.state === 'ready'`, 120000));
await sleep(600); await shot('b-ready-1920.png');
note('b_text', await run(`document.querySelector('.repo-progress').textContent`));
note('b_source', await run(`[...document.querySelectorAll('.repo-source-btn')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed'))`));
// (c) an answer with path + KID
await setVal('#chat-message', QUESTION);
await run(`document.querySelector('.chat-composer').requestSubmit()`);
note('c_answered', await until(`!!document.querySelector('.repo-citation') || !!document.querySelector('.chat-error .error-state')`, 90000));
await sleep(800); await shot('c-answer-path-kid-1920.png');
note('c_answer', await run(`({ text: document.querySelector('.repo-turn .bubble-text')?.textContent, weak: document.querySelector('.sherlock-weak')?.textContent ?? null, rerank: document.querySelector('.sherlock-rerank')?.textContent ?? null, cites: [...document.querySelectorAll('.repo-citation')].map((c) => [c.querySelector('.repo-path').textContent, c.querySelector('.repo-kid')?.textContent ?? null]) })`));
// (d) an error: a repo that does not exist
await run(`document.querySelector('.repo-detach-btn').click()`);
await until(`!document.querySelector('.repo-source')`); 
await attach('octocat/this-repo-does-not-exist-zz9');
note('d_error_seen', await until(`!!document.querySelector('.repo-error')`, 60000));
await sleep(600); await shot('d-error-repo-not-found-1920.png');
note('d_error', await run(`document.querySelector('.repo-error')?.textContent ?? null`));
// (e) Sherlock down: words, no other search
sherlockUp = false;
await attach(REPO);
note('e_error_seen', await until(`!!document.querySelector('.repo-error')`, 30000));
await sleep(600); await shot('e-sherlock-down-1920.png');
note('e_error', await run(`document.querySelector('.repo-error')?.textContent ?? null`));
writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
ws.close(); proc.kill(); srv.close(); process.exit(0);