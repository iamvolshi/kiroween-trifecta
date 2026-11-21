import type { Entry } from '../adapter/seam.ts';
import { parseMs } from '../util/interval.ts';
import { renderKid } from '../util/kid-display.ts';
import { clockTime, type TimeZone } from '../util/timezone.ts';

/**
 * The hour folder's log as a grid (Darren, Nov 20): fixed columns like
 * Explorer. Each column has a defined width in ch; a longer value scrolls
 * inside its cell; dragging a header edge moves width to the neighbour (the
 * total never changes); clicking a header sorts. Sort only, no filter.
 */

/** The KTIE folder's two lists, and the ERIE page's pool. */
export type GridList = 'did' | 'believed' | 'pool';
export type ColumnKey = 'time' | 'kid' | 'subject' | 'state' | 'authority' | 'evidence' | 'reason';
export type SortDir = 'asc' | 'desc';
export interface GridSort { col: ColumnKey; dir: SortDir }

export const COLUMNS: ReadonlyArray<{ key: ColumnKey; label: string }> = [
  { key: 'time', label: 'Time' },
  { key: 'kid', label: 'KID' },
  { key: 'subject', label: 'Subject' },
  { key: 'state', label: 'State' },
  { key: 'authority', label: 'Authority' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'reason', label: 'Reason' },
];

/**
 * Default widths in ch, in column order: the order's widths, each holding
 * its column's longest live value plus the cell's padding (measured Nov 20,
 * see katie-page/notes.md).
 */
export const DEFAULT_WIDTHS: readonly number[] = [10, 6, 25, 10, 4, 37, 45];
export const MIN_WIDTH = 4;

interface ListState { sort: GridSort | null; widths: number[] }

/**
 * Sort and widths per list, held in module memory: they last while the app
 * runs (every hour opened in this page load) and reset on a fresh load.
 */
const state: Record<GridList, ListState> = {
  did: { sort: null, widths: [...DEFAULT_WIDTHS] },
  believed: { sort: null, widths: [...DEFAULT_WIDTHS] },
  pool: { sort: null, widths: [...DEFAULT_WIDTHS] },
};

/** Back to record order and default widths (tests; a fresh load does this by itself). */
export function resetGridState(): void {
  for (const list of ['did', 'believed', 'pool'] as const) {
    state[list] = { sort: null, widths: [...DEFAULT_WIDTHS] };
  }
}

export function gridState(list: GridList): Readonly<ListState> {
  return state[list];
}

/** The clock time of an entry, HH:MM:SS (UTC or local), or ??:??:?? when its start cannot be read. */
function timeOf(e: Entry, zone: TimeZone, timeZone: string): string {
  const ms = parseMs(e.k_start);
  if (Number.isNaN(ms)) return '??:??:??';
  return clockTime(ms, zone, timeZone);
}

function sortValue(e: Entry, col: ColumnKey): number | string {
  switch (col) {
    case 'time': return parseMs(e.k_start);
    case 'kid': return e.kid;
    case 'authority': return e.authority;
    default: return e[col];
  }
}

/**
 * Entries in sort order. Numbers sort numerically (KID 2 before 10), Time
 * by the start instant, the rest alphabetically. Ties, and an unreadable
 * start time, keep record order; an unreadable time sorts last either way.
 */
export function sortEntries(entries: Entry[], sort: GridSort | null): Entry[] {
  if (sort === null) return entries.slice();
  const indexed = entries.map((e, i) => ({ e, i }));
  const sign = sort.dir === 'asc' ? 1 : -1;
  indexed.sort((a, b) => {
    const va = sortValue(a.e, sort.col);
    const vb = sortValue(b.e, sort.col);
    if (typeof va === 'number' && typeof vb === 'number') {
      const na = Number.isNaN(va);
      const nb = Number.isNaN(vb);
      if (na || nb) return na === nb ? a.i - b.i : na ? 1 : -1;
      return va === vb ? a.i - b.i : sign * (va - vb);
    }
    const c = String(va).localeCompare(String(vb), 'en');
    return c === 0 ? a.i - b.i : sign * c;
  });
  return indexed.map((x) => x.e);
}

/**
 * Drag the edge between column `i` and `i + 1` by `deltaCh`. The left
 * column takes the width from its right neighbour, so the pair's sum (and
 * the table's total) never changes; neither goes under MIN_WIDTH.
 */
export function resizePair(widths: readonly number[], i: number, deltaCh: number): number[] {
  const out = widths.slice();
  if (i < 0 || i + 1 >= out.length) return out;
  const pair = out[i]! + out[i + 1]!;
  const left = Math.min(Math.max(out[i]! + deltaCh, MIN_WIDTH), pair - MIN_WIDTH);
  const rounded = Math.round(left * 10) / 10;
  out[i] = rounded;
  out[i + 1] = Math.round((pair - rounded) * 10) / 10;
  return out;
}

function cellText(e: Entry, col: ColumnKey, zone: TimeZone, timeZone: string): string {
  if (col === 'time') return timeOf(e, zone, timeZone);
  if (col === 'authority') return String(e.authority);
  return e[col as 'subject' | 'state' | 'evidence' | 'reason'];
}

function renderRow(e: Entry, zone: TimeZone, timeZone: string): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = 'log-line';
  for (const { key } of COLUMNS) {
    const td = document.createElement('td');
    td.className = `col-${key}`;
    const cell = document.createElement('div');
    cell.className = `cell cell-${key}`;
    if (key === 'kid') {
      const a = document.createElement('a');
      a.className = 'kid';
      a.setAttribute('href', `/entry/${e.kid}/${encodeURIComponent(e.subject)}/${encodeURIComponent(e.id)}`);
      a.textContent = renderKid(e.kid);
      cell.appendChild(a);
    } else {
      cell.textContent = cellText(e, key, zone, timeZone);
    }
    td.appendChild(cell);
    tr.appendChild(td);
  }
  return tr;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** One list's grid: a <table> with a sortable, resizable header row. */
export function renderEntryGrid(
  entries: Entry[],
  label: string,
  list: GridList,
  zone: TimeZone,
  timeZone: string,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'entry-grid-wrap';
  const table = document.createElement('table');
  table.className = 'entry-log entry-grid';
  table.dataset.list = list;
  table.setAttribute('aria-label', label);
  const colgroup = document.createElement('colgroup');
  const cols = COLUMNS.map(({ key }) => {
    const col = document.createElement('col');
    col.className = `col-${key}`;
    colgroup.appendChild(col);
    return col;
  });
  table.appendChild(colgroup);

  const applyWidths = (): void => {
    const widths = state[list].widths;
    widths.forEach((w, i) => { cols[i]!.style.width = `${w}ch`; });
    // As wide as the folder, never narrower than the columns: a wider folder
    // shares its extra width out in proportion; a narrower one scrolls sideways.
    table.style.width = `max(100%, ${sum(widths)}ch)`;
  };

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const tbody = document.createElement('tbody');
  const ths: HTMLTableCellElement[] = [];

  const renderBody = (): void => {
    tbody.replaceChildren(...sortEntries(entries, state[list].sort).map((e) => renderRow(e, zone, timeZone)));
    const sort = state[list].sort;
    COLUMNS.forEach(({ key }, i) => {
      const th = ths[i]!;
      const dir = sort && sort.col === key ? sort.dir : null;
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none');
      th.querySelector('.sort-arrow')!.textContent = dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '';
    });
  };

  COLUMNS.forEach(({ key, label: text }, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = `col-${key}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sort-button';
    // A narrow column clips its label; the full name stays on hover.
    button.title = text;
    const name = document.createElement('span');
    name.className = 'sort-label';
    name.textContent = text;
    const arrow = document.createElement('span');
    arrow.className = 'sort-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(name, arrow);
    button.addEventListener('click', () => {
      const cur = state[list].sort;
      state[list].sort = cur && cur.col === key
        ? { col: key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { col: key, dir: 'asc' };
      renderBody();
    });
    th.appendChild(button);
    if (i < COLUMNS.length - 1) th.appendChild(renderGrip(i));
    ths.push(th);
    headRow.appendChild(th);
  });

  /** The edge between column i and i + 1; drag it to slide the column open. */
  function renderGrip(i: number): HTMLElement {
    const grip = document.createElement('span');
    grip.className = 'col-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.addEventListener('pointerdown', (down: PointerEvent) => {
      if (down.button !== 0) return;
      down.preventDefault();
      const start = state[list].widths.slice();
      const width = table.getBoundingClientRect().width;
      // Pixels per ch as drawn: the table spans sum(widths) ch, scaled to the folder.
      const chPx = width > 0 ? width / sum(start) : 8;
      const x0 = down.clientX;
      // Window-level move/up: a capture is a bonus, never the mechanism.
      try { grip.setPointerCapture(down.pointerId); } catch { /* ignore */ }
      table.classList.add('resizing');
      const move = (ev: PointerEvent): void => {
        // The hour changed mid-drag: this table is gone, stop listening.
        if (!table.isConnected) { up(); return; }
        state[list].widths = resizePair(start, i, (ev.clientX - x0) / chPx);
        applyWidths();
      };
      const up = (): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        table.classList.remove('resizing');
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    // A click on the edge never sorts.
    grip.addEventListener('click', (ev) => ev.stopPropagation());
    return grip;
  }

  thead.appendChild(headRow);
  table.append(thead, tbody);
  applyWidths();
  renderBody();
  wrap.appendChild(table);
  return wrap;
}
