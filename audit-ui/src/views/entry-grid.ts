import type { Entry } from '../adapter/seam.ts';
import { parseMs } from '../util/interval.ts';
import { renderKid } from '../util/kid-display.ts';
import { clockTime, type TimeZone } from '../util/timezone.ts';

/**
 * Entry lists as Explorer grids (Darren, Nov 20 and Nov 22: "exactly like
 * Windows Explorer with columns that are stretchable"). One grid for every
 * list screen: a real <table> whose columns each have a defined width in
 * ch; a longer value scrolls inside its cell, so no column ever shifts
 * (the state sits at the same x on every row); dragging a header edge moves
 * width to the neighbour (the total never changes); clicking a header sorts.
 * A list may add an Inspect link column and rows that expand to details.
 */

/**
 * The lists: the KTIE folder's two, the ERIE page's pool, the Action List,
 * the Record view's subjects, and the Entry Detail chain. Each keeps its own
 * sort and widths.
 */
export type GridList = 'did' | 'believed' | 'pool' | 'actions' | 'record' | 'chain';
export type ColumnKey = 'time' | 'kid' | 'subject' | 'state' | 'authority' | 'evidence' | 'reason' | 'inspect';
export type SortDir = 'asc' | 'desc';
export interface GridSort { col: ColumnKey; dir: SortDir }

const LABELS: Record<ColumnKey, string> = {
  time: 'Time',
  kid: 'KID',
  subject: 'Subject',
  state: 'State',
  authority: 'Authority',
  evidence: 'Evidence',
  reason: 'Reason',
  inspect: 'Inspect',
};

/** The KTIE folder's columns (the default list), in order. */
/** A column that holds an entry's own value (every column but Inspect). */
export type DataColumn = Exclude<ColumnKey, 'inspect'>;

export const COLUMNS: ReadonlyArray<{ key: DataColumn; label: string }> = (
  ['time', 'kid', 'subject', 'state', 'authority', 'evidence', 'reason'] as const
).map((key) => ({ key, label: LABELS[key] }));

/**
 * Default widths in ch for the KTIE folder, in column order: each holds
 * its column's longest live value plus the cell's padding (measured Nov 20,
 * see katie-page/notes.md).
 */
export const DEFAULT_WIDTHS: readonly number[] = [10, 6, 25, 10, 4, 37, 45];
export const MIN_WIDTH = 4;

/**
 * Each list's columns and default widths (ch). Subject 43 holds the longest
 * live subjects a person reads (frankenstein-biography-young-frankenstein,
 * 41 chars; the subject cell's ▸ marker takes about 2ch of it), and a
 * Curator folder's longer name scrolls inside its cell with a clear gap
 * before the next column, so it never reads as one word with the state.
 * State 11 holds CANDIDATE.
 */
const LISTS: Record<GridList, { columns: readonly ColumnKey[]; widths: readonly number[] }> = {
  did: { columns: COLUMNS.map((c) => c.key), widths: DEFAULT_WIDTHS },
  believed: { columns: COLUMNS.map((c) => c.key), widths: DEFAULT_WIDTHS },
  pool: { columns: COLUMNS.map((c) => c.key), widths: DEFAULT_WIDTHS },
  actions: { columns: ['kid', 'subject', 'state', 'authority', 'inspect'], widths: [5, 43, 11, 7, 9] },
  record: { columns: ['time', 'kid', 'subject', 'state', 'authority', 'evidence'], widths: [21, 5, 43, 11, 7, 37] },
  chain: { columns: ['time', 'kid', 'state', 'authority', 'evidence', 'reason'], widths: [21, 6, 11, 7, 30, 45] },
};

/** The columns a list shows, in order. */
export function columnsOf(list: GridList): readonly ColumnKey[] {
  return LISTS[list].columns;
}

interface ListState { sort: GridSort | null; widths: number[] }

/**
 * Sort and widths per list, held in module memory: they last while the app
 * runs (every page opened in this load) and reset on a fresh load.
 */
const state = new Map<GridList, ListState>();

function stateOf(list: GridList): ListState {
  let s = state.get(list);
  if (!s) {
    s = { sort: null, widths: [...LISTS[list].widths] };
    state.set(list, s);
  }
  return s;
}

/** Back to the given order and default widths (tests; a fresh load does this by itself). */
export function resetGridState(): void {
  state.clear();
}

export function gridState(list: GridList): Readonly<ListState> {
  return stateOf(list);
}

/** How the Time column reads: the clock alone (one hour's folder) or the full UTC stamp. */
export type TimeFormat = 'clock' | 'stamp';

/** The time of an entry; ??:??:?? (or a dash for a stamp) when its start cannot be read. */
function timeOf(e: Entry, zone: TimeZone, timeZone: string, format: TimeFormat): string {
  const ms = parseMs(e.k_start);
  if (format === 'stamp') {
    if (Number.isNaN(ms)) return e.k_start || '—';
    return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
  }
  if (Number.isNaN(ms)) return '??:??:??';
  return clockTime(ms, zone, timeZone);
}

function sortValue(e: Entry, col: ColumnKey): number | string {
  switch (col) {
    case 'time': return parseMs(e.k_start);
    case 'kid': return e.kid;
    case 'authority': return e.authority;
    case 'inspect': return 0;
    default: return e[col];
  }
}

/**
 * Entries in sort order. Numbers sort numerically (KID 2 before 10), Time
 * by the start instant, the rest alphabetically. Ties, and an unreadable
 * start time, keep the given order; an unreadable time sorts last either way.
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

export const entryHref = (e: Entry): string =>
  `/entry/${e.kid}/${encodeURIComponent(e.subject)}/${encodeURIComponent(e.id)}`;

export interface GridOptions {
  /** The table's accessible name. */
  label: string;
  list: GridList;
  zone?: TimeZone;
  timeZone?: string;
  /** Time column: 'clock' (default, one hour's folder) or 'stamp' (date and time). */
  timeFormat?: TimeFormat;
  /** KID as a link to its Entry Detail (default true). */
  kidLink?: boolean;
  /**
   * Rows expand: the Subject cell (the State cell where a list has no
   * Subject) becomes a toggle button and the row opens a details row under
   * it holding what this returns. Each row on its own.
   */
  details?: (e: Entry) => HTMLElement;
  /** A prefix for the details regions' ids (aria-controls targets). */
  idPrefix?: string;
}

export interface EntryGrid {
  element: HTMLElement;
  table: HTMLTableElement;
  /** Show only the entries `keep` passes; returns how many show. Rows keep their open state. */
  setVisible(keep: (e: Entry) => boolean): number;
}

/** One list's grid: a <table> with a sortable, resizable header row. */
export function createEntryGrid(entries: Entry[], opts: GridOptions): EntryGrid {
  const { list } = opts;
  const keys = LISTS[list].columns;
  const zone = opts.zone ?? 'utc';
  const timeZone = opts.timeZone ?? 'UTC';
  const timeFormat = opts.timeFormat ?? 'clock';
  const kidLink = opts.kidLink ?? true;
  const s = stateOf(list);
  const toggleKey: ColumnKey = keys.includes('subject') ? 'subject' : 'state';

  const wrap = document.createElement('div');
  wrap.className = 'entry-grid-wrap';
  const table = document.createElement('table');
  table.className = 'entry-log entry-grid';
  table.dataset.list = list;
  table.setAttribute('aria-label', opts.label);
  const colgroup = document.createElement('colgroup');
  const cols = keys.map((key) => {
    const col = document.createElement('col');
    col.className = `col-${key}`;
    colgroup.appendChild(col);
    return col;
  });
  table.appendChild(colgroup);

  const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
  const applyWidths = (): void => {
    s.widths.forEach((w, i) => { cols[i]!.style.width = `${w}ch`; });
    // As wide as its box, never narrower than the columns: a wider box
    // shares its extra width out in proportion; a narrower one scrolls sideways.
    table.style.width = `max(100%, ${sum(s.widths)}ch)`;
  };

  // -- rows: built once, so sorting and filtering keep each row's open state.
  const shown = new Map<Entry, boolean>();
  const open = new Map<Entry, boolean>();
  const rows = new Map<Entry, HTMLTableRowElement[]>();
  let n = 0;
  for (const e of entries) {
    const tr = document.createElement('tr');
    tr.className = 'log-line';
    tr.dataset.state = e.state;
    const detailsId = `${opts.idPrefix ?? `grid-${list}`}-details-${n++}`;
    let toggle: HTMLButtonElement | null = null;
    for (const key of keys) {
      const td = document.createElement('td');
      td.className = `col-${key}`;
      const cell = document.createElement('div');
      cell.className = `cell cell-${key}`;
      if (key === 'kid') {
        const k = document.createElement(kidLink ? 'a' : 'span');
        k.className = 'kid';
        if (kidLink) k.setAttribute('href', entryHref(e));
        k.textContent = renderKid(e.kid);
        cell.appendChild(k);
      } else if (key === 'inspect') {
        const a = document.createElement('a');
        a.className = 'card-action';
        a.setAttribute('href', entryHref(e));
        a.textContent = 'Inspect';
        cell.appendChild(a);
      } else if (key === toggleKey && opts.details) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'card-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', detailsId);
        toggle.textContent = key === 'subject' ? e.subject : e.state;
        cell.appendChild(toggle);
      } else {
        cell.textContent =
          key === 'time' ? timeOf(e, zone, timeZone, timeFormat)
          : key === 'authority' ? String(e.authority)
          : e[key as 'subject' | 'state' | 'evidence' | 'reason'];
      }
      td.appendChild(cell);
      tr.appendChild(td);
    }
    shown.set(e, true);
    const mine = [tr];
    if (opts.details && toggle) {
      const dtr = document.createElement('tr');
      dtr.className = 'grid-details-row';
      const td = document.createElement('td');
      td.colSpan = keys.length;
      const details = opts.details(e);
      details.classList.add('card-details');
      details.id = detailsId;
      details.setAttribute('role', 'region');
      details.setAttribute('aria-label', `Details: ${e.subject}`);
      td.appendChild(details);
      dtr.appendChild(td);
      dtr.hidden = true;
      details.hidden = true;
      mine.push(dtr);
      open.set(e, false);
      const t = toggle;
      t.addEventListener('click', () => {
        const now = !open.get(e);
        open.set(e, now);
        t.setAttribute('aria-expanded', String(now));
        tr.classList.toggle('is-open', now);
        dtr.hidden = !(now && shown.get(e));
        details.hidden = !now;
      });
      // A click anywhere on the row opens it too, like Explorer; links,
      // buttons and the column edges keep their own clicks.
      tr.addEventListener('click', (ev) => {
        if ((ev.target as HTMLElement).closest('a, button')) return;
        t.click();
      });
    }
    rows.set(e, mine);
  }

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const tbody = document.createElement('tbody');
  const ths: HTMLTableCellElement[] = [];

  const renderBody = (): void => {
    tbody.replaceChildren(...sortEntries(entries, s.sort).flatMap((e) => rows.get(e)!));
    keys.forEach((key, i) => {
      const th = ths[i]!;
      if (key === 'inspect') return;
      const dir = s.sort && s.sort.col === key ? s.sort.dir : null;
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none');
      th.querySelector('.sort-arrow')!.textContent = dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '';
    });
  };

  keys.forEach((key, i) => {
    const text = LABELS[key];
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = `col-${key}`;
    const name = document.createElement('span');
    name.className = 'sort-label';
    name.textContent = text;
    if (key === 'inspect') {
      // A link column: nothing to sort by.
      const plain = document.createElement('span');
      plain.className = 'col-head';
      plain.title = text;
      plain.appendChild(name);
      th.appendChild(plain);
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sort-button';
      // A narrow column clips its label; the full name stays on hover.
      button.title = text;
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(name, arrow);
      button.addEventListener('click', () => {
        const cur = s.sort;
        s.sort = cur && cur.col === key
          ? { col: key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
          : { col: key, dir: 'asc' };
        renderBody();
      });
      th.appendChild(button);
    }
    if (i < keys.length - 1) th.appendChild(renderGrip(i));
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
      const start = s.widths.slice();
      const width = table.getBoundingClientRect().width;
      // Pixels per ch as drawn: the table spans sum(widths) ch, scaled to its box.
      const chPx = width > 0 ? width / sum(start) : 8;
      const x0 = down.clientX;
      // Window-level move/up: a capture is a bonus, never the mechanism.
      try { grip.setPointerCapture(down.pointerId); } catch { /* ignore */ }
      table.classList.add('resizing');
      const move = (ev: PointerEvent): void => {
        // The view changed mid-drag: this table is gone, stop listening.
        if (!table.isConnected) { up(); return; }
        s.widths = resizePair(start, i, (ev.clientX - x0) / chPx);
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

  return {
    element: wrap,
    table,
    setVisible(keep) {
      let count = 0;
      for (const e of entries) {
        const on = keep(e);
        shown.set(e, on);
        if (on) count++;
        const [tr, dtr] = rows.get(e)!;
        tr!.hidden = !on;
        if (dtr) dtr.hidden = !(on && open.get(e));
      }
      return count;
    },
  };
}

/** One list's grid, as an element (the KTIE folder and the ERIE pool). */
export function renderEntryGrid(
  entries: Entry[],
  label: string,
  list: GridList,
  zone: TimeZone,
  timeZone: string,
): HTMLElement {
  return createEntryGrid(entries, { label, list, zone, timeZone }).element;
}
