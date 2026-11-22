import type { Entry, KidMap, SeamAdapter } from './adapter/seam.ts';
import { compareKStart, isLiveAt } from './util/interval.ts';

/** Test-only helpers and test doubles. Not imported by app code. */

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
  'ask' | 'curatorAsk' | 'chat' | 'update' | 'fetchLessons' | 'fetchRecord'
> {
  const err = { ok: false as const, error: 'not used in this test' };
  return {
    ask: async () => err,
    curatorAsk: async () => err,
    chat: async () => err,
    update: async () => err,
    fetchLessons: async () => err,
    fetchRecord: async () => err,
  };
}

// ---------------------------------------------------------------------------
// Record stub: a test double of the seam's record reads. Not app data: the
// app never imports this file. Four fixed entries with known live intervals:
//   A (kid 1, temperature) T0 -> T1, B (kid 1) T1 -> T2, C (kid 1) T2 -> T3,
//   D (kid 3, pressure) T0 -> T1.
// ---------------------------------------------------------------------------

const T0_MS = Date.parse('2024-01-01T00:00:00.000Z');
const T1_MS = Date.parse('2024-04-01T00:00:00.000Z');
const T2_MS = Date.parse('2024-07-01T00:00:00.000Z');
const T3_MS = Date.parse('2024-10-01T00:00:00.000Z');

export const STUB_ENTRIES: readonly Entry[] = Object.freeze([
  makeEntry({ id: 'entry-a1', kid: 1, subject: 'temperature', state: 'confirmed', authority: 7, pool: 'pool-alpha',
    k_start: '2024-01-01T00:00:00.000Z', t_time: '2024-01-01T00:05:00.000Z', e_time: '2024-01-01T00:03:00.000Z',
    k_time: '2024-04-01T00:00:00.000Z', evidence: 'sensor-reading-001', reason: 'initial confirmation',
    prev_hash: '0000000000000000' }),
  makeEntry({ id: 'entry-b1', kid: 1, subject: 'temperature', state: 'revised', authority: 8, pool: 'pool-alpha',
    k_start: '2024-04-01T00:00:00.000Z', t_time: '2024-04-01T00:05:00.000Z', e_time: '2024-04-01T00:03:00.000Z',
    k_time: '2024-07-01T00:00:00.000Z', evidence: 'sensor-reading-002', reason: 'revised after re-calibration',
    prev_hash: 'abcdef1234567890' }),
  makeEntry({ id: 'entry-c1', kid: 1, subject: 'temperature', state: 'rejected', authority: 2, pool: 'pool-alpha',
    k_start: '2024-07-01T00:00:00.000Z', t_time: '2024-07-01T00:05:00.000Z', e_time: '2024-07-01T00:03:00.000Z',
    k_time: '2024-10-01T00:00:00.000Z', evidence: 'sensor-reading-003', reason: 'rejected due to anomaly',
    prev_hash: 'fedcba0987654321' }),
  makeEntry({ id: 'entry-d3', kid: 3, subject: 'pressure', state: 'confirmed', authority: 7, pool: 'pool-beta',
    k_start: '2024-01-01T00:00:00.000Z', t_time: '2024-01-01T01:00:00.000Z', e_time: '2024-01-01T00:58:00.000Z',
    k_time: '2024-04-01T00:00:00.000Z', evidence: 'gauge-reading-001', reason: 'baseline pressure reading',
    prev_hash: '0000000000000000' }),
]);

/** Moments inside and around the stub entries' live intervals. */
export const STUB_TIMES = {
  insideT0T1: T0_MS + 1, // A and D
  insideT1T2: T1_MS + 1, // B
  insideT2T3: T2_MS + 1, // C
  beforeAll: T0_MS - 1,
  afterAll: T3_MS + 1,
  T0_MS, T1_MS, T2_MS, T3_MS,
} as const;

/** KID labels the record stub answers (KID 2 deliberately absent). */
export const STUB_KID_LABELS: KidMap = Object.freeze({ 1: 'sensor-alpha', 3: 'pressure-gauge' });

/**
 * A record-reads test double over `entries` (default STUB_ENTRIES), applying
 * the seam's interval rule. Chat, ask, update, lessons and record answer the
 * typed "not used in this test" error unless `extra` overrides them.
 */
export function createRecordStub(
  entries: readonly Entry[] = STUB_ENTRIES,
  extra: Partial<SeamAdapter> = {},
): SeamAdapter {
  const all = (): Entry[] => [...entries];
  return {
    fetchAllEntries: async () => ({ ok: true, data: all() }),
    fetchBeliefPool: async (m: number) => ({ ok: true, data: all().filter((e) => isLiveAt(e, m)) }),
    fetchChain: async (kid: number, subject: string) => ({
      ok: true,
      data: all().filter((e) => e.kid === kid && e.subject === subject).sort(compareKStart),
    }),
    fetchKidMap: async () => ({ ok: true, data: { ...STUB_KID_LABELS } }),
    ...assemblyNotUsed(),
    // The record for one account: entries whose subject starts with "<account>.".
    fetchRecord: async (accountId: string) => {
      const fields: Record<string, Entry[]> = {};
      for (const e of all().filter((x) => x.subject.startsWith(`${accountId}.`)).sort(compareKStart)) {
        (fields[e.subject] ??= []).push(e);
      }
      return { ok: true, data: { account_id: accountId, fields } };
    },
    ...extra,
  };
}

/** A test double whose every call answers `error`. */
export function createFailingStub(error = 'stub failure'): SeamAdapter {
  const err = { ok: false as const, error };
  return {
    fetchAllEntries: async () => err,
    fetchBeliefPool: async () => err,
    fetchChain: async () => err,
    fetchKidMap: async () => err,
    ask: async () => err,
    curatorAsk: async () => err,
    chat: async () => err,
    update: async () => err,
    fetchLessons: async () => err,
    fetchRecord: async () => err,
  };
}

/**
 * A /models test double for the chat: the three voices, each on a stub
 * route (no real provider or model id). `overrides` replaces routes, e.g.
 * { 'young-frankenstein': { error: '...' } } for an unconfigured voice.
 */
export function createModelsStub(
  overrides: Record<string, { provider: string; model: string } | { error: string }> = {},
  voices: string[] = ['movie', 'book', 'young-frankenstein'],
): { status: () => Promise<{ ok: true; data: import('./adapter/live-models.ts').ModelStatus }> } {
  const registers: Record<string, { provider: string; model: string } | { error: string }> = {};
  for (const v of voices) registers[v] = { provider: `stub-provider-${v}`, model: `stub-model-${v}` };
  Object.assign(registers, overrides);
  return {
    status: async () => ({
      ok: true,
      data: {
        persona: 'entity',
        personas: ['Frankenstein'],
        default: { provider: 'stub-provider', model: 'stub-model' },
        registers,
        register_voices: voices,
      },
    }),
  };
}
