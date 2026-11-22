/**
 * The first-load modal: it appears while the record service is still waking
 * and goes away the moment the left panel's list first settles — on success
 * and on failure alike.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRecordStub, createFailingStub, deferred, tick } from '../test-helpers.ts';
import { boot } from '../boot.ts';
import { LoadingModal, LOADING_LINE, LOADING_LINE_SLOW } from './loading-modal.ts';
import type { Router } from '../router/router.ts';
import type { SeamAdapter } from '../adapter/seam.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('LoadingModal (unit)', () => {
  let host: HTMLElement;
  let watch: HTMLElement;
  let modal: LoadingModal | undefined;

  afterEach(() => {
    modal?.hide();
    host?.remove();
    modal = undefined;
  });

  function setup(opts?: { showAfterMs?: number; slowAfterMs?: number }): void {
    host = document.createElement('div');
    watch = document.createElement('div');
    host.append(watch);
    document.body.append(host);
    modal = new LoadingModal(watch, host, opts);
  }

  it('stays hidden until the show delay, then shows the first line', async () => {
    setup({ showAfterMs: 20, slowAfterMs: 1000 });
    expect(host.querySelector('.loading-modal.loading-hidden')).not.toBeNull();
    await sleep(40);
    const el = host.querySelector('.loading-modal');
    expect(el).not.toBeNull();
    expect(el!.classList.contains('loading-hidden')).toBe(false);
    expect(host.querySelector('.loading-line')?.textContent).toBe(LOADING_LINE);
  });

  it('swaps to the slow line after the slow delay', async () => {
    setup({ showAfterMs: 5, slowAfterMs: 30 });
    await sleep(60);
    expect(host.querySelector('.loading-line')?.textContent).toBe(LOADING_LINE_SLOW);
  });

  it('goes away when the watched list first gets children', async () => {
    setup({ showAfterMs: 5, slowAfterMs: 1000 });
    await sleep(20);
    expect(host.querySelector('.loading-modal')).not.toBeNull();
    watch.append(document.createElement('p'));
    await tick();
    expect(host.querySelector('.loading-modal')).toBeNull();
  });

  it('goes away on the Hide button', async () => {
    setup({ showAfterMs: 5, slowAfterMs: 1000 });
    await sleep(20);
    (host.querySelector('.loading-hide') as HTMLButtonElement).click();
    expect(host.querySelector('.loading-modal')).toBeNull();
  });
});

describe('LoadingModal at boot', () => {
  let router: Router | undefined;
  let app: HTMLElement | undefined;

  afterEach(() => {
    router?.destroy();
    app?.remove();
    router = undefined;
    app = undefined;
  });

  it('shows while the record read is pending and hides when it settles', async () => {
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
    // Past the 300ms show delay, the load still pending: the modal is up.
    await sleep(400);
    expect(app.querySelector('.loading-modal')).not.toBeNull();
    expect(app.querySelector('.loading-modal.loading-hidden')).toBeNull();
    expect(app.querySelector('.loading-line')?.textContent).toBe(LOADING_LINE);

    entriesGate.resolve({ ok: true, data: [] });
    lessonsGate.resolve({ ok: true, data: [] });
    await tick();
    await tick();
    expect(app.querySelector('.loading-modal')).toBeNull();
  });

  it('hides when a rail tap swaps the list away before it settles', async () => {
    const entriesGate = deferred<Awaited<ReturnType<SeamAdapter['fetchAllEntries']>>>();
    window.history.replaceState({}, '', '/chat');
    app = document.createElement('div');
    document.body.appendChild(app);
    router = boot(createRecordStub([], { fetchAllEntries: () => entriesGate.promise }), app);
    await sleep(400);
    expect(app.querySelector('.loading-modal.loading-hidden')).toBeNull(); // up
    app.querySelector<HTMLButtonElement>('.rail-button[data-rail="lessons"]')!.click();
    await tick();
    expect(app.querySelector('.loading-modal')).toBeNull();
    entriesGate.resolve({ ok: true, data: [] });
  });

  it('hides when the record read fails (the error state is the answer)', async () => {
    window.history.replaceState({}, '', '/chat');
    app = document.createElement('div');
    document.body.appendChild(app);
    router = boot(createFailingStub('connector asleep'), app);
    await tick();
    await tick();
    expect(app.querySelector('.loading-modal')).toBeNull();
    expect(app.querySelector('.error-state')).not.toBeNull();
  });
});
