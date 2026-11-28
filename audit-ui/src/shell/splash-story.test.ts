/**
 * The first-load splash story: bullets first, short beats about three
 * seconds each, looping back to the bullets, click to enter always
 * present and entering at once. Nothing in it waits on or mentions
 * the backend.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRecordStub, createFailingStub, deferred, tick } from '../test-helpers.ts';
import { boot } from '../boot.ts';
import {
  SplashStory,
  SPLASH_BEAT_MS,
  SPLASH_BULLETS,
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

  function bullets(): string[] {
    return [...host.querySelectorAll('.splash-bullets li')].map((li) => li.textContent ?? '');
  }

  it('opens on the bullet list, 11 apps in caps, enter always present', () => {
    setup();
    expect(host.querySelector('.splash-story')).not.toBeNull();
    expect(bullets()).toEqual(SPLASH_BULLETS);
    expect(bullets()[0]).toContain('ERIE, KATIE, ELLE, ARCHE, SHERLOCK, PEEP, RATR, CURATOR, WATSON, ROSIE, TEMPE');
    const enter = host.querySelector('.splash-enter') as HTMLButtonElement;
    expect(enter?.textContent).toBe(SPLASH_ENTER_LABEL);
  });

  it('advances about every beat, and the loop opens and closes on the bullets', async () => {
    setup(30);
    expect(SPLASH_BEAT_MS).toBe(3000);
    expect(bullets().length).toBe(4);
    await sleep(40);
    expect(host.querySelector('.splash-beat')?.textContent).toBe(SPLASH_BEATS[0]);
    expect(host.querySelector('.splash-enter')).not.toBeNull();
    await sleep(40);
    expect(host.querySelector('.splash-beat')?.textContent).toBe(SPLASH_BEATS[1]);
    await sleep(40);
    expect(bullets()).toEqual(SPLASH_BULLETS);
    await sleep(40);
    expect(host.querySelector('.splash-beat')?.textContent).toBe(SPLASH_BEATS[0]);
  });

  it('enter removes it at once and stops the loop', async () => {
    setup(30);
    await sleep(40);
    expect(host.querySelector('.splash-beat')).not.toBeNull();
    (host.querySelector('.splash-enter') as HTMLButtonElement).click();
    expect(host.querySelector('.splash-story')).toBeNull();
    await sleep(80);
    expect(host.querySelector('.splash-story')).toBeNull();
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
    expect(app.querySelector('.splash-bullets li')).not.toBeNull();
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
