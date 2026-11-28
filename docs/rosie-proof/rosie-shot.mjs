import { spawn, spawnSync } from 'node:child_process';
import { createServer, request as hreq } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
// usage: node rosie-shot.mjs <distDir> <outDir> <sherlockWorktree> <Rosie.exe> <rosiePkgDir> <rosie_agent_run.py>
// One origin (:4178) serves the built app and forwards /api to a local Sherlock (:8090) started from the
// feat/sherlock-rosie branch. The REAL Rosie.exe pairs first; the real agent code (fixed folder) reads the folder.
const [dist, outDir, SHERLOCK, EXE, PKG, RUNNER] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'rosie-app-proof-'));
const folder = join(work, 'harbor-notes');
mkdirSync(join(folder, 'src'), { recursive: true }); mkdirSync(join(folder, 'node_modules'), { recursive: true });
writeFileSync(join(folder, 'README.md'), '# Harbor notes\n\nLanternfish are counted every night by the harbor tool.\n');
writeFileSync(join(folder, 'src', 'count.py'), 'def count_fish(net):\n    """Return how many glowing lanternfish are in the net."""\n    return len(net)\n');
writeFileSync(join(folder, 'src', 'vault.py'), "def vault_door():\n    return 'zebra-quartz-passphrase is kept in the vault'\n");
writeFileSync(join(folder, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 0, 0, 0]));
writeFileSync(join(folder, 'node_modules', 'index.js'), 'module.exports = 1;');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env, PYTHONPATH: join(SHERLOCK, 'src'), SHERLOCK_SEARCH_CORS_ORIGINS: 'http://127.0.0.1:4178' };
delete env.SHERLOCK_SEARCH_API_KEY;
const sherlock = spawn('python', ['-c', `import uvicorn; from sherlock.api import create_app; uvicorn.run(create_app(case_store=r'${join(work, 'store')}', static_dir=None), host='127.0.0.1', port=8090, log_level='warning')`], { env, stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:8090/api/search/health')).ok) break; } catch {} await sleep(300); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, r) => {
  if (q.url.startsWith('/api/')) {
    const u = hreq({ host: '127.0.0.1', port: 8090, path: q.url, method: q.method, headers: q.headers }, (res) => { r.writeHead(res.statusCode, res.headers); res.pipe(r); });
    u.on('error', () => { r.writeHead(502); r.end(); }); q.pipe(u); return;
  }
  const p = resolve(dist, '.' + decodeURIComponent(q.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(dist, 'index.html');
  r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(4178, '127.0.0.1');
const origin = 'http://127.0.0.1:4178', BASE = origin;
const port = 9393;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'chrome')}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 30000) => { for (let t = 0; t < ms; t += 400) { if (await run(expr)) return true; await sleep(400); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const report = {};
const note = (k, v) => { report[k] = v; console.log(k, JSON.stringify(v)); };
const kids = [];
const cleanup = () => { for (const p of [...kids, chrome, sherlock]) { try { spawnSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { stdio: 'ignore' }); } catch {} } try { srv.close(); } catch {} };
process.on('exit', cleanup);
const txt = (sel) => run(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${origin}/chat` });
  await until(`!!document.querySelector('.rosie-attach-btn')`); await sleep(800);
  note('a_buttons', await run(`({ dl: document.querySelector('.rosie-download')?.textContent, href: document.querySelector('.rosie-download')?.href, attach: document.querySelector('.rosie-attach-btn')?.textContent, github: document.querySelector('.repo-attach-btn')?.textContent })`));
  await run(`document.querySelector('.rosie-attach-btn').click()`); await sleep(300);
  await shot('a-panel-not-paired-1920.png');
  note('a_words', await txt('.rosie-steps'));
  // pairing code, then the REAL exe pairs with it (code from the file name)
  await run(`document.querySelector('.rosie-go').click()`);
  note('b_code_shown', await until(`!!document.querySelector('.rosie-code')`));
  if (!report.b_code_shown) note('b_error', await txt('.rosie-error'));
  await sleep(300); await shot('b-pairing-code-1920.png');
  const code = (await txt('.rosie-code')).replace('-', '');
  note('b_code_len', code.length);
  const exeNamed = join(work, `Rosie-${code}.exe`); copyFileSync(EXE, exeNamed);
  const exe = spawn(exeNamed, ['--base', BASE], { env: { ...process.env, ROSIE_HOME: join(work, 'exe-home') }, stdio: 'ignore' }); kids.push(exe);
  note('c_connected', await until(`/Rosie is connected/.test(document.querySelector('.rosie-progress')?.textContent ?? '')`, 40000));
  await sleep(300); await shot('c-rosie-connected-1920.png');
  note('c_words', await txt('.rosie-progress'));
  note('c_code_gone', await run(`!document.querySelector('.rosie-code')`));
  // she goes quiet: the app says so in words
  spawn('taskkill', ['/F', '/T', '/PID', String(exe.pid)], { stdio: 'ignore' }); // the exe is a one-file bundle: kill the whole tree
  note('d_asleep', await until(`/Rosie is asleep, start her again/.test(document.querySelector('.rosie-progress')?.textContent ?? '')`, 90000));
  await sleep(300); await shot('d-rosie-asleep-1920.png');
  note('d_words', await txt('.rosie-progress'));
  note('d_choose_disabled', await run(`document.querySelector('.rosie-go')?.disabled ?? null`));
  // start her again (same exe, saved pairing, no new code): she is awake at once. She must be awake to take the unpair command.
  const exe2 = spawn(exeNamed, ['--base', BASE], { env: { ...process.env, ROSIE_HOME: join(work, 'exe-home') }, stdio: 'ignore' }); kids.push(exe2);
  note('d2_restarted', await until(`/Rosie is connected/.test(document.querySelector('.rosie-progress')?.textContent ?? '')`, 60000));
  // unpair, pair again with the agent code (fixed folder)
  await run(`[...document.querySelectorAll('.rosie-unpair-btn')].find(Boolean).click()`);
  await until(`!!document.querySelector('.rosie-go') && /Get a pairing code/.test(document.querySelector('.rosie-go').textContent)`);
  await run(`document.querySelector('.rosie-go').click()`);
  await until(`!!document.querySelector('.rosie-code')`);
  const code2 = (await txt('.rosie-code')).replace('-', '');
  const agent = spawn('python', [RUNNER, PKG, BASE, code2, join(work, 'agent-home'), folder], { stdio: 'inherit' }); kids.push(agent);
  note('e_connected', await until(`/Rosie is connected/.test(document.querySelector('.rosie-progress')?.textContent ?? '')`, 40000));
  await run(`document.querySelector('.rosie-go').click()`);
  // catch the folder being chosen or read, then ready
  const t0 = Date.now(); let seen = null;
  while (Date.now() - t0 < 30000) {
    const st = await run(`document.querySelector('.rosie-progress')?.dataset.state ?? ''`);
    if (st === 'choosing_folder' || st === 'reading' || st === 'indexing') { seen = st; await shot('e-choosing-folder-1920.png'); break; }
    if (st === 'ready') break;
    await sleep(30);
  }
  note('e_state_seen', { state: seen, text: await txt('.rosie-progress') });
  note('f_ready', await until(`document.querySelector('.rosie-progress')?.dataset.state === 'ready'`, 60000));
  await sleep(600); await shot('f-ready-1920.png');
  note('f_text', await txt('.rosie-progress'));
  note('f_source', await run(`[...document.querySelectorAll('.rosie-source-btn')].map((b) => b.textContent + ':' + b.getAttribute('aria-pressed'))`));
  // ask the folder: path + KID + machine
  await run(`(() => { const i = document.querySelector('#chat-message'); i.value = 'Where is the passphrase kept?'; i.dispatchEvent(new Event('input')); })()`);
  await run(`document.querySelector('.chat-composer').requestSubmit()`);
  note('g_answered', await until(`!!document.querySelector('.repo-citation') || !!document.querySelector('.chat-error .error-state')`, 60000));
  await sleep(800); await shot('g-answer-path-kid-1920.png');
  note('g_answer', await run(`({ text: document.querySelector('.repo-turn .bubble-text')?.textContent, cites: [...document.querySelectorAll('.repo-citation')].map((c) => [c.querySelector('.repo-machine')?.textContent ?? null, c.querySelector('.repo-path').textContent, c.querySelector('.repo-kid')?.textContent ?? null]) })`));
  // detach: the folder goes, the book is asked again
  await run(`document.querySelector('.rosie-detach-btn').click()`);
  note('h_detached', await until(`!document.querySelector('.rosie-source') && /Rosie is connected/.test(document.querySelector('.rosie-progress')?.textContent ?? '')`, 20000));
  await sleep(500); await shot('h-detached-1920.png');
  note('h_placeholder', await run(`document.querySelector('#chat-message')?.placeholder ?? null`));
  note('h_ask_after', await run(`fetch('/api/rosie/ask', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Sherlock-Session': localStorage.getItem('sherlock-github-session') }, body: JSON.stringify({ question: 'x' }) }).then(async (r) => r.status + ' ' + JSON.stringify((await r.json()).detail?.error))`));
  // unpair at the end
  await run(`document.querySelector('.rosie-unpair-btn').click()`);
  note('i_unpaired', await until(`!document.querySelector('.rosie-progress') || document.querySelector('.rosie-progress')?.dataset.state === 'not_paired'`, 20000));
  await sleep(500);
  note('i_agent_stopped', await new Promise((r) => { const t = setTimeout(() => r(false), 40000); agent.on('exit', () => { clearTimeout(t); r(true); }); if (agent.exitCode !== null) { clearTimeout(t); r(true); } }));
} finally {
  writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
  cleanup();
}
process.exit(0);



