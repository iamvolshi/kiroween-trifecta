import type { SeamAdapter } from './adapter/seam.ts';
import { Router } from './router/router.ts';

/**
 * Boots the app into ppEl.
 *
 * The Router constructor resolves the current URL, so deep links stand as they
 * are. Only the bare root / is redirected, via replaceState before the Router
 * is constructed: no NotFound flash and no extra history entry.
 */
export function boot(adapter: SeamAdapter, appEl: HTMLElement): Router {
  if (window.location.pathname === '/') {
    window.history.replaceState({}, '', '/actions');
  }
  return new Router(adapter, appEl);
}