import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
// usage: node sw-shot.mjs <distDir> <outDir>
// Serves the built app on :4179 and forwards /connector, /sherlock and /watson to the REAL hosted services
// (one origin, so no CORS setup is needed). Every forwarded request is logged with the phase it happened in.
const [dist, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const UP = { connector: 'https://hackenstein-connector.onrender.com', sherlock: 'https://sherlock-search-nwx7.onrender.com', watson: 'https://watson-bridge-nfkl.onrender.com' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let phase = 'boot'; const log = [];
const srv = createServer(async (q, r) => {
  const m = q.url.match(/^\/(connector|sherlock|watson)(\/.*)$/);
  if (m) {
    const chunks = []; for await (const c of q) chunks.push(c);
    const body = Buffer.concat(chunks);
    const t0 = Date.now();
    try {
      const res = await fetch(UP[m[1]] + m[2], { method: q.method, headers: q.headers['content-type'] ? { 'content-type': q.headers['content-type'] } : {}, body: body.length ? body : undefined });
      const buf = Buffer.from(await res.arrayBuffer());
      log.push({ phase, service: m[1], method: q.method, path: m[2].split('?')[0], status: res.status, ms: Date.now() - t0 });
      r.writeHead(res.status, { 'content-type': res.headers.get('content-type') ?? 'application/json' }); r.end(buf);
    } catch (e) { log.push({ phase, service: m[1], method: q.method, path: m[2].split('?')[0], status: 'error', error: String(e), ms: Date.now() - t0 }); r.writeHead(502); r.end(); }
    return;
  }
  const p = resolve(dist, '.' + decodeURIComponent(q.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(dist, 'index.html');
  r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(4179, '127.0.0.1');
const origin = 'http://127.0.0.1:4179';
const port = 9393;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'chrome-sw-' + Date.now())}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 150000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const report = {}; const note = (k, v) => { report[k] = v; console.log(k, JSON.stringify(v)); };
const setVal = (sel, v) => run(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.disabled = false; i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); })()`);
const QCHAT = process.env.QCHAT ?? 'Hello. Who are you, and what do you want?';
const QDEEP = process.env.QDEEP ?? 'Who created the creature, and how did he do it?';
try {
  // 1. Chat: a persona talks.
  phase = 'chat'; await send('Page.navigate', { url: `${origin}/chat` });
  await until(`!!document.querySelector('.voice-picker [data-voice="movie"]')`);
  await run(`document.querySelector('.voice-picker [data-voice="movie"]').click()`); await sleep(300);
  await setVal('#chat-message', QCHAT);
  await run(`document.querySelector('.chat-composer').requestSubmit()`);
  note('chat_answered', await until(`!!document.querySelector('.chat-reply .bubble-text') || !!document.querySelector('.chat-error .error-state')`));
  await sleep(1200); await shot('a-chat-persona-1920.png');
  note('chat_reply', await run(`({ text: document.querySelector('.chat-reply .bubble-text')?.textContent ?? null, error: document.querySelector('.chat-error .error-state')?.textContent ?? null, voice: document.querySelector('.chat-view')?.dataset.voice })`));
  // 2. The new page via the rail.
  phase = 'page-open'; await run(`document.querySelector('.rail-button[data-rail="investigate"]').click()`);
  await until(`!!document.querySelector('.sw-view')`); await sleep(1500);
  note('page', await run(`({ path: location.pathname, view: document.querySelector('.brand-view')?.textContent, purpose: document.querySelector('.sw-purpose')?.textContent, source: document.querySelector('.sw-source')?.textContent })`));
  await shot('b-page-empty-1920.png');
  phase = 'deep'; await run(`document.querySelector('.sw-view .voice-picker [data-voice="book"]').click()`); await sleep(300);
  await setVal('#sw-question', QDEEP);
  await run(`document.querySelector('.sw-view .chat-composer').requestSubmit()`);
  note('deep_done', await until(`(!!document.querySelector('.sw-turn .sw-reply') && !document.querySelector('.chat-thinking')) `));
  await sleep(1500); await run(`(() => { for (let n = document.querySelector('.sw-turn'); n; n = n.parentElement) n.scrollTop = 0; })()`); await sleep(500); await shot('c-page-answer-provenance-1920.png');
  note('deep', await run(`({ voice: document.querySelector('.sw-turn .sw-voice-name')?.textContent ?? null, reply: document.querySelector('.sw-turn .sw-reply .bubble-text')?.textContent ?? null, problems: [...document.querySelectorAll('.sw-problem')].map((n) => n.textContent), cites: [...document.querySelectorAll('.sw-citation')].map((c) => [c.querySelector('.sw-path').textContent, c.querySelector('.sw-kid')?.textContent ?? null]), watson: document.querySelector('.watson-conclusion .watson-summary')?.textContent ?? null, report: document.querySelector('.sw-report-text')?.textContent ?? null })`));
} catch (e) { note('script_error', String(e)); }
report.requests = log; writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
try { await send('Browser.close'); } catch {}
proc.kill(); srv.close(); process.exit(0);