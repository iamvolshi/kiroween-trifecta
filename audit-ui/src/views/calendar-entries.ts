import type { Entry } from '../adapter/seam.ts';
import { parseMs } from '../util/interval.ts';
import { renderKid } from '../util/kid-display.ts';
import { clockTime, type TimeZone } from '../util/timezone.ts';

/** The clock time of an entry, HH:MM:SS — UTC, or the viewer's local time — or ??:??:?? when its start cannot be read. */
function timeOf(e: Entry, zone: TimeZone, timeZone: string): string {
  const ms = parseMs(e.k_start);
  if (Number.isNaN(ms)) return '??:??:??';
  return clockTime(ms, zone, timeZone);
}

/**
 * Entries as log lines: one line per entry, clock time first, then KID,
 * subject, state, authority, evidence, reason. The KID links to its Entry
 * Detail. Data via textContent.
 */
export function renderEntryLog(
  entries: Entry[],
  label: string,
  zone: TimeZone,
  timeZone: string,
): HTMLElement {
  const log = document.createElement('div');
  log.className = 'entry-log';
  log.setAttribute('role', 'list');
  log.setAttribute('aria-label', label);

  for (const entry of entries) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.setAttribute('role', 'listitem');
    line.appendChild(document.createTextNode(`${timeOf(entry, zone, timeZone)} · `));

    const kid = document.createElement('a');
    kid.className = 'kid';
    kid.setAttribute(
      'href',
      `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${encodeURIComponent(entry.id)}`,
    );
    kid.textContent = renderKid(entry.kid);
    line.appendChild(kid);

    const fields: Array<[string, string]> = [
      ['subject', entry.subject],
      ['state', entry.state],
      ['authority', String(entry.authority)],
      ['evidence', entry.evidence],
      ['reason', entry.reason],
    ];
    for (const [cls, text] of fields) {
      line.appendChild(document.createTextNode(' · '));
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      line.appendChild(span);
    }
    log.appendChild(line);
  }
  return log;
}
