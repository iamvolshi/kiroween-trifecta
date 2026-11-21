// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Entry } from '../adapter/seam';
import {
  COLUMNS,
  DEFAULT_WIDTHS,
  MIN_WIDTH,
  gridState,
  renderEntryGrid,
  resetGridState,
  resizePair,
  sortEntries,
  type ColumnKey,
} from './entry-grid';

function entry(over: Partial<Entry>): Entry {
  return {
    id: 'e', kid: 1, subject: 's', state: 'WILD', authority: 5, pool: '0',
    k_start: '2026-11-20T23:46:00.000Z', t_time: '2026-11-20T23:46:00.000Z',
    e_time: '', k_time: '', evidence: '', reason: '', prev_hash: '',
    ...over,
  } as Entry;
}

// Record order as served: every column out of order somewhere.
const E: Entry[] = [
  entry({ id: 'a', kid: 10, subject: 'frankenstein-chapter-10', state: 'WILD', authority: 5, k_start: '2026-11-20T23:46:02.000Z', evidence: 'Project Gutenberg 41445, Chapter 10', reason: 'ingest b' }),
  entry({ id: 'b', kid: 2, subject: 'frankenstein-chapter-2', state: 'CANDIDATE', authority: 10, k_start: '2026-11-20T23:46:00.000Z', evidence: 'Project Gutenberg 41445, Chapter 2', reason: 'ingest a' }),
  entry({ id: 'c', kid: 9, subject: 'frankenstein-letter-1', state: 'MATURE', authority: 2, k_start: '2026-11-20T23:46:01.000Z', evidence: 'Audit UI', reason: 'user turn' }),
];

const ids = (es: Entry[]): string[] => es.map((e) => e.id);

afterEach(() => {
  resetGridState();
  document.body.replaceChildren();
});

describe('sortEntries', () => {
  // Expected ascending order per column; descending is its reverse.
  const ASC: Record<ColumnKey, string[]> = {
    time: ['b', 'c', 'a'],
    kid: ['b', 'c', 'a'], // 2, 9, 10: numbers, not text
    subject: ['a', 'b', 'c'], // chapter-10 < chapter-2 < letter-1 (alphabetical)
    state: ['b', 'c', 'a'], // CANDIDATE, MATURE, WILD
    authority: ['c', 'a', 'b'], // 2, 5, 10
    evidence: ['c', 'a', 'b'], // Audit UI, ...Chapter 10, ...Chapter 2
    reason: ['b', 'a', 'c'],
  };
  for (const { key } of COLUMNS) {
    it(`${key}: ascending, then descending`, () => {
      expect(ids(sortEntries(E, { col: key, dir: 'asc' }))).toEqual(ASC[key]);
      expect(ids(sortEntries(E, { col: key, dir: 'desc' }))).toEqual([...ASC[key]].reverse());
    });
  }

  it('KID 2 sorts before KID 10', () => {
    const two = [entry({ id: 'ten', kid: 10 }), entry({ id: 'two', kid: 2 })];
    expect(ids(sortEntries(two, { col: 'kid', dir: 'asc' }))).toEqual(['two', 'ten']);
  });

  it('no sort is record order; ties keep record order; the input is never changed', () => {
    const tie = [entry({ id: 'x', state: 'WILD' }), entry({ id: 'y', state: 'WILD' })];
    expect(ids(sortEntries(tie, { col: 'state', dir: 'desc' }))).toEqual(['x', 'y']);
    expect(ids(sortEntries(E, null))).toEqual(['a', 'b', 'c']);
    sortEntries(E, { col: 'kid', dir: 'asc' });
    expect(ids(E)).toEqual(['a', 'b', 'c']);
  });

  it('an unreadable start time sorts last, both ways', () => {
    const es = [entry({ id: 'bad', k_start: 'not a time' }), ...E];
    expect(ids(sortEntries(es, { col: 'time', dir: 'asc' })).at(-1)).toBe('bad');
    expect(ids(sortEntries(es, { col: 'time', dir: 'desc' })).at(-1)).toBe('bad');
  });
});

describe('resizePair', () => {
  const total = (w: number[]): number => w.reduce((a, b) => a + b, 0);

  it('the dragged column takes width from its neighbour; the total never changes', () => {
    const w = resizePair(DEFAULT_WIDTHS, 2, 6);
    expect(w[2]).toBe(DEFAULT_WIDTHS[2]! + 6);
    expect(w[3]).toBe(DEFAULT_WIDTHS[3]! - 6);
    expect(total(w)).toBe(total([...DEFAULT_WIDTHS]));
    expect(w.filter((_, i) => i !== 2 && i !== 3)).toEqual(DEFAULT_WIDTHS.filter((_, i) => i !== 2 && i !== 3));
  });

  it(`no column goes under ${MIN_WIDTH}ch, either way`, () => {
    const left = resizePair(DEFAULT_WIDTHS, 2, -500);
    expect(left[2]).toBe(MIN_WIDTH);
    expect(left[2]! + left[3]!).toBe(DEFAULT_WIDTHS[2]! + DEFAULT_WIDTHS[3]!);
    const right = resizePair(DEFAULT_WIDTHS, 2, 500);
    expect(right[3]).toBe(MIN_WIDTH);
    expect(total(right)).toBe(total([...DEFAULT_WIDTHS]));
  });

  it('the last column has no right edge to drag', () => {
    expect(resizePair(DEFAULT_WIDTHS, 6, 5)).toEqual([...DEFAULT_WIDTHS]);
  });
});

describe('renderEntryGrid', () => {
  const mount = (list: 'did' | 'believed' = 'did', es: Entry[] = E): HTMLElement => {
    const el = renderEntryGrid(es, 'What the agent did this hour', list, 'utc', 'UTC');
    document.body.appendChild(el);
    return el;
  };
  const kids = (el: HTMLElement): string[] => [...el.querySelectorAll('tbody .kid')].map((a) => a.textContent!);
  const header = (el: HTMLElement, key: ColumnKey): HTMLElement => el.querySelector(`th.col-${key}`)!;
  const sortBy = (el: HTMLElement, key: ColumnKey): void => header(el, key).querySelector('button')!.click();

  it('a real table: header row Time / KID / Subject / State / Authority / Evidence / Reason, one row per entry', () => {
    const el = mount();
    const table = el.querySelector('table')!;
    expect(table.getAttribute('aria-label')).toBe('What the agent did this hour');
    const ths = [...table.querySelectorAll('thead th')];
    expect(ths.map((th) => th.querySelector('.sort-label')!.textContent)).toEqual(
      ['Time', 'KID', 'Subject', 'State', 'Authority', 'Evidence', 'Reason'],
    );
    expect(ths.every((th) => th.getAttribute('scope') === 'col' && th.getAttribute('aria-sort') === 'none')).toBe(true);
    expect(ths.every((th) => th.querySelector('button[type="button"]'))).toBe(true);
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(3);
    expect([...rows[0]!.querySelectorAll('td')].map((td) => td.textContent)).toEqual(
      ['23:46:02', '10', 'frankenstein-chapter-10', 'WILD', '5', 'Project Gutenberg 41445, Chapter 10', 'ingest b'],
    );
  });

  it('every column has its defined width in ch; every value sits in a scrolling cell', () => {
    const el = mount();
    const cols = [...el.querySelectorAll('col')] as HTMLElement[];
    expect(cols.map((c) => c.style.width)).toEqual(DEFAULT_WIDTHS.map((w) => `${w}ch`));
    const cells = [...el.querySelectorAll('tbody td')];
    expect(cells.every((td) => td.children.length === 1 && td.firstElementChild!.classList.contains('cell'))).toBe(true);
  });

  it('click sorts, click again reverses; the header shows its direction', () => {
    const el = mount();
    sortBy(el, 'kid');
    expect(kids(el)).toEqual(['2', '9', '10']);
    expect(header(el, 'kid').getAttribute('aria-sort')).toBe('ascending');
    expect(header(el, 'kid').querySelector('.sort-arrow')!.textContent).toBe('▲');
    sortBy(el, 'kid');
    expect(kids(el)).toEqual(['10', '9', '2']);
    expect(header(el, 'kid').getAttribute('aria-sort')).toBe('descending');
    expect(header(el, 'kid').querySelector('.sort-arrow')!.textContent).toBe('▼');
    sortBy(el, 'authority');
    expect(kids(el)).toEqual(['9', '10', '2']);
    expect(header(el, 'kid').getAttribute('aria-sort')).toBe('none');
    expect(header(el, 'kid').querySelector('.sort-arrow')!.textContent).toBe('');
  });

  it('the KID stays a link to its entry, the number alone, whatever the sort', () => {
    const el = mount();
    sortBy(el, 'subject');
    sortBy(el, 'subject');
    const a = [...el.querySelectorAll<HTMLAnchorElement>('tbody a.kid')];
    expect(a.map((x) => x.textContent)).toEqual(['9', '2', '10']);
    expect(a[0]!.getAttribute('href')).toBe('/entry/9/frankenstein-letter-1/c');
  });

  it('did and believed sort on their own; both hold across a new hour', () => {
    const did = mount('did');
    const believed = mount('believed');
    sortBy(did, 'kid');
    sortBy(did, 'kid');
    expect(kids(did)).toEqual(['10', '9', '2']);
    expect(kids(believed)).toEqual(['10', '2', '9']); // record order
    // A new hour renders new tables: the did sort holds, believed stays served order.
    const nextDid = mount('did');
    const nextBelieved = mount('believed');
    expect(kids(nextDid)).toEqual(['10', '9', '2']);
    expect(header(nextDid, 'kid').getAttribute('aria-sort')).toBe('descending');
    expect(kids(nextBelieved)).toEqual(['10', '2', '9']);
    expect(gridState('believed').sort).toBeNull();
  });

  it('a fresh load is record order and default widths', () => {
    const el = mount();
    sortBy(el, 'kid');
    resetGridState(); // what a page load does: module state starts over
    const fresh = mount();
    expect(kids(fresh)).toEqual(['10', '2', '9']);
    expect(gridState('did')).toEqual({ sort: null, widths: [...DEFAULT_WIDTHS] });
  });

  it('dragging a header edge moves width to the neighbour, through window-level move/up', () => {
    const el = mount();
    const grip = header(el, 'subject').querySelector<HTMLElement>('.col-grip')!;
    expect(header(el, 'reason').querySelector('.col-grip')).toBeNull(); // no right edge
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    expect(el.querySelector('table')!.classList.contains('resizing')).toBe(true);
    // jsdom draws nothing: the table's width is 0, so a ch is taken as 8px.
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 116 }));
    const cols = [...el.querySelectorAll('col')] as HTMLElement[];
    expect(cols[2]!.style.width).toBe(`${DEFAULT_WIDTHS[2]! + 2}ch`);
    expect(cols[3]!.style.width).toBe(`${DEFAULT_WIDTHS[3]! - 2}ch`);
    window.dispatchEvent(new MouseEvent('pointerup', {}));
    expect(el.querySelector('table')!.classList.contains('resizing')).toBe(false);
    // After the release, moves change nothing.
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400 }));
    expect(cols[2]!.style.width).toBe(`${DEFAULT_WIDTHS[2]! + 2}ch`);
    // The widths hold for the next hour's table.
    const next = mount();
    expect((next.querySelectorAll('col')[2] as HTMLElement).style.width).toBe(`${DEFAULT_WIDTHS[2]! + 2}ch`);
    // Sorting never touches the widths; the edge never sorts.
    grip.click();
    expect(header(el, 'subject').getAttribute('aria-sort')).toBe('none');
  });

  it('a drag survives a pointer capture that throws', () => {
    const el = mount();
    const grip = header(el, 'kid').querySelector<HTMLElement>('.col-grip')!;
    (grip as unknown as { setPointerCapture: () => void }).setPointerCapture = () => { throw new Error('no capture'); };
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 0 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 8 }));
    window.dispatchEvent(new MouseEvent('pointerup', {}));
    expect(gridState('did').widths[1]).toBe(DEFAULT_WIDTHS[1]! + 1);
  });
});
