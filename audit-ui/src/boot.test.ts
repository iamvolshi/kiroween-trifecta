/**
 * Boot decision (task 2): deep links survive boot; only exactly "/" redirects.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRecordStub } from './test-helpers.ts';
import { boot } from './boot.ts';
import { tick } from './test-helpers.ts';
import type { Router } from './router/router.ts';

describe('boot', () => {
  let router: Router | undefined;
  let app: HTMLElement | undefined;

  afterEach(() => {
    router?.destroy();
    app?.remove();
    router = undefined;
    app = undefined;
  });

  function bootAt(path: string): { before: number } {
    window.history.replaceState({}, '', path);
    const before = window.history.length;
    app = document.createElement('div');
    document.body.appendChild(app);
    router = boot(createRecordStub(), app);
    return { before };
  }

  it('keeps /time-travel and adds no history entry', () => {
    const { before } = bootAt('/time-travel');
    expect(window.location.pathname).toBe('/time-travel');
    expect(window.history.length).toBe(before);
    expect(app!.querySelector('.time-travel-view')).not.toBeNull();
  });

  it('keeps an /entry/... deep link and shows that entry', async () => {
    const { before } = bootAt('/entry/1/temperature/entry-b1');
    await tick();
    expect(window.location.pathname).toBe('/entry/1/temperature/entry-b1');
    expect(window.history.length).toBe(before);
    expect(app!.querySelector('.entry-primary .state')?.textContent).toBe('revised');
  });

  it('keeps an unknown path as NotFound (no redirect)', () => {
    bootAt('/nope');
    expect(window.location.pathname).toBe('/nope');
    expect(app!.querySelector('.not-found')).not.toBeNull();
  });

  it('redirects exactly "/" to /actions without a NotFound flash or new history entry', () => {
    const { before } = bootAt('/');
    expect(window.location.pathname).toBe('/actions');
    expect(window.history.length).toBe(before);
    expect(app!.querySelector('.not-found')).toBeNull();
    expect(app!.querySelector('h1')?.textContent).toBe('Action List');
  });
});