import type { Entry } from '../adapter/seam.ts';
import { compareKStart, parseMs } from './interval.ts';
import { parseUtcInput } from './moment.ts';

/** A calendar drill-down level. Month is 1-12; all dates are UTC. */
export type CalendarTarget =
  | { level: 'month'; year: number; month: number }
  | { level: 'day'; year: number; month: number; day: number }
  | { level: 'hour'; year: number; month: number; day: number; hour: number };

export const WEEKDAY_HEADERS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MONTH_NAMES: readonly string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const p2 = (n: number): string => String(n).padStart(2, '0');
const p4 = (n: number): string => String(n).padStart(4, '0');

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `YYYY-MM-DD` (UTC) of the entry's k_start, or null if unparseable. */
export function entryDayKey(e: Entry): string | null {
  const ms = parseMs(e.k_start);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${p4(d.getUTCFullYear())}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** day-of-month -> count of entries whose k_start falls on that UTC day. */
export function daysWithEntries(
  entries: Entry[],
  year: number,
  month: number,
): Map<number, number> {
  const out = new Map<number, number>();
  const prefix = `${p4(year)}-${p2(month)}-`;
  for (const e of entries) {
    const key = entryDayKey(e);
    if (key === null || !key.startsWith(prefix)) continue;
    const day = Number(key.slice(prefix.length));
    out.set(day, (out.get(day) ?? 0) + 1);
  }
  return out;
}

/** Weeks (Monday first) of day numbers; null pads days outside the month. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const total = daysInMonth(year, month);
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const lead = (firstDow + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Entries whose k_start is in [hour start, +1h), sorted by k_start. */
export function entriesInHour(
  entries: Entry[],
  y: number,
  m: number,
  d: number,
  h: number,
): Entry[] {
  const start = Date.UTC(y, m - 1, d, h);
  const end = start + 3_600_000;
  return entries
    .filter((e) => {
      const ms = parseMs(e.k_start);
      return !Number.isNaN(ms) && ms >= start && ms < end;
    })
    .sort(compareKStart);
}

/** `YYYY-MM-DDTHH:00`; the queried moment is parseUtcInput of this string. */
export function hourMomentInput(y: number, m: number, d: number, h: number): string {
  return `${p4(y)}-${p2(m)}-${p2(d)}T${p2(h)}:00`;
}

export function calendarHref(t: CalendarTarget): string {
  const month = `${p4(t.year)}-${p2(t.month)}`;
  if (t.level === 'month') return `/calendar/${month}`;
  const day = `${month}-${p2(t.day)}`;
  if (t.level === 'day') return `/calendar/${day}`;
  return `/calendar/${day}/${p2(t.hour)}`;
}

/** Parses calendar routes. Bare `/calendar` -> 'default'; invalid -> null. */
export function parseCalendarPath(path: string): CalendarTarget | 'default' | null {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (trimmed === '/calendar') return 'default';
  const m = /^\/calendar\/(\d{4})-(\d{2})(?:-(\d{2})(?:\/(\d{2}))?)?$/.exec(trimmed);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  // Date.UTC maps years 0..99 onto 1900..1999; four-digit years only.
  if (year < 1000) return null;
  if (month < 1 || month > 12) return null;
  if (m[3] === undefined) return { level: 'month', year, month };
  const day = Number(m[3]);
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (m[4] === undefined) return { level: 'day', year, month, day };
  const hour = Number(m[4]);
  if (hour > 23) return null;
  return { level: 'hour', year, month, day, hour };
}

/** The queried moment for an hour target. */
export function hourMoment(y: number, m: number, d: number, h: number): number | null {
  return parseUtcInput(hourMomentInput(y, m, d, h));
}
