import type { Entry } from '../adapter/seam.ts';
import { parseMs } from './interval.ts';

/**
 * The calendar rail's periods: each wheel holds its full range, and the
 * counts say what the record holds (0 where empty) — the same rule the
 * hour wheel already had, all 24 hours with live counts. A wheel with
 * nothing at all in the record says so in words. Nothing here invents an
 * entry; a period with 0 entries is a true statement about the record.
 */

export interface Day {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface Quarter {
  year: number;
  q: number; // 1-4
}

export interface Week {
  /** ISO week-numbering year and week (Monday first). */
  isoYear: number;
  week: number;
}

const DAY_MS = 86_400_000;

export function dayOf(e: Entry): Day | null {
  const ms = parseMs(e.k_start);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function quarterOf(d: Day): Quarter {
  return { year: d.year, q: Math.floor((d.month - 1) / 3) + 1 };
}

/** ISO 8601 week of a UTC day. */
export function isoWeekOf(d: Day): Week {
  const t = Date.UTC(d.year, d.month - 1, d.day);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = t + (3 - dow) * DAY_MS;
  const isoYear = new Date(thursday).getUTCFullYear();
  const jan4 = Date.UTC(isoYear, 0, 4);
  const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7;
  const week1Monday = jan4 - jan4Dow * DAY_MS;
  return { isoYear, week: Math.floor((thursday - week1Monday) / (7 * DAY_MS)) + 1 };
}

export const dayKey = (d: Day): string =>
  `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
export const quarterKey = (q: Quarter): string => `${q.year}-Q${q.q}`;
export const weekKey = (w: Week): string => `${w.isoYear}-W${String(w.week).padStart(2, '0')}`;

/** Every distinct day holding an entry, oldest first, with its entry count. */
export function daysPresent(entries: Entry[]): Array<{ day: Day; count: number }> {
  const counts = new Map<string, { day: Day; count: number }>();
  for (const e of entries) {
    const d = dayOf(e);
    if (!d) continue;
    const k = dayKey(d);
    const cur = counts.get(k);
    if (cur) cur.count++;
    else counts.set(k, { day: d, count: 1 });
  }
  return [...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
}

/** Quarters holding entries, oldest first. */
export function quartersPresent(days: Day[]): Quarter[] {
  const seen = new Map<string, Quarter>();
  for (const d of days) {
    const q = quarterOf(d);
    seen.set(quarterKey(q), q);
  }
  return [...seen.values()];
}

/** All four quarters of a year, oldest first. */
export function quartersOfYear(year: number): Quarter[] {
  return [1, 2, 3, 4].map((q) => ({ year, q }));
}

/** Every ISO week holding a day of a quarter, oldest first. */
export function weeksOfQuarter(q: Quarter): Week[] {
  const first = Date.UTC(q.year, (q.q - 1) * 3, 1);
  const last = Date.UTC(q.year, q.q * 3, 0); // last day of the quarter's third month
  const seen = new Map<string, Week>();
  for (let t = first; t <= last; t += DAY_MS) {
    const d = new Date(t);
    const w = isoWeekOf({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    seen.set(weekKey(w), w);
  }
  return [...seen.values()].sort((a, b) => a.isoYear - b.isoYear || a.week - b.week);
}

/** The Monday of an ISO week. */
export function mondayOfWeek(w: Week): Day {
  const jan4 = Date.UTC(w.isoYear, 0, 4);
  const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7;
  const monday = jan4 - jan4Dow * DAY_MS + (w.week - 1) * 7 * DAY_MS;
  const d = new Date(monday);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Every day of an ISO week that falls inside a quarter, oldest first. */
export function daysOfWeekInQuarter(w: Week, q: Quarter): Day[] {
  const mon = mondayOfWeek(w);
  const start = Date.UTC(mon.year, mon.month - 1, mon.day);
  const out: Day[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start + i * DAY_MS);
    const day: Day = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    const dq = quarterOf(day);
    if (dq.year === q.year && dq.q === q.q) out.push(day);
  }
  return out;
}

/** The years a wheel spans: one before the earliest entry year through one
 * past the latest entry year or this year, whichever is later. Empty record: none. */
export function yearsRange(days: Day[]): number[] {
  if (days.length === 0) return [];
  const years = days.map((d) => d.year);
  const lo = Math.min(...years) - 1;
  const hi = Math.max(new Date().getUTCFullYear(), ...years) + 1;
  const out: number[] = [];
  for (let y = lo; y <= hi; y++) out.push(y);
  return out;
}

/** Years holding entries, oldest first: the time tree's root. */
export function yearsPresent(days: Day[]): number[] {
  const seen = new Set<number>();
  for (const d of days) seen.add(d.year);
  return [...seen].sort((a, b) => a - b);
}

/** Quarters holding entries inside one year, oldest first. */
export function quartersOfYearPresent(days: Day[], year: number): Quarter[] {
  return quartersPresent(days).filter((q) => q.year === year);
}

/** ISO weeks holding entries inside one quarter, oldest first. */
export function weeksPresent(days: Day[], q: Quarter): Week[] {
  const seen = new Map<string, Week>();
  for (const d of days) {
    const dq = quarterOf(d);
    if (dq.year !== q.year || dq.q !== q.q) continue;
    const w = isoWeekOf(d);
    seen.set(weekKey(w), w);
  }
  return [...seen.values()];
}

/** Days holding entries inside one quarter's ISO week, oldest first. */
export function daysOfWeekPresent(days: Day[], q: Quarter, w: Week): Day[] {
  return days.filter((d) => {
    const dq = quarterOf(d);
    const dw = isoWeekOf(d);
    return dq.year === q.year && dq.q === q.q && dw.isoYear === w.isoYear && dw.week === w.week;
  });
}

/** Entry count per UTC hour (0-23) of one day. */
export function hourCounts(entries: Entry[], d: Day): number[] {
  const out = new Array<number>(24).fill(0);
  const start = Date.UTC(d.year, d.month - 1, d.day);
  for (const e of entries) {
    const ms = parseMs(e.k_start);
    if (Number.isNaN(ms) || ms < start || ms >= start + DAY_MS) continue;
    out[Math.floor((ms - start) / 3_600_000)]!++;
  }
  return out;
}
