import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
// usage: node mini-shot.mjs <distDir> <outDir>
const [dist, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = createServer((q, r) => {
  const p = resolve(dist, '.' + decodeURIComponent(q.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(dist, 'index.html');
  r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(4177, '127.0.0.1');
const origin = 'http://127.0.0.1:4177';
const port = 9391;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve(outDir, '..', '.chrome-mini')}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await run(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const state = `({ path: location.pathname, pane: document.querySelector('.shell-right')?.dataset.pane ?? null, telemetry: !!document.querySelector('.shell-right .telemetry'), mini: !!document.querySelector('.shell-right .mini-chat'),
  scrollW: document.documentElement.scrollWidth, innerW: innerWidth, rightH: Math.round(document.querySelector('.shell-right').getBoundingClientRect().height),
  composerBottomInPane: (() => { const r = document.querySelector('.shell-right').getBoundingClientRect(); const c = document.querySelector('.shell-right .chat-composer, .shell-center .chat-composer'); return c ? Math.round(c.getBoundingClientRect().bottom) + ' / pane bottom ' + Math.round(r.bottom) + ' / viewport ' + innerHeight : null; })(),
  transcript: [...document.querySelectorAll('.shell-center .chat-user, .shell-right .chat-user')].map(e => e.textContent) })`;
const goto = async (path) => { await run(`history.pushState({}, '', '${path}'); dispatchEvent(new PopStateEvent('popstate'))`); await sleep(2500); };
const see = async () => run(`document.querySelector('.shell-right').scrollIntoView()`);
await send('Page.enable');
const report = {};
for (const [w, h, mobile, tag] of [[1920, 1080, false, 'desktop'], [390, 844, true, 'phone']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await send('Page.navigate', { url: origin + '/chat' });
  await until(`!!document.querySelector('.rail-button')`);
  await sleep(3000);
  await shot(`chat-telemetry-${tag}.png`);
  report[`${tag}-chat`] = await run(state);
  for (const p of ['calendar', 'research']) {
    await goto('/' + p);
    await until(`!!document.querySelector('.shell-right .voice-picker')`, 90000);
    await see(); await sleep(500);
    await shot(`${p}-mini-chat-${tag}.png`);
    report[`${tag}-${p}`] = await run(state);
  }
  await goto('/calendar');
  await run(`document.querySelector('.shell-right .voice-picker [data-voice]').click()`); await sleep(500);
  await run(`(() => { const i = document.querySelector('.shell-right #chat-message'); i.value = 'Hello from the mini chat (${tag})'; document.querySelector('.shell-right .chat-composer').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()`);
  const replied = await until(`!!document.querySelector('.shell-right .chat-reply') || !!document.querySelector('.shell-right .chat-error .error-state')`, 150000);
  await sleep(1000); await see();
  await shot(`mini-chat-sent-${tag}.png`);
  report[`${tag}-sent-in-mini`] = { replied, ...(await run(state)), error: await run(`document.querySelector('.shell-right .chat-error')?.textContent ?? null`) };
  await run(`document.querySelector('.rail-button[data-rail="chat"]').click()`);
  await until(`location.pathname === '/chat'`); await sleep(2500);
  await run(`window.scrollTo(0, 0)`);
  await shot(`chat-shows-mini-message-${tag}.png`);
  report[`${tag}-chat-after-send`] = await run(state);
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
ws.close(); proc.kill(); srv.close(); process.exit(0);