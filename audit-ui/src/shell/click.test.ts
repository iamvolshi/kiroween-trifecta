/**
 * playClick: a light tiny click, synthesised, silent when the browser has
 * no AudioContext. Order matters in this file: the module caches its
 * context once created, so the silent path is tested before the fake one.
 */
import { describe, expect, it } from 'vitest';
import { playClick } from './click.ts';

describe('playClick', () => {
  it('is silent when the browser has no AudioContext', () => {
    expect((window as unknown as { AudioContext?: unknown }).AudioContext).toBeUndefined();
    expect(() => playClick()).not.toThrow();
  });

  it('plays a short quiet blip when AudioContext exists', () => {
    const calls: string[] = [];
    class FakeOscillator {
      type = '';
      frequency = { setValueAtTime: () => { calls.push('freq'); } };
      connect = () => { calls.push('osc-connect'); };
      start = () => { calls.push('start'); };
      stop = () => { calls.push('stop'); };
    }
    class FakeGain {
      gain = {
        setValueAtTime: () => { calls.push('gain-set'); },
        exponentialRampToValueAtTime: () => { calls.push('gain-ramp'); },
      };
      connect = () => { calls.push('gain-connect'); };
    }
    class FakeContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator = () => new FakeOscillator();
      createGain = () => new FakeGain();
      resume = () => Promise.resolve();
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
    try {
      playClick();
    } finally {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    }
    expect(calls).toContain('start');
    expect(calls).toContain('stop');
    expect(calls).toContain('gain-ramp');
  });
});
