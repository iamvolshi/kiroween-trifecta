import { spawn } from 'node:child_process';
import { createServer, request as hreq } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
// usage: node fix-shot.mjs <distDir> <outDir> <resultsJson> [stopSherlock]
// Serves the built app on :4178 and forwards /api to the local Sherlock on :8090 (one origin, no CORS needed).
const [dist, outDir, resultsPath] = process.argv.slice(2);
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
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-fix')}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
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
const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
const qOf = (id) => results.results.find((r) => r.id === id).question;
const report = {};
async function ask(q, name) {
  await send('Page.navigate', { url: `${origin}/research` });
  await until(`!!document.querySelector('.rail-button')`); await sleep(1500);
  await run(`document.querySelector('.rail-button[data-rail="research"]').click()`); await sleep(800);
  await run(`(() => { const i = document.querySelector('#research-q'); i.value = ${JSON.stringify(q)}; i.form.requestSubmit(); })()`);
  const ok = await until(`!!document.querySelector('.research-hit') || !!document.querySelector('.shell-left .error-state')`);
  await sleep(1500);
  await shot(name);
  return { ok, hits: await run(`document.querySelectorAll('.research-hit').length`),
    first: await run(`document.querySelector('.research-hit')?.textContent.slice(0, 120) ?? null`),
    weak: await run(`document.querySelector('.sherlock-weak')?.textContent ?? null`),
    rerank: await run(`document.querySelector('.sherlock-rerank')?.textContent ?? null`),
    err: await run(`document.querySelector('.shell-left .error-state')?.textContent ?? null`) };
}
report.a_k_entry = await ask(qOf('q10'), 'a-k-entry-answer-1920.png');
report.b_low_confidence = await ask(qOf('q04'), 'b-low-confidence-1920.png');
// (c) the score summary page, built from results.json
const s = results.summary; const b = s.baseline;
const rows = results.results.map((r) => { const f = (r.grade_facts_present ?? []).filter(Boolean).length; return `<tr><td>${r.id}</td><td>${r.ask.state}</td><td>${r.ask.status}</td><td>${f} of 3</td></tr>`; }).join('');
const html = `<!doctype html><meta charset="utf-8"><title>Sherlock 24-question re-run</title><style>body{background:#10141a;color:#e6edf3;font:16px system-ui;margin:40px 60px}table{border-collapse:collapse;margin:16px 0}td,th{border:1px solid #3a4452;padding:6px 14px;text-align:right}th:first-child,td:first-child{text-align:left}.note{max-width:900px;color:#ffbd58;border-left:3px solid #ffbd58;padding:8px 12px}small{color:#9fb0b3}</style>
<h1>Sherlock re-run: 24 sealed Frankenstein questions</h1>
<table><tr><th></th><th>Baseline</th><th>Fixed</th></tr>
<tr><td>Answered (found)</td><td>${b.answered}</td><td>${s.answered_found}</td></tr>
<tr><td>not_found</td><td>${b.not_found}</td><td>${s.not_found}</td></tr>
<tr><td>Weakly sure (WEAK_SUPPORT)</td><td>-</td><td>${s.status.WEAK_SUPPORT} of 24</td></tr>
<tr><td>Correct (all 3 key facts)</td><td>${b.correct} / 24</td><td>${s.correct} / 24</td></tr>
<tr><td>Key facts present</td><td>${b.key_facts} / ${s.key_facts_total}</td><td>${s.key_facts_present} / ${s.key_facts_total}</td></tr></table>
<p class="note">Grading is one reader's lenient, meaning-based judgement of the returned excerpts (${s.grader}). A stricter reader would count fewer than ${s.correct} correct. Numbers are the service re-run's, not re-graded here. Every answer was weakly sure.</p>
<table><tr><th>Question</th><th>State</th><th>Status</th><th>Key facts</th></tr>${rows}</table>
<small>Source: _proof/sherlock-fix/results.json</small>`;
writeFileSync(join(outDir, 'score-summary.html'), html);
await send('Page.navigate', { url: 'file:///' + resolve(outDir, 'score-summary.html').replace(/\\/g, '/') });
await sleep(1500); await shot('c-score-summary-1920.png');
// Sherlock down: no fallback
sherlockUp = false;
await send('Page.navigate', { url: `${origin}/research` });
await until(`!!document.querySelector('.rail-button')`); await sleep(1500);
await run(`document.querySelector('.rail-button[data-rail="research"]').click()`); await sleep(800);
await run(`(() => { const i = document.querySelector('#research-q'); i.value = 'who is Victor'; i.form.requestSubmit(); })()`);
await until(`!!document.querySelector('.shell-left .error-state')`); await sleep(800);
await shot('d-sherlock-down-1920.png');
report.d_down = await run(`document.querySelector('.shell-left .error-state')?.textContent ?? null`);
writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
ws.close(); proc.kill(); srv.close(); process.exit(0);
