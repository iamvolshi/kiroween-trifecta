import type { Entry } from '../adapter/seam.ts';

/**
 * Action List filters: event type (state), retractions, confidence band.
 * Pure logic over the entries the view already fetched, plus the filter bar.
 * No values come from anywhere but those entries.
 */

/**
 * "Retractions" = entries that take back an earlier belief. Read as state
 * `rejected` or `contradicted` (judgment call flagged for Darren in the
 * round order; change this set if he narrows it).
 */
export const RETRACTION_STATES: ReadonlySet<string> = new Set(['rejected', 'contradicted']);

/** Darren's triadic confidence bands on the 0-9 authority scale. */
export const BANDS = [
  { id: 'low', label: '1-3 low', min: 1, max: 3 },
  { id: 'middle', label: '4-6 middle', min: 4, max: 6 },
  { id: 'high', label: '7-9 high', min: 7, max: 9 },
] as const;

export type BandId = (typeof BANDS)[number]['id'];

export interface FilterState {
  /** null = All event types. */
  state: string | null;
  /** true = only retraction entries. */
  retractions: boolean;
  /** null = All confidence levels. */
  band: BandId | null;
}

export const NO_FILTER: FilterState = { state: null, retractions: false, band: null };

export function isRetraction(e: Entry): boolean {
  return RETRACTION_STATES.has(e.state);
}

export function inBand(e: Entry, band: BandId): boolean {
  const b = BANDS.find((x) => x.id === band)!;
  return e.authority >= b.min && e.authority <= b.max;
}

/** One chip per state present in the loaded entries, alphabetical. */
export function statesIn(entries: Entry[]): string[] {
  return [...new Set(entries.map((e) => e.state))].sort();
}

export function matches(e: Entry, f: FilterState): boolean {
  if (f.state !== null && e.state !== f.state) return false;
  if (f.retractions && !isRetraction(e)) return false;
  if (f.band !== null && !inBand(e, f.band)) return false;
  return true;
}

export function applyFilters(entries: Entry[], f: FilterState): Entry[] {
  return entries.filter((e) => matches(e, f));
}

export function titleCase(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

/** Words naming the active filters, e.g. "event type Rejected, confidence 4-6 middle". */
export function describeFilters(f: FilterState): string {
  const parts: string[] = [];
  if (f.state !== null) parts.push(`event type ${titleCase(f.state)}`);
  if (f.retractions) parts.push('retractions only');
  if (f.band !== null) parts.push(`confidence ${BANDS.find((b) => b.id === f.band)!.label}`);
  return parts.join(', ');
}

// ---- Filter bar ---------------------------------------------------------

function chip(text: string, pressed: boolean, onClick: () => void, data: Record<string, string>): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'filter-chip';
  b.textContent = text;
  b.setAttribute('aria-pressed', String(pressed));
  for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
  b.addEventListener('click', onClick);
  return b;
}

function group(label: string, buttons: HTMLElement[]): HTMLDivElement {
  const g = document.createElement('div');
  g.className = 'filter-group';
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', label);
  const l = document.createElement('span');
  l.className = 'filter-label';
  l.textContent = label;
  l.setAttribute('aria-hidden', 'true');
  g.append(l, ...buttons);
  return g;
}

/** Renders the bar for `f`; `onChange` receives the next state. */
export function renderFilterBar(
  states: string[],
  f: FilterState,
  onChange: (next: FilterState) => void,
): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'action-filters';

  bar.appendChild(
    group('Event type', [
      chip('All', f.state === null, () => onChange({ ...f, state: null }), { filter: 'state', value: 'all' }),
      ...states.map((s) =>
        chip(titleCase(s), f.state === s, () => onChange({ ...f, state: s }), { filter: 'state', value: s }),
      ),
    ]),
  );

  bar.appendChild(
    group('Retractions', [
      chip('Retractions only', f.retractions, () => onChange({ ...f, retractions: !f.retractions }), {
        filter: 'retractions',
        value: 'on',
      }),
    ]),
  );

  bar.appendChild(
    group('Confidence', [
      chip('All', f.band === null, () => onChange({ ...f, band: null }), { filter: 'band', value: 'all' }),
      ...BANDS.map((b) =>
        chip(b.label, f.band === b.id, () => onChange({ ...f, band: b.id }), { filter: 'band', value: b.id }),
      ),
    ]),
  );

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'filter-clear';
  clear.textContent = 'Clear filters';
  clear.dataset.filter = 'clear';
  clear.dataset.value = 'all';
  // Always enabled, so focus is never dropped; it is a no-op when unfiltered.
  clear.addEventListener('click', () => onChange({ ...NO_FILTER }));
  bar.appendChild(clear);

  return bar;
}
