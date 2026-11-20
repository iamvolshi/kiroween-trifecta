/**
 * The KTIE page: its header, the heatmap, hour rows, the knowledge-state
 * snapshot, the time tree as drums and the folder under them. Every value
 * comes from the record stub (a test double), never from the app.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { CalendarView, KTIE_ZONE_KEY, renderSnapshot } from './calendar.ts';
import { CalendarRail, DRUM_FADE, SEGMENTS, type Moment } from './calendar-rail.ts';
import { Router } from '../router/router.ts';
import { createLiveAdapter, NO_ADDRESS_ERROR } from '../adapter/live.ts';
import { daysWithEntries, entriesInHour } from '../util/calendar.ts';
import { isoWeekOf } from '../util/rail.ts';
import type { Entry, SeamAdapter } from '../adapter/seam.ts';
import { createRecordStub, makeEntry, tick } from '../test-helpers.ts';

// Test data: Wed 18 Nov 2026 (W47, Q4) and Tue 3 Mar 2026 (W10, Q1).
const at = (iso: string, id: string, extra: Partial<Entry> = {}): Entry =>
  makeEntry({ id, k_start: iso, t_time: iso, k_time: '', e_time: '', subject: 'turn', ...extra });
const ENTRIES: Entry[] = [
  at('2026-03-03T08:00:00.000Z', 'm1'),
  at('2026-11-18T14:05:00.000Z', 'n1', { reason: 'user turn (connector)' }),
  at('2026-11-18T14:06:00.000Z', 'n2', { reason: 'Frankenstein reply turn' }),
  at('2026-11-18T14:40:00.000Z', 'n3'),
  at('2026-11-18T16:00:00.000Z', 'n4'),
  at('2026-11-17T09:00:00.000Z', 'n5'),
];

/** A stub whose belief pool is every entry written by the moment (open intervals). */
function stub(entries: Entry[]): SeamAdapter {
  return createRecordStub(entries, {
    fetchBeliefPool: async (m: number) => ({ ok: true, data: entries.filter((e) => Date.parse(e.k_start) <= m) }),
  });
}

let root: HTMLElement;
let view: CalendarView | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
  root?.remove();
  // The zone persists for the session; a test that flips it cleans up after
  // itself so the next test starts on UTC.
  window.sessionStorage.removeItem(KTIE_ZONE_KEY);
});

async function mount(target: ConstructorParameters<typeof CalendarView>[1], adapter = stub(ENTRIES), settleMs?: number, timeZone?: string): Promise<void> {
  root = document.createElement('div');
  document.body.appendChild(root);
  view = new CalendarView(adapter, target, settleMs, timeZone);
  view.mount(root);
  for (let i = 0; i < 4; i++) await tick();
}

describe('month heatmap', () => {
  it('intensity follows the live per-day counts; empty days are plain', async () => {
    await mount({ level: 'month', year: 2026, month: 11 });
    const counts = daysWithEntries(ENTRIES, 2026, 11);
    expect([...counts.entries()].sort()).toEqual([[17, 1], [18, 4]]);
    const heat = (day: number): string | undefined =>
      [...root.querySelectorAll<HTMLElement>('.calendar-grid td')].find((td) => td.querySelector('.day-link')?.textContent === String(day))?.dataset.heat;
    expect(heat(18)).toBe('4'); // the busiest day
    expect(heat(17)).toBe('1'); // 1 of 4
    expect(heat(16)).toBeUndefined();
    expect(root.querySelectorAll('.calendar-grid td[data-heat]')).toHaveLength(2);
    expect(root.querySelector('.calendar-grid td[data-heat="4"] .day-count')?.textContent).toBe('4');
  });

  it('an empty month has no marks', async () => {
    await mount({ level: 'month', year: 2026, month: 6 });
    expect(root.querySelectorAll('.calendar-grid td[data-heat]')).toHaveLength(0);
    expect(root.querySelectorAll('.day-count')).toHaveLength(0);
  });
});

describe('day view', () => {
  it('24 hour rows with live counts only where n > 0', async () => {
    await mount({ level: 'day', year: 2026, month: 11, day: 18 });
    const rows = [...root.querySelectorAll('.hour-list li')];
    expect(rows).toHaveLength(24);
    const counted = rows
      .map((li, h) => [h, li.querySelector('.hour-count')?.textContent ?? null] as const)
      .filter(([, c]) => c !== null);
    expect(counted).toEqual([[14, ' (3)'], [16, ' (1)']]);
  });
});

describe('hour view snapshot', () => {
  it('its counts match the two logs below it', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 });
    const snap = root.querySelector('.knowledge-state')!;
    expect(snap.textContent).toBe('14:00 UTC · recorded 3 · live 2 · masks: Frankenstein');
    const didLines = root.querySelectorAll('.hour-did .log-line').length;
    const poolLines = root.querySelectorAll('.hour-believed .log-line').length;
    expect(snap.getAttribute('data-recorded')).toBe(String(didLines));
    expect(snap.getAttribute('data-live')).toBe(String(poolLines));
    expect(didLines).toBe(entriesInHour(ENTRIES, 2026, 11, 18, 14).length);
    expect(poolLines).toBe(2); // m1 + n5: written before 14:00
    expect(snap.getAttribute('data-masks')).toBe('Frankenstein'); // named in a reason of the hour
    // The snapshot sits above the two logs.
    const order = [...root.querySelectorAll('.knowledge-state, .hour-did, .hour-believed')].map((s) => s.className);
    expect(order).toEqual(['knowledge-state log-head', 'hour-did log-block', 'hour-believed log-block']);
  });

  it('names no mask when no reason names one', () => {
    const snap = renderSnapshot(
      [at('2026-11-18T14:05:00.000Z', 'x', { reason: 'user turn (connector)' })],
      [],
      { year: 2026, month: 11, day: 18, hour: 14 },
      'utc',
      'UTC',
    );
    expect(snap.getAttribute('data-masks')).toBe('none named');
    expect(snap.getAttribute('data-live')).toBe('0');
  });

  it('names the mask from the evidence when the reason carries none (live loop shape)', () => {
    // Live loop: reason "assistant turn (reply)", mask name in evidence.
    const snap = renderSnapshot(
      [at('2026-11-18T14:05:00.000Z', 'x', { reason: 'assistant turn (reply)', evidence: 'Frankenstein' })],
      [],
      { year: 2026, month: 11, day: 18, hour: 14 },
      'utc',
      'UTC',
    );
    expect(snap.getAttribute('data-masks')).toBe('Frankenstein');
  });

  it('reads the hour in local time when the switch is on local', () => {
    const snap = renderSnapshot(
      [at('2026-11-18T14:05:00.000Z', 'x', { reason: 'user turn (connector)' })],
      [],
      { year: 2026, month: 11, day: 18, hour: 14 },
      'local',
      'America/New_York',
    );
    expect(snap.textContent).toContain('09:00 Local');
    expect(snap.textContent).not.toContain('14:00');
  });
});

describe('UTC / Local switch', () => {
  it('UTC by default; Local translates the cursor, the snapshot, the log times and the caption', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 }, stub(ENTRIES), undefined, 'America/New_York');
    const cursor = (): string => root.querySelector('.cursor-display')!.textContent!;
    const snap = (): string => root.querySelector('.knowledge-state')!.textContent!;
    const firstDid = (): string => root.querySelector('.hour-did .log-line')!.textContent!;
    const caption = (): string => root.querySelector('.ktie-folder-caption')!.textContent!;

    // UTC is the record's time, and the default.
    expect(cursor()).toBe('Moment (UTC): 2026-11-18T14:00');
    expect(snap()).toContain('14:00 UTC');
    expect(firstDid()).toContain('14:05:00');
    expect(caption()).toContain('14:00 UTC');
    const buttons = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['UTC', 'Local']);
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false');

    // Flip to local: the same moment, the same entries, a new clock.
    buttons[1]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(cursor()).toBe('Moment (Local): 2026-11-18T09:00');
    expect(snap()).toContain('09:00 Local');
    expect(snap()).not.toContain('14:00');
    expect(firstDid()).toContain('09:05:00');
    expect(caption()).toContain('09:00 Local');
    expect(caption()).toContain('3 entries');

    // Flip back: UTC again.
    const back = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    back[0]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(cursor()).toBe('Moment (UTC): 2026-11-18T14:00');
    expect(snap()).toContain('14:00 UTC');
    expect(firstDid()).toContain('14:05:00');
  });

  it('a UTC moment past midnight reads the day before in local time', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 21, hour: 2 }, stub(ENTRIES), undefined, 'America/New_York');
    const buttons = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    buttons[1]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(root.querySelector('.cursor-display')!.textContent).toBe('Moment (Local): 2026-11-20T21:00');
  });
});

describe('the drums follow the UTC / Local switch', () => {
  it('flip to local: the drums read local, the hour links still name the UTC hour', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 }, stub(ENTRIES), undefined, 'America/New_York');
    expect(readout(root)).toEqual(['2026', 'Q4', 'W47', 'Wed 18', '14:00']);
    expect(wheel(root, 'hour').querySelector('.drum-head')?.textContent).toBe('Hours (UTC)');
    const buttons = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    buttons[1]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(readout(root)).toEqual(['2026', 'Q4', 'W47', 'Wed 18', '09:00']);
    expect(wheel(root, 'hour').querySelector('.drum-head')?.textContent).toBe('Hours (Local)');
    const h9 = wheel(root, 'hour').querySelector<HTMLElement>('.drum-value[data-key="9"]')!;
    expect(h9.getAttribute('aria-label')).toBe('09:00 Local, 3 entries');
    expect(h9.getAttribute('href')).toBe('/calendar/2026-11-18/14');
    // The folder still reads the same UTC hour, in local time.
    expect(root.querySelector('.cursor-display')!.textContent).toBe('Moment (Local): 2026-11-18T09:00');
    expect(root.querySelector('.knowledge-state')!.textContent).toContain('09:00 Local');
  });

  it('a local spin settles on the UTC hour it reads as', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 }, stub(ENTRIES), 20, 'America/New_York');
    const buttons = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    buttons[1]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(centered(root, 'hour')).toBe('09:00');
    const hourWheel = root.querySelector<HTMLElement>('.drum[data-seg="hour"]')!;
    spin(hourWheel, 100); // 09:00 -> 10:00 local
    spin(hourWheel, 100); // -> 11:00 local
    expect(centered(root, 'hour')).toBe('11:00');
    await wait(120);
    for (let i = 0; i < 4; i++) await tick();
    // 11:00 local is 16:00 UTC: the folder reads the record's hour (n4, the
    // 16:00 UTC entry), shows it on the local clock, and the address stays
    // UTC — that address is the conversion's proof.
    expect(root.querySelector('.cursor-display')!.textContent).toBe('Moment (Local): 2026-11-18T11:00');
    expect(root.querySelector('.knowledge-state')?.textContent).toContain('11:00 Local');
    expect(root.querySelector('.knowledge-state')?.textContent).toContain('recorded 1');
    expect(root.querySelector('.ktie-folder-caption')?.textContent).toBe('Folder: 2026-11-18 \u00b7 11:00 Local \u00b7 1 entry');
    expect(window.location.pathname).toBe('/calendar/2026-11-18/16');
  });

  it('a UTC moment past midnight reads the day before on the drums too', async () => {
    const entries = [...ENTRIES, at('2026-11-21T02:00:00.000Z', 'd1')];
    await mount({ level: 'hour', year: 2026, month: 11, day: 21, hour: 2 }, stub(entries), undefined, 'America/New_York');
    expect(readout(root)).toEqual(['2026', 'Q4', 'W47', 'Sat 21', '02:00']);
    const buttons = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    buttons[1]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(readout(root)).toEqual(['2026', 'Q4', 'W47', 'Fri 20', '21:00']);
    const h21 = wheel(root, 'hour').querySelector<HTMLElement>('.drum-value[data-key="21"]')!;
    expect(h21.getAttribute('href')).toBe('/calendar/2026-11-21/02');
    expect(h21.getAttribute('aria-label')).toBe('21:00 Local, 1 entry');
  });

  it('the zone holds across mounts: a fresh view opens on local', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 }, stub(ENTRIES), undefined, 'America/New_York');
    const buttons = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    buttons[1]!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(centered(root, 'hour')).toBe('09:00');
    // A fresh view (a new hour opened next) reads the stored zone.
    view!.unmount();
    view = null;
    root.remove();
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 }, stub(ENTRIES), undefined, 'America/New_York');
    const again = [...root.querySelectorAll<HTMLElement>('.zone-switch button')];
    expect(again[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(centered(root, 'hour')).toBe('09:00');
    expect(wheel(root, 'hour').querySelector('.drum-head')?.textContent).toBe('Hours (Local)');
  });
});

const NOV18 = { year: 2026, month: 11, day: 18 };
// A second year, so the Years wheel has two values: Sat 6 Dec 2025 (2025-Q4, W49).
const TWO_YEARS: Entry[] = [...ENTRIES, at('2025-12-06T20:00:00.000Z', 'y1'), at('2025-12-06T21:30:00.000Z', 'y2')];

const wheel = (r: CalendarRail | HTMLElement, seg: string): HTMLElement =>
  ('root' in r ? r.root : r).querySelector<HTMLElement>(`.drum[data-seg="${seg}"]`)!;
const labels = (r: CalendarRail | HTMLElement, seg: string): string[] =>
  [...wheel(r, seg).querySelectorAll('.drum-value')].map((v) => v.textContent!);
const centered = (r: CalendarRail | HTMLElement, seg: string): string | null =>
  wheel(r, seg).querySelector('.drum-value[data-selected="true"]')?.textContent ?? null;
const readout = (r: CalendarRail | HTMLElement): Array<string | null> => SEGMENTS.map((s) => centered(r, s));
const spin = (target: Element, deltaY: number): WheelEvent => {
  const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};
const key = (target: Element, k: string, mods: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods });
  target.dispatchEvent(e);
  return e;
};
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('the KTIE header', () => {
  it('the page top is KTIE over "Knowledge Time Indexing Engine" and nothing else', async () => {
    await mount({ level: 'month', year: 2026, month: 11 });
    const head = root.querySelector('.ktie-head')!;
    expect(head.querySelector('h1')?.textContent).toBe('KTIE');
    expect(head.querySelector('h1')?.classList.contains('ktie-name')).toBe(true);
    expect(head.querySelector('.ktie-expansion')?.textContent).toBe('Knowledge Time Indexing Engine');
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    // No helper line at all: the page teaches nothing, the drums are
    // the navigation.
    expect(root.querySelector('.view-intro')).toBeNull();
    // The header strip still reads "View: Calendar": the body carries
    // the data-view the intro used to carry.
    expect(root.querySelector('.calendar-view')?.getAttribute('data-view')).toBe('Calendar');
    expect(root.textContent).not.toContain('KATIE');
  });
});

describe('the drums', () => {
  it('five wheels, left to right: Years, Quarters, Weeks, Days, Hours', () => {
    const r = new CalendarRail(TWO_YEARS, NOV18, null);
    const drums = [...r.root.querySelectorAll<HTMLElement>('.drum')];
    expect(drums.map((d) => d.dataset.seg)).toEqual(['year', 'quarter', 'week', 'day', 'hour']);
    expect(drums.map((d) => d.querySelector('.drum-head')?.textContent)).toEqual(['Years', 'Quarters', 'Weeks', 'Days', 'Hours (UTC)']);
    // Every wheel holds its full range; the counts say what the record holds.
    expect(labels(r, 'year')).toEqual(['2024', '2025', '2026', '2027']);
    expect(labels(r, 'quarter')).toEqual(['Q1', 'Q2', 'Q3', 'Q4']); // all four quarters of 2026
    expect(labels(r, 'week')).toEqual(['W40', 'W41', 'W42', 'W43', 'W44', 'W45', 'W46', 'W47', 'W48', 'W49', 'W50', 'W51', 'W52', 'W53']);
    expect(labels(r, 'day')).toEqual(['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22']);
    expect(labels(r, 'hour')).toHaveLength(24);
    // The readout: the newest moment holding an entry.
    expect(readout(r)).toEqual(['2026', 'Q4', 'W47', 'Wed 18', '16:00']);
  });

  it('the centered value is solid; its neighbours fade with distance; far ones hide', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    const hours = [...wheel(r, 'hour').querySelectorAll<HTMLElement>('.drum-value')];
    const fade = (h: number): string => hours[h]!.style.getPropertyValue('--fade');
    expect(hours[14]!.dataset.selected).toBe('true');
    expect([fade(14), fade(13), fade(15), fade(12), fade(16), fade(11), fade(17)]).toEqual(
      ['1', '0.55', '0.55', '0.3', '0.3', '0.14', '0.14'],
    );
    expect(Number(fade(14))).toBe(DRUM_FADE[0]);
    expect(fade(10)).toBe('0');
    expect(hours[10]!.dataset.far).toBe('true');
    expect(hours[11]!.dataset.far).toBe('true');
    expect(hours[12]!.dataset.far).toBeUndefined();
    expect(hours[13]!.style.getPropertyValue('--d')).toBe('-1');
    expect(wheel(r, 'hour').querySelector<HTMLElement>('.drum-reel')!.style.getPropertyValue('--sel')).toBe('14');
    // One Tab stop per wheel: the centered value.
    expect(hours.filter((h) => h.tabIndex === 0)).toEqual([hours[14]]);
    const quarters = [...wheel(r, 'quarter').querySelectorAll<HTMLButtonElement>('.drum-value')];
    expect(quarters.map((q) => q.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true']);
    expect(r.root.getAttribute('role')).toBe('group');
    expect(wheel(r, 'hour').getAttribute('role')).toBe('group');
  });

  it('counts ride in the labels; nothing is invented', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    const h14 = wheel(r, 'hour').querySelector<HTMLElement>('.drum-value[data-key="14"]')!;
    expect(h14.getAttribute('aria-label')).toBe('14:00 UTC, 3 entries');
    expect(h14.title).toBe('14:00 UTC, 3 entries');
    expect(wheel(r, 'hour').querySelector('.drum-value[data-key="3"]')?.getAttribute('data-has')).toBe('false');
    expect(wheel(r, 'day').getAttribute('aria-label')).toBe('Days: Wed 18, Wednesday 18 November 2026, 4 entries');
    // Label in name: every value's spoken label starts with what it shows.
    for (const v of r.root.querySelectorAll<HTMLElement>('.drum-value')) {
      expect(v.getAttribute('aria-label')!.startsWith(v.textContent!)).toBe(true);
    }
    expect(r.root.style.getPropertyValue('--drum-reach')).toBe('2');
    expect(wheel(r, 'year').querySelector('.drum-value[data-key="2026"]')?.getAttribute('aria-label')).toBe('2026, 6 entries');
  });

  it('a year pick cascades to its last quarter, week, day and hour', () => {
    const r = new CalendarRail(TWO_YEARS, NOV18, null);
    document.body.appendChild(r.root);
    wheel(r, 'year').querySelector<HTMLButtonElement>('.drum-value[data-key="2025"]')!.click();
    expect(readout(r)).toEqual(['2025', 'Q4', 'W49', 'Sat 6', '21:00']);
    expect(labels(r, 'quarter')).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    r.root.remove();
  });

  it('the scroll wheel spins only the hovered wheel; the wheels to its right follow', () => {
    const r = new CalendarRail(TWO_YEARS, NOV18, null);
    document.body.appendChild(r.root);
    wheel(r, 'quarter').dispatchEvent(new MouseEvent('mouseenter'));
    expect(SEGMENTS.map((s) => wheel(r, s).dataset.hover ?? null)).toEqual([null, 'true', null, null, null]);
    expect(spin(wheel(r, 'quarter'), -100).defaultPrevented).toBe(true);
    // Q4 -> Q3 of 2026: the week, day and hour re-derive; the year to its left stays.
    // Q3 holds no entries, so the wheels land on its end (W40, Wed 30, 00:00).
    expect(readout(r)).toEqual(['2026', 'Q3', 'W40', 'Wed 30', '00:00']);
    expect(wheel(r, 'quarter').dataset.hover).toBe('true'); // hover survives the spin
    expect(isoWeekOf({ year: 2026, month: 3, day: 3 }).week).toBe(10);
    r.root.remove();
  });

  it('the wheel claims the scroll only when it moved: at an end the page scrolls', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 23);
    document.body.appendChild(r.root);
    expect(spin(wheel(r, 'hour'), 100).defaultPrevented).toBe(false); // 23:00 is the end
    expect(spin(wheel(r, 'hour'), -100).defaultPrevented).toBe(true);
    expect(centered(r, 'hour')).toBe('22:00');
    expect(spin(wheel(r, 'quarter'), 100).defaultPrevented).toBe(false); // Q4 is the newest
    expect(r.move('quarter', 1)).toBe(false);
    r.root.remove();
  });

  it('Ctrl + wheel (zoom, a pinch) is never claimed', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    document.body.appendChild(r.root);
    const e = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    wheel(r, 'hour').dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(centered(r, 'hour')).toBe('14:00');
    r.root.remove();
  });

  it('line and page wheel deltas step too; a gather resets on a direction change', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    document.body.appendChild(r.root);
    wheel(r, 'hour').dispatchEvent(new WheelEvent('wheel', { deltaY: 3, deltaMode: 1, bubbles: true, cancelable: true })); // 3 lines
    expect(centered(r, 'hour')).toBe('15:00');
    wheel(r, 'hour').dispatchEvent(new WheelEvent('wheel', { deltaY: 1, deltaMode: 2, bubbles: true, cancelable: true })); // a page
    expect(centered(r, 'hour')).toBe('16:00');
    spin(wheel(r, 'hour'), 40);
    spin(wheel(r, 'hour'), -40); // the other way: the 40 down is dropped, not netted
    spin(wheel(r, 'hour'), -10);
    expect(centered(r, 'hour')).toBe('15:00');
    r.root.remove();
  });

  it('small trackpad deltas gather into one step', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    document.body.appendChild(r.root);
    for (let i = 0; i < 4; i++) spin(wheel(r, 'hour'), 10);
    expect(centered(r, 'hour')).toBe('14:00'); // 40px: not yet a step
    spin(wheel(r, 'hour'), 10);
    expect(centered(r, 'hour')).toBe('15:00');
    r.root.remove();
  });

  it('a spin patches the spun wheel in place (so it turns) and rebuilds only the wheels it changed', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    document.body.appendChild(r.root);
    const hourReel = wheel(r, 'hour').querySelector('.drum-reel');
    expect(r.move('hour', 1)).toBe(true);
    expect(wheel(r, 'hour').querySelector('.drum-reel')).toBe(hourReel);
    const dayWheel = wheel(r, 'day');
    expect(r.move('day', -1)).toBe(true);
    expect(wheel(r, 'day')).toBe(dayWheel); // same days: patched
    expect(readout(r)).toEqual(['2026', 'Q4', 'W47', 'Tue 17', '09:00']);
    r.root.remove();
  });

  it('a day change rebuilds the hour wheel: its links, counts and labels follow the new day', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    document.body.appendChild(r.root);
    expect(r.move('day', -1)).toBe(true); // Wed 18 -> Tue 17
    const h9 = wheel(r, 'hour').querySelector<HTMLAnchorElement>('a.drum-value[data-key="9"]')!;
    expect(h9.getAttribute('href')).toBe('/calendar/2026-11-17/09');
    expect(h9.getAttribute('aria-label')).toBe('09:00 UTC, 1 entry');
    expect(wheel(r, 'hour').querySelector('a.drum-value[data-key="14"]')?.getAttribute('data-has')).toBe('false');
    r.root.remove();
  });

  it('keyboard twin: arrows spin the focused wheel and keep focus on its centered value', () => {
    const r = new CalendarRail(TWO_YEARS, NOV18, null);
    document.body.appendChild(r.root);
    const q4 = wheel(r, 'quarter').querySelector<HTMLElement>('.drum-value[data-selected="true"]')!;
    q4.focus();
    key(q4, 'ArrowUp');
    expect((document.activeElement as HTMLElement).textContent).toBe('Q3');
    expect(document.activeElement?.getAttribute('aria-pressed')).toBe('true');
    key(document.activeElement!, 'ArrowDown');
    expect((document.activeElement as HTMLElement).textContent).toBe('Q4');
    key(document.activeElement!, 'ArrowLeft');
    expect((document.activeElement as HTMLElement).textContent).toBe('Q3');
    // Hours: Home / End jump to the wheel's ends.
    const h = wheel(r, 'hour').querySelector<HTMLElement>('.drum-value[data-selected="true"]')!;
    h.focus();
    key(h, 'End');
    expect((document.activeElement as HTMLElement).dataset.key).toBe('23');
    // Modified arrows are the browser's.
    expect(key(document.activeElement!, 'ArrowUp', { altKey: true }).defaultPrevented).toBe(false);
    expect(centered(r, 'hour')).toBe('23:00');
    r.root.remove();
  });

  it('an empty record: every wheel says so in words, no values', () => {
    const r = new CalendarRail([], null, null);
    expect(r.root.querySelectorAll('.drum-value')).toHaveLength(0);
    expect([...r.root.querySelectorAll('.drum .empty-state')].map((p) => p.textContent)).toEqual(
      Array(5).fill('Nothing in the record for this wheel.'),
    );
    expect(r.moment()).toBeNull();
  });

  it('the hour view\'s hour is marked current on the drums', () => {
    const r = new CalendarRail(ENTRIES, NOV18, 14);
    expect(wheel(r, 'hour').querySelector('.drum-value[aria-current="true"]')?.getAttribute('data-key')).toBe('14');
    expect(centered(r, 'hour')).toBe('14:00');
  });
});

describe('the drums and the hour view', () => {
  it('an hour on the drums is a link to the same hour view as the day list', async () => {
    window.history.replaceState({}, '', '/calendar/2026-11-18');
    root = document.createElement('div');
    document.body.appendChild(root);
    const router = new Router(stub(ENTRIES), root);
    for (let i = 0; i < 6; i++) await tick();
    const fromList = root.querySelectorAll<HTMLAnchorElement>('.hour-list .hour-link')[14]!.getAttribute('href');
    const h14 = root.querySelector<HTMLAnchorElement>('.ktie-drums .drum[data-seg="hour"] a.drum-value[data-key="14"]')!;
    expect(h14.getAttribute('href')).toBe(fromList);
    h14.click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/calendar/2026-11-18/14');
    expect(root.querySelector('.knowledge-state')?.textContent).toContain('14:00 UTC');
    // The hour view, with the drums above it.
    const order = [...root.querySelector('.calendar-view')!.children].map((c) => c.className);
    expect(order).toEqual(['calendar-rail ktie-drums', 'ktie-passing', 'sr-only ktie-landed', 'ktie-folder-caption', 'ktie-folder']);
    // The hour already open: clicking it again adds no history entry and keeps the view.
    const before = window.history.length;
    const viewEl = root.querySelector('.calendar-view');
    root.querySelector<HTMLAnchorElement>('.drum[data-seg="hour"] a.drum-value[data-key="14"]')!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(window.history.length).toBe(before);
    expect(root.querySelector('.calendar-view')).toBe(viewEl);
    router.destroy();
  });
});

describe('the folder under the drums', () => {
  it('holds while the drums spin, then lands on the settled moment', async () => {
    await mount({ level: 'month', year: 2026, month: 11 }, stub(ENTRIES), 200);
    const folder = root.querySelector<HTMLElement>('.ktie-folder')!;
    const passing = root.querySelector<HTMLElement>('.ktie-passing')!;
    expect(folder.querySelector('.calendar-grid')).not.toBeNull(); // the route's own content first
    expect(passing.hidden).toBe(true);
    const hourWheel = root.querySelector<HTMLElement>('.drum[data-seg="hour"]')!;
    spin(hourWheel, -100); // 16:00 -> 15:00
    spin(hourWheel, -100); // -> 14:00
    expect(folder.querySelector('.calendar-grid')).not.toBeNull(); // still spinning: the old folder stays
    expect(folder.dataset.spinning).toBe('true');
    expect(passing.hidden).toBe(false);
    expect(passing.textContent).toBe('2026-11-18 \u00b7 14:00 UTC \u00b7 3 entries');
    expect(folder.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.ktie-folder-caption')?.textContent).toBe('Folder: November 2026 (UTC)');
    await wait(20);
    expect(folder.querySelector('.calendar-grid')).not.toBeNull(); // not settled yet
    await wait(320);
    for (let i = 0; i < 4; i++) await tick();
    expect(folder.querySelector('.calendar-grid')).toBeNull();
    expect(folder.querySelector('.knowledge-state')?.textContent).toContain('14:00 UTC');
    expect(folder.querySelector('.hour-did')).not.toBeNull();
    expect(folder.querySelector('.hour-believed')).not.toBeNull();
    expect(folder.dataset.spinning).toBeUndefined();
    expect(folder.hasAttribute('aria-busy')).toBe(false);
    expect(passing.hidden).toBe(true);
    // The caption and the address follow the folder; no new history entry.
    expect(root.querySelector('.ktie-folder-caption')?.textContent).toBe('Folder: 2026-11-18 \u00b7 14:00 UTC \u00b7 3 entries');
    expect(root.querySelector('.ktie-landed')?.textContent).toBe('Folder: 2026-11-18 \u00b7 14:00 UTC \u00b7 3 entries');
    expect(window.location.pathname).toBe('/calendar/2026-11-18/14');
  });

  it('a settle whose read fails says so in the caption and leaves the address alone', async () => {
    window.history.replaceState({}, '', '/calendar');
    const base = stub(ENTRIES);
    const adapter: SeamAdapter = { ...base, fetchBeliefPool: async () => ({ ok: false as const, error: 'Connector unreachable: stub' }) };
    await mount({ level: 'month', year: 2026, month: 11 }, adapter, 20);
    spin(root.querySelector<HTMLElement>('.drum[data-seg="hour"]')!, -100);
    await wait(100);
    for (let i = 0; i < 4; i++) await tick();
    expect(root.querySelector('.ktie-folder .error-state')?.textContent).toBe('Connector unreachable: stub');
    expect(root.querySelector('.ktie-folder-caption')?.textContent).toBe('Folder: 2026-11-18 \u00b7 15:00 UTC \u00b7 0 entries, could not load');
    expect(window.location.pathname).toBe('/calendar');
  });

  it('unmount during a pending settle: nothing lands, no error, the timer is gone', async () => {
    window.history.replaceState({}, '', '/calendar');
    await mount({ level: 'month', year: 2026, month: 11 }, stub(ENTRIES), 40);
    spin(root.querySelector<HTMLElement>('.drum[data-seg="hour"]')!, -100);
    view!.unmount();
    view = null;
    await wait(120);
    expect(root.innerHTML).toBe('');
    expect(window.location.pathname).toBe('/calendar'); // the settle never ran
  });

  it('destroy() clears the settle timer', async () => {
    const settled: Moment[] = [];
    const r = new CalendarRail(ENTRIES, NOV18, 14, { onSettle: (m) => settled.push(m), settleMs: 20 });
    r.move('hour', 1);
    r.destroy();
    await wait(80);
    expect(settled).toEqual([]);
  });

  it('an hour route on a day with no entries: drums on the newest day of the month, no hour marked current', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 20, hour: 5 });
    expect(readout(root)).toEqual(['2026', 'Q4', 'W47', 'Wed 18', '16:00']);
    expect(root.querySelector('.drum-value[aria-current]')).toBeNull();
    expect(root.querySelector('.ktie-folder-caption')?.textContent).toBe('Folder: 2026-11-20 \u00b7 05:00 UTC');
    expect(root.querySelector('.knowledge-state')?.textContent).toContain('05:00 UTC');
  });

  it('every passing line names a real moment from the record', async () => {
    const seen: string[] = [];
    const r = new CalendarRail(ENTRIES, NOV18, 16, { onSpin: (m: Moment) => seen.push(`${m.day.day} ${m.hour} ${m.count}`), settleMs: 5 });
    document.body.appendChild(r.root);
    for (let i = 0; i < 3; i++) r.move('hour', -1);
    r.move('day', -1);
    expect(seen).toEqual(['18 15 0', '18 14 3', '18 13 0', '17 9 1']);
    for (const s of seen) {
      const [day, hour] = s.split(' ').map(Number);
      expect(day === 17 || day === 18).toBe(true);
      expect(hour! >= 0 && hour! < 24).toBe(true);
    }
    r.destroy();
    r.root.remove();
  });

  it('a newer spin drops an older folder load: no half-loaded folder', async () => {
    let release: () => void = () => {};
    const slow = new Promise<void>((res) => { release = res; });
    const base = stub(ENTRIES);
    const adapter: SeamAdapter = { ...base, fetchBeliefPool: async (m: number) => { await slow; return base.fetchBeliefPool(m); } };
    await mount({ level: 'month', year: 2026, month: 11 }, adapter, 20);
    const hourWheel = root.querySelector<HTMLElement>('.drum[data-seg="hour"]')!;
    spin(hourWheel, -100);
    await wait(80); // settled: the load starts and waits on the belief pool
    spin(hourWheel, -100); // spinning again before it lands (now 14:00)
    release();
    for (let i = 0; i < 10; i++) await Promise.resolve(); // the stale load finishes, timers not yet
    expect(root.querySelector('.ktie-folder .calendar-grid')).not.toBeNull(); // dropped: the old folder, untouched
    await wait(120);
    for (let i = 0; i < 4; i++) await tick();
    // The newer moment lands, never the stale 15:00 one.
    expect(root.querySelector('.ktie-folder .knowledge-state')?.textContent).toContain('14:00 UTC');
  });
});

describe('unreachable connector', () => {
  it('the calendar says so in words, drums included', async () => {
    await mount({ level: 'month', year: 2026, month: 11 }, createLiveAdapter(''));
    expect(root.textContent).toContain(NO_ADDRESS_ERROR);
    expect(root.querySelector('.ktie-drums')).toBeNull(); // nothing built from a failed read
    expect(root.querySelector('.ktie-head h1')?.textContent).toBe('KTIE');
  });
});

describe('one screen at 1024x768', () => {
  it('the fit rules are in the CSS: narrow drums, smaller title, shorter day cells, hours as a grid', async () => {
    // Vitest blanks CSS imports, so read the files from disk (run from audit-ui/; Node built-in, no new dependency).
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as unknown as { readFileSync(p: string, e: 'utf8'): string };
    const read = (f: string): string => fs.readFileSync(`src/${f}`, 'utf8');
    const rail = read('styles/calendar-rail.css');
    // At a 1024 screen the center column is ~617px, so the narrow drums
    // must fire there (48rem), not only under 44rem.
    expect(rail).toContain('@container (max-width: 48rem)');
    expect(rail).toContain('--drum-row: 2rem;');
    // The title drops a size and the gaps tighten at 1100px and under.
    expect(rail).toContain('@media (max-width: 1100px)');
    expect(rail).toContain('font-size: var(--t-headline-lg-size);');
    const cal = read('styles/calendar.css');
    // Shorter day cells at 1100px and under, so the month grid fits.
    expect(cal).toContain('height: 2.75rem;');
    // The day's 24 hours sit as a 6-column grid, not a long list.
    expect(cal).toContain('grid-template-columns: repeat(6, minmax(0, 1fr));');
    // The center's bottom padding tightens at 1100px and under.
    const sys = read('styles/stitch-system.css');
    expect(sys).toContain('padding-bottom: var(--s3);');
    // No page scroll: head and body share one full-height column, the
    // folder row takes what is left, and the folder is the box that
    // scrolls inside it when its content is taller than the screen.
    expect(rail).toContain('.ktie-page {');
    expect(rail).toContain('height: 100%;');
    expect(rail).toContain('grid-template-rows: auto auto auto minmax(0, 1fr);');
    expect(rail).toContain('overflow-y: auto;');
  });

  it('the page wraps head and body in one full-height column', async () => {
    await mount({ level: 'month', year: 2026, month: 11 });
    const page = root.querySelector('.ktie-page');
    expect(page).not.toBeNull();
    expect(page?.querySelector('.ktie-head')).not.toBeNull();
    expect(page?.querySelector('.calendar-view')).not.toBeNull();
  });
});
