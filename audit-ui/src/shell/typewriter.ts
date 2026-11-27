/**
 * The typewriter strike a composer makes while you type. Synthesised with
 * Web Audio like click.ts: no audio file, no network, one shared context.
 * A filtered noise burst (the snap) plus a low sine thump (the body), about
 * 40 ms, a little different on every key. Silent when there is no
 * AudioContext (jsdom, old browsers). Sound is garnish: a failure is
 * swallowed and the keystroke always lands.
 */

const STORE_KEY = 'typewriter-sound';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
/** The choice for this page, kept even when storage is blocked. */
let memoryOff = false;

/** Sound is on unless the user turned it off. Storage that throws counts as on. */
export function isSoundOn(): boolean {
  if (memoryOff) return false;
  try {
    return window.localStorage.getItem(STORE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  memoryOff = !on;
  try {
    window.localStorage.setItem(STORE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
}

/** Keys that change the text: a single printable character, Enter, Backspace. */
export function changesText(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false;
  return e.key === 'Enter' || e.key === 'Backspace' || [...e.key].length === 1;
}

export function playStrike(): void {
  try {
    if (!isSoundOn()) return;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (typeof AC !== 'function') return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const v = 0.85 + Math.random() * 0.3; // per-key variation

    if (!noise) {
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(2400 * v, t);
    band.Q.setValueAtTime(1.2, t);
    const snap = ctx.createGain();
    snap.gain.setValueAtTime(0.09 * v, t);
    snap.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(band);
    band.connect(snap);
    snap.connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.04);

    const body = ctx.createOscillator();
    const thump = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(150 * v, t);
    body.frequency.exponentialRampToValueAtTime(70, t + 0.04);
    thump.gain.setValueAtTime(0.12, t);
    thump.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    body.connect(thump);
    thump.connect(ctx.destination);
    body.start(t);
    body.stop(t + 0.05);
  } catch {
    // Never let a sound break a keystroke.
  }
}

/** Play the strike after the key event, so typing is never held up. */
export function onTypewriterKey(e: KeyboardEvent): void {
  if (!changesText(e)) return;
  queueMicrotask(playStrike);
}

/** Wire a composer input and give back its small sound on/off button. */
export function attachTypewriter(input: HTMLInputElement): HTMLButtonElement {
  input.addEventListener('keydown', onTypewriterKey);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chat-sound';
  const paint = (): void => {
    const on = isSoundOn();
    btn.textContent = on ? 'Sound on' : 'Sound off';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', 'Typewriter sound');
  };
  btn.addEventListener('click', () => {
    setSoundOn(!(isSoundOn()));
    paint();
  });
  paint();
  return btn;
}