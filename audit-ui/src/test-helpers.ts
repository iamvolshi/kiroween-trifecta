import type { Entry, SeamAdapter } from './adapter/seam.ts';

/** Test-only helpers (mock data). Not imported by app code. */

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    kid: 1,
    subject: 'temperature',
    state: 'confirmed',
    authority: 5,
    pool: 'pool-x',
    k_start: '2024-01-01T00:00:00.000Z',
    t_time: '2024-01-01T00:05:00.000Z',
    e_time: '2024-01-01T00:03:00.000Z',
    k_time: '2024-02-01T00:00:00.000Z',
    evidence: 'ev',
    reason: 'why',
    prev_hash: '0000',
    ...overrides,
  };
}

export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Resolves when `release()` is called; lets a test order async completions. */
export function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * The five assembly methods, each answering a typed error. Spread into a
 * hand-built record-only fake adapter so it still satisfies SeamAdapter.
 */
export function assemblyNotUsed(): Pick<
  SeamAdapter,
  'ask' | 'chat' | 'update' | 'fetchLessons' | 'fetchRecord'
> {
  const err = { ok: false as const, error: 'not used in this test' };
  return {
    ask: async () => err,
    chat: async () => err,
    update: async () => err,
    fetchLessons: async () => err,
    fetchRecord: async () => err,
  };
}
