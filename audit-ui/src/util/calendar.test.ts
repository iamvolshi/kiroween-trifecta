import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { makeEntry } from '../test-helpers.ts';
import {
  daysWithEntries,
  entriesInHour,
  entryDayKey,
  hourMomentInput,
  monthGrid,
  parseCalendarPath,
  calendarHref,
} from './calendar.ts';
import { parseUtcInput } from './moment.ts';

describe('calendar util', () => {
  it('entryDayKey returns UTC day or null', () => {
    expect(entryDayKey(makeEntry({ k_start: '2026-11-16T23:59:59.999Z' }))).toBe('2026-11-16');
    expect(entryDayKey(makeEntry({ k_start: 'junk' }))).toBeNull();
  });

  it('dotted days equal k_start days (property)', () => {
    const ms = fc.integer({ min: Date.UTC(2026, 9, 1), max: Date.UTC(2026, 11, 31) });
    fc.assert(
      fc.property(fc.array(ms, { maxLength: 30 }), (list) => {
        const entries = list.map((t, i) =>
          makeEntry({ id: `e${i}`, k_start: new Date(t).toISOString() }),
        );
        const got = [...daysWithEntries(entries, 2026, 11).keys()].sort((a, b) => a - b);
        const want = [
          ...new Set(
            list
              .map((t) => new Date(t))
              .filter((d) => d.getUTCMonth() === 10)
              .map((d) => d.getUTCDate()),
          ),
        ].sort((a, b) => a - b);
        expect(got).toEqual(want);
      }),
    );
  });

  it('monthGrid is Monday first and complete', () => {
    const g = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(g[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g.flat().filter((d) => d !== null)).toHaveLength(30);
  });

  it('entriesInHour is half-open and sorted', () => {
    const a = makeEntry({ id: 'a', k_start: '2026-11-16T10:30:00.000Z' });
    const b = makeEntry({ id: 'b', k_start: '2026-11-16T10:00:00.000Z' });
    const c = makeEntry({ id: 'c', k_start: '2026-11-16T11:00:00.000Z' });
    expect(entriesInHour([a, b, c], 2026, 11, 16, 10).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('hourMomentInput round-trips through parseUtcInput', () => {
    expect(hourMomentInput(2026, 11, 16, 9)).toBe('2026-11-16T09:00');
    expect(parseUtcInput('2026-11-16T09:00')).toBe(Date.UTC(2026, 10, 16, 9));
  });

  it('parseCalendarPath accepts the four forms', () => {
    expect(parseCalendarPath('/calendar')).toBe('default');
    expect(parseCalendarPath('/calendar/2026-11')).toEqual({ level: 'month', year: 2026, month: 11 });
    expect(parseCalendarPath('/calendar/2026-11-16')).toEqual({ level: 'day', year: 2026, month: 11, day: 16 });
    expect(parseCalendarPath('/calendar/2026-11-16/09')).toEqual({
      level: 'hour', year: 2026, month: 11, day: 16, hour: 9,
    });
  });

  it('parseCalendarPath rejects invalid input', () => {
    for (const p of [
      '/calendar/2026-13', '/calendar/2026-00', '/calendar/2026-02-30', '/calendar/0000-01', '/calendar/0099-05-01',
      '/calendar/2026-11-16/24', '/calendar/junk', '/calendar/2026-11-16/9',
      '/calendar/2026-11/05', '/other',
    ]) {
      expect(parseCalendarPath(p), p).toBeNull();
    }
  });

  it('calendarHref round-trips', () => {
    for (const p of ['/calendar/2026-11', '/calendar/2026-11-16', '/calendar/2026-11-16/09']) {
      const t = parseCalendarPath(p);
      expect(t).not.toBeNull();
      expect(t).not.toBe('default');
      if (t && t !== 'default') expect(calendarHref(t)).toBe(p);
    }
  });
});
