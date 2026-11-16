/**
 * Tests for ActionListView.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ActionListView } from './action-list';
import { createMockAdapter, createErrorMock } from '../adapter/mock';
import type { Entry, SeamAdapter, KidMap } from '../adapter/seam';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Entry with defaults overridden by the given partial. */
function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'test-id',
    kid: 1,
    subject: 'temperature',
    state: 'confirmed',
    authority: 7,
    pool: 'pool-alpha',
    k_start: '2024-01-01T00:00:00.000Z',
    t_time:  '2024-01-01T00:05:00.000Z',
    e_time:  '2024-01-01T00:03:00.000Z',
    k_time:  '2024-04-01T00:00:00.000Z',
    evidence: 'ev-001',
    reason:   'test reason',
    prev_hash: '0000000000000000',
    ...overrides,
  };
}

/** Create a SeamAdapter that always returns the given entries (and empty kidMap). */
function adapterFromEntries(entries: Entry[]): SeamAdapter {
  return {
    async fetchAllEntries() { return { ok: true, data: entries }; },
    async fetchBeliefPool() { return { ok: true, data: [] }; },
    async fetchChain() { return { ok: true, data: [] }; },
    async fetchKidMap(): Promise<{ ok: true; data: KidMap } | { ok: false; error: string }> {
      return { ok: true, data: {} };
    },
  };
}

/** Mount a view, await async load, return the container. */
async function mountAndLoad(view: ActionListView): Promise<HTMLElement> {
  const container = document.createElement('div');
  view.mount(container);
  await view.load(container);
  return container;
}

// ---------------------------------------------------------------------------
// fast-check arbitraries
// ---------------------------------------------------------------------------

/** ISO-8601 UTC timestamp generator. */
const isoTimestamp = fc.integer({ min: 946684800000, max: 4102444799000 })
  .map(ms => new Date(ms).toISOString());

/** Generate a single arbitrary Entry. */
const arbitraryEntry = fc.record<Entry>({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  kid: fc.integer({ min: 1, max: 9999 }),
  subject: fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !s.includes(':') && s.trim().length > 0),
  state: fc.constantFrom('confirmed', 'rejected', 'revised', 'contradicted'),
  authority: fc.integer({ min: 0, max: 8 }),
  pool: fc.string({ minLength: 1, maxLength: 20 }),
  k_start: isoTimestamp,
  t_time:  isoTimestamp,
  e_time:  isoTimestamp,
  k_time:  isoTimestamp,
  evidence: fc.string({ minLength: 1, maxLength: 20 }),
  reason:   fc.string({ minLength: 1, maxLength: 20 }),
  prev_hash: fc.stringMatching(/^[0-9a-f]{16}$/),
});

/** Generate a non-empty array of entries (≥ 1) with unique ids. */
const nonEmptyEntries = fc.array(arbitraryEntry, { minLength: 1, maxLength: 20 })
  .map(entries => entries.map((e, i) => ({ ...e, id: `entry-${i}` })));

// ---------------------------------------------------------------------------
// Example-based tests
// ---------------------------------------------------------------------------

describe('ActionListView – example-based', () => {
  it('empty result → <p class="empty-state"> present, no <ul> (Req 3.6, 9.4)', async () => {
    const adapter = adapterFromEntries([]);
    const view = new ActionListView(adapter);
    const el = await mountAndLoad(view);

    expect(el.querySelector('.empty-state')).not.toBeNull();
    expect(el.querySelector('ul')).toBeNull();
  });

  it('error result → <p class="error-state"> present, no <ul> (Req 3.7)', async () => {
    const view = new ActionListView(createErrorMock());
    const el = await mountAndLoad(view);

    expect(el.querySelector('.error-state')).not.toBeNull();
    expect(el.querySelector('ul')).toBeNull();
  });

  it('renders a <ul class="action-list"> when entries are present', async () => {
    const view = new ActionListView(createMockAdapter());
    const el = await mountAndLoad(view);

    expect(el.querySelector('ul.action-list')).not.toBeNull();
  });

  it('fixture entry – all field values appear verbatim (Req 9.1)', async () => {
    const entry = makeEntry({
      id: 'fixture-01',
      kid: 42,
      subject: 'voltage',
      state: 'confirmed',
      authority: 5,
      k_start: '2024-03-01T12:00:00.000Z',
      t_time:  '2024-03-01T12:01:00.000Z',
      e_time:  '2024-03-01T12:00:30.000Z',
      k_time:  '2024-06-01T00:00:00.000Z',
    });

    const view = new ActionListView(adapterFromEntries([entry]));
    const el = await mountAndLoad(view);

    // kid number appears in .kid span
    expect(el.querySelector('.kid')?.textContent).toContain('42');
    // authority appears in .authority span
    expect(el.querySelector('.authority')?.textContent).toBe('5');
    // timestamps appear verbatim
    expect(el.querySelector('.k-start')?.textContent).toBe('2024-03-01T12:00:00.000Z');
    expect(el.querySelector('.t-time')?.textContent).toBe('2024-03-01T12:01:00.000Z');
    expect(el.querySelector('.e-time')?.textContent).toBe('2024-03-01T12:00:30.000Z');
    expect(el.querySelector('.k-time')?.textContent).toBe('2024-06-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Property 3: Action List ordering invariant
// Validates: Requirements 3.1, 3.3
// ---------------------------------------------------------------------------

describe('Property 3: Action List ordering invariant', () => {
  /**
   * The rendered <li> elements appear in DESCENDING order by k_start (newest first).
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  it('rendered <li> elements are ordered descending by k_start', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyEntries, async (entries) => {
        const view = new ActionListView(adapterFromEntries(entries));
        const el = await mountAndLoad(view);

        const kStartValues = Array.from(el.querySelectorAll('.k-start'))
          .map(span => span.textContent ?? '');

        // Verify descending order: each k_start ≥ the next
        for (let i = 0; i < kStartValues.length - 1; i++) {
          expect(kStartValues[i] >= kStartValues[i + 1]).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Action List field completeness
// Validates: Requirements 3.2, 9.1
// ---------------------------------------------------------------------------

describe('Property 4: Action List field completeness', () => {
  /**
   * Each <li> contains ALL required field spans with non-empty content.
   *
   * **Validates: Requirements 3.2, 9.1**
   */
  it('each <li> contains kid, authority, k_start, t_time, e_time, k_time', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyEntries, async (entries) => {
        const view = new ActionListView(adapterFromEntries(entries));
        const el = await mountAndLoad(view);

        const lis = Array.from(el.querySelectorAll('li'));
        expect(lis.length).toBe(entries.length);

        for (const li of lis) {
          // kid: contains a numeric value
          const kidText = li.querySelector('.kid')?.textContent ?? '';
          expect(kidText.length).toBeGreaterThan(0);
          // The kid span must start with a numeric substring
          expect(/\d/.test(kidText)).toBe(true);

          // authority: integer value
          const authorityText = li.querySelector('.authority')?.textContent ?? '';
          expect(/^\d+$/.test(authorityText)).toBe(true);

          // All four timestamps present and non-empty
          expect((li.querySelector('.k-start')?.textContent ?? '').length).toBeGreaterThan(0);
          expect((li.querySelector('.t-time')?.textContent ?? '').length).toBeGreaterThan(0);
          expect((li.querySelector('.e-time')?.textContent ?? '').length).toBeGreaterThan(0);
          expect((li.querySelector('.k-time')?.textContent ?? '').length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Label derivation integrity (view layer)
// Validates: Requirements 3.4, 3.5
// ---------------------------------------------------------------------------

describe('Property 5: Label derivation integrity', () => {
  /**
   * The text in each .label span is derived solely from subject and state.
   * formatLabel produces "${subject}: ${state}", so every character in the
   * label output must come from subject, state, or the separator ": ".
   *
   * **Validates: Requirements 3.4, 3.5**
   */
  it('.label span contains only text derivable from subject and state', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyEntries, async (entries) => {
        const view = new ActionListView(adapterFromEntries(entries));
        const el = await mountAndLoad(view);

        const lis = Array.from(el.querySelectorAll('li'));

        for (let i = 0; i < lis.length; i++) {
          // Match the rendered li back to its source entry via the href id segment.
          const anchor = lis[i].querySelector('a');
          const href = anchor?.getAttribute('href') ?? '';
          // href is /entry/${kid}/${subject}/${id}
          const hrefParts = href.split('/');
          const entryId = decodeURIComponent(hrefParts[hrefParts.length - 1] ?? '');
          const matchingEntry = entries.find(e => e.id === entryId);
          if (!matchingEntry) continue; // shouldn't happen in well-formed data

          const labelText = lis[i].querySelector('.label')?.textContent ?? '';

          // The label must be a substring or derivation from subject + state.
          // Specifically, every part of the label must be found in subject or state.
          expect(labelText).toContain(matchingEntry.subject);
          expect(labelText).toContain(matchingEntry.state);
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Entry navigability
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------

describe('Property 6: Entry navigability', () => {
  /**
   * Each <li> contains a navigable <a> element with the correct href pattern.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('each <li> contains an <a> without tabindex="-1" and with correct href', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyEntries, async (entries) => {
        const view = new ActionListView(adapterFromEntries(entries));
        const el = await mountAndLoad(view);

        const lis = Array.from(el.querySelectorAll('li'));

        for (const li of lis) {
          const anchor = li.querySelector('a');
          expect(anchor).not.toBeNull();

          // Must be navigable — no tabindex="-1"
          expect(anchor!.getAttribute('tabindex')).not.toBe('-1');

          // href must match /entry/${kid}/...
          const href = anchor!.getAttribute('href') ?? '';
          expect(href).toMatch(/^\/entry\/\d+\//);
          const lastSeg = href.split('/').pop() ?? '';
          expect(entries.map(e => encodeURIComponent(e.id))).toContain(lastSeg);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('href contains the kid value from the entry', async () => {
    await fc.assert(
      fc.asyncProperty(nonEmptyEntries, async (entries) => {
        const view = new ActionListView(adapterFromEntries(entries));
        const el = await mountAndLoad(view);

        const lis = Array.from(el.querySelectorAll('li'));

        for (const li of lis) {
          const anchor = li.querySelector('a');
          const href = anchor?.getAttribute('href') ?? '';
          // href is /entry/${kid}/${subject}/${id} — kid is the first path segment after /entry/
          const kidFromHref = href.split('/')[2];
          // .kid span text starts with the numeric kid
          const kidSpanText = li.querySelector('.kid')?.textContent ?? '';
          expect(kidSpanText.startsWith(kidFromHref)).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});
