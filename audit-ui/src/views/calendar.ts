import type { View } from '../router/router.ts';
import type { SeamAdapter, Entry } from '../adapter/seam.ts';
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
import { momentInput, utcMomentToLocal, viewerTimeZone, zoneName, type TimeZone } from '../util/timezone.ts';
import type { Day } from '../util/rail.ts';
import { renderEntryLog } from './calendar-entries.ts';
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
 * The locked hour's knowledge state, as one log line: the hour, how many
 * entries it recorded, how many were live at the moment, and the masks
 * named in the hour's entries. Live loop reasons carry no mask name
 * ("assistant turn (reply)"); the mask's name is in the turn's evidence,
 * so both are read. The hour reads in the record's UTC, or in the viewer's
 * local time when the switch is on local. The counts ride in data
 * attributes too, for tests.
 */
export function renderSnapshot(
  did: Entry[],
  pool: Entry[],
  t: { year: number; month: number; day: number; hour: number },
  zone: TimeZone,
  timeZone: string,
): HTMLElement {
  const masks = PERSONAS.filter((m) => did.some((e) => e.reason.includes(m) || e.evidence.includes(m)));
  const hour = zone === 'utc' ? t.hour : utcMomentToLocal(t.year, t.month, t.day, t.hour, timeZone).hour;
  const line = el(
    'p',
    'knowledge-state log-head',
    `${p2(hour)}:00 ${zoneName(zone)} · recorded ${did.length} · live ${pool.length} · masks: ${masks.length > 0 ? masks.join(', ') : 'none named'}`,
  );
  line.dataset.recorded = String(did.length);
  line.dataset.live = String(pool.length);
  line.dataset.masks = masks.length > 0 ? masks.join(', ') : 'none named';
  return line;
}

/** Fired on window when the page moves the address in place (replaceState): the Router refreshes its panels. */
export const ADDRESS_FOLLOWED = 'hackenstein:address-followed';

/**
 * The zone the drums and the folder read in, kept for the session: the
 * drums are the clock the user reads, so a flip to local holds across the
 * hour views they open next. UTC is the default (the record's time).
 * Storage can be unavailable (private mode); then the zone just does not
 * persist and the view still works.
 */
export const KTIE_ZONE_KEY = 'hackenstein-ktie-zone';
function storedZone(): TimeZone {
  try {
    return window.sessionStorage.getItem(KTIE_ZONE_KEY) === 'local' ? 'local' : 'utc';
  } catch {
    return 'utc';
  }
}
function storeZone(zone: TimeZone): void {
  try {
    window.sessionStorage.setItem(KTIE_ZONE_KEY, zone);
  } catch {
    // No storage: the zone holds for this view only.
  }
}

/** The KTIE page's header: the engine's name over what it stands for. */
export const KTIE_NAME = 'KTIE';
export const KTIE_EXPANSION = 'Knowledge Time Indexing Engine';

/** "2026-11-18 \u00b7 14:00 UTC \u00b7 3 entries": a real moment, as the folder pane names it — in UTC, or in the viewer's local time. */
export function momentLabel(m: Moment, zone: TimeZone, timeZone: string): string {
  const n = `${m.count} ${m.count === 1 ? 'entry' : 'entries'}`;
  if (zone === 'utc') {
    return `${m.day.year}-${p2(m.day.month)}-${p2(m.day.day)} \u00b7 ${p2(m.hour)}:00 UTC \u00b7 ${n}`;
  }
  const l = utcMomentToLocal(m.day.year, m.day.month, m.day.day, m.hour, timeZone);
  return `${l.year}-${p2(l.month)}-${p2(l.day)} \u00b7 ${p2(l.hour)}:00 Local \u00b7 ${n}`;
}

/** What the folder shows before any spin: the route's own content. The hour names its moment in the shown zone; the month and day are the record's own structure, so they stay UTC. */
function folderCaption(t: CalendarTarget, zone: TimeZone, timeZone: string): string {
  if (t.level === 'month') return `Folder: ${MONTH_NAMES[t.month - 1]} ${t.year} (UTC)`;
  if (t.level === 'day') return `Folder: ${t.year}-${p2(t.month)}-${p2(t.day)} (UTC)`;
  if (zone === 'utc') return `Folder: ${t.year}-${p2(t.month)}-${p2(t.day)} \u00b7 ${p2(t.hour)}:00 UTC`;
  const l = utcMomentToLocal(t.year, t.month, t.day, t.hour, timeZone);
  return `Folder: ${l.year}-${p2(l.month)}-${p2(l.day)} \u00b7 ${p2(l.hour)}:00 Local`;
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
  /** The zone the folder reads in: UTC is the record's time, local is the viewer's. The record never changes. */
  private zone: TimeZone = 'utc';
  /** The viewer's IANA time zone; injected in tests so local readings are exact. */
  private timeZone: string;
  /** The record's entries, for re-rendering the folder when the zone flips. */
  private entries: Entry[] = [];
  /** The hour the folder is on, in the record's UTC, for the same re-render. */
  private current: { year: number; month: number; day: number; hour: number } | null = null;
  private folder: HTMLElement | null = null;
  private caption: HTMLElement | null = null;
  private passing: HTMLElement | null = null;
  private landed: HTMLElement | null = null;
  private settleMs: number | undefined;

  /** `settleMs`: the drums' quiet time before the folder follows (tests shorten it). `timeZone`: the viewer's IANA zone (tests pass one so local readings are exact). */
  constructor(adapter: SeamAdapter, target: CalendarTarget | null, settleMs?: number, timeZone?: string) {
    this.adapter = adapter;
    this.target = target;
    this.settleMs = settleMs;
    this.timeZone = timeZone ?? viewerTimeZone();
    this.zone = storedZone();
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
    this.entries = entries;

    const t = this.target ?? this.defaultTarget(entries);
    // The folder under the drums: the record at the moment they rest on.
    const folder = el('div', 'ktie-folder');
    this.folder = folder;
    // The line above the folder: the moment passing while the drums spin (its
    // space is kept when idle, so the folder never jumps), and, for screen
    // readers, a short word of where the folder landed.
    const passing = el('p', 'ktie-passing');
    passing.hidden = true;
    passing.setAttribute('aria-hidden', 'true'); // motion only
    this.passing = passing;
    const landed = el('p', 'sr-only ktie-landed');
    landed.setAttribute('role', 'status');
    this.landed = landed;
    // What the folder shows: the route's own content, until a spin settles.
    const caption = el('p', 'ktie-folder-caption', folderCaption(t, this.zone, this.timeZone));
    this.caption = caption;
    const fill = (parts: HTMLElement[]): void => {
      const main = el('div', 'calendar-main');
      main.append(...parts);
      folder.replaceChildren(main);
    };
    // The drums across the top, built from the same loaded entries.
    const rail = this.makeRail(
      entries,
      { year: t.year, month: t.month, day: t.level === 'month' ? 0 : t.day },
      t.level === 'hour' ? t.hour : null,
    );
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

    const input = hourMomentInput(t.year, t.month, t.day, t.hour);
    const moment = parseUtcInput(input);
    if (moment === null) return showError('Invalid moment.');
    const pool = await this.adapter.fetchBeliefPool(moment);
    if (!isCurrent()) return;
    if (!pool.ok) return showError(pool.error);
    this.current = { year: t.year, month: t.month, day: t.day, hour: t.hour };
    show(this.renderHour(entries, pool.data, t));
  }

  /**
   * Build the drums for `entries`, focused on the UTC `focus` day (and
   * hour, when locked), in the current zone. The rail translates the focus
   * into its own frame; its moments come back in UTC. Replaces the old
   * drums, so a zone flip rebuilds them in place on the same moment.
   */
  private makeRail(entries: Entry[], focus: Day | null, lockedHour: number | null): CalendarRail {
    const token = this.requestToken;
    const live = (): boolean => token === this.requestToken && this.body !== null;
    this.rail?.destroy();
    const rail = new CalendarRail(entries, focus, lockedHour, {
      settleMs: this.settleMs,
      zone: this.zone,
      timeZone: this.timeZone,
      onSpin: (m) => {
        const folder = this.folder;
        const passing = this.passing;
        if (!live() || folder === null || passing === null) return;
        this.folderToken++; // an older load lands nowhere
        passing.hidden = false;
        passing.textContent = momentLabel(m, this.zone, this.timeZone);
        folder.dataset.spinning = 'true';
        folder.setAttribute('aria-busy', 'true');
      },
      onSettle: (m) => {
        const folder = this.folder;
        const passing = this.passing;
        const caption = this.caption;
        const landed = this.landed;
        if (!live() || folder === null || passing === null || caption === null || landed === null) return;
        void this.settle(folder, passing, caption, landed, entries, m, live);
      },
    });
    this.rail = rail;
    return rail;
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
    const pool = moment === null ? null : await this.adapter.fetchBeliefPool(moment);
    if (!live()) return;
    this.current = t;
    const main = el('div', 'calendar-main');
    const failed = pool === null ? 'Invalid moment.' : !pool.ok ? pool.error : null;
    if (failed !== null) main.appendChild(el('p', 'error-state', failed));
    else main.append(...this.renderHour(entries, (pool as { ok: true; data: Entry[] }).data, t));
    folder.replaceChildren(main);
    delete folder.dataset.spinning;
    folder.removeAttribute('aria-busy');
    folder.dataset.moment = input;
    passing.hidden = true;
    const words = failed === null ? `Folder: ${momentLabel(m, this.zone, this.timeZone)}` : `Folder: ${momentLabel(m, this.zone, this.timeZone)}, could not load`;
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
    t: { year: number; month: number; day: number; hour: number },
  ): HTMLElement[] {
    const out: HTMLElement[] = [];
    out.push(
      link(
        calendarHref({ level: 'day', year: t.year, month: t.month, day: t.day }),
        `Back to ${t.year}-${p2(t.month)}-${p2(t.day)}`,
        'cal-back',
      ),
    );
    const cursorRow = el('div', 'cursor-row');
    cursorRow.appendChild(
      el('p', 'cursor-display', `Moment (${zoneName(this.zone)}): ${momentInput(t.year, t.month, t.day, t.hour, this.zone, this.timeZone)}`),
    );
    cursorRow.appendChild(this.renderZoneSwitch());
    out.push(cursorRow);

    const did = entriesInHour(entries, t.year, t.month, t.day, t.hour);
    out.push(renderSnapshot(did, pool, t, this.zone, this.timeZone));
    const didSec = el('section', 'hour-did log-block');
    didSec.appendChild(el('p', 'log-label', `did · ${did.length} ${did.length === 1 ? 'entry' : 'entries'}`));
    didSec.appendChild(
      did.length === 0
        ? el('p', 'empty-state', 'Nothing was recorded in this hour.')
        : renderEntryLog(did, 'What the agent did this hour', this.zone, this.timeZone),
    );
    out.push(didSec);

    const beliefSec = el('section', 'hour-believed log-block');
    beliefSec.appendChild(el('p', 'log-label', `believed · ${pool.length} ${pool.length === 1 ? 'entry' : 'entries'}`));
    beliefSec.appendChild(
      pool.length === 0
        ? el('p', 'empty-state', 'No entries were live at this moment.')
        : renderEntryLog(pool, 'What it believed at this moment', this.zone, this.timeZone),
    );
    out.push(beliefSec);
    return out;
  }

  /** UTC / Local switch: the record stays UTC; the drums and the folder read in the shown zone. */
  private renderZoneSwitch(): HTMLElement {
    const group = el('div', 'zone-switch');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Times shown in');
    for (const z of ['utc', 'local'] as const) {
      const b = el('button', 'zone-button', z === 'utc' ? 'UTC' : 'Local');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(this.zone === z));
      if (this.zone === z) b.classList.add('zone-active');
      b.addEventListener('click', () => {
        if (this.zone !== z) {
          this.zone = z;
          storeZone(z);
          void this.refreshZone();
        }
      });
      group.appendChild(b);
    }
    return group;
  }

  /**
   * The zone flipped: the drums rebuild in the new zone on the same moment
   * (a local pick reads the same UTC record), and the folder re-reads.
   * The month grid and the day hour list are the record's own structure,
   * so they stay UTC; only the drums and the hour folder follow the switch.
   * The switch lives on the hour view, so a flip from a month or day route
   * waits for an hour view — the zone it sets holds across mounts.
   */
  private async refreshZone(): Promise<void> {
    const oldRoot = this.rail?.root ?? null;
    let focus: Day | null = null;
    let locked: number | null = null;
    if (this.current !== null) {
      focus = { year: this.current.year, month: this.current.month, day: this.current.day };
      locked = this.current.hour;
    } else {
      const target = this.target;
      if (target !== null) {
        if (target.level === 'hour') {
          focus = { year: target.year, month: target.month, day: target.day };
          locked = target.hour;
        } else if (target.level === 'day') {
          focus = { year: target.year, month: target.month, day: target.day };
        } else {
          focus = { year: target.year, month: target.month, day: 0 };
        }
      }
    }
    const rail = this.makeRail(this.entries, focus, locked);
    if (oldRoot !== null) oldRoot.replaceWith(rail.root);
    await this.refreshFolder();
  }

  /** Re-read the folder in the new zone: same moment, same entries, new clock. */
  private async refreshFolder(): Promise<void> {
    const folder = this.folder;
    const caption = this.caption;
    const landed = this.landed;
    const current = this.current;
    if (folder === null || caption === null || landed === null || current === null) return;
    const mine = ++this.folderToken;
    const live = (): boolean => mine === this.folderToken && this.body !== null;
    const input = hourMomentInput(current.year, current.month, current.day, current.hour);
    const moment = parseUtcInput(input);
    const pool = moment === null ? null : await this.adapter.fetchBeliefPool(moment);
    if (!live()) return;
    if (pool === null || !pool.ok) return;
    const main = el('div', 'calendar-main');
    main.append(...this.renderHour(this.entries, pool.data, current));
    folder.replaceChildren(main);
    const m: Moment = {
      day: { year: current.year, month: current.month, day: current.day },
      hour: current.hour,
      count: entriesInHour(this.entries, current.year, current.month, current.day, current.hour).length,
    };
    const words = `Folder: ${momentLabel(m, this.zone, this.timeZone)}`;
    caption.textContent = words;
    landed.textContent = words;
  }

  unmount(): void {
    this.requestToken++;
    this.folderToken++;
    this.rail?.destroy();
    this.rail = null;
    this.body = null;
    this.folder = null;
    this.caption = null;
    this.passing = null;
    this.landed = null;
    this.current = null;
    this.entries = [];
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
