// MOCK ADAPTER — for development and testing only

import type {
  AdapterResult, AskResult, ChatTurn, Entry, KidMap, Lesson, RecordResult,
  SeamAdapter, UpdateResult,
} from './seam';
import type { ScenarioCursor } from '../scenario/types.ts';
import { SCENARIO } from '../scenario/script.ts';
import { createScenarioCursor } from '../scenario/stepper.ts';
import { createAssemblyMethods } from './mock-assembly.ts';
import { isLiveAt, compareKStart } from '../util/interval';

export const MOCK_ADAPTER = 'mock' as const;

// ---------------------------------------------------------------------------
// Fixture timestamps
//
// Three non-overlapping live intervals:
//   Entry A: live from T0 to T1   (2024-01-01 00:00 → 2024-04-01 00:00)
//   Entry B: live from T1 to T2   (2024-04-01 00:00 → 2024-07-01 00:00)
//   Entry C: live from T2 to T3   (2024-07-01 00:00 → 2024-10-01 00:00)
//
// This guarantees:
//   cursor at T0+1ms → {A}
//   cursor at T1+1ms → {B}
//   cursor in gap between T0 and T0 (before any entry) → {}
// ---------------------------------------------------------------------------

const T0_MS = Date.parse('2024-01-01T00:00:00.000Z'); // 1_704_067_200_000
const T1_MS = Date.parse('2024-04-01T00:00:00.000Z'); // 1_711_929_600_000
const T2_MS = Date.parse('2024-07-01T00:00:00.000Z'); // 1_719_792_000_000
const T3_MS = Date.parse('2024-10-01T00:00:00.000Z'); // 1_727_740_800_000

// ---------------------------------------------------------------------------
// Fixture entries
// ---------------------------------------------------------------------------

const ENTRIES: Entry[] = [
  // --- Entry A (kid=1, subject="temperature") — confirmed, authority=7
  {
    id: 'entry-a1',
    kid: 1,
    subject: 'temperature',
    state: 'confirmed',
    authority: 7,
    pool: 'pool-alpha',
    k_start: '2024-01-01T00:00:00.000Z',
    t_time:  '2024-01-01T00:05:00.000Z',
    e_time:  '2024-01-01T00:03:00.000Z',
    k_time:  '2024-04-01T00:00:00.000Z',
    evidence: 'sensor-reading-001',
    reason:   'initial confirmation',
    prev_hash: '0000000000000000',
  },

  // --- Entry B (kid=1, subject="temperature") — revised, authority=8
  {
    id: 'entry-b1',
    kid: 1,
    subject: 'temperature',
    state: 'revised',
    authority: 8,
    pool: 'pool-alpha',
    k_start: '2024-04-01T00:00:00.000Z',
    t_time:  '2024-04-01T00:05:00.000Z',
    e_time:  '2024-04-01T00:03:00.000Z',
    k_time:  '2024-07-01T00:00:00.000Z',
    evidence: 'sensor-reading-002',
    reason:   'revised after re-calibration',
    prev_hash: 'abcdef1234567890',
  },

  // --- Entry C (kid=1, subject="temperature") — rejected, authority=2
  {
    id: 'entry-c1',
    kid: 1,
    subject: 'temperature',
    state: 'rejected',
    authority: 2,
    pool: 'pool-alpha',
    k_start: '2024-07-01T00:00:00.000Z',
    t_time:  '2024-07-01T00:05:00.000Z',
    e_time:  '2024-07-01T00:03:00.000Z',
    k_time:  '2024-10-01T00:00:00.000Z',
    evidence: 'sensor-reading-003',
    reason:   'rejected due to anomaly',
    prev_hash: 'fedcba0987654321',
  },

  // --- Entry D (kid=3, subject="pressure") — confirmed, authority=7
  //   Shares T0→T1 live interval with Entry A so it also appears in pool at T0+1ms.
  {
    id: 'entry-d3',
    kid: 3,
    subject: 'pressure',
    state: 'confirmed',
    authority: 7,
    pool: 'pool-beta',
    k_start: '2024-01-01T00:00:00.000Z',
    t_time:  '2024-01-01T01:00:00.000Z',
    e_time:  '2024-01-01T00:58:00.000Z',
    k_time:  '2024-04-01T00:00:00.000Z',
    evidence: 'gauge-reading-001',
    reason:   'baseline pressure reading',
    prev_hash: '0000000000000000',
  },
];

// ---------------------------------------------------------------------------
// createMockAdapter
// ---------------------------------------------------------------------------

export interface MockOptions {
  cursor?: ScenarioCursor | null;
}

export function createMockAdapter(entries?: Entry[], options: MockOptions = {}): SeamAdapter {
  const base = entries ?? ENTRIES;
  // No args = fixtures + a fresh scenario cursor. Explicit entries = no
  // scenario unless a cursor is passed.
  const cursor: ScenarioCursor | null =
    options.cursor !== undefined
      ? options.cursor
      : entries === undefined
        ? createScenarioCursor(SCENARIO)
        : null;
  const readAll = (): Entry[] => (cursor ? [...base, ...cursor.visibleEntries()] : [...base]);

  return {
    async fetchAllEntries(): Promise<AdapterResult<Entry[]>> {
      return { ok: true, data: readAll() };
    },

    async fetchBeliefPool(momentMs: number): Promise<AdapterResult<Entry[]>> {
      const live = readAll().filter(e => isLiveAt(e, momentMs));
      return { ok: true, data: live };
    },

    async fetchChain(kid: number, subject: string): Promise<AdapterResult<Entry[]>> {
      const chain = readAll()
        .filter(e => e.kid === kid && e.subject === subject)
        .sort(compareKStart);
      return { ok: true, data: chain };
    },

    async fetchKidMap(): Promise<AdapterResult<KidMap>> {
      // KID 1 → "sensor-alpha"; KID 2 is intentionally absent
      const map: KidMap = {
        1: 'sensor-alpha',
        3: 'pressure-gauge',
      };
      if (cursor) Object.assign(map, cursor.scenario.kid_labels);
      return { ok: true, data: map };
    },

    ...createAssemblyMethods(cursor, readAll),
  };
}

// ---------------------------------------------------------------------------
// createErrorMock
// ---------------------------------------------------------------------------

export function createErrorMock(): SeamAdapter {
  const err = { ok: false as const, error: 'mock error' };
  return {
    async fetchAllEntries():              Promise<AdapterResult<Entry[]>> { return err; },
    async fetchBeliefPool(_momentMs):     Promise<AdapterResult<Entry[]>> { return err; },
    async fetchChain(_kid, _subject):     Promise<AdapterResult<Entry[]>> { return err; },
    async fetchKidMap():                  Promise<AdapterResult<KidMap>>  { return err; },
    async ask(_question):                 Promise<AdapterResult<AskResult>> { return err; },
    async chat(_message):                 Promise<AdapterResult<ChatTurn>> { return err; },
    async update(_req):                   Promise<AdapterResult<UpdateResult>> { return err; },
    async fetchLessons():                 Promise<AdapterResult<Lesson[]>> { return err; },
    async fetchRecord(_accountId):        Promise<AdapterResult<RecordResult>> { return err; },
  };
}

// ---------------------------------------------------------------------------
// Exported cursor landmarks (useful in tests)
// ---------------------------------------------------------------------------

export const MOCK_CURSORS = {
  /** A cursor inside the first live interval → returns entries A and D */
  insideT0T1: T0_MS + 1,
  /** A cursor inside the second live interval → returns entry B only */
  insideT1T2: T1_MS + 1,
  /** A cursor inside the third live interval → returns entry C only */
  insideT2T3: T2_MS + 1,
  /** A cursor before any entry → empty pool */
  beforeAll:  T0_MS - 1,
  /** A cursor after all entries → empty pool */
  afterAll:   T3_MS + 1,
  /** Raw ms values for constructing custom cursors */
  T0_MS,
  T1_MS,
  T2_MS,
  T3_MS,
} as const;
