import type { Entry } from '../adapter/seam.ts';
import { MONTH_NAMES, calendarHref } from '../util/calendar.ts';
import { stripBase } from '../util/base.ts';
import {
  type Day,
  type Quarter,
  type Week,
  daysOfWeekInQuarter,
  daysPresent,
  dayKey,
  hourCounts,
  isoWeekOf,
  quarterKey,
  quarterOf,
  quartersOfYear,
  weekKey,
  weeksOfQuarter,
  yearsRange,
} from '../util/rail.ts';

/**
 * KTIE's time tree as drums: a row of spinning wheels, one per segment
 * (Years, Quarters, Weeks, Days, Hours), like the Apple date picker or the
 * segments of a clock readout. The centered value is the selection, solid;
 * the values above and below fade with their distance from the center.
 *
 * Each wheel holds its full range — every year around the record, all four
 * quarters of a year, every ISO week of a quarter, every day of a week, all
 * 24 hours of a day — and the counts say what the record holds, 0 where
 * empty. A wheel with nothing at all in the record says so in words.
 *
 * Hover a wheel and the scroll wheel spins that wheel; the wheels to its
 * right re-derive from the new selection (a year move re-picks the last
 * quarter, week, day and hour in it; a quarter move the last week, day and
 * hour; and so on). A wheel claims the scroll only when it moved: at an end
 * the page scrolls. Arrow keys spin the focused wheel (Up/Down, and
 * Left/Right as the old rail did), Home / End jump to its ends. Clicking a value
 * centers it; clicking an hour opens that hour's view (a plain link).
 *
 * Every move reports the moment it passes (`onSpin`); once the wheels have
 * been still for `settleMs`, the moment they rest on is reported
 * (`onSettle`). The view swaps the folder underneath only then.
 */

export type Segment = 'year' | 'quarter' | 'week' | 'day' | 'hour';
export const SEGMENTS: readonly Segment[] = ['year', 'quarter', 'week', 'day', 'hour'];
const HEADS: Record<Segment, string> = { year: 'Years', quarter: 'Quarters', week: 'Weeks', day: 'Days', hour: 'Hours (UTC)' };

/** Values shown either side of the center; further ones are hidden. */
export const DRUM_REACH = 2;
/** Opacity by distance from the center: solid, then fading out. */
export const DRUM_FADE: readonly number[] = [1, 0.55, 0.3, 0.14];
/** Quiet time after the last move before the wheels count as settled. */
export const SETTLE_MS = 420;
/** Wheel travel (px) per step: a mouse notch is one step; a trackpad gathers small deltas. */
const STEP_PX = 50;
/** A gathered partial step is dropped after this much quiet (ms). */
const GATHER_QUIET_MS = 160;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const p2 = (n: number): string => String(n).padStart(2, '0');
const plural = (n: number): string => `${n} ${n === 1 ? 'entry' : 'entries'}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The moment the wheels point at: a day and an hour of it, with that hour's live count. */
export interface Moment {
  day: Day;
  hour: number;
  count: number;
}

export interface RailOptions {
  onSpin?: (m: Moment) => void;
  onSettle?: (m: Moment) => void;
  settleMs?: number;
}

/** One value on a wheel. */
interface Value {
  key: string;
  label: string;
  aria: string;
  count: number;
  /** Hours only: the hour view. */
  href?: string;
}

const dayName = (d: Day): string => WEEKDAYS[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()]!;

/**
 * What a wheel's values are: their keys, and their links (the hour wheel's
 * 24 keys are the same every day; its links name the day). Same signature:
 * the wheel is patched in place and spins; else it is rebuilt.
 */
function signature(vals: Value[]): string {
  return vals.map((v) => `${v.key}>${v.href ?? ''}`).join('|');
}

/** A path as the Router matches it: no query, no hash, no trailing slash. */
function normalPath(raw: string): string {
  let p = raw.split(/[?#]/)[0]!;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** The fade of a value `d` steps from the center. */
export function fadeAt(d: number): number {
  const a = Math.abs(d);
  return a < DRUM_FADE.length ? DRUM_FADE[a]! : 0;
}

export class CalendarRail {
  readonly root: HTMLElement;
  private days: Array<{ day: Day; count: number }>;
  private entries: Entry[];
  private year: number | null = null;
  private quarter: Quarter | null = null;
  private week: Week | null = null;
  private day: Day | null = null;
  private hour: number | null = null;
  private lockedHour: number | null;
  /** The day the locked hour belongs to (the hour view's day). */
  private lockedDay: Day | null;
  private hovered: Segment | null = null;
  private drums = new Map<Segment, HTMLElement>();
  private row: HTMLElement;
  private wheelGather = new Map<Segment, number>();
  private wheelAt = new Map<Segment, number>();
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private opts: RailOptions;

  /** `focus`: the day the view is on (if any); `lockedHour`: the hour view's hour on that day. */
  constructor(entries: Entry[], focus: Day | null, lockedHour: number | null, opts: RailOptions = {}) {
    this.entries = entries;
    this.days = daysPresent(entries);
    this.lockedHour = lockedHour;
    this.lockedDay = lockedHour !== null ? focus : null;
    this.opts = opts;
    this.root = el('div', 'calendar-rail ktie-drums');
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Time tree');
    this.root.style.setProperty('--drum-reach', String(DRUM_REACH));
    this.row = el('div', 'drum-row');
    this.root.appendChild(this.row);
    const start =
      (focus && this.days.find((d) => dayKey(d.day) === dayKey(focus))?.day) ??
      (focus && this.newestIn((d) => d.year === focus.year && d.month === focus.month)) ??
      this.days[this.days.length - 1]?.day ??
      null;
    if (start) {
      this.selectDay(start);
      this.hour = lockedHour !== null && focus && dayKey(start) === dayKey(focus) ? lockedHour : this.lastHourOf(start);
    }
    this.render();
  }

  /** The moment the wheels point at, or null with nothing in the record. */
  moment(): Moment | null {
    if (!this.day || this.hour === null) return null;
    return { day: this.day, hour: this.hour, count: hourCounts(this.entries, this.day)[this.hour] ?? 0 };
  }

  /** Stop the settle timer (the view is going away). */
  destroy(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  private newestIn(test: (d: Day) => boolean): Day | null {
    const hit = this.days.filter((d) => test(d.day));
    return hit[hit.length - 1]?.day ?? null;
  }

  private all(): Day[] {
    return this.days.map((d) => d.day);
  }

  private selectDay(d: Day): void {
    this.day = d;
    this.year = d.year;
    this.quarter = quarterOf(d);
    this.week = isoWeekOf(d);
  }

  /** The last hour of `d` that holds an entry (every present day has one). */
  private lastHourOf(d: Day): number {
    const counts = hourCounts(this.entries, d);
    for (let h = 23; h >= 0; h--) if (counts[h]! > 0) return h;
    return 0;
  }

  private countIn(test: (d: Day) => boolean): number {
    return this.days.filter((d) => test(d.day)).reduce((s, d) => s + d.count, 0);
  }

  /** The values on one wheel, from the selection to its left. */
  private values(seg: Segment): Value[] {
    const days = this.all();
    if (seg === 'year') {
      return yearsRange(days).map((y) => {
        const n = this.countIn((d) => d.year === y);
        return { key: String(y), label: String(y), aria: `${y}, ${plural(n)}`, count: n };
      });
    }
    if (seg === 'quarter') {
      if (this.year === null) return [];
      return quartersOfYear(this.year).map((q) => {
        const n = this.countIn((d) => quarterKey(quarterOf(d)) === quarterKey(q));
        return { key: quarterKey(q), label: `Q${q.q}`, aria: `Q${q.q}, ${q.year} Q${q.q}, ${plural(n)}`, count: n };
      });
    }
    if (seg === 'week') {
      const q = this.quarter;
      if (!q) return [];
      return weeksOfQuarter(q).map((w) => {
        const n = this.countIn((d) => quarterKey(quarterOf(d)) === quarterKey(q) && weekKey(isoWeekOf(d)) === weekKey(w));
        return { key: weekKey(w), label: `W${w.week}`, aria: `W${w.week}, week ${w.week} of ${w.isoYear}, ${plural(n)}`, count: n };
      });
    }
    if (seg === 'day') {
      if (!this.quarter || !this.week) return [];
      return daysOfWeekInQuarter(this.week, this.quarter).map((d) => {
        const n = this.days.find((x) => dayKey(x.day) === dayKey(d))?.count ?? 0;
        return {
          key: dayKey(d),
          label: `${dayName(d).slice(0, 3)} ${d.day}`,
          aria: `${dayName(d).slice(0, 3)} ${d.day}, ${dayName(d)} ${d.day} ${MONTH_NAMES[d.month - 1]} ${d.year}, ${plural(n)}`,
          count: n,
        };
      });
    }
    const d = this.day;
    if (!d) return [];
    return hourCounts(this.entries, d).map((n, h) => ({
      key: String(h),
      label: `${p2(h)}:00`,
      aria: `${p2(h)}:00 UTC, ${plural(n)}`,
      count: n,
      href: calendarHref({ level: 'hour', year: d.year, month: d.month, day: d.day, hour: h }),
    }));
  }

  /** The selected value's key on a wheel. */
  private selectedKey(seg: Segment): string | null {
    if (seg === 'year') return this.year === null ? null : String(this.year);
    if (seg === 'quarter') return this.quarter && quarterKey(this.quarter);
    if (seg === 'week') return this.week && weekKey(this.week);
    if (seg === 'day') return this.day && dayKey(this.day);
    return this.hour === null ? null : String(this.hour);
  }

  /** The last value holding an entry, else the last value (a range with nothing in it lands on its end). */
  private lastWithEntries<T>(vals: T[], countOf: (v: T) => number): T {
    for (let i = vals.length - 1; i >= 0; i--) if (countOf(vals[i]!) > 0) return vals[i]!;
    return vals[vals.length - 1]!;
  }

  /** Set one wheel's value by its index, and re-pick every wheel to its right (the last holding an entry in each, else the last). */
  private setIndex(seg: Segment, i: number): void {
    if (seg === 'hour') {
      this.hour = i;
      return;
    }
    let quarter = this.quarter!;
    let week = this.week!;
    let day = this.day!;
    if (seg === 'year') {
      this.year = yearsRange(this.all())[i]!;
      quarter = this.lastWithEntries(quartersOfYear(this.year), (q) =>
        this.countIn((d) => quarterKey(quarterOf(d)) === quarterKey(q)),
      );
      this.quarter = quarter;
    } else if (seg === 'quarter') {
      quarter = quartersOfYear(this.year!)[i]!;
      this.quarter = quarter;
    }
    if (seg === 'year' || seg === 'quarter') {
      week = this.lastWithEntries(weeksOfQuarter(quarter), (w) =>
        this.countIn((d) => quarterKey(quarterOf(d)) === quarterKey(quarter) && weekKey(isoWeekOf(d)) === weekKey(w)),
      );
      this.week = week;
    } else if (seg === 'week') {
      week = weeksOfQuarter(quarter)[i]!;
      this.week = week;
    }
    if (seg === 'day') {
      day = daysOfWeekInQuarter(week, quarter)[i]!;
    } else {
      day = this.lastWithEntries(daysOfWeekInQuarter(week, quarter), (d) =>
        this.days.find((x) => dayKey(x.day) === dayKey(d))?.count ?? 0,
      );
    }
    this.day = day;
    this.hour = this.lastHourOf(day);
  }

  /**
   * Spin wheel `seg` by `step` among its values. Returns whether it moved
   * (false at either end), so the scroll wheel only claims the scroll when
   * the wheel did something.
   */
  move(seg: Segment, step: number): boolean {
    const vals = this.values(seg);
    const cur = vals.findIndex((v) => v.key === this.selectedKey(seg));
    if (cur < 0) return false;
    const next = Math.min(vals.length - 1, Math.max(0, cur + step));
    if (next === cur) return false;
    this.setIndex(seg, next);
    this.render();
    this.spun();
    return true;
  }

  /** Center a value on a wheel (a click). */
  private pick(seg: Segment, i: number): void {
    const vals = this.values(seg);
    if (vals[i]?.key === this.selectedKey(seg)) return;
    this.setIndex(seg, i);
    this.render();
    this.refocus(seg);
    this.spun();
  }

  /** A move happened: report the passing moment, and (re)start the settle wait. */
  private spun(): void {
    const m = this.moment();
    if (m) this.opts.onSpin?.(m);
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      const at = this.moment();
      if (at) this.opts.onSettle?.(at);
    }, this.opts.settleMs ?? SETTLE_MS);
  }

  /** Can wheel `seg` move one step in `dir` (+1 / -1)? */
  private canMove(seg: Segment, dir: number): boolean {
    const vals = this.values(seg);
    const cur = vals.findIndex((v) => v.key === this.selectedKey(seg));
    return cur >= 0 && cur + dir >= 0 && cur + dir < vals.length;
  }

  private refocus(seg: Segment): void {
    this.drums.get(seg)?.querySelector<HTMLElement>('.drum-value[data-selected="true"]')?.focus();
  }

  private setHover(seg: Segment | null): void {
    this.hovered = seg;
    for (const [s, drum] of this.drums) {
      if (s === seg) drum.dataset.hover = 'true';
      else delete drum.dataset.hover;
    }
  }

  /** Build (or patch in place, so it spins) every wheel from the selection. */
  render(): void {
    for (const seg of SEGMENTS) {
      const vals = this.values(seg);
      const old = this.drums.get(seg);
      const keys = signature(vals);
      if (old && old.dataset.keys === keys && keys !== '') {
        this.patch(old, seg, vals);
        continue;
      }
      const fresh = this.drum(seg, vals);
      if (old) old.replaceWith(fresh);
      else this.row.appendChild(fresh);
      this.drums.set(seg, fresh);
    }
  }

  private drum(seg: Segment, vals: Value[]): HTMLElement {
    const drum = el('div', 'drum');
    drum.setAttribute('role', 'group');
    drum.dataset.seg = seg;
    drum.dataset.keys = signature(vals);
    if (this.hovered === seg) drum.dataset.hover = 'true';
    drum.appendChild(el('h3', 'drum-head', HEADS[seg]));
    const win = el('div', 'drum-window');
    drum.appendChild(win);
    if (vals.length === 0) {
      drum.dataset.empty = 'true';
      win.appendChild(el('p', 'empty-state', 'Nothing in the record for this wheel.'));
      drum.setAttribute('aria-label', `${HEADS[seg]}: nothing in the record`);
      return drum;
    }
    const reel = el('div', 'drum-reel');
    reel.setAttribute('role', 'group');
    vals.forEach((v, i) => {
      const item = v.href ? el('a', 'drum-value') : el('button', 'drum-value');
      if (v.href) item.setAttribute('href', v.href);
      else (item as HTMLButtonElement).type = 'button';
      item.dataset.key = v.key;
      item.dataset.index = String(i);
      item.dataset.has = String(v.count > 0);
      item.setAttribute('aria-label', v.aria);
      item.title = v.aria;
      item.textContent = v.label;
      if (!v.href) item.addEventListener('click', () => this.pick(seg, i));
      else {
        // The hour already open: no second history entry, no remount.
        item.addEventListener('click', (e) => {
          if (v.href === normalPath(stripBase(window.location.pathname))) {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      }
      reel.appendChild(item);
    });
    win.appendChild(reel);

    drum.addEventListener('mouseenter', () => this.setHover(seg));
    drum.addEventListener('mouseleave', () => this.setHover(null));
    drum.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        // Ctrl + wheel is the browser's zoom (and a trackpad pinch): never claimed.
        if (e.deltaY === 0 || e.ctrlKey) return;
        const dir = e.deltaY > 0 ? 1 : -1;
        // At an end the page scrolls: the wheel claims nothing.
        if (!this.canMove(seg, dir)) {
          this.wheelGather.set(seg, 0);
          return;
        }
        e.preventDefault();
        const px = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
        // A notch is a step (a line counts 20px, so a 3-line notch is one); small
        // trackpad deltas gather until they make one.
        // A gather goes stale after a quiet moment: an old scroll never adds to a new one.
        const now = Date.now();
        const prev = now - (this.wheelAt.get(seg) ?? 0) > GATHER_QUIET_MS ? 0 : this.wheelGather.get(seg) ?? 0;
        this.wheelAt.set(seg, now);
        let gathered = Math.abs(px) >= STEP_PX ? px : prev + px;
        if (Math.sign(gathered) !== dir) gathered = px;
        // At most one step per event, however large the delta.
        if (Math.abs(gathered) >= STEP_PX) {
          gathered = 0;
          this.move(seg, dir);
        }
        this.wheelGather.set(seg, gathered);
      },
      { passive: false },
    );
    // Keyboard twin: arrows spin the focused wheel, Home / End jump to its ends.
    drum.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const step =
        e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1
        : e.key === 'Home' ? -Infinity
        : e.key === 'End' ? Infinity
        : 0;
      if (step === 0) return;
      e.preventDefault();
      const n = this.values(seg).length;
      if (this.move(seg, Math.max(-n, Math.min(n, step)))) this.refocus(seg);
    });
    this.patch(drum, seg, vals);
    return drum;
  }

  /** Center the selection and fade the rest by distance; a CSS transition makes it spin. */
  private patch(drum: HTMLElement, seg: Segment, vals: Value[]): void {
    const sel = Math.max(0, vals.findIndex((v) => v.key === this.selectedKey(seg)));
    const reel = drum.querySelector<HTMLElement>('.drum-reel');
    if (!reel) return;
    reel.style.setProperty('--sel', String(sel));
    const v = vals[sel]!;
    drum.setAttribute('aria-label', `${HEADS[seg]}: ${v.aria}`);
    const lockedOn = seg === 'hour' && this.lockedHour !== null && this.lockedDay !== null && this.day !== null && dayKey(this.lockedDay) === dayKey(this.day);
    for (const item of reel.querySelectorAll<HTMLElement>('.drum-value')) {
      const i = Number(item.dataset.index);
      const d = i - sel;
      item.style.setProperty('--d', String(d));
      item.style.setProperty('--fade', String(fadeAt(d)));
      item.dataset.selected = String(d === 0);
      if (Math.abs(d) > DRUM_REACH) item.dataset.far = 'true';
      else delete item.dataset.far;
      // One Tab stop per wheel: its centered value.
      item.tabIndex = d === 0 ? 0 : -1;
      if (item.tagName === 'BUTTON') item.setAttribute('aria-pressed', String(d === 0));
      if (lockedOn && i === this.lockedHour) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    }
  }
}
