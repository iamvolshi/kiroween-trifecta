/**
 * The Action List as an Explorer grid (Darren, Nov 22: "exactly like
 * Windows Explorer with columns that are stretchable"). KID | Subject |
 * State | Authority | Inspect. Each column holds its width, so the state
 * sits in one straight column whatever the subject's length. A row click
 * opens its details in the row under it; Inspect stays a real link.
 * Layout itself is measured in Chrome (docs/explorer-columns-proof); jsdom
 * checks the structure that makes it straight.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ActionListView } from './action-list.ts';
import { EntryDetailView } from './entry-detail.ts';
import { RecordView } from './record.ts';
import { DEFAULT_WIDTHS, MIN_WIDTH, columnsOf, gridState, resetGridState } from './entry-grid.ts';
import { Router } from '../router/router.ts';
import { createRecordStub } from '../test-helpers.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import type { Entry } from '../adapter/seam.ts';

// Mixed lengths and states: a short subject with a long state, and the reverse.
const ENTRIES: Entry[] = [
  makeEntry({ id: 'a1', kid: 4, subject: 'frankenstein-letter-1', state: 'WILD', authority: 5,
    k_start: '2026-11-16T09:12:00.000Z', k_time: '2026-11-16T14:30:00.000Z', reason: 'R-A1', evidence: 'value=a (stub)' }),
  makeEntry({ id: 'a2', kid: 10, subject: 'frankenstein-chapter-23', state: 'CANDIDATE', authority: 7,
    k_start: '2026-11-16T14:30:00.000Z', k_time: '2026-11-17T00:00:00.000Z', reason: 'R-A2', evidence: 'value=b (stub)' }),
  makeEntry({ id: 'b1', kid: 2, subject: 'turn', state: 'MATURE', authority: 8,
    k_start: '2026-11-16T10:05:00.000Z', k_time: '2026-11-16T15:10:00.000Z', reason: 'R-B1', evidence: 'value=c (stub)' }),
];

let container: HTMLElement;

async function mountList(entries = ENTRIES): Promise<HTMLElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  new ActionListView(createRecordStub(entries)).mount(container);
  for (let i = 0; i < 4; i++) await tick();
  return container;
}

afterEach(() => {
  container?.remove();
  resetGridState();
});

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLTableRowElement>('.action-list tbody tr.log-line'));
const toggleOf = (tr: Element) => tr.querySelector<HTMLButtonElement>('.card-toggle')!;
const detailsOf = (tr: Element) => document.getElementById(toggleOf(tr).getAttribute('aria-controls')!)!;
const ids = (c: HTMLElement) => rows(c).map((tr) => tr.querySelector('a.card-action')!.getAttribute('href')!.split('/').pop());

describe('Explorer columns', () => {
  it('a real table: KID | Subject | State | Authority | Inspect, newest first', async () => {
    const c = await mountList();
    const ths = [...c.querySelectorAll('.action-list thead th')];
    expect(ths.map((th) => th.textContent)).toEqual(['KID', 'Subject', 'State', 'Authority', 'Inspect']);
    expect(ths.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
    expect(ids(c)).toEqual(['a2', 'b1', 'a1']);
    const tr = rows(c)[0]!;
    expect([...tr.children].map((td) => td.textContent)).toEqual(['10', 'frankenstein-chapter-23', 'CANDIDATE', '7', 'Inspect']);
  });

  it('the state sits in the same column on every row, a fixed width in ch', async () => {
    const c = await mountList();
    const table = c.querySelector<HTMLTableElement>('.action-list table')!;
    const stateAt = columnsOf('actions').indexOf('state');
    for (const tr of rows(c)) {
      const td = tr.children[stateAt]!;
      expect(td.classList.contains('col-state')).toBe(true);
      // A long state scrolls inside its cell; it never pushes the column.
      expect(td.querySelector('.cell-state')!.classList.contains('cell')).toBe(true);
    }
    const widths = [...table.querySelectorAll<HTMLElement>('col')].map((col) => col.style.width);
    expect(widths).toEqual(gridState('actions').widths.map((w) => `${w}ch`));
    expect(widths.every((w) => w.endsWith('ch'))).toBe(true);
  });

  it('dragging a header edge moves width to the neighbour; the total never changes', async () => {
    const c = await mountList();
    const before = gridState('actions').widths.slice();
    const total = before.reduce((a, b) => a + b, 0);
    const grip = c.querySelector<HTMLElement>('.action-list th.col-subject .col-grip')!;
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100 }));
    // jsdom draws nothing: a ch is taken as 8px.
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 124 }));
    window.dispatchEvent(new MouseEvent('pointerup', {}));
    const after = gridState('actions').widths;
    expect(after[1]).toBe(before[1]! + 3);
    expect(after[2]).toBe(before[2]! - 3);
    expect(after.reduce((a, b) => a + b, 0)).toBe(total);
    const cols = [...c.querySelectorAll<HTMLElement>('.action-list col')];
    expect(cols[1]!.style.width).toBe(`${before[1]! + 3}ch`);
    // Far past the neighbour: it stops at the floor.
    grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 0 }));
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 4000 }));
    window.dispatchEvent(new MouseEvent('pointerup', {}));
    expect(gridState('actions').widths[2]).toBe(MIN_WIDTH);
    expect(gridState('actions').widths.every((w) => w >= MIN_WIDTH)).toBe(true);
    expect(gridState('actions').widths.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('click a header sorts; again reverses; KID is numeric; Inspect does not sort', async () => {
    const c = await mountList();
    const sortBy = (k: string) => c.querySelector<HTMLButtonElement>(`.action-list th.col-${k} button`)!.click();
    sortBy('kid');
    expect(ids(c)).toEqual(['b1', 'a1', 'a2']); // 2, 4, 10
    sortBy('kid');
    expect(ids(c)).toEqual(['a2', 'a1', 'b1']);
    sortBy('state');
    expect(rows(c).map((tr) => tr.querySelector('.cell-state')!.textContent)).toEqual(['CANDIDATE', 'MATURE', 'WILD']);
    expect(c.querySelector('.action-list th.col-state')!.getAttribute('aria-sort')).toBe('ascending');
    expect(c.querySelector('.action-list th.col-inspect button')).toBeNull();
  });

  it('the widths and sort hold for the next visit; a fresh load starts over', async () => {
    const c = await mountList();
    c.querySelector<HTMLButtonElement>('.action-list th.col-kid button')!.click();
    c.remove();
    const again = await mountList();
    expect(ids(again)).toEqual(['b1', 'a1', 'a2']);
    resetGridState(); // what a page load does
    again.remove();
    const fresh = await mountList();
    expect(ids(fresh)).toEqual(['a2', 'b1', 'a1']);
    expect(gridState('actions').widths).not.toEqual(DEFAULT_WIDTHS); // its own defaults, not the folder's
  });
});

describe('rows open to their details', () => {
  it('every row starts closed; the toggle is tied to its details region', async () => {
    const c = await mountList();
    const seen = new Set<string>();
    for (const tr of rows(c)) {
      const t = toggleOf(tr);
      expect(t.getAttribute('aria-expanded')).toBe('false');
      expect(detailsOf(tr).hidden).toBe(true);
      expect(detailsOf(tr).getAttribute('role')).toBe('region');
      expect(tr.nextElementSibling!.contains(detailsOf(tr))).toBe(true); // the row under it
      seen.add(t.getAttribute('aria-controls')!);
    }
    expect(seen.size).toBe(3);
  });

  it('click expands (reason, evidence and times appear), click again collapses', async () => {
    const c = await mountList();
    const tr = rows(c)[0]!;
    const t = toggleOf(tr);
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('true');
    const d = detailsOf(tr);
    expect(d.hidden).toBe(false);
    expect((d.closest('tr') as HTMLElement).hidden).toBe(false);
    expect(d.querySelector('.card-inset .reason')!.textContent).toBe('R-A2');
    expect(d.querySelector('.card-inset .evidence')!.textContent).toBe('value=b (stub)');
    expect(d.querySelector('.card-times .k-time')!.textContent).toBe('2026-11-17T00:00:00.000Z');
    expect(d.querySelector('.k-start')!.textContent).toBe('2026-11-16T14:30:00.000Z');
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(d.hidden).toBe(true);
  });

  it('a click on the row itself opens it, like Explorer; each row on its own', async () => {
    const c = await mountList();
    const [r0, r1, r2] = rows(c);
    (r0!.querySelector('.cell-state') as HTMLElement).click();
    toggleOf(r1!).click();
    expect(detailsOf(r0!).hidden).toBe(false);
    expect(detailsOf(r1!).hidden).toBe(false);
    expect(detailsOf(r2!).hidden).toBe(true);
  });

  it('an open row stays open through a sort', async () => {
    const c = await mountList();
    const tr = rows(c)[0]!;
    toggleOf(tr).click();
    c.querySelector<HTMLButtonElement>('.action-list th.col-kid button')!.click();
    expect(toggleOf(tr).getAttribute('aria-expanded')).toBe('true');
    expect(tr.nextElementSibling!.classList.contains('grid-details-row')).toBe(true);
    expect((tr.nextElementSibling as HTMLElement).hidden).toBe(false);
  });

  it('the toggle is a real button: Enter and Space open it', async () => {
    const c = await mountList();
    const t = toggleOf(rows(c)[0]!);
    expect(t.tagName).toBe('BUTTON');
    expect(t.type).toBe('button');
    t.focus();
    for (const key of ['Enter', ' ']) {
      const before = t.getAttribute('aria-expanded');
      t.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      t.click(); // a native button fires click on Enter and Space
      expect(t.getAttribute('aria-expanded')).not.toBe(before);
    }
  });
});

describe('Inspect stays one click away', () => {
  it('Inspect is a link in its own column, never inside the toggle', async () => {
    const c = await mountList();
    for (const tr of rows(c)) {
      const a = tr.querySelector<HTMLAnchorElement>('td.col-inspect a.card-action')!;
      expect(a.getAttribute('href')).toMatch(/^\/entry\/\d+\//);
      expect(toggleOf(tr).contains(a)).toBe(false);
      expect(toggleOf(tr).querySelector('a, button')).toBeNull();
    }
  });

  it('clicking Inspect on a closed row opens Entry Detail, and does not open the row', async () => {
    window.history.replaceState({}, '', '/actions');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const router = new Router(createRecordStub(ENTRIES), root);
    for (let i = 0; i < 4; i++) await tick();
    const tr = root.querySelector('.action-list tbody tr.log-line')!;
    expect(detailsOf(tr).hidden).toBe(true);
    tr.querySelector<HTMLAnchorElement>('a.card-action')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    for (let i = 0; i < 4; i++) await tick();
    expect(window.location.pathname).toMatch(/^\/entry\//);
    expect(root.querySelector('.entry-primary')).not.toBeNull();
    router.destroy();
    root.remove();
  });
});

describe('the Record view and the Entry Detail chain are the same grid', () => {
  async function mountView(make: (c: HTMLElement) => void): Promise<HTMLElement> {
    container = document.createElement('div');
    document.body.appendChild(container);
    make(container);
    for (let i = 0; i < 4; i++) await tick();
    return container;
  }
  const order = [
    makeEntry({ id: 'o1', kid: 4, subject: 'order-1042.delivery_date', state: 'confirmed', authority: 6,
      k_start: '2026-11-16T09:12:00.000Z', reason: 'R-1', evidence: 'ev-1' }),
    makeEntry({ id: 'o2', kid: 4, subject: 'order-1042.delivery_date', state: 'revised', authority: 7,
      k_start: '2026-11-16T14:30:00.000Z', reason: 'R-2', evidence: 'ev-2' }),
  ];

  it('Record view: Time | KID | Subject | State | Authority | Evidence', async () => {
    const c = await mountView((el) => new RecordView(createRecordStub(order), 'order-1042').mount(el));
    expect([...c.querySelectorAll('.record-entries thead th')].map((th) => th.textContent)).toEqual(
      ['Time', 'KID', 'Subject', 'State', 'Authority', 'Evidence'],
    );
    expect(c.querySelectorAll('.record-entries tbody tr.log-line')).toHaveLength(2);
    expect(c.querySelector('.record-entries .col-grip')).not.toBeNull();
    expect(c.querySelector('.record-entries a.kid')!.getAttribute('href')).toBe('/entry/4/order-1042.delivery_date/o1');
  });

  it('Entry Detail chain: Time | KID | State | Authority | Evidence | Reason', async () => {
    const c = await mountView((el) =>
      new EntryDetailView(createRecordStub(order), 4, 'order-1042.delivery_date', 'o2').mount(el),
    );
    expect([...c.querySelectorAll('.chain-list thead th')].map((th) => th.textContent)).toEqual(
      ['Time', 'KID', 'State', 'Authority', 'Evidence', 'Reason'],
    );
    const tr = c.querySelectorAll('.chain-list tbody tr.log-line');
    expect(tr).toHaveLength(2);
    expect(tr[0]!.querySelector('.cell-time')!.textContent).toBe('2026-11-16 09:12:00');
    // With no Subject column, the State cell opens the row.
    expect(tr[0]!.querySelector('.card-toggle')!.textContent).toBe('confirmed');
  });
});
