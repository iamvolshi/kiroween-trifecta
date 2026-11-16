/**
 * Property-based and example-based tests for `TimeTravelView`.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.2, 9.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TimeTravelView } from './time-travel';
import {
  createMockAdapter,
  createErrorMock,
  MOCK_CURSORS,
} from '../adapter/mock';
import { isLiveAt } from '../util/interval';
import type { Entry, SeamAdapter } from '../adapter/seam';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'test-id',
    kid: 1,
    subject: 'test-subject',
    state: 'active',
    authority: 5,
    pool: 'test-pool',
    k_start: new Date(0).toISOString(),
    t_time: new Date(0).toISOString(),
    e_time: new Date(0).toISOString(),
    k_time: new Date(1_000_000).toISOString(),
    evidence: 'test-evidence',
    reason: 'test-reason',
    prev_hash: '',
    ...overrides,
  };
}

/** Convert a Unix-ms timestamp to a datetime-local input value, in UTC.
 *
 * The view reads the input as UTC (record times are UTC), so the value is
 * formatted from UTC components and the expected moment is the same
 * minute-truncated UTC ms, independent of the machine's timezone.
 */
function msToInputValue(ms: number): { value: string; roundedMs: number } {
  const roundedMs = Math.floor(ms / 60_000) * 60_000;
  const value = new Date(roundedMs).toISOString().slice(0, 16);
  return { value, roundedMs };
}
/**
 * Mount the view, trigger a cursor change to the given ms, await the async handler.
 * Returns the actual ms that the view will use (rounded to minute precision, UTC).
 */
async function triggerCursor(
  _view: TimeTravelView,
  container: HTMLElement,
  momentMs: number,
): Promise<number> {
  const input = container.querySelector<HTMLInputElement>('#moment-cursor');
  if (!input) throw new Error('No #moment-cursor input found');
  const { value, roundedMs } = msToInputValue(momentMs);
  input.value = value;
  input.dispatchEvent(new Event('change'));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return roundedMs;
}

/** Build a custom SeamAdapter backed by a fixed entry array. */
function createAdapterFromEntries(entries: Entry[]): SeamAdapter {
  return {
    async fetchAllEntries() {
      return { ok: true, data: [...entries] };
    },
    async fetchBeliefPool(momentMs: number) {
      const live = entries.filter((e) => isLiveAt(e, momentMs));
      return { ok: true, data: live };
    },
    async fetchChain(kid, subject) {
      const chain = entries
        .filter((e) => e.kid === kid && e.subject === subject)
        .sort((a, b) => Date.parse(a.k_start) - Date.parse(b.k_start));
      return { ok: true, data: chain };
    },
    async fetchKidMap() {
      return { ok: true, data: {} };
    },
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});

// ---------------------------------------------------------------------------
// Example-based: input present on mount (Req 4.1)
// ---------------------------------------------------------------------------

describe('Example: datetime-local input present on mount', () => {
  it('renders #moment-cursor input immediately after mount (Req 4.1)', () => {
    const view = new TimeTravelView(createMockAdapter());
    view.mount(container);
    const input = container.querySelector('input[type="datetime-local"]');
    expect(input).not.toBeNull();
    expect(input?.id).toBe('moment-cursor');
    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// Example-based: empty state on cursor with no live entries (Req 4.6, 9.4)
// ---------------------------------------------------------------------------

describe('Example: empty state when no live entries', () => {
  it('renders .empty-state when cursor is before all entries (Req 4.6, 9.4)', async () => {
    const view = new TimeTravelView(createMockAdapter());
    view.mount(container);
    await triggerCursor(view, container, MOCK_CURSORS.beforeAll);
    const emptyState = container.querySelector('.empty-state');
    expect(emptyState).not.toBeNull();
    expect(container.querySelector('.error-state')).toBeNull();
    view.unmount();
  });

  it('renders .empty-state when cursor is after all entries', async () => {
    const view = new TimeTravelView(createMockAdapter());
    view.mount(container);
    await triggerCursor(view, container, MOCK_CURSORS.afterAll);
    const emptyState = container.querySelector('.empty-state');
    expect(emptyState).not.toBeNull();
    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// Example-based: error state when adapter returns error (Req 4.7)
// ---------------------------------------------------------------------------

describe('Example: error state on adapter error', () => {
  it('renders .error-state when adapter.fetchBeliefPool errors (Req 4.7)', async () => {
    const view = new TimeTravelView(createErrorMock());
    view.mount(container);
    await triggerCursor(view, container, MOCK_CURSORS.insideT0T1);
    const errorState = container.querySelector('.error-state');
    expect(errorState).not.toBeNull();
    expect(container.querySelector('.empty-state')).toBeNull();
    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// Example-based: pool replaces on second cursor change (Req 4.4)
// ---------------------------------------------------------------------------

describe('Example: cursor change replaces pool content', () => {
  it('changing cursor twice does not accumulate .cursor-display elements (Req 4.4)', async () => {
    const view = new TimeTravelView(createMockAdapter());
    view.mount(container);

    await triggerCursor(view, container, MOCK_CURSORS.insideT0T1);
    const firstCount = container.querySelectorAll('.cursor-display').length;
    expect(firstCount).toBe(1);

    await triggerCursor(view, container, MOCK_CURSORS.insideT1T2);
    const secondCount = container.querySelectorAll('.cursor-display').length;
    expect(secondCount).toBe(1);

    view.unmount();
  });

  it('belief-pool content is replaced, not appended', async () => {
    const view = new TimeTravelView(createMockAdapter());
    view.mount(container);

    await triggerCursor(view, container, MOCK_CURSORS.insideT0T1);
    const firstPoolItems = container.querySelectorAll('.belief-pool li').length;

    await triggerCursor(view, container, MOCK_CURSORS.insideT1T2);
    const secondPoolItems = container.querySelectorAll('.belief-pool li').length;

    // Second cursor selects only entry B (1 item), first cursor selects A+D (2 items).
    // If pool were accumulated we'd have more items than expected.
    expect(firstPoolItems).toBe(2);
    expect(secondPoolItems).toBe(1);

    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// Property 7 (view layer): Time Travel pool correctness
// Run with 3 known moment values, then property-based with generated sets.
//
// Validates: Requirements 4.2, 4.3, 4.4, 9.2
// ---------------------------------------------------------------------------

describe('Property 7: Time Travel pool correctness', () => {
  const knownMoments = [
    MOCK_CURSORS.beforeAll,       // before all entries → empty
    MOCK_CURSORS.insideT0T1,      // inside first interval → A + D
    MOCK_CURSORS.insideT1T2,      // inside second interval → B only
    MOCK_CURSORS.insideT2T3,      // inside third interval → C only
    MOCK_CURSORS.afterAll,        // after all entries → empty
  ];

  for (const momentMs of knownMoments) {
    it(`pool matches isLiveAt filter for cursor=${momentMs}ms`, async () => {
      const adapter = createMockAdapter();
      const allResult = await adapter.fetchAllEntries();
      if (!allResult.ok) throw new Error('fixture failed');
      const allEntries = allResult.data;

      const view = new TimeTravelView(adapter);
      view.mount(container);
      const roundedMs = await triggerCursor(view, container, momentMs);

      // Use the rounded ms (what the view actually passed to fetchBeliefPool)
      const expectedLive = allEntries.filter((e) => isLiveAt(e, roundedMs));
      const renderedItems = container.querySelectorAll('.belief-pool li');

      expect(renderedItems.length).toBe(expectedLive.length);
      view.unmount();
    });
  }

  it('rendered pool entry count equals isLiveAt count for generated entry sets (≥50 runs)', async () => {
    const timestampArb = fc.integer({
      min: Date.parse('2020-01-01T00:00:00Z'),
      max: Date.parse('2030-01-01T00:00:00Z'),
    });
    const durationArb = fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }); // up to 1 year

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            startMs: timestampArb,
            duration: durationArb,
            id: fc.uuid(),
            kid: fc.integer({ min: 1, max: 99 }),
            subject: fc.string({ minLength: 1, maxLength: 20 }),
            state: fc.constantFrom('confirmed', 'revised', 'rejected'),
            authority: fc.integer({ min: 0, max: 8 }),
            evidence: fc.string({ minLength: 1, maxLength: 20 }),
            reason: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        timestampArb,
        async (rawEntries, momentMs) => {
          const entries: Entry[] = rawEntries.map((r) =>
            makeEntry({
              id: r.id,
              kid: r.kid,
              subject: r.subject,
              state: r.state,
              authority: r.authority,
              evidence: r.evidence,
              reason: r.reason,
              k_start: new Date(r.startMs).toISOString(),
              k_time: new Date(r.startMs + r.duration).toISOString(),
            }),
          );

          const adapter = createAdapterFromEntries(entries);
          const c = document.createElement('div');
          document.body.appendChild(c);
          const view = new TimeTravelView(adapter);
          view.mount(c);
          const roundedMs = await triggerCursor(view, c, momentMs);

          // Use roundedMs — the actual ms the view passed to fetchBeliefPool
          // (the view truncates to minute precision via the datetime-local input format)
          const expectedCount = entries.filter((e) => isLiveAt(e, roundedMs)).length;
          const renderedCount = c.querySelectorAll('.belief-pool li').length;
          view.unmount();
          document.body.removeChild(c);

          return renderedCount === expectedCount;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Cursor display
// For any moment T where the cursor is set, .cursor-display appears first
// and contains the cursor value.
//
// Validates: Requirements 4.3, 4.5
// ---------------------------------------------------------------------------

describe('Property 8: Cursor display', () => {
  it('.cursor-display is present and contains cursor value after any change', async () => {
    const timestampArb = fc.integer({
      min: Date.parse('2020-01-01T00:00:00Z'),
      max: Date.parse('2029-12-31T00:00:00Z'),
    });

    await fc.assert(
      fc.asyncProperty(timestampArb, async (momentMs) => {
        const adapter = createMockAdapter();
        const c = document.createElement('div');
        document.body.appendChild(c);
        const view = new TimeTravelView(adapter);
        view.mount(c);
        const { value: inputValue } = msToInputValue(momentMs);
        // We need to trigger the cursor with our raw ms, but capture the input value
        // used (triggerCursor calls msToInputValue internally)
        await triggerCursor(view, c, momentMs);

        const pool = c.querySelector('#belief-pool');
        if (!pool) {
          view.unmount();
          document.body.removeChild(c);
          return false;
        }

        const cursorDisplay = pool.querySelector('.cursor-display');
        if (!cursorDisplay) {
          view.unmount();
          document.body.removeChild(c);
          return false;
        }

        // The cursor-display must be the first child of #belief-pool.
        const firstChild = pool.firstElementChild;
        const isFirst = firstChild === cursorDisplay;

        // The cursor-display must contain the input value text.
        const containsValue = cursorDisplay.textContent?.includes(inputValue) ?? false;

        view.unmount();
        document.body.removeChild(c);

        return isFirst && containsValue;
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Belief Pool field completeness
// Each rendered <li> contains all 6 required fields as distinct visible spans.
//
// Validates: Requirements 4.5, 9.2
// ---------------------------------------------------------------------------

describe('Property 9: Belief Pool field completeness', () => {
  it('each rendered <li> contains kid, subject, state, authority, evidence, reason spans (≥50 runs)', async () => {
    const entryArb = fc.record({
      id: fc.uuid(),
      kid: fc.integer({ min: 1, max: 999 }),
      subject: fc.string({ minLength: 1, maxLength: 30 }),
      state: fc.constantFrom('confirmed', 'revised', 'rejected', 'contradicted'),
      authority: fc.integer({ min: 0, max: 8 }),
      evidence: fc.string({ minLength: 1, maxLength: 30 }),
      reason: fc.string({ minLength: 1, maxLength: 30 }),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(entryArb, { minLength: 1, maxLength: 8 }),
        async (rawEntries) => {
          // All entries share a common live interval [T0, T1).
          const T0 = Date.parse('2025-01-01T00:00:00Z');
          const T1 = Date.parse('2025-12-31T00:00:00Z');
          const cursorMs = T0 + Math.floor((T1 - T0) / 2);

          const entries: Entry[] = rawEntries.map((r) =>
            makeEntry({
              id: r.id,
              kid: r.kid,
              subject: r.subject,
              state: r.state,
              authority: r.authority,
              evidence: r.evidence,
              reason: r.reason,
              k_start: new Date(T0).toISOString(),
              k_time: new Date(T1).toISOString(),
            }),
          );

          const adapter = createAdapterFromEntries(entries);
          const c = document.createElement('div');
          document.body.appendChild(c);
          const view = new TimeTravelView(adapter);
          view.mount(c);
          await triggerCursor(view, c, cursorMs);

          const listItems = c.querySelectorAll('.belief-pool li');
          let allValid = true;

          for (let i = 0; i < listItems.length; i++) {
            const li = listItems[i];
            const entry = entries[i];

            const kidSpan = li.querySelector('.kid');
            const subjectSpan = li.querySelector('.subject');
            const stateSpan = li.querySelector('.state');
            const authoritySpan = li.querySelector('.authority');
            const evidenceSpan = li.querySelector('.evidence');
            const reasonSpan = li.querySelector('.reason');

            if (
              !kidSpan ||
              !subjectSpan ||
              !stateSpan ||
              !authoritySpan ||
              !evidenceSpan ||
              !reasonSpan
            ) {
              allValid = false;
              break;
            }

            // kid span must include the numeric kid
            if (!kidSpan.textContent?.includes(String(entry.kid))) {
              allValid = false;
              break;
            }

            // authority span must be the integer
            if (authoritySpan.textContent !== String(entry.authority)) {
              allValid = false;
              break;
            }

            // remaining fields must match exactly
            if (
              subjectSpan.textContent !== entry.subject ||
              stateSpan.textContent !== entry.state ||
              evidenceSpan.textContent !== entry.evidence ||
              reasonSpan.textContent !== entry.reason
            ) {
              allValid = false;
              break;
            }
          }

          view.unmount();
          document.body.removeChild(c);

          return allValid;
        },
      ),
      { numRuns: 50 },
    );
  });
});
