/**
 * The translator: the record is UTC, the reading is the viewer's local time.
 *
 * A K-time moment is an absolute instant. UTC is how the record stores it;
 * local is how a person reads it. Nothing here changes the record, the
 * routes, or the moments the drums point at — it only translates what the
 * folder shows. The drums, the month grid and the day hour list are the
 * record's own structure, so they stay UTC; the hour view (the folder)
 * translates.
 */

export type TimeZone = 'utc' | 'local';

/** The viewer's IANA time zone, e.g. "America/New_York". */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export interface ClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const p2 = (n: number): string => String(n).padStart(2, '0');

/** The wall-clock reading of an absolute instant in `timeZone`. */
export function partsInZone(ms: number, timeZone: string): ClockParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string): number => Number(parts.find((p) => p.type === t)!.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** HH:MM:SS of an absolute instant, in UTC or in the viewer's zone. */
export function clockTime(ms: number, zone: TimeZone, timeZone: string): string {
  if (zone === 'utc') {
    const d = new Date(ms);
    return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
  }
  const p = partsInZone(ms, timeZone);
  return `${p2(p.hour)}:${p2(p.minute)}:${p2(p.second)}`;
}

/** The local date and hour of a UTC moment (year/month/day/hour). */
export function utcMomentToLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number } {
  const p = partsInZone(Date.UTC(year, month - 1, day, hour), timeZone);
  return { year: p.year, month: p.month, day: p.day, hour: p.hour };
}

/** The zone's name on a reading: "UTC" or "Local". */
export function zoneName(zone: TimeZone): string {
  return zone === 'utc' ? 'UTC' : 'Local';
}

/** "2026-11-20T22:00" for a UTC moment, or its local reading. */
export function momentInput(
  year: number,
  month: number,
  day: number,
  hour: number,
  zone: TimeZone,
  timeZone: string,
): string {
  if (zone === 'utc') return `${year}-${p2(month)}-${p2(day)}T${p2(hour)}:00`;
  const l = utcMomentToLocal(year, month, day, hour, timeZone);
  return `${l.year}-${p2(l.month)}-${p2(l.day)}T${p2(l.hour)}:00`;
}
