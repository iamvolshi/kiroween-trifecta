import type { SeamAdapter } from './seam.ts';
import { createMockAdapter } from './mock.ts';
import { createLiveAdapter } from './live.ts';

/**
 * Which adapter the app runs on: the ONE switch. It follows the connector
 * base URL: set VITE_CONNECTOR_URL at build time (e.g. in audit-ui/.env.local,
 * `VITE_CONNECTOR_URL=http://127.0.0.1:8787`) and the app runs live;
 * leave it unset and the app runs on the scripted mock. `createActiveAdapter()`
 * builds the adapter from it and the chrome labels (seam chip, MOCK DATA
 * badge, the chat's mock note) read the same constant, so the data and its
 * label cannot disagree.
 */
export const LIVE_BASE_URL: string = String(import.meta.env.VITE_CONNECTOR_URL ?? '').trim();

export const ACTIVE_ADAPTER_KIND: 'mock' | 'live' = LIVE_BASE_URL === '' ? 'mock' : 'live';

export function createAdapterFor(kind: 'mock' | 'live'): SeamAdapter {
  return kind === 'mock' ? createMockAdapter() : createLiveAdapter(LIVE_BASE_URL);
}

export function createActiveAdapter(): SeamAdapter {
  return createAdapterFor(ACTIVE_ADAPTER_KIND);
}
