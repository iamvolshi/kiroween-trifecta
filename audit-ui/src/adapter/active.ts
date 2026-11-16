/**
 * Which adapter the app runs on. Read by the chrome so the data source is
 * always labeled. Switch to 'live' only together with main.ts, when the live
 * seam is confirmed (unresolved GRAY: trifecta /record vs katied).
 */
export const ACTIVE_ADAPTER_KIND: 'mock' | 'live' = 'mock';
