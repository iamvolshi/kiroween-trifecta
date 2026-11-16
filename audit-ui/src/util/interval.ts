import type { Entry } from '../adapter/seam';

/**
 * Parses an ISO-8601 string or a Unix-ms numeric string to milliseconds.
 * Uses Date.parse() for ISO strings, Number() for numeric strings.
 */
export function parseMs(value: string): number {
  // A purely numeric string (possibly with leading/trailing whitespace) is a
  // Unix-ms timestamp; everything else is treated as ISO-8601.
  return /^\s*-?\d{10,}\s*$/.test(value) ? Number(value) : Date.parse(value);
}

/**
 * Returns true iff `momentMs` falls within the entry's live interval.
 *
 * Lower bound: k_start  (inclusive) — k_start_ms <= momentMs
 * Upper bound: k_time   (exclusive) — momentMs   <  k_time_ms
 *
 * Validates: Requirements 4.2, 4.4
 */
export function isLiveAt(entry: Entry, momentMs: number): boolean {
  const kStartMs = parseMs(entry.k_start);
  const kTimeMs = parseMs(entry.k_time);
  return kStartMs <= momentMs && momentMs < kTimeMs;
}

/**
 * Ascending comparator on parsed k_start milliseconds.
 * An unparseable k_start (NaN) sorts first, so ordering stays deterministic.
 */
export function compareKStart(a: Entry, b: Entry): number {
  const na = parseMs(a.k_start);
  const nb = parseMs(b.k_start);
  const x = Number.isNaN(na) ? -Infinity : na;
  const y = Number.isNaN(nb) ? -Infinity : nb;
  if (x === y) return 0;
  return x < y ? -1 : 1;
}
