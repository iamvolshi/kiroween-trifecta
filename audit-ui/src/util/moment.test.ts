import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseUtcInput } from './moment.ts';

describe('parseUtcInput', () => {
  it('reads components as UTC', () => {
    expect(parseUtcInput('2024-01-01T00:00')).toBe(Date.parse('2024-01-01T00:00:00Z'));
    expect(parseUtcInput('2024-06-15T08:30:15')).toBe(Date.parse('2024-06-15T08:30:15Z'));
  });

  it('returns null for empty, malformed or out-of-range input', () => {
    for (const bad of ['', '   ', 'nope', '2024-13-01T00:00', '2024-02-30T00:00', '2024-01-01T25:00', '2024-01-01']) {
      expect(parseUtcInput(bad)).toBeNull();
    }
  });

  it('round-trips any UTC minute through ISO formatting (timezone independent)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(1971, 0, 1), max: Date.UTC(2099, 11, 31) }),
        (raw) => {
          const minute = Math.floor(raw / 60_000) * 60_000;
          const value = new Date(minute).toISOString().slice(0, 16);
          return parseUtcInput(value) === minute;
        },
      ),
    );
  });
});