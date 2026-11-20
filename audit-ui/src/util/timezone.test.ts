import { describe, it, expect } from 'vitest';
import {
  clockTime,
  localToUtc,
  momentInput,
  partsInZone,
  utcMomentToLocal,
  viewerTimeZone,
  zoneName,
} from './timezone';

// The viewer's zone is the machine's; the translator takes an explicit zone
// so the local readings are testable anywhere (the VM is UTC).
const NY = 'America/New_York';

describe('utcMomentToLocal', () => {
  it('22:00 UTC is 17:00 the same day in New York (EST, winter)', () => {
    expect(utcMomentToLocal(2026, 11, 20, 22, NY)).toEqual({ year: 2026, month: 11, day: 20, hour: 17 });
  });

  it('02:00 UTC is 21:00 the day before in New York (the date shifts)', () => {
    expect(utcMomentToLocal(2026, 11, 21, 2, NY)).toEqual({ year: 2026, month: 11, day: 20, hour: 21 });
  });

  it('22:00 UTC in July is 18:00 in New York (EDT, not a fixed offset)', () => {
    expect(utcMomentToLocal(2026, 7, 4, 22, NY)).toEqual({ year: 2026, month: 7, day: 4, hour: 18 });
  });

  it('midnight UTC is 19:00 the day before in New York', () => {
    expect(utcMomentToLocal(2026, 11, 21, 0, NY)).toEqual({ year: 2026, month: 11, day: 20, hour: 19 });
  });
});

describe('localToUtc', () => {
  it('17:00 in New York is 22:00 UTC the same day (EST, winter)', () => {
    expect(localToUtc(2026, 11, 20, 17, NY)).toEqual({ year: 2026, month: 11, day: 20, hour: 22 });
  });

  it('21:00 in New York is 02:00 UTC the next day (the date shifts)', () => {
    expect(localToUtc(2026, 11, 20, 21, NY)).toEqual({ year: 2026, month: 11, day: 21, hour: 2 });
  });

  it('18:00 in New York in July is 22:00 UTC (EDT, not a fixed offset)', () => {
    expect(localToUtc(2026, 7, 4, 18, NY)).toEqual({ year: 2026, month: 7, day: 4, hour: 22 });
  });

  it('03:00 on the spring-forward day is 07:00 UTC (EDT begins)', () => {
    expect(localToUtc(2026, 3, 8, 3, NY)).toEqual({ year: 2026, month: 3, day: 8, hour: 7 });
  });

  it('01:00 on the fall-back day is 05:00 UTC (the first of the two)', () => {
    expect(localToUtc(2026, 11, 1, 1, NY)).toEqual({ year: 2026, month: 11, day: 1, hour: 5 });
  });

  it('02:00 after the fall-back is 07:00 UTC (EST again)', () => {
    expect(localToUtc(2026, 11, 1, 2, NY)).toEqual({ year: 2026, month: 11, day: 1, hour: 7 });
  });

  it('round-trips with utcMomentToLocal for real times', () => {
    // The second 01:00 on the fall-back day is the one reading that cannot
    // round-trip: localToUtc returns the first of the two by design.
    for (const [y, mo, d, h] of [[2026, 11, 20, 22], [2026, 11, 21, 2], [2026, 7, 4, 22], [2026, 3, 8, 7], [2026, 11, 1, 5]] as const) {
      const l = utcMomentToLocal(y, mo, d, h, NY);
      expect(localToUtc(l.year, l.month, l.day, l.hour, NY)).toEqual({ year: y, month: mo, day: d, hour: h });
    }
  });
});

describe('clockTime', () => {
  it('UTC reads the UTC clock', () => {
    const ms = Date.UTC(2026, 10, 20, 22, 29, 8);
    expect(clockTime(ms, 'utc', NY)).toBe('22:29:08');
  });

  it('local reads the New York clock (the novel mint, 22:29:08 UTC)', () => {
    const ms = Date.UTC(2026, 10, 20, 22, 29, 8);
    expect(clockTime(ms, 'local', NY)).toBe('17:29:08');
  });

  it('local midnight UTC is 19:00:00 the day before in New York', () => {
    const ms = Date.UTC(2026, 10, 21, 0, 0, 0);
    expect(clockTime(ms, 'local', NY)).toBe('19:00:00');
  });
});

describe('momentInput', () => {
  it('UTC passes the moment through', () => {
    expect(momentInput(2026, 11, 20, 22, 'utc', NY)).toBe('2026-11-20T22:00');
  });

  it('local translates the moment, date included', () => {
    expect(momentInput(2026, 11, 20, 22, 'local', NY)).toBe('2026-11-20T17:00');
    expect(momentInput(2026, 11, 21, 2, 'local', NY)).toBe('2026-11-20T21:00');
  });
});

describe('partsInZone', () => {
  it('reads every part of an instant in the zone', () => {
    expect(partsInZone(Date.UTC(2026, 10, 20, 22, 29, 8), NY)).toEqual({
      year: 2026, month: 11, day: 20, hour: 17, minute: 29, second: 8,
    });
  });
});

describe('zoneName and viewerTimeZone', () => {
  it('names the zones', () => {
    expect(zoneName('utc')).toBe('UTC');
    expect(zoneName('local')).toBe('Local');
  });

  it('the viewer has a zone', () => {
    expect(viewerTimeZone().length).toBeGreaterThan(0);
  });
});
