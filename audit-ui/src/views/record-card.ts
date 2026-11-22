import type { Entry } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';

/**
 * The card parts a grid row opens to (entry-grid.ts): the fields the row's
 * columns leave out, each with a spoken label. Every value comes from the
 * entry itself. Field class names (kid, subject, state, authority,
 * evidence, reason, k-start, t-time, e-time, k-time) are the hooks the
 * views and tests use.
 */

export type CardField =
  | 'kid'
  | 'subject'
  | 'state'
  | 'authority'
  | 'evidence'
  | 'reason'
  | 'k-start'
  | 't-time'
  | 'e-time'
  | 'k-time';

function span(className: string, text: string): HTMLSpanElement {
  return Object.assign(document.createElement('span'), { className, textContent: text });
}

function div(className: string, children: HTMLElement[]): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  d.append(...children);
  return d;
}

/**
 * Spoken label for each field. Rendered as real (visually hidden) text in
 * front of the value, so a screen reader announces it; the visible captions
 * stay CSS and are marked decorative there, so nothing is read twice.
 */
export const FIELD_LABELS: Record<CardField, string> = {
  kid: 'KID',
  subject: 'Subject',
  state: 'State',
  authority: 'Authority',
  evidence: 'Evidence',
  reason: 'Why',
  'k-start': 'Live from',
  't-time': 'Wall time',
  'e-time': 'Event time',
  'k-time': 'Live until',
};

/** A visually hidden text node for assistive technology. */
export function srOnly(text: string): HTMLSpanElement {
  return span('sr-only', text);
}

/** [hidden spoken label, value span] for one field of `entry`. */
function labelledField(entry: Entry, f: CardField): HTMLElement[] {
  return [srOnly(`${FIELD_LABELS[f]}: `), span(f, value(entry, f))];
}

function value(entry: Entry, f: CardField): string {
  switch (f) {
    case 'kid':
      return renderKid(entry.kid);
    case 'subject':
      return entry.subject;
    case 'state':
      return entry.state;
    case 'authority':
      return String(entry.authority);
    case 'evidence':
      return entry.evidence;
    case 'reason':
      return entry.reason;
    case 'k-start':
      return entry.k_start;
    case 't-time':
      return entry.t_time;
    case 'e-time':
      return entry.e_time;
    case 'k-time':
      return entry.k_time;
  }
}

/**
 * The details a grid row opens to (Action List): everything the row's
 * columns leave out, in the card skeleton's order: the meta line (live
 * from), the WHY/EVIDENCE inset, and the times footer. The state, KID,
 * subject and authority are the row's own columns.
 */
export function renderCardDetails(entry: Entry): HTMLElement {
  const field = (f: CardField): HTMLElement[] => labelledField(entry, f);
  const details = document.createElement('div');
  details.append(
    div('card-meta', field('k-start')),
    div('card-inset', [...field('reason'), ...field('evidence')]),
    div('card-foot', [div('card-times', [...field('t-time'), ...field('e-time'), ...field('k-time')])]),
  );
  return details;
}
