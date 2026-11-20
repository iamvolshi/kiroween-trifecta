import type { Entry } from '../adapter/seam.ts';
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

/** Fills `host` (an <a> or <li>) with the card skeleton for `entry`. */
export function fillRecordCard(
  host: HTMLElement,
  entry: Entry,
  opts: CardOptions,
): void {
  const has = (f: CardField): boolean => opts.fields.includes(f);
  const field = (f: CardField): HTMLElement[] => labelledField(entry, f);

  host.classList.add('record-card');
  host.dataset.state = entry.state;

  const chips: HTMLElement[] = [];
  if (has('authority')) chips.push(...field('authority'));
  if (has('state')) chips.push(...field('state'));
  host.appendChild(div('card-chips', chips));

  host.appendChild(
    div('card-headline-row', [
      span(opts.headlineClass ?? 'card-headline', formatLabel(entry.subject, entry.state)),
    ]),
  );

  const meta = (['kid', 'subject', 'k-start'] as CardField[]).filter(has).flatMap(field);
  if (meta.length > 0) host.appendChild(div('card-meta', meta));

  const inset = (['reason', 'evidence'] as CardField[]).filter(has).flatMap(field);
  if (inset.length > 0) host.appendChild(div('card-inset', inset));

  const times = (['t-time', 'e-time', 'k-time'] as CardField[]).filter(has).flatMap(field);
  const foot: HTMLElement[] = [div('card-times', times)];
  if (opts.link) foot.push(span('card-action', 'Inspect'));
  if (times.length > 0 || opts.link) host.appendChild(div('card-foot', foot));
}

export interface CollapsibleOptions {
  /** Entry Detail href for the separate "Inspect" link. */
  href: string;
  /** Unique id for the details region (aria-controls target). */
  detailsId: string;
}

/**
 * Collapsible variant of the card (Action List only). Two separate
 * controls, never nested:
 *   - the title row is a <button> toggle (aria-expanded, aria-controls),
 *     carrying the highlights: KID, headline (subject: state), authority;
 *   - "Inspect" is a real <a> to Entry Detail, always visible.
 * Underneath, the details region holds the rest of the skeleton: the
 * state chip, the meta line (subject . live from), the WHY/EVIDENCE inset,
 * and the times footer. It starts hidden; each card toggles on its own.
 */
export function fillCollapsibleCard(
  host: HTMLElement,
  entry: Entry,
  opts: CollapsibleOptions,
): void {
  const field = (f: CardField): HTMLElement[] => labelledField(entry, f);

  host.classList.add('record-card', 'card-collapsible');
  host.dataset.state = entry.state;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'card-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', opts.detailsId);
  toggle.append(
    ...field('kid'),
    span('label', formatLabel(entry.subject, entry.state)),
    ...field('authority'),
  );

  const inspect = document.createElement('a');
  inspect.className = 'card-action';
  inspect.setAttribute('href', opts.href);
  inspect.textContent = 'Inspect';

  host.appendChild(div('card-row', [toggle, inspect]));

  const details = document.createElement('div');
  details.className = 'card-details';
  details.id = opts.detailsId;
  details.setAttribute('role', 'region');
  details.setAttribute('aria-label', `Details: ${formatLabel(entry.subject, entry.state)}`);
  details.hidden = true;
  details.append(
    div('card-chips', field('state')),
    div('card-meta', [...field('subject'), ...field('k-start')]),
    div('card-inset', [...field('reason'), ...field('evidence')]),
    div('card-foot', [div('card-times', [...field('t-time'), ...field('e-time'), ...field('k-time')])]),
  );
  host.appendChild(details);

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    details.hidden = open;
    host.classList.toggle('is-open', !open);
  });
}
