import type { View } from '../router/router.ts';
import type { SeamAdapter, Entry, KidMap } from '../adapter/seam.ts';
import { parseMs } from '../util/interval.ts';
import { stripBase, withBase } from '../util/base.ts';
import {
  type CalendarTarget,
  MONTH_NAMES,
  WEEKDAY_HEADERS,
  calendarHref,
  daysWithEntries,
  entriesInHour,
  hourMomentInput,
  monthGrid,
} from '../util/calendar.ts';
import { parseUtcInput } from '../util/moment.ts';
import { renderEntryTable } from './calendar-entries.ts';
import { CalendarRail, type Moment } from './calendar-rail.ts';
import { PERSONAS } from '../adapter/seam.ts';

const p2 = (n: number): string => String(n).padStart(2, '0');

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(href: string, text: string, className = ''): HTMLAnchorElement {
  const a = el('a', className, text);
  a.setAttribute('href', href);
  return a;
}

function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year} (UTC)`;
}

/**
 * The locked hour's knowledge state: live-derived counts only. Recorded =
 * the hour's entries (the "did" table), live = the belief pool (the
 * "believed" table), and the masks named in the hour's entries. Live loop
 * reasons carry no mask name ("assistant turn (reply)"); the mask's name is
 * in the turn's evidence, so both are read.
 */
export function renderSnapshot(did: Entry[], pool: Entry[], hour: number): HTMLElement {
  const sec = el('section', 'knowledge-state');
  sec.appendChild(el('h2', '', `Knowledge state at ${p2(hour)}:00 UTC (hour #${p2(hour)} record closure)`));
  sec.appendChild(el('p', 'knowledge-lede', 'Everything recorded and believed by the agent in this 60-minute window.'));
  const masks = PERSONAS.filter((m) => did.some((e) => e.reason.includes(m) || e.evidence.includes(m)));
  const dl = el('dl', 'knowledge-stats');
  const stat = (term: string, value: string, key: string): void => {
    const box = el('div', 'knowledge-stat');
    box.dataset.stat = key;
    box.append(el('dt', '', term), el('dd', '', value));
    dl.appendChild(box);
  };
  stat('Recorded this hour', String(did.length), 'recorded');
  stat('Live at this moment', String(pool.length), 'live');
  stat('Masks named in the hour', masks.length > 0 ? masks.join(', ') : 'None named', 'masks');
  sec.appendChild(dl);
  return sec;
}

/** Fired on window when the page moves the address in place (replaceState): the Router refreshes its panels. */
export const ADDRESS_FOLLOWED = 'hackenstein:address-followed';

/** The KTIE page's header: the engine's name over what it stands for. */
export const KTIE_NAME = 'KTIE';
export const KTIE_EXPANSION = 'Knowledge Time Indexing Engine';

/** "2026-11-18 \u00b7 14:00 UTC \u00b7 3 entries": a real moment, as the folder pane names it. */
export function momentLabel(m: Moment): string {
  const n = `${m.count} ${m.count === 1 ? 'entry' : 'entries'}`;
  return `${m.day.year}-${p2(m.day.month)}-${p2(m.day.day)} \u00b7 ${p2(m.hour)}:00 UTC \u00b7 ${n}`;
}

/** What the folder shows before any spin: the route's own content. */
function folderCaption(t: CalendarTarget): string {
  if (t.level === 'month') return `Folder: ${MONTH_NAMES[t.month - 1]} ${t.year} (UTC)`;
  if (t.level === 'day') return `Folder: ${t.year}-${p2(t.month)}-${p2(t.day)} (UTC)`;
  return `Folder: ${t.year}-${p2(t.month)}-${p2(t.day)} \u00b7 ${p2(t.hour)}:00 UTC`;
}

/**
 * The KTIE page (the Calendar route): the KTIE header, the time tree as
 * drums across the top, and the folder underneath: the record at the
 * moment the drums rest on. The folder starts as the route's own content
 * (the month grid, the day's hours, or the hour view); once the drums have
 * been spun and have settled, it becomes the hour view for that moment.
 * While they spin the old folder stays put, and a line above it names the
 * real moments passing by.
 */
export class CalendarView implements View {
  private adapter: SeamAdapter;
  private target: CalendarTarget | null;
  private container: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private requestToken = 0;
  /** Counts folder loads; a spin or a newer settle drops an older load. */
  private folderToken = 0;
  private rail: CalendarRail | null = null;
  private settleMs: number | undefined;

  /** `settleMs`: the drums' quiet time before the folder follows (tests shorten it). */
  constructor(adapter: SeamAdapter, target: CalendarTarget | null, settleMs?: number) {
    this.adapter = adapter;
    this.target = target;
    this.settleMs = settleMs;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    // One page, no page scroll: head and body share a single full-height
    // column, and the folder below the drums is the box that scrolls
    // inside it when its content is taller than the screen.
    const page = el('div', 'ktie-page');
    const head = el('header', 'ktie-head');
    head.append(el('h1', 'ktie-name', KTIE_NAME), el('p', 'ktie-expansion', KTIE_EXPANSION));
    page.appendChild(head);
    const body = el('div', 'view-body calendar-view');
    // The intro used to carry data-view="Calendar"; with no intro the
    // body carries it, so the header strip still reads "View: Calendar".
    body.dataset.view = 'Calendar';
    this.body = body;
    page.appendChild(body);
    container.appendChild(page);
    void this.load(body);
  }

  private async load(body: HTMLElement): Promise<void> {
    const token = ++this.requestToken;
    const isCurrent = (): boolean => token === this.requestToken && this.body === body;
    const showError = (msg: string): void => {
      body.replaceChildren(el('p', 'error-state', msg));
    };

    const all = await this.adapter.fetchAllEntries();
    if (!isCurrent()) return;
    if (!all.ok) return showError(all.error);
    const entries = all.data;

    const t = this.target ?? this.defaultTarget(entries);
    // The folder under the drums: the record at the moment they rest on.
    const folder = el('div', 'ktie-folder');
    // The line above the folder: the moment passing while the drums spin (its
    // space is kept when idle, so the folder never jumps), and, for screen
    // readers, a short word of where the folder landed.
    const passing = el('p', 'ktie-passing');
    passing.hidden = true;
    passing.setAttribute('aria-hidden', 'true'); // motion only
    const landed = el('p', 'sr-only ktie-landed');
    landed.setAttribute('role', 'status');
    // What the folder shows: the route's own content, until a spin settles.
    const caption = el('p', 'ktie-folder-caption', folderCaption(t));
    const fill = (parts: HTMLElement[]): void => {
      const main = el('div', 'calendar-main');
      main.append(...parts);
      folder.replaceChildren(main);
    };
    // The drums across the top, built from the same loaded entries.
    this.rail?.destroy();
    const rail = new CalendarRail(
      entries,
      { year: t.year, month: t.month, day: t.level === 'month' ? 0 : t.day },
      t.level === 'hour' ? t.hour : null,
      {
        settleMs: this.settleMs,
        onSpin: (m) => {
          if (!isCurrent()) return;
          this.folderToken++; // an older load lands nowhere
          passing.hidden = false;
          passing.textContent = momentLabel(m);
          folder.dataset.spinning = 'true';
          folder.setAttribute('aria-busy', 'true');
        },
        onSettle: (m) => {
          if (isCurrent()) void this.settle(folder, passing, caption, landed, entries, m, isCurrent);
        },
      },
    );
    this.rail = rail;
    const show = (parts: HTMLElement[]): void => {
      fill(parts);
      body.replaceChildren(rail.root, passing, landed, caption, folder);
    };

    if (t.level === 'month') {
      show(this.renderMonth(entries, t.year, t.month));
      return;
    }

    if (t.level === 'day') {
      show(this.renderDay(entries, t.year, t.month, t.day));
      return;
    }

    const kidMapResult = await this.adapter.fetchKidMap();
    if (!isCurrent()) return;
    const kidMap: KidMap | null = kidMapResult.ok ? kidMapResult.data : null;

    const input = hourMomentInput(t.year, t.month, t.day, t.hour);
    const moment = parseUtcInput(input);
    if (moment === null) return showError('Invalid moment.');
    const pool = await this.adapter.fetchBeliefPool(moment);
    if (!isCurrent()) return;
    if (!pool.ok) return showError(pool.error);
    show(this.renderHour(entries, pool.data, kidMap, t, input));
  }

  /** The drums came to rest on `m`: the folder becomes the hour view for it. */
  private async settle(
    folder: HTMLElement,
    passing: HTMLElement,
    caption: HTMLElement,
    landed: HTMLElement,
    entries: Entry[],
    m: Moment,
    isCurrent: () => boolean,
  ): Promise<void> {
    const mine = ++this.folderToken;
    const live = (): boolean => isCurrent() && mine === this.folderToken;
    const t = { year: m.day.year, month: m.day.month, day: m.day.day, hour: m.hour };
    const input = hourMomentInput(t.year, t.month, t.day, t.hour);
    const moment = parseUtcInput(input);
    const kidMapResult = await this.adapter.fetchKidMap();
    if (!live()) return;
    const kidMap: KidMap | null = kidMapResult.ok ? kidMapResult.data : null;
    const pool = moment === null ? null : await this.adapter.fetchBeliefPool(moment);
    if (!live()) return;
    const main = el('div', 'calendar-main');
    const failed = pool === null ? 'Invalid moment.' : !pool.ok ? pool.error : null;
    if (failed !== null) main.appendChild(el('p', 'error-state', failed));
    else main.append(...this.renderHour(entries, (pool as { ok: true; data: Entry[] }).data, kidMap, t, input));
    folder.replaceChildren(main);
    delete folder.dataset.spinning;
    folder.removeAttribute('aria-busy');
    folder.dataset.moment = input;
    passing.hidden = true;
    const words = failed === null ? `Folder: ${momentLabel(m)}` : `Folder: ${momentLabel(m)}, could not load`;
    caption.textContent = words;
    landed.textContent = words;
    if (failed !== null) return; // the address stays where it was
    // The address follows the folder (no new history entry), so a reload or a
    // shared link shows the same moment; the shell is told so its labels follow.
    const href = calendarHref({ level: 'hour', ...t });
    if (stripBase(window.location.pathname) !== href) {
      window.history.replaceState(window.history.state, '', withBase(href));
      window.dispatchEvent(new Event(ADDRESS_FOLLOWED));
    }
  }

  /** Month of the newest entry by k_start, else the current UTC month. */
  private defaultTarget(entries: Entry[]): CalendarTarget {
    let best = Number.NaN;
    for (const e of entries) {
      const ms = parseMs(e.k_start);
      if (!Number.isNaN(ms) && (Number.isNaN(best) || ms > best)) best = ms;
    }
    const d = Number.isNaN(best) ? new Date() : new Date(best);
    return { level: 'month', year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }

  private renderMonth(entries: Entry[], year: number, month: number): HTMLElement[] {
    const counts = daysWithEntries(entries, year, month);
    // Heatmap: a day's intensity (1-4) follows its live entry count.
    const maxCount = Math.max(0, ...counts.values());
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

    const head = el('div', 'calendar-head');
    head.appendChild(link(calendarHref({ level: 'month', ...prev }), 'Previous month', 'cal-prev'));
    head.appendChild(el('h2', 'calendar-title', monthTitle(year, month)));
    head.appendChild(link(calendarHref({ level: 'month', ...next }), 'Next month', 'cal-next'));

    const table = el('table', 'calendar-grid');
    const thead = el('thead', '');
    const headRow = el('tr', '');
    for (const h of WEEKDAY_HEADERS) {
      const th = el('th', '', h);
      th.setAttribute('scope', 'col');
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = el('tbody', '');
    table.appendChild(tbody);
    for (const week of monthGrid(year, month)) {
      const tr = el('tr', '');
      for (const day of week) {
        const td = el('td', day === null ? 'day-blank' : 'day-cell');
        if (day !== null) {
          const a = link(
            calendarHref({ level: 'day', year, month, day }),
            String(day),
            'day-link',
          );
          td.appendChild(a);
          const n = counts.get(day) ?? 0;
          if (n > 0) {
            td.dataset.heat = String(Math.max(1, Math.ceil((n / maxCount) * 4)));
            const label = `${n} ${n === 1 ? 'entry' : 'entries'}`;
            const count = el('span', 'day-count', String(n));
            count.setAttribute('title', label);
            count.setAttribute('aria-label', label);
            td.appendChild(count);
          }
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    return [head, table];
  }

  private renderDay(entries: Entry[], year: number, month: number, day: number): HTMLElement[] {
    const out: HTMLElement[] = [];
    out.push(el('h2', 'calendar-title', `${year}-${p2(month)}-${p2(day)} (UTC)`));
    out.push(link(calendarHref({ level: 'month', year, month }), `Back to ${monthTitle(year, month)}`, 'cal-back'));

    let total = 0;
    const ul = el('ul', 'hour-list');
    for (let h = 0; h < 24; h++) {
      const n = entriesInHour(entries, year, month, day, h).length;
      total += n;
      const li = el('li', '');
      const a = link(calendarHref({ level: 'hour', year, month, day, hour: h }), p2(h), 'hour-link');
      li.appendChild(a);
      if (n > 0) li.appendChild(el('span', 'hour-count', ` (${n})`));
      ul.appendChild(li);
    }
    if (total === 0) out.push(el('p', 'empty-state', 'No record entries on this day.'));
    out.push(ul);
    return out;
  }

  private renderHour(
    entries: Entry[],
    pool: Entry[],
    kidMap: KidMap | null,
    t: { year: number; month: number; day: number; hour: number },
    input: string,
  ): HTMLElement[] {
    const out: HTMLElement[] = [];
    out.push(
      link(
        calendarHref({ level: 'day', year: t.year, month: t.month, day: t.day }),
        `Back to ${t.year}-${p2(t.month)}-${p2(t.day)}`,
        'cal-back',
      ),
    );
    out.push(el('p', 'cursor-display', `Moment (UTC): ${input}`));

    const did = entriesInHour(entries, t.year, t.month, t.day, t.hour);
    out.push(renderSnapshot(did, pool, t.hour));
    const didSec = el('section', 'hour-did');
    didSec.appendChild(el('h2', '', 'What the agent did this hour'));
    didSec.appendChild(
      did.length === 0
        ? el('p', 'empty-state', 'Nothing was recorded in this hour.')
        : renderEntryTable(did, kidMap, 'What the agent did this hour'),
    );
    out.push(didSec);

    const beliefSec = el('section', 'hour-believed');
    beliefSec.appendChild(el('h2', '', 'What it believed at this moment'));
    beliefSec.appendChild(
      pool.length === 0
        ? el('p', 'empty-state', 'No entries were live at this moment.')
        : renderEntryTable(pool, kidMap, 'What it believed at this moment'),
    );
    out.push(beliefSec);
    return out;
  }

  unmount(): void {
    this.requestToken++;
    this.folderToken++;
    this.rail?.destroy();
    this.rail = null;
    this.body = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
