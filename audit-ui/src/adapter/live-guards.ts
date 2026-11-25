// Shape guards for the connector's record reads. A reply that does not have
// the seam shape is refused in words; nothing is coerced into shape.
import type { Entry, KidMap } from './seam';
import { parseMs } from '../util/interval';

const STRING_FIELDS = [
  'id', 'subject', 'state', 'pool', 'k_start', 't_time', 'e_time', 'k_time',
  'evidence', 'reason', 'prev_hash',
] as const;

/**
 * True when `v` has every Entry field with its seam type, and `k_start` and
 * `t_time` parse as times (the views bucket and sort by them). `e_time` and
 * `k_time` may be "": the connector sends that for "not recorded" and "open".
 */
export function isEntry(v: unknown): v is Entry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.kid === 'number' && Number.isInteger(e.kid) &&
    typeof e.authority === 'number' && Number.isInteger(e.authority) &&
    e.authority >= 0 && e.authority <= 9 &&
    STRING_FIELDS.every((f) => typeof e[f] === 'string') &&
    Number.isFinite(parseMs(e.k_start as string)) &&
    Number.isFinite(parseMs(e.t_time as string)) &&
    (e.case_file === undefined ||
      (Array.isArray(e.case_file) && e.case_file.every((x) => typeof x === 'string')))
  );
}

/** The Entry[] in `v`, or a sentence saying why it is not one. */
export function asEntries(v: unknown, path: string): { ok: true; data: Entry[] } | { ok: false; error: string } {
  if (!Array.isArray(v)) {
    return { ok: false, error: `Connector reply to ${path} is not a list of entries (see docs/assembly-parts.md)` };
  }
  const bad = v.findIndex((e) => !isEntry(e));
  if (bad !== -1) {
    return {
      ok: false,
      error: `Connector reply to ${path}: item ${bad} is not an Entry (see docs/assembly-parts.md)`,
    };
  }
  return { ok: true, data: v as Entry[] };
}

/**
 * The KidMap in `v`, or a sentence saying why it is not one. JSON object keys
 * are strings, so each key must be the decimal form of a whole number and
 * each value a string label.
 */
export function asKidMap(v: unknown, path: string): { ok: true; data: KidMap } | { ok: false; error: string } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    return { ok: false, error: `Connector reply to ${path} is not a KID map object (see docs/assembly-parts.md)` };
  }
  const out: KidMap = {};
  for (const [key, label] of Object.entries(v as Record<string, unknown>)) {
    if (!/^(0|[1-9]\d*)$/.test(key) || !Number.isSafeInteger(Number(key))) {
      return { ok: false, error: `Connector reply to ${path}: key "${key}" is not a KID number` };
    }
    if (typeof label !== 'string') {
      return { ok: false, error: `Connector reply to ${path}: the label for KID ${key} is not a string` };
    }
    out[Number(key)] = label;
  }
  return { ok: true, data: out };
}
