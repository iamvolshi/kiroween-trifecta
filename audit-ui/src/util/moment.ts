/**
 * Parses a `datetime-local` input value as a UTC moment.
 *
 * Record times are UTC, so the picker's wall-clock components are read as UTC
 * (never as machine-local time). Returns null for empty or malformed input.
 */
export function parseUtcInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
    value.trim(),
  );
  if (!m) return null;

  const [, y, mo, d, h, mi, s, frac] = m;
  const ms = frac ? Number(frac.padEnd(3, '0')) : 0;
  const t = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
    ms,
  );
  if (Number.isNaN(t)) return null;

  // Reject out-of-range components that Date.UTC would silently roll over.
  const back = new Date(t);
  if (
    back.getUTCFullYear() !== Number(y) ||
    back.getUTCMonth() !== Number(mo) - 1 ||
    back.getUTCDate() !== Number(d) ||
    back.getUTCHours() !== Number(h) ||
    back.getUTCMinutes() !== Number(mi)
  ) {
    return null;
  }
  return t;
}
