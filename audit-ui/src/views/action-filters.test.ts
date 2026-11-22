/**
 * Action List filters: event type, retractions, confidence band. Each alone
 * shows exactly the matching entries; they combine with AND; Clear restores
 * all; the no-match state names the active filters; the count reads from the
 * loaded entries; chips derive from the data.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ActionListView } from './action-list.ts';
import { createRecordStub } from '../test-helpers.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import { applyFilters, BANDS, matches, statesIn, type FilterState } from './action-filters.ts';
import type { Entry } from '../adapter/seam.ts';

const E: Entry[] = [
  makeEntry({ id: 'c6', state: 'confirmed', authority: 6, k_start: '2026-11-16T09:00:00.000Z' }),
  makeEntry({ id: 'v7', state: 'revised', authority: 7, k_start: '2026-11-16T10:00:00.000Z' }),
  makeEntry({ id: 'r2', state: 'rejected', authority: 2, k_start: '2026-11-16T11:00:00.000Z' }),
  makeEntry({ id: 'x5', state: 'contradicted', authority: 5, k_start: '2026-11-16T12:00:00.000Z' }),
  makeEntry({ id: 'c8', state: 'confirmed', authority: 8, k_start: '2026-11-16T13:00:00.000Z' }),
  makeEntry({ id: 'r7', state: 'rejected', authority: 7, k_start: '2026-11-16T14:00:00.000Z' }),
];

let c: HTMLElement;

async function mount(entries: Entry[] = E): Promise<HTMLElement> {
  c = document.createElement('div');
  document.body.appendChild(c);
  new ActionListView(createRecordStub(entries)).mount(c);
  for (let i = 0; i < 4; i++) await tick();
  return c;
}

afterEach(() => c?.remove());

const visibleIds = (root: HTMLElement): string[] =>
  Array.from(root.querySelectorAll<HTMLTableRowElement>('.action-list tbody tr.log-line'))
    .filter((li) => !li.hidden)
    .map((li) => decodeURIComponent(li.querySelector('a.card-action')!.getAttribute('href')!.split('/').pop()!));

const btn = (root: HTMLElement, filter: string, value: string): HTMLButtonElement =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('.action-filters button')).find(
    (b) => b.dataset.filter === filter && b.dataset.value === value,
  )!;

const press = (root: HTMLElement, filter: string, value: string): void => btn(root, filter, value).click();
const count = (root: HTMLElement): string => root.querySelector('.filter-count')!.textContent!;
const sortedIds = (ids: string[]): string[] => [...ids].sort();

describe('unfiltered', () => {
  it('shows every entry and the real count', async () => {
    const r = await mount();
    expect(visibleIds(r)).toHaveLength(6);
    expect(count(r)).toBe('Showing 6 of 6 entries');
    expect(r.querySelector<HTMLElement>('.filter-empty')!.hidden).toBe(true);
  });
});

describe('chips derive from the loaded entries', () => {
  it('one event-type chip per state present, plus All', async () => {
    const r = await mount();
    const values = Array.from(r.querySelectorAll<HTMLButtonElement>('[data-filter="state"]')).map((b) => b.dataset.value);
    expect(values).toEqual(['all', 'confirmed', 'contradicted', 'rejected', 'revised']);
  });

  it('a state with no entries offers no chip', async () => {
    const r = await mount(E.filter((e) => e.state !== 'contradicted' && e.state !== 'revised'));
    const values = Array.from(r.querySelectorAll<HTMLButtonElement>('[data-filter="state"]')).map((b) => b.dataset.value);
    expect(values).toEqual(['all', 'confirmed', 'rejected']);
    expect(btn(r, 'state', 'contradicted')).toBeUndefined();
  });

  it('statesIn holds exactly the distinct states (property)', () => {
    const states = ['confirmed', 'revised', 'rejected', 'contradicted', 'held'];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...states), { maxLength: 20 }), (picked) => {
        const entries = picked.map((s, i) => makeEntry({ id: `e${i}`, state: s }));
        expect(statesIn(entries)).toEqual([...new Set(picked)].sort());
      }),
    );
  });
});

describe('each filter alone shows exactly the matching entries', () => {
  it('event type', async () => {
    const r = await mount();
    press(r, 'state', 'rejected');
    expect(sortedIds(visibleIds(r))).toEqual(['r2', 'r7']);
    expect(count(r)).toBe('Showing 2 of 6 entries');
    expect(btn(r, 'state', 'rejected').getAttribute('aria-pressed')).toBe('true');
    expect(btn(r, 'state', 'all').getAttribute('aria-pressed')).toBe('false');
  });

  it('retractions = rejected or contradicted', async () => {
    const r = await mount();
    press(r, 'retractions', 'on');
    expect(sortedIds(visibleIds(r))).toEqual(['r2', 'r7', 'x5']);
    expect(btn(r, 'retractions', 'on').getAttribute('aria-pressed')).toBe('true');
    press(r, 'retractions', 'on');
    expect(visibleIds(r)).toHaveLength(6);
  });

  it('confidence bands 1-3 / 4-6 / 7-9', async () => {
    const r = await mount();
    press(r, 'band', 'low');
    expect(sortedIds(visibleIds(r))).toEqual(['r2']);
    press(r, 'band', 'middle');
    expect(sortedIds(visibleIds(r))).toEqual(['c6', 'x5']);
    press(r, 'band', 'high');
    expect(sortedIds(visibleIds(r))).toEqual(['c8', 'r7', 'v7']);
    press(r, 'band', 'all');
    expect(visibleIds(r)).toHaveLength(6);
  });
});

describe('filters combine (AND)', () => {
  it('rejected + high shows only r7', async () => {
    const r = await mount();
    press(r, 'state', 'rejected');
    press(r, 'band', 'high');
    expect(visibleIds(r)).toEqual(['r7']);
    expect(count(r)).toBe('Showing 1 of 6 entries');
  });

  it('retractions + middle shows only x5', async () => {
    const r = await mount();
    press(r, 'retractions', 'on');
    press(r, 'band', 'middle');
    expect(visibleIds(r)).toEqual(['x5']);
  });

  it('the view matches applyFilters for every combination (property)', async () => {
    const r = await mount();
    const combos = fc.record({
      state: fc.constantFrom(null, 'confirmed', 'revised', 'rejected', 'contradicted'),
      retractions: fc.boolean(),
      band: fc.constantFrom(null, ...BANDS.map((b) => b.id)),
    });
    fc.assert(
      fc.property(combos, (f: FilterState) => {
        press(r, 'clear', 'all');
        if (f.state) press(r, 'state', f.state);
        if (f.retractions) press(r, 'retractions', 'on');
        if (f.band) press(r, 'band', f.band);
        const expected = applyFilters(E, f).map((e) => e.id);
        expect(sortedIds(visibleIds(r))).toEqual(sortedIds(expected));
        expect(count(r)).toBe(`Showing ${expected.length} of 6 entries`);
        for (const e of E) expect(matches(e, f)).toBe(expected.includes(e.id));
      }),
      { numRuns: 60 },
    );
  });
});

describe('no matches and Clear', () => {
  it('names the active filters, hides the list, and Clear restores everything', async () => {
    const r = await mount();
    press(r, 'state', 'confirmed');
    press(r, 'band', 'low');
    expect(visibleIds(r)).toEqual([]);
    const empty = r.querySelector<HTMLElement>('.filter-empty')!;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toContain('No entries match');
    expect(empty.textContent).toContain('event type Confirmed');
    expect(empty.textContent).toContain('confidence 1-3 low');
    expect(r.querySelector<HTMLElement>('.action-list')!.hidden).toBe(true);
    expect(count(r)).toBe('Showing 0 of 6 entries');

    press(r, 'clear', 'all');
    expect(visibleIds(r)).toHaveLength(6);
    expect(empty.hidden).toBe(true);
    expect(btn(r, 'state', 'all').getAttribute('aria-pressed')).toBe('true');
    expect(btn(r, 'band', 'all').getAttribute('aria-pressed')).toBe('true');
    expect(btn(r, 'retractions', 'on').getAttribute('aria-pressed')).toBe('false');
  });

  it('names retractions when that filter is part of a no-match', async () => {
    const r = await mount();
    press(r, 'retractions', 'on');
    press(r, 'state', 'confirmed');
    expect(r.querySelector('.filter-empty')!.textContent).toContain('retractions only');
  });
});

describe('controls and row state', () => {
  it('every control is a real button with aria-pressed (except Clear), Tab-reachable', async () => {
    const r = await mount();
    const buttons = Array.from(r.querySelectorAll<HTMLButtonElement>('.action-filters button'));
    expect(buttons.length).toBe(1 + 4 + 1 + 4 + 1);
    for (const b of buttons) {
      expect(b.type).toBe('button');
      expect(b.tabIndex).toBe(0);
      expect(b.disabled).toBe(false);
      if (b.dataset.filter !== 'clear') expect(['true', 'false']).toContain(b.getAttribute('aria-pressed'));
    }
    expect(r.querySelectorAll('.action-filters [role="group"]')).toHaveLength(3);
  });

  it('focus stays on the pressed chip after the bar re-renders', async () => {
    const r = await mount();
    const b = btn(r, 'band', 'high');
    b.focus();
    b.click();
    const now = document.activeElement as HTMLElement;
    expect(now.dataset.filter).toBe('band');
    expect(now.dataset.value).toBe('high');
  });

  it('rows stay collapsed, and an expanded row keeps its state across filtering', async () => {
    const r = await mount();
    const rowsOf = (): HTMLTableRowElement[] => Array.from(r.querySelectorAll<HTMLTableRowElement>('.action-list tbody tr.log-line'));
    // A row's details sit in the row under it (the grid's details row).
    const detailsOf = (x: Element): HTMLElement =>
      document.getElementById(x.querySelector('.card-toggle')!.getAttribute('aria-controls')!)!;
    const li = rowsOf().find((x) =>
      x.querySelector('a.card-action')!.getAttribute('href')!.endsWith('/r7'),
    )!;
    expect(detailsOf(li).hidden).toBe(true);
    li.querySelector<HTMLButtonElement>('.card-toggle')!.click();
    press(r, 'state', 'confirmed');
    expect(li.hidden).toBe(true);
    press(r, 'clear', 'all');
    expect(li.hidden).toBe(false);
    expect(li.querySelector('.card-toggle')!.getAttribute('aria-expanded')).toBe('true');
    expect(detailsOf(li).hidden).toBe(false);
    const others = rowsOf().filter((x) => x !== li);
    expect(others.every((x) => detailsOf(x).hidden)).toBe(true);
  });

  it('an authority of 0 falls in no band', async () => {
    const r = await mount([makeEntry({ id: 'z0', authority: 0 })]);
    for (const band of ['low', 'middle', 'high']) {
      press(r, 'band', band);
      expect(visibleIds(r)).toEqual([]);
    }
  });
});
