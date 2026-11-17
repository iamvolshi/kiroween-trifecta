import type { Entry, KidMap } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';
import { formatLabel } from '../util/format.ts';

/**
 * One skeleton for every record card (presentation only). Reading order:
 *   chips    authority badge + state tag
 *   headline what happened (subject: state)
 *   meta     one mono line: KID . subject . live from
 *   inset    WHY (reason) and EVIDENCE, each labeled
 *   foot     times on one side; "Inspect" only when the card is a link
 * Every value comes from the entry itself. Field class names (kid, subject,
 * state, authority, evidence, reason, k-start, t-time, e-time, k-time,
 * label) are the hooks the views and tests already use.
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

export interface CardOptions {
  /** Fields to show; anything not listed is left out, as each view did before. */
  fields: CardField[];
  /** Headline element class: 'label' for the action list, 'card-headline' elsewhere. */
  headlineClass?: string;
  /** True when the host is a link to Entry Detail: shows the Inspect cue. */
  link?: boolean;
}

function span(className: string, text: string): HTMLSpanElement {
  return Object.assign(document.createElement('span'), { className, textContent: text });
}

function div(className: string, children: HTMLElement[]): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  d.append(...children);
  return d;
}

function value(entry: Entry, f: CardField, kidMap: KidMap | null): string {
  switch (f) {
    case 'kid':
      return renderKid(entry.kid, kidMap);
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

/** Fills `host` (an <a> or <li>) with the card skeleton for `entry`. */
export function fillRecordCard(
  host: HTMLElement,
  entry: Entry,
  kidMap: KidMap | null,
  opts: CardOptions,
): void {
  const has = (f: CardField): boolean => opts.fields.includes(f);
  const field = (f: CardField): HTMLSpanElement => span(f, value(entry, f, kidMap));

  host.classList.add('record-card');
  host.dataset.state = entry.state;

  const chips: HTMLElement[] = [];
  if (has('authority')) chips.push(field('authority'));
  if (has('state')) chips.push(field('state'));
  host.appendChild(div('card-chips', chips));

  host.appendChild(
    div('card-headline-row', [
      span(opts.headlineClass ?? 'card-headline', formatLabel(entry.subject, entry.state)),
    ]),
  );

  const meta = (['kid', 'subject', 'k-start'] as CardField[]).filter(has).map(field);
  if (meta.length > 0) host.appendChild(div('card-meta', meta));

  const inset = (['reason', 'evidence'] as CardField[]).filter(has).map(field);
  if (inset.length > 0) host.appendChild(div('card-inset', inset));

  const times = (['t-time', 'e-time', 'k-time'] as CardField[]).filter(has).map(field);
  const foot: HTMLElement[] = [div('card-times', times)];
  if (opts.link) foot.push(span('card-action', 'Inspect'));
  if (times.length > 0 || opts.link) host.appendChild(div('card-foot', foot));
}
