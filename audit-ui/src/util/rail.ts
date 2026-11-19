import type { Entry } from '../adapter/seam.ts';
import { parseMs } from './interval.ts';

/**
 * The calendar rail's periods, from the loaded entries only: the quarters,
 * ISO weeks and days that hold at least one entry (by k_start, UTC), and the
 * per-hour counts of one day. Nothing here invents a period.
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
