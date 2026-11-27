/**
 * Typewriter sound: the strike fires on keys that change text, stays silent
 * for modifiers and navigation, honours the mute, and never throws without an
 * AudioContext. The silent-path test runs first: the module caches its context.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { attachTypewriter, isSoundOn, setSoundOn } from './typewriter.ts';

const w = window as unknown as { AudioContext?: unknown };

function key(input: HTMLElement, k: string, init: KeyboardEventInit = {}): void {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));
}
const flush = (): Promise<void> => Promise.resolve().then(() => undefined);

let starts = 0;
class FakeNode {
  gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  frequency = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  Q = { setValueAtTime() {} };
  buffer: unknown = null;
  type = '';
  connect() {}
  start() { starts++; }
  stop() {}
}
class FakeContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) });
  createBufferSource = () => new FakeNode();
  createBiquadFilter = () => new FakeNode();
  createGain = () => new FakeNode();
  createOscillator = () => new FakeNode();
  resume = () => Promise.resolve();
}

function setup(): HTMLInputElement {
  const input = document.createElement('input');
  attachTypewriter(input);
  return input;
}

describe('typewriter sound', () => {
  afterEach(() => { localStorage.clear(); delete w.AudioContext; starts = 0; });

  it('does not throw without an AudioContext', async () => {
    expect(w.AudioContext).toBeUndefined();
    const input = setup();
    expect(() => key(input, 'a')).not.toThrow();
    await flush();
  });

  it('strikes on a character, Enter and Backspace', async () => {
    w.AudioContext = FakeContext;
    const input = setup();
    key(input, 'a'); key(input, 'Enter'); key(input, 'Backspace');
    await flush();
    expect(starts).toBe(6); // noise + body per key
  });

  it('is silent for modifiers, navigation and shortcuts', async () => {
    w.AudioContext = FakeContext;
    const input = setup();
    for (const k of ['Shift', 'Control', 'Alt', 'Meta', 'ArrowLeft', 'Tab', 'Escape', 'Home']) key(input, k);
    key(input, 'c', { ctrlKey: true });
    await flush();
    expect(starts).toBe(0);
  });

  it('is silent when muted, and the mute persists across a fresh button', async () => {
    w.AudioContext = FakeContext;
    const input = document.createElement('input');
    const btn = attachTypewriter(input);
    btn.click();
    expect(isSoundOn()).toBe(false);
    expect(localStorage.getItem('typewriter-sound')).toBe('off');
    key(input, 'a');
    await flush();
    expect(starts).toBe(0);
    expect(attachTypewriter(document.createElement('input')).textContent).toBe('Sound off');
    setSoundOn(true);
    key(input, 'a');
    await flush();
    expect(starts).toBe(2);
  });
});