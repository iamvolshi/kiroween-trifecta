/**
 * Router link handling: modified clicks (task 8), encoded entry ids (task 9),
 * malformed percent-encoding (task 12).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from './router.ts';
import { createMockAdapter } from '../adapter/mock.ts';
import { ActionListView } from '../views/action-list.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import type { Entry } from '../adapter/seam.ts';

let container: HTMLElement;
let router: Router;

function start(entries?: Entry[], path = '/actions') {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createMockAdapter(entries), container);
}

afterEach(() => {
  router.destroy();
  container.remove();
  vi.restoreAllMocks();
});

describe('click handling', () => {
  beforeEach(() => start());

  /** Click the Time Travel nav link; report whether the router consumed it. */
  function click(init: MouseEventInit): { prevented: boolean } {
    const a = container.querySelector<HTMLAnchorElement>('nav a[href="/time-travel"]')!;
    let prevented = false;
    // Registered after the router's listener: observes its decision, then stops
    // jsdom from attempting a real navigation.
    const spy = (e: Event) => {
      prevented = e.defaultPrevented;
      e.preventDefault();
    };
    document.addEventListener('click', spy);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
    document.removeEventListener('click', spy);
    return { prevented };
  }

  it('plain left click navigates in-app', () => {
    const { prevented } = click({ button: 0 });
    expect(prevented).toBe(true);
    expect(window.location.pathname).toBe('/time-travel');
  });

  for (const [name, init] of [
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
    ['right button', { button: 2 }],
  ] as const) {
    it(`${name}+click passes through to the browser`, () => {
      const { prevented } = click({ button: 0, ...init });
      expect(prevented).toBe(false);
      expect(window.location.pathname).toBe('/actions');
    });
  }
});

describe('entry ids in links', () => {
  it('an id containing / ? # % links to a route that resolves to that entry', async () => {
    const weird = 'a/b?c#d%e';
    start([makeEntry({ id: weird, reason: 'WEIRD-ID-REASON' })]);
    await tick();

    const a = container.querySelector<HTMLAnchorElement>('.action-list a')!;
    const href = a.getAttribute('href')!;
    expect(href.endsWith('/' + encodeURIComponent(weird))).toBe(true);

    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await tick();
    expect(container.querySelector('.entry-primary')).not.toBeNull();
    expect(container.querySelector('.entry-primary .reason')?.textContent).toBe('WEIRD-ID-REASON');
    expect(container.querySelector('.entry-not-found')).toBeNull();
  });

  it('ActionListView alone emits an encoded id', async () => {
    const c = document.createElement('div');
    const view = new ActionListView(createMockAdapter([makeEntry({ id: 'x/y' })]));
    view.mount(c);
    await tick();
    expect(c.querySelector('.action-list a')!.getAttribute('href')).toBe('/entry/1/temperature/x%2Fy');
    view.unmount();
  });
});

describe('malformed percent-encoding', () => {
  it('renders NotFound with no thrown error (navigate)', () => {
    start();
    expect(() => router.navigate('/entry/1/%E0%A4%A/x')).not.toThrow();
    expect(container.querySelector('.not-found')).not.toBeNull();
    expect(container.querySelector('.entry-primary')).toBeNull();
  });

  it('renders NotFound with no thrown error (initial load / deep link)', () => {
    router = undefined as unknown as Router;
    window.history.replaceState({}, '', '/entry/1/ok/%E0%A4%A');
    container = document.createElement('div');
    document.body.appendChild(container);
    expect(() => {
      router = new Router(createMockAdapter(), container);
    }).not.toThrow();
    expect(container.querySelector('.not-found')).not.toBeNull();
  });
});