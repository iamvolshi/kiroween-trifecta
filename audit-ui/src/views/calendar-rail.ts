import type { Entry } from '../adapter/seam.ts';
import { MONTH_NAMES, calendarHref } from '../util/calendar.ts';
import {
  type Day,
  type Quarter,
  type Week,
  daysOfWeekPresent,
  daysPresent,
  dayKey,
  hourCounts,
  isoWeekOf,
  quarterKey,
  quarterOf,
  quartersPresent,
  weekKey,
  weeksPresent,
} from '../util/rail.ts';

/**
 * The calendar rail: quarters, weeks, days and a 24-hour strip, tiered like
 * a directory tree, each tier a row of small ticks. Built ONLY from the
 * loaded entries: a tier with nothing in the record says so (NOT KNOWN).
 * The wheel moves the tier the cursor is over; clicking an hour locks it
 * and opens the same hour view as the day's hour list.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const p2 = (n: number): string => String(n).padStart(2, '0');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const plural = (n: number): string => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/** 1-4 by share of the tier's largest count; 0 for none. */
function level(n: number, max: number): number {
  return n <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((n / max) * 4));
}

export class CalendarRail {
  readonly root: HTMLElement;
  private days: Array<{ day: Day; count: number }>;
  private entries: Entry[];
  private quarter: Quarter | null = null;
  private week: Week | null = null;
  private day: Day | null = null;
  /** The hour the wheel points at in Tier 4 (not locked until clicked). */
  private hourCursor: number | null;
  private lockedHour: number | null;
  private hovered: number | null = null;
  /** The day the locked hour belongs to (the hour view's day). */
  private lockedDay: Day | null;

  /** `focus`: the day the view is on (if any); `lockedHour`: the hour view's hour on that day. */
  constructor(entries: Entry[], focus: Day | null, lockedHour: number | null) {
    this.entries = entries;
    this.days = daysPresent(entries);
    this.lockedHour = lockedHour;
    this.lockedDay = lockedHour !== null ? focus : null;
    this.hourCursor = lockedHour;
    this.root = el('section', 'calendar-rail');
    this.root.setAttribute('aria-label', 'Calendar rail');
    const start =
      (focus && this.days.find((d) => dayKey(d.day) === dayKey(focus))?.day) ??
      (focus && this.newestIn((d) => d.year === focus.year && d.month === focus.month)) ??
      this.days[this.days.length - 1]?.day ??
      null;
    if (start) this.selectDay(start);
    this.render();
  }

  private newestIn(test: (d: Day) => boolean): Day | null {
    const hit = this.days.filter((d) => test(d.day));
    return hit[hit.length - 1]?.day ?? null;
  }

  private selectDay(d: Day): void {
    this.day = d;
    this.quarter = quarterOf(d);
    this.week = isoWeekOf(d);
  }

  private all(): Day[] {
    return this.days.map((d) => d.day);
  }

  /** Move tier `tier` by `step` among the periods present, then re-render. */
  move(tier: number, step: number): void {
    if (tier === 4) {
      const next = Math.min(23, Math.max(0, (this.hourCursor ?? (step > 0 ? -1 : 24)) + step));
      this.hourCursor = next;
      this.render();
      return;
    }
    const days = this.all();
    if (tier === 1 && this.quarter) {
      const qs = quartersPresent(days);
      const i = qs.findIndex((q) => quarterKey(q) === quarterKey(this.quarter!));
      const q = qs[Math.min(qs.length - 1, Math.max(0, i + step))]!;
      if (quarterKey(q) !== quarterKey(this.quarter)) {
        const ws = weeksPresent(days, q);
        const w = ws[ws.length - 1]!;
        const ds = daysOfWeekPresent(days, q, w);
        this.quarter = q;
        this.week = w;
        this.day = ds[ds.length - 1]!;
        this.hourCursor = null;
      }
    } else if (tier === 2 && this.quarter && this.week) {
      const ws = weeksPresent(days, this.quarter);
      const i = ws.findIndex((w) => weekKey(w) === weekKey(this.week!));
      const w = ws[Math.min(ws.length - 1, Math.max(0, i + step))]!;
      if (weekKey(w) !== weekKey(this.week)) {
        const ds = daysOfWeekPresent(days, this.quarter, w);
        this.week = w;
        this.day = ds[ds.length - 1]!;
        this.hourCursor = null;
      }
    } else if (tier === 3 && this.quarter && this.week && this.day) {
      const ds = daysOfWeekPresent(days, this.quarter, this.week);
      const i = ds.findIndex((d) => dayKey(d) === dayKey(this.day!));
      const d = ds[Math.min(ds.length - 1, Math.max(0, i + step))]!;
      if (dayKey(d) !== dayKey(this.day)) {
        this.day = d;
        this.hourCursor = null;
      }
    }
    this.render();
  }

  private tier(n: number, head: string, ticks: HTMLElement[] | null): HTMLElement {
    const sec = el('section', 'rail-tier');
    sec.dataset.tier = String(n);
    if (this.hovered === n) sec.dataset.hover = 'true';
    sec.appendChild(el('h3', 'rail-tier-head', head));
    if (ticks === null) {
      sec.appendChild(el('p', 'empty-state', 'Nothing in the record for this tier.'));
    } else {
      const row = el('div', 'rail-ticks');
      row.append(...ticks);
      sec.appendChild(row);
    }
    sec.addEventListener('mouseenter', () => this.setHover(n));
    sec.addEventListener('mouseleave', () => this.setHover(null));
    sec.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.deltaY === 0 || ticks === null) return;
        e.preventDefault();
        this.move(n, e.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );
    return sec;
  }

  private setHover(n: number | null): void {
    this.hovered = n;
    for (const t of this.root.querySelectorAll<HTMLElement>('.rail-tier')) {
      if (t.dataset.tier === String(n)) t.dataset.hover = 'true';
      else delete t.dataset.hover;
    }
  }

  private tick(label: string, aria: string, count: number, max: number, selected: boolean, onPick: () => void): HTMLButtonElement {
    const b = el('button', 'rail-tick');
    b.type = 'button';
    b.dataset.level = String(level(count, max));
    b.setAttribute('aria-pressed', String(selected));
    b.setAttribute('aria-label', aria);
    b.title = aria;
    b.appendChild(el('span', 'rail-tick-label', label));
    b.addEventListener('click', onPick);
    return b;
  }

  private countIn(test: (d: Day) => boolean): number {
    return this.days.filter((d) => test(d.day)).reduce((s, d) => s + d.count, 0);
  }

  render(): void {
    const days = this.all();
    const tiers: HTMLElement[] = [];
    const q = this.quarter;
    const w = this.week;
    const d = this.day;

    // Tier 1: quarters present.
    const qs = quartersPresent(days);
    const qCount = (x: Quarter): number => this.countIn((y) => quarterKey(quarterOf(y)) === quarterKey(x));
    const qMax = Math.max(0, ...qs.map(qCount));
    tiers.push(
      this.tier(
        1,
        q ? `Tier 1: Quarters (${q.year}) \u2014 Q${q.q}` : 'Tier 1: Quarters',
        qs.length === 0
          ? null
          : qs.map((x) =>
              this.tick(`Q${x.q}`, `${x.year} Q${x.q}, ${plural(qCount(x))}`, qCount(x), qMax, !!q && quarterKey(x) === quarterKey(q), () => {
                const ws = weeksPresent(days, x);
                const wk = ws[ws.length - 1]!;
                const ds = daysOfWeekPresent(days, x, wk);
                this.quarter = x;
                this.week = wk;
                this.day = ds[ds.length - 1]!;
                this.hourCursor = null;
                this.render();
              }),
            ),
      ),
    );

    // Tier 2: weeks present in the quarter.
    const ws = q ? weeksPresent(days, q) : [];
    const wCount = (x: Week): number =>
      this.countIn((y) => !!q && quarterKey(quarterOf(y)) === quarterKey(q) && weekKey(isoWeekOf(y)) === weekKey(x));
    const wMax = Math.max(0, ...ws.map(wCount));
    tiers.push(
      this.tier(
        2,
        q && w ? `Tier 2: Weeks of Q${q.q} \u2014 Week ${w.week}` : 'Tier 2: Weeks',
        ws.length === 0
          ? null
          : ws.map((x) =>
              this.tick(`W${x.week}`, `Week ${x.week} of ${x.isoYear}, ${plural(wCount(x))}`, wCount(x), wMax, !!w && weekKey(x) === weekKey(w), () => {
                const ds = daysOfWeekPresent(days, q!, x);
                this.week = x;
                this.day = ds[ds.length - 1]!;
                this.hourCursor = null;
                this.render();
              }),
            ),
      ),
    );

    // Tier 3: days present in the week.
    const ds = q && w ? daysOfWeekPresent(days, q, w) : [];
    const dCount = (x: Day): number => this.days.find((y) => dayKey(y.day) === dayKey(x))?.count ?? 0;
    const dMax = Math.max(0, ...ds.map(dCount));
    const dayName = (x: Day): string =>
      `${WEEKDAYS[new Date(Date.UTC(x.year, x.month - 1, x.day)).getUTCDay()]} ${x.day} ${MONTH_NAMES[x.month - 1]}`;
    tiers.push(
      this.tier(
        3,
        w && d ? `Tier 3: Days (W${w.week}) \u2014 ${dayName(d)}` : 'Tier 3: Days',
        ds.length === 0
          ? null
          : ds.map((x) =>
              this.tick(String(x.day), `${dayName(x)} ${x.year}, ${plural(dCount(x))}`, dCount(x), dMax, !!d && dayKey(x) === dayKey(d), () => {
                this.day = x;
                this.hourCursor = null;
                this.render();
              }),
            ),
      ),
    );

    // Tier 4: the 24-hour strip of the day, built once.
    if (d) {
      const counts = hourCounts(this.entries, d);
      const max = Math.max(...counts);
      const total = counts.reduce((s, n) => s + n, 0);
      const locked = this.lockedHour !== null && this.isLockedDay(d) ? this.lockedHour : null;
      const strip = counts.map((n, h) => {
        const a = el('a', 'rail-tick rail-hour');
        a.setAttribute('href', calendarHref({ level: 'hour', year: d.year, month: d.month, day: d.day, hour: h }));
        a.dataset.hour = String(h);
        a.dataset.level = String(level(n, max));
        const aria = `${p2(h)}:00 UTC, ${plural(n)}`;
        a.setAttribute('aria-label', aria);
        a.title = aria;
        if (h === locked) a.setAttribute('aria-current', 'true');
        if (h === this.hourCursor) a.dataset.cursor = 'true';
        a.appendChild(el('span', 'rail-tick-label', p2(h)));
        return a;
      });
      const head =
        locked !== null
          ? `Tier 4: 24-hour strip (${MONTH_NAMES[d.month - 1]!.slice(0, 3)} ${d.day}) \u2014 Active \u2014 ${p2(locked)}:00 UTC (${plural(counts[locked]!)})`
          : `Tier 4: 24-hour strip (${MONTH_NAMES[d.month - 1]!.slice(0, 3)} ${d.day}) \u2014 ${plural(total)}`;
      tiers.push(this.tier(4, head, strip));
    } else {
      tiers.push(this.tier(4, 'Tier 4: 24-hour strip', null));
    }
    this.root.replaceChildren(...tiers);
  }

  private isLockedDay(d: Day): boolean {
    return this.lockedDay !== null && dayKey(this.lockedDay) === dayKey(d);
  }
}
