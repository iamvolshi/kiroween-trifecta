/**
 * The first-load splash story: the announcement first, short beats
 * about three seconds each, looping back to the announcement, click
 * to enter always present and entering at once. Nothing in it waits
 * on or mentions the backend.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRecordStub, createFailingStub, deferred, tick } from '../test-helpers.ts';
import { boot } from '../boot.ts';
import {
  SplashStory,
  SPLASH_BEAT_MS,
  SPLASH_HEADLINE,
  SPLASH_OPENING,
  SPLASH_BEATS,
  SPLASH_ENTER_LABEL,
} from './splash-story.ts';
import type { Router } from '../router/router.ts';
import type { SeamAdapter } from '../adapter/seam.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SplashStory (unit)', () => {
  let host: HTMLElement;
  let splash: SplashStory | undefined;

  afterEach(() => {
    splash?.enter();
    host?.remove();
    splash = undefined;
  });

  function setup(beatMs = 30): void {
    host = document.createElement('div');
    document.body.append(host);
    splash = new SplashStory(host, { beatMs });
  }

  function opening(): string[] {
    return [...host.querySelectorAll('.splash-opening p')].map((p) => p.textContent ?? '');
  }

  it('opens on the announcement, enter always present', () => {
    setup();
    expect(host.querySelector('.splash-story')).not.toBeNull();
    expect(host.querySelector('.splash-headline')?.textContent).toBe(SPLASH_HEADLINE);
    expect(opening()).toEqual(SPLASH_OPENING);
    const enter = host.querySelector('.splash-enter') as HTMLButtonElement;
    expect(enter?.textContent).toBe(SPLASH_ENTER_LABEL);
  });

  it('advances about every beat, and the loop opens and closes on the announcement', () => {
    vi.useFakeTimers();
    try {
      setup(3000);
      expect(SPLASH_BEAT_MS).toBe(3000);
      expect(host.querySelector('.splash-headline')).not.toBeNull();
      vi.advanceTimersByTime(3000);
      expect(host.querySelector('.splash-beat')?.textContent).toBe(SPLASH_BEATS[0]);
      expect(host.querySelector('.splash-enter')).not.toBeNull();
      vi.advanceTimersByTime(3000);
      expect(host.querySelector('.splash-beat')?.textContent).toBe(SPLASH_BEATS[1]);
      expect(host.querySelector('.splash-beat')?.textContent).toContain(
        'ERIE, KATIE, ELLE, ARCHE, SHERLOCK, PEEP, RATR, CURATOR, WATSON, ROSIE, TEMPE',
      );
      vi.advanceTimersByTime(3000);
      expect(host.querySelector('.splash-beat')?.textContent).toBe(SPLASH_BEATS[2]);
      vi.advanceTimersByTime(3000);
      expect(host.querySelector('.splash-headline')?.textContent).toBe(SPLASH_HEADLINE);
      expect(opening()).toEqual(SPLASH_OPENING);
    } finally {
      vi.useRealTimers();
    }
  });

  it('enter removes it at once and stops the loop', () => {
    vi.useFakeTimers();
    try {
      setup(3000);
      vi.advanceTimersByTime(3000);
      expect(host.querySelector('.splash-beat')).not.toBeNull();
      (host.querySelector('.splash-enter') as HTMLButtonElement).click();
      expect(host.querySelector('.splash-story')).toBeNull();
      vi.advanceTimersByTime(30000);
      expect(host.querySelector('.splash-story')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('mentions nothing about the backend waking or loading', () => {
    setup();
    const text = host.querySelector('.splash-story')?.textContent ?? '';
    expect(text).not.toMatch(/loading|wake|waking|asleep|sleep|service|render/i);
  });
});

describe('SplashStory at boot', () => {
  let router: Router | undefined;
  let app: HTMLElement | undefined;

  afterEach(() => {
    router?.destroy();
    app?.remove();
    router = undefined;
    app = undefined;
  });

  it('shows at boot, stays up while the record read is pending, and does not go away when it settles', async () => {
    const entriesGate = deferred<Awaited<ReturnType<SeamAdapter['fetchAllEntries']>>>();
    const lessonsGate = deferred<Awaited<ReturnType<SeamAdapter['fetchLessons']>>>();
    window.history.replaceState({}, '', '/chat');
    app = document.createElement('div');
    document.body.appendChild(app);
    router = boot(
      createRecordStub([], {
        fetchAllEntries: () => entriesGate.promise,
        fetchLessons: () => lessonsGate.promise,
      }),
      app,
    );
    await sleep(400);
    expect(app.querySelector('.splash-story')).not.toBeNull();
    expect(app.querySelector('.splash-headline')).not.toBeNull();
    entriesGate.resolve({ ok: true, data: [] });
    lessonsGate.resolve({ ok: true, data: [] });
    await tick();
    await tick();
    // No Render gating: the record settling does not dismiss the splash.
    expect(app.querySelector('.splash-story')).not.toBeNull();
    (app.querySelector('.splash-enter') as HTMLButtonElement).click();
    expect(app.querySelector('.splash-story')).toBeNull();
  });

  it('stays up when the record read fails', async () => {
    window.history.replaceState({}, '', '/chat');
    app = document.createElement('div');
    document.body.appendChild(app);
    router = boot(createFailingStub('connector asleep'), app);
    await tick();
    await tick();
    expect(app.querySelector('.splash-story')).not.toBeNull();
    expect(app.querySelector('.error-state')).not.toBeNull();
  });
});
