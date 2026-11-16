/**
 * Property-based and example-based tests for `isLiveAt`.
 *
 * Validates: Requirements 4.2, 4.4, 9.2
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isLiveAt } from './interval';
import type { Entry } from '../adapter/seam';

// ---------------------------------------------------------------------------
// Minimal Entry fixture helper
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
    k_time: new Date(1000).toISOString(),
    evidence: 'test-evidence',
    reason: 'test-reason',
    prev_hash: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property 7 (predicate): Time Travel pool correctness
//
// For arbitrary (k_start_ms, k_time_ms, momentMs) triples where k_start < k_time,
// isLiveAt returns true iff k_start_ms <= momentMs < k_time_ms.
//
// Validates: Requirements 4.2, 4.4, 9.2
// ---------------------------------------------------------------------------
describe('Property 7: isLiveAt predicate correctness', () => {
  it('returns true iff k_start_ms <= momentMs < k_time_ms (≥100 iterations)', () => {
    // Generate three timestamps: a < b, and an arbitrary moment T.
    const timestampArb = fc.integer({ min: 0, max: 2_000_000_000_000 }); // up to year ~2033

    fc.assert(
      fc.property(
        timestampArb,
        fc.integer({ min: 1, max: 100_000_000 }), // duration > 0
        timestampArb,
        (kStartMs, duration, momentMs) => {
          const kTimeMs = kStartMs + duration; // guarantees k_start < k_time

          const entry = makeEntry({
            k_start: new Date(kStartMs).toISOString(),
            k_time: new Date(kTimeMs).toISOString(),
          });

          const expected = kStartMs <= momentMs && momentMs < kTimeMs;
          return isLiveAt(entry, momentMs) === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Consistency property: non-overlapping entry set
//
// For a set of entries with non-overlapping intervals, each entry's midpoint
// should be live only for that entry, not for its neighbours.
//
// Validates: Requirements 4.2, 4.4, 9.2
// ---------------------------------------------------------------------------
describe('Consistency: non-overlapping interval set', () => {
  it('midpoint is live, before-start and at-k_time are not', () => {
    // Build non-overlapping entries from a sorted set of boundary timestamps.
    const boundaryArb = fc
      .uniqueArray(fc.integer({ min: 0, max: 1_000_000_000_000 }), {
        minLength: 4,
        maxLength: 10,
      })
      .map((arr) => arr.slice().sort((a, b) => a - b));

    fc.assert(
      fc.property(boundaryArb, (bounds) => {
        // Need an even number of boundaries to form complete intervals.
        const count = Math.floor(bounds.length / 2);
        const entries: Entry[] = [];

        for (let i = 0; i < count; i++) {
          const kStartMs = bounds[i * 2];
          const kTimeMs = bounds[i * 2 + 1];
          if (kStartMs === kTimeMs) return true; // degenerate; skip
          entries.push(
            makeEntry({
              id: `entry-${i}`,
              k_start: new Date(kStartMs).toISOString(),
              k_time: new Date(kTimeMs).toISOString(),
            }),
          );
        }

        for (const entry of entries) {
          const kStartMs = Date.parse(entry.k_start);
          const kTimeMs = Date.parse(entry.k_time);
          const midpoint = Math.floor((kStartMs + kTimeMs) / 2);

          // Midpoint must be live for this entry.
          if (!isLiveAt(entry, midpoint)) return false;

          // One ms before k_start must not be live.
          if (kStartMs > 0 && isLiveAt(entry, kStartMs - 1)) return false;

          // Exactly at k_time must not be live (exclusive upper bound).
          if (isLiveAt(entry, kTimeMs)) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Example-based edge cases
// ---------------------------------------------------------------------------
describe('isLiveAt edge cases', () => {
  const kStartMs = 1_000_000;
  const kTimeMs = 2_000_000;

  const entry = makeEntry({
    k_start: new Date(kStartMs).toISOString(),
    k_time: new Date(kTimeMs).toISOString(),
  });

  it('momentMs exactly at k_start → true (inclusive lower bound)', () => {
    expect(isLiveAt(entry, kStartMs)).toBe(true);
  });

  it('momentMs exactly at k_time → false (exclusive upper bound)', () => {
    expect(isLiveAt(entry, kTimeMs)).toBe(false);
  });

  it('momentMs one ms before k_start → false', () => {
    expect(isLiveAt(entry, kStartMs - 1)).toBe(false);
  });

  it('momentMs one ms before k_time → true', () => {
    expect(isLiveAt(entry, kTimeMs - 1)).toBe(true);
  });
});

import { parseMs } from './interval';

describe('parseMs year-only regression', () => {
  it('bare year string is parsed as a date, not as milliseconds', () => {
    expect(parseMs('2026')).toBe(Date.parse('2026'));
    expect(parseMs('2026')).not.toBe(2026);
  });

  it('13-digit numeric string is still Unix ms', () => {
    expect(parseMs('1700000000000')).toBe(1700000000000);
    expect(parseMs(' 1700000000000 ')).toBe(1700000000000);
  });

  it('ISO string still parses', () => {
    expect(parseMs('1970-01-01T00:00:01.000Z')).toBe(1000);
  });
});