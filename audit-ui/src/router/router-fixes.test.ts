/**
 * Regression tests: router link filtering (//host, target, download) and
 * path normalisation (trailing slash, query, hash).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Router } from './router.ts';
import { createMockAdapter } from '../adapter/mock.ts';

let container: HTMLElement;
let router: Router;

function start(path = '/actions') {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createMockAdapter(), container);
}

afterEach(() => {
  router.destroy();
  container.remove();
  vi.restoreAllMocks();
});

/** Click a bare anchor; report whether the router consumed the click. */
function clickAnchor(attrs: Record<string, string>): boolean {
  const a = document.createElement('a');
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  container.appendChild(a);
  let prevented = false;
  const spy = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', spy);
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  document.removeEventListener('click', spy);
  return prevented;
}

describe('link filtering', () => {
  it('protocol-relative //host link is left to the browser', () => {
    start();
    const push = vi.spyOn(window.history, 'pushState');
    expect(clickAnchor({ href: '//other.example/x' })).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it('target=_blank link is left to the browser', () => {
    start();
    expect(clickAnchor({ href: '/time-travel', target: '_blank' })).toBe(false);
    expect(window.location.pathname).toBe('/actions');
  });

  it('download link is left to the browser', () => {
    start();
    expect(clickAnchor({ href: '/time-travel', download: '' })).toBe(false);
    expect(window.location.pathname).toBe('/actions');
  });

  it('target=_self link still navigates in-app', () => {
    start();
    expect(clickAnchor({ href: '/time-travel', target: '_self' })).toBe(true);
    expect(window.location.pathname).toBe('/time-travel');
  });
});

describe('path normalisation', () => {
  it('trailing slash resolves to the route', () => {
    start();
    router.navigate('/time-travel/');
    expect(container.querySelector('.not-found')).toBeNull();
    expect(container.querySelector('.time-travel-view')).not.toBeNull();
  });

  it('query string is ignored when matching', () => {
    start();
    router.navigate('/time-travel?x=1');
    expect(container.querySelector('.not-found')).toBeNull();
    expect(container.querySelector('.time-travel-view')).not.toBeNull();
  });

  it('hash is ignored when matching', () => {
    start();
    router.navigate('/time-travel#top');
    expect(container.querySelector('.not-found')).toBeNull();
  });

  it('unknown path is still NotFound', () => {
    start();
    router.navigate('/nope/');
    expect(container.querySelector('.not-found')).not.toBeNull();
  });
});