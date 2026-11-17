import type { SeamAdapter } from './seam.ts';
import { createMockAdapter } from './mock.ts';
import { createLiveAdapter } from './live.ts';

/**
 * Which adapter the app runs on: the ONE switch. `createActiveAdapter()`
 * builds the adapter from it and the chrome labels (seam chip, MOCK DATA
 * badge) read the same constant, so the data and its label cannot disagree.
 * Switch to 'live' only when the live seam is confirmed (unresolved GRAY:
 * trifecta /record vs katied).
 */
export const ACTIVE_ADAPTER_KIND: 'mock' | 'live' = 'mock';

/**
 * Live endpoint base URL. Deliberately empty: no endpoint is confirmed, and
 * the live adapter is a stub that answers every call with a typed error.
 */
export const LIVE_BASE_URL = '';

export function createAdapterFor(kind: 'mock' | 'live'): SeamAdapter {
  return kind === 'mock' ? createMockAdapter() : createLiveAdapter(LIVE_BASE_URL);
}

export function createActiveAdapter(): SeamAdapter {
  return createAdapterFor(ACTIVE_ADAPTER_KIND);
}
