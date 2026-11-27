import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
// usage: node shots.mjs <distDir> <outDir>. Serves the built app on :4179 (built against the stub connector on :8799, a test double).
const [dist, outDir] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = createServer((q, r) => {
  const p = resolve(dist, '.' + decodeURIComponent(q.url.split('?')[0]));
  const f = existsSync(p) && extname(p) ? p : join(dist, 'index.html');
  r.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(4179, '127.0.0.1');
const port = 9393;
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'chrome-tw-' + Date.now())}`, '--no-first-run', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 150 && !ws; i++) { try { const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); if (page) { const s = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => s.addEventListener('open', r)); ws = s; } } catch {} if (!ws) await sleep(200); }
ws.addEventListener('message', (m) => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const run = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const until = async (expr, ms = 20000) => { for (let t = 0; t < ms; t += 250) { if (await run(expr)) return true; await sleep(250); } return false; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64')); };
const report = {}; const note = (k, v) => { report[k] = v; console.log(k, JSON.stringify(v)); };
try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  // Real key events through the browser's input pipeline.
  const press = async (key, text) => {
    await run(`window.__t += 0.12`);
    const code = key.length === 1 ? (/[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : 'Space') : key;
    await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, text, windowsVirtualKeyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : ({ Backspace: 8, Shift: 16, ArrowLeft: 37 })[key] });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    await sleep(40);
  };
  const pickVoice = async () => { await until(`[...document.querySelectorAll('.chat-view button')].some((b) => b.textContent.includes('[BOOK]'))`); await run(`[...document.querySelectorAll('.chat-view button')].find((b) => b.textContent.includes('[BOOK]')).click()`); await until(`!document.querySelector('#chat-message').disabled`); };
  await send('Page.navigate', { url: 'http://127.0.0.1:4179/chat' });
  await until(`!!document.querySelector('#chat-message')`); await sleep(500);
  await pickVoice();
  note('toggle_initial', await run(`document.querySelector('.chat-sound').textContent`));
  // Offline context standing in for the speakers: records every strike and renders them to a WAV. Time advances 0.12 s per key.
  await run(`(() => { window.__t = 0.05; window.__log = []; window.__key = '';
    addEventListener('keydown', (e) => { window.__key = e.key; }, true);
    window.AudioContext = class extends OfflineAudioContext { constructor() { super(1, 44100 * 3, 44100); window.__ctx = this; }
      get currentTime() { return window.__t; }
      createBufferSource() { window.__log.push({ key: window.__key, at: +window.__t.toFixed(2) }); return super.createBufferSource(); } }; })()`);
  await run(`document.querySelector('#chat-message').focus()`);
  for (const ch of 'Hello') await press(ch, ch);
  await press('Shift'); await press('ArrowLeft'); await press('Backspace');
  await sleep(300);
  note('log_sound_on', await run(`window.__log`));
  await shot('a-composer-sound-on-1920.png');
  await run(`document.querySelector('.chat-sound').click()`);
  note('toggle_after_click', await run(`document.querySelector('.chat-sound').textContent + ' / ' + localStorage.getItem('typewriter-sound')`));
  await run(`document.querySelector('#chat-message').focus()`);
  const before = await run(`window.__log.length`);
  for (const ch of ' now') await press(ch, ch);
  await sleep(300);
  note('strikes_while_muted', (await run(`window.__log.length`)) - before);
  note('typed_text_lands', await run(`document.querySelector('#chat-message').value`));
  await shot('b-composer-sound-off-1920.png');
  // WAV of the strikes made while sound was on (rendered offline).
  const wav = await run(`(async () => { const b = await window.__ctx.startRendering(); const d = b.getChannelData(0); const n = Math.floor(44100 * 1.1); const u = new Uint8Array(44 + n * 2); const v = new DataView(u.buffer);
    const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    let peak = 0; for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(d[i])); v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true); }
    let bin = ''; for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode(...u.subarray(i, i + 8192)); return JSON.stringify({ peak, b64: btoa(bin) }); })()`);
  const w = JSON.parse(wav); note('wav_peak', w.peak);
  writeFileSync(join(outDir, 'typewriter-strikes-offline.wav'), Buffer.from(w.b64, 'base64'));
  // Reload: mute must survive.
  await send('Page.navigate', { url: 'http://127.0.0.1:4179/chat' });
  await sleep(500); await until(`!!document.querySelector('.chat-sound')`);
  await pickVoice();
  note('after_reload', await run(`document.querySelector('.chat-sound').textContent + ' / pressed=' + document.querySelector('.chat-sound').getAttribute('aria-pressed') + ' / ' + localStorage.getItem('typewriter-sound')`));
  await shot('c-after-reload-still-muted-1920.png');
  // Layout: the toggle sits inside the composer, nothing overflows.
  note('layout', await run(`(() => { const f = document.querySelector('.chat-composer'); const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { form: r(f), input: r(f.querySelector('input')), toggle: r(f.querySelector('.chat-sound')), send: r(f.querySelector('.chat-send')), overflow: f.scrollWidth > f.clientWidth }; })()`));
} finally {
  writeFileSync(join(outDir, 'shot-report.json'), JSON.stringify(report, null, 2));
  try { await send('Browser.close'); } catch {}
  proc.kill(); srv.close(); setTimeout(() => process.exit(0), 500);
}