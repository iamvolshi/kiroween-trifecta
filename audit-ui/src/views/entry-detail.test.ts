/**
 * Tests for EntryDetailView
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.1, 9.3, 9.4, 9.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EntryDetailView } from './entry-detail';
import { createFailingStub } from '../test-helpers.ts';
import type { Entry, KidMap, SeamAdapter } from '../adapter/seam';
import { assemblyNotUsed } from '../test-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
}

function cleanup(container: HTMLElement): void {
  container.remove();
}

/** Mount a view and flush all microtasks so the async render completes. */
async function mountAndFlush(view: EntryDetailView, container: HTMLElement): Promise<void> {
  view.mount(container);
  // Flush the microtask queue — allows Promise.all inside render() to settle
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

/** Build a minimal SeamAdapter that returns the given chain and kidMap. */
function makeAdapter(chain: Entry[], kidMap: KidMap): SeamAdapter {
  return {
    ...assemblyNotUsed(),
    fetchAllEntries: async () => ({ ok: true, data: chain }),
    fetchBeliefPool: async () => ({ ok: true, data: chain }),
    fetchChain: async () => ({ ok: true, data: chain }),
    fetchKidMap: async () => ({ ok: true, data: kidMap }),
  };
}

/** Build an adapter whose fetchChain returns an error. */
function makeChainErrorAdapter(): SeamAdapter {
  return {
    ...createFailingStub(),
    // override fetchKidMap so both settle — render checks chainResult first
    fetchKidMap: async () => ({ ok: true, data: {} }),
  };
}

// ---------------------------------------------------------------------------
// fast-check arbitraries
// ---------------------------------------------------------------------------

/** ISO-like timestamp string: realistic enough to sort lexicographically. */
const arbTimestamp = fc
  .integer({ min: 2000, max: 2100 })
  .chain(year =>
    fc.record({
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
      second: fc.integer({ min: 0, max: 59 }),
    }).map(({ month, day, hour, minute, second }) => {
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`;
    })
  );

/** Visible-string filter: no HTML chars, no whitespace-only values. */
const visibleStr = (minLength = 1, maxLength = 64) =>
  fc.string({ minLength, maxLength }).filter(
    s => !s.includes('<') && !s.includes('>') && s.trim().length > 0,
  );

const arbEntry = fc.record<Entry>({
  id:        fc.string({ minLength: 1, maxLength: 32 }).filter(s => s.trim().length > 0),
  kid:       fc.integer({ min: 1, max: 9999 }),
  subject:   visibleStr(1, 64),
  state:     fc.oneof(
               fc.constant('confirmed'),
               fc.constant('rejected'),
               fc.constant('contradicted'),
               fc.constant('revised'),
               visibleStr(1, 32),
             ),
  authority: fc.integer({ min: 0, max: 8 }),
  pool:      visibleStr(1, 32),
  k_start:   arbTimestamp,
  t_time:    arbTimestamp,
  e_time:    arbTimestamp,
  k_time:    arbTimestamp,
  evidence:  visibleStr(1, 64),
  reason:    visibleStr(1, 128),
  prev_hash: fc.stringMatching(/^[0-9a-f]{16,64}$/),
});

/** Generate a non-empty array of entries that all share the same kid/subject. */
const arbChain = fc.integer({ min: 1, max: 8 }).chain(len =>
  fc.tuple(
    fc.integer({ min: 1, max: 9999 }),
    visibleStr(1, 32),
  ).chain(([kid, subject]) =>
    fc.array(arbEntry, { minLength: len, maxLength: len }).map(entries =>
      entries.map((e, i) => ({
        ...e,
        kid,
        subject,
        // Give each entry a distinct k_start so ordering is deterministic
        k_start: `${2000 + i}-01-01T00:00:00.000Z`,
      }))
    )
  )
);

// ---------------------------------------------------------------------------
// Property 10: Entry Detail field completeness
// Validates: Requirements 5.1, 5.2, 9.1
// ---------------------------------------------------------------------------

describe('Property 10: Entry Detail field completeness', () => {
  it('primary panel <dl> shows visible values for all 12 fields across arbitrary entries', async () => {
    /**
     * **Validates: Requirements 5.1, 5.2, 9.1**
     */
    await fc.assert(
      fc.asyncProperty(arbEntry, async (entry) => {
        const container = makeContainer();
        try {
          const adapter = makeAdapter([entry], {});
          const view = new EntryDetailView(adapter, entry.kid, entry.subject, entry.id);
          await mountAndFlush(view, container);

          const dl = container.querySelector('.entry-primary dl');
          expect(dl).not.toBeNull();

          const ddKid       = container.querySelector('.entry-primary dd.kid');
          const ddSubject   = container.querySelector('.entry-primary dd.subject');
          const ddState     = container.querySelector('.entry-primary dd.state');
          const ddAuthority = container.querySelector('.entry-primary dd.authority');
          const ddPool      = container.querySelector('.entry-primary dd.pool');
          const ddKStart    = container.querySelector('.entry-primary dd.k-start');
          const ddTTime     = container.querySelector('.entry-primary dd.t-time');
          const ddETime     = container.querySelector('.entry-primary dd.e-time');
          const ddKTime     = container.querySelector('.entry-primary dd.k-time');
          const ddEvidence  = container.querySelector('.entry-primary dd.evidence');
          const ddReason    = container.querySelector('.entry-primary dd.reason');
          const ddPrevHash  = container.querySelector('.entry-primary dd.prev-hash');

          expect(ddKid,       'dd.kid missing').not.toBeNull();
          expect(ddSubject,   'dd.subject missing').not.toBeNull();
          expect(ddState,     'dd.state missing').not.toBeNull();
          expect(ddAuthority, 'dd.authority missing').not.toBeNull();
          expect(ddPool,      'dd.pool missing').not.toBeNull();
          expect(ddKStart,    'dd.k-start missing').not.toBeNull();
          expect(ddTTime,     'dd.t-time missing').not.toBeNull();
          expect(ddETime,     'dd.e-time missing').not.toBeNull();
          expect(ddKTime,     'dd.k-time missing').not.toBeNull();
          expect(ddEvidence,  'dd.evidence missing').not.toBeNull();
          expect(ddReason,    'dd.reason missing').not.toBeNull();
          expect(ddPrevHash,  'dd.prev-hash missing').not.toBeNull();

          // Each dd must have non-empty text content
          expect(ddKid!.textContent?.trim()).not.toBe('');
          expect(ddSubject!.textContent?.trim()).not.toBe('');
          expect(ddState!.textContent?.trim()).not.toBe('');
          expect(ddAuthority!.textContent?.trim()).not.toBe('');
          expect(ddPool!.textContent?.trim()).not.toBe('');
          expect(ddKStart!.textContent?.trim()).not.toBe('');
          expect(ddTTime!.textContent?.trim()).not.toBe('');
          expect(ddETime!.textContent?.trim()).not.toBe('');
          expect(ddKTime!.textContent?.trim()).not.toBe('');
          expect(ddEvidence!.textContent?.trim()).not.toBe('');
          expect(ddReason!.textContent?.trim()).not.toBe('');
          expect(ddPrevHash!.textContent?.trim()).not.toBe('');
        } finally {
          cleanup(container);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Chain ordering and completeness
// Validates: Requirements 5.3, 5.4, 9.3
// ---------------------------------------------------------------------------

describe('Property 11: Chain ordering and completeness', () => {
  it('all entries appear in ascending k_start order in .chain-list', async () => {
    /**
     * **Validates: Requirements 5.3, 5.4, 9.3**
     */
    await fc.assert(
      fc.asyncProperty(arbChain, async (chain) => {
        const container = makeContainer();
        try {
          const first = chain[0]!;
          const adapter = makeAdapter(chain, {});
          const view = new EntryDetailView(adapter, first.kid, first.subject, first.id);
          await mountAndFlush(view, container);

          const ol = container.querySelector('ol.chain-list');
          expect(ol, 'chain-list missing').not.toBeNull();

          const items = ol!.querySelectorAll('li.chain-entry');
          expect(items.length).toBe(chain.length);

          // Collect rendered k_start values from each list item
          const renderedKStarts: string[] = [];
          items.forEach(li => {
            const kStartSpan = li.querySelector('.k-start');
            expect(kStartSpan, 'k-start span missing in chain-entry').not.toBeNull();
            renderedKStarts.push(kStartSpan!.textContent ?? '');
          });

          // Assert ascending order (ISO strings sort lexicographically)
          for (let i = 1; i < renderedKStarts.length; i++) {
            expect(renderedKStarts[i] >= renderedKStarts[i - 1]).toBe(true);
          }
        } finally {
          cleanup(container);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: KID numeric primacy
// Validates: Requirements 5.1, 9.1
// ---------------------------------------------------------------------------

describe('Property 12: KID numeric primacy (view layer)', () => {
  it('dd.kid always contains the numeric kid as visible text', async () => {
    /**
     * **Validates: Requirements 5.1, 9.1**
     */
    await fc.assert(
      fc.asyncProperty(
        arbEntry,
        fc.oneof(
          fc.constant<KidMap>({}),
          fc.dictionary(
            fc.integer({ min: 1, max: 9999 }).map(String),
            fc.string({ minLength: 1, maxLength: 32 }),
          ),
        ),
        async (entry, kidMap) => {
          const container = makeContainer();
          try {
            const adapter = makeAdapter([entry], kidMap);
            const view = new EntryDetailView(adapter, entry.kid, entry.subject, entry.id);
            await mountAndFlush(view, container);

            const ddKid = container.querySelector('.entry-primary dd.kid');
            expect(ddKid, 'dd.kid missing').not.toBeNull();

            // The KID shows as its number alone, whatever the kidmap holds
            expect(ddKid!.textContent).toBe(String(entry.kid));
          } finally {
            cleanup(container);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: KIDMAP label fidelity
// Validates: Requirements 5.2, 9.5
// ---------------------------------------------------------------------------

describe('Property 13: no KIDMAP label ever renders (view layer)', () => {
  it('no .kid-label span, whatever the kidmap holds', async () => {
    /**
     * **Validates: Requirements 5.2, 9.5**
     * The kidmap's tag is the machine key behind the number; it is never
     * printed. (Darren, Nov 20: the long tag in the log was ridiculous.)
     */
    await fc.assert(
      fc.asyncProperty(
        arbEntry,
        fc.oneof(
          fc.constant<KidMap>({}),
          fc.dictionary(
            fc.integer({ min: 1, max: 9999 }).map(String),
            fc.string({ minLength: 1, maxLength: 32 }),
          ),
        ),
        async (entry, kidMap) => {
          const container = makeContainer();
          try {
            const adapter = makeAdapter([entry], kidMap);
            const view = new EntryDetailView(adapter, entry.kid, entry.subject, entry.id);
            await mountAndFlush(view, container);

            expect(container.querySelector('.entry-primary dd.kid .kid-label')).toBeNull();
            const ddKid = container.querySelector('.entry-primary dd.kid');
            expect(ddKid, 'dd.kid missing').not.toBeNull();
            expect(ddKid!.textContent).toBe(String(entry.kid));
          } finally {
            cleanup(container);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Example-based tests
// ---------------------------------------------------------------------------

describe('EntryDetailView — example-based', () => {
  const FIXTURE_ENTRY: Entry = {
    id: 'entry-fixture-1',
    kid: 42,
    subject: 'voltage',
    state: 'confirmed',
    authority: 7,
    pool: 'pool-gamma',
    k_start: '2024-03-01T00:00:00.000Z',
    t_time:  '2024-03-01T00:05:00.000Z',
    e_time:  '2024-03-01T00:03:00.000Z',
    k_time:  '2024-06-01T00:00:00.000Z',
    evidence: 'volt-sensor-99',
    reason:   'routine measurement',
    prev_hash: 'deadbeef12345678',
  };

  it('empty chain → empty-state paragraph, no entry-primary section (Req 5.5, 9.4)', async () => {
    const container = makeContainer();
    try {
      const adapter = makeAdapter([], {});
      const view = new EntryDetailView(adapter, 42, 'voltage', 'x');
      await mountAndFlush(view, container);

      expect(container.querySelector('p.empty-state')).not.toBeNull();
      expect(container.querySelector('p.empty-state')!.textContent).toContain('No chain entries found.');
      expect(container.querySelector('section.entry-primary')).toBeNull();
    } finally {
      cleanup(container);
    }
  });

  it('error → error-state paragraph present (Req 5.6)', async () => {
    const container = makeContainer();
    try {
      const view = new EntryDetailView(makeChainErrorAdapter(), 42, 'voltage', 'x');
      await mountAndFlush(view, container);

      expect(container.querySelector('p.error-state')).not.toBeNull();
    } finally {
      cleanup(container);
    }
  });

  it('all 12 field values from fixture match exactly (Req 9.1)', async () => {
    const container = makeContainer();
    try {
      const adapter = makeAdapter([FIXTURE_ENTRY], {});
      const view = new EntryDetailView(adapter, FIXTURE_ENTRY.kid, FIXTURE_ENTRY.subject, FIXTURE_ENTRY.id);
      await mountAndFlush(view, container);

      const q = (cls: string) => container.querySelector(`.entry-primary dd.${cls}`)!.textContent ?? '';

      expect(q('kid')).toContain('42');
      expect(q('subject')).toBe('voltage');
      expect(q('state')).toBe('confirmed');
      expect(q('authority')).toBe('7');
      expect(q('pool')).toBe('pool-gamma');
      expect(q('k-start')).toBe('2024-03-01T00:00:00.000Z');
      expect(q('t-time')).toBe('2024-03-01T00:05:00.000Z');
      expect(q('e-time')).toBe('2024-03-01T00:03:00.000Z');
      expect(q('k-time')).toBe('2024-06-01T00:00:00.000Z');
      expect(q('evidence')).toBe('volt-sensor-99');
      expect(q('reason')).toBe('routine measurement');
      expect(q('prev-hash')).toBe('deadbeef12345678');
    } finally {
      cleanup(container);
    }
  });

  it('no .kid-label ever; dd.kid is the number alone (Req 9.5)', async () => {
    const container = makeContainer();
    try {
      // kidMap HAS the entry's kid — the tag still never renders
      const kidMap: KidMap = { 42: 'some-label' };
      const adapter = makeAdapter([FIXTURE_ENTRY], kidMap);
      const view = new EntryDetailView(adapter, FIXTURE_ENTRY.kid, FIXTURE_ENTRY.subject, FIXTURE_ENTRY.id);
      await mountAndFlush(view, container);

      expect(container.querySelector('.entry-primary dd.kid .kid-label')).toBeNull();
      expect(container.querySelector('.entry-primary dd.kid')!.textContent).toBe('42');
    } finally {
      cleanup(container);
    }
  });

  it('chain section renders all entries in ascending k_start order', async () => {
    const container = makeContainer();
    try {
      const entries: Entry[] = [
        { ...FIXTURE_ENTRY, id: 'e3', k_start: '2024-07-01T00:00:00.000Z' },
        { ...FIXTURE_ENTRY, id: 'e1', k_start: '2024-01-01T00:00:00.000Z' },
        { ...FIXTURE_ENTRY, id: 'e2', k_start: '2024-04-01T00:00:00.000Z' },
      ];
      const adapter = makeAdapter(entries, {});
      const view = new EntryDetailView(adapter, FIXTURE_ENTRY.kid, FIXTURE_ENTRY.subject, 'e1');
      await mountAndFlush(view, container);

      const items = container.querySelectorAll('ol.chain-list li.chain-entry');
      expect(items.length).toBe(3);

      const kStarts = Array.from(items).map(li => li.querySelector('.k-start')!.textContent);
      expect(kStarts[0]).toBe('2024-01-01T00:00:00.000Z');
      expect(kStarts[1]).toBe('2024-04-01T00:00:00.000Z');
      expect(kStarts[2]).toBe('2024-07-01T00:00:00.000Z');
    } finally {
      cleanup(container);
    }
  });
});
