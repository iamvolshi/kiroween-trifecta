import type { View } from '../router/router.ts';
import type { SeamAdapter, Entry, KidMap } from '../adapter/seam.ts';
import { parseMs } from '../util/interval.ts';
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
import { createIntro } from './intro.ts';

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

export class CalendarView implements View {
  private adapter: SeamAdapter;
  private target: CalendarTarget | null;
  private container: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private requestToken = 0;

  constructor(adapter: SeamAdapter, target: CalendarTarget | null) {
    this.adapter = adapter;
    this.target = target;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    container.appendChild(el('h1', '', 'Calendar'));
    container.appendChild(createIntro('calendar'));
    const body = el('div', 'view-body calendar-view');
    this.body = body;
    container.appendChild(body);
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

    if (t.level === 'month') {
      body.replaceChildren(...this.renderMonth(entries, t.year, t.month));
      return;
    }

    if (t.level === 'day') {
      body.replaceChildren(...this.renderDay(entries, t.year, t.month, t.day));
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
    body.replaceChildren(
      ...this.renderHour(entries, pool.data, kidMap, t, input),
    );
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
            const dot = el('span', 'day-dot', '\u25CF');
            const label = `${n} ${n === 1 ? 'entry' : 'entries'}`;
            dot.setAttribute('title', label);
            dot.setAttribute('aria-label', label);
            td.appendChild(dot);
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
    this.body = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
