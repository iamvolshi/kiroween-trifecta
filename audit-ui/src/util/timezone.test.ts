import { describe, it, expect } from 'vitest';
import {
  clockTime,
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
