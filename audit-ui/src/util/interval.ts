import type { Entry } from '../adapter/seam';

/**
 * Parses an ISO-8601 string or a Unix-ms numeric string to milliseconds.
 * Uses Date.parse() for ISO strings, Number() for numeric strings.
 */
function parseMs(value: string): number {
  // A purely numeric string (possibly with leading/trailing whitespace) is a
  // Unix-ms timestamp; everything else is treated as ISO-8601.
  return /^\s*-?\d+\s*$/.test(value) ? Number(value) : Date.parse(value);
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
