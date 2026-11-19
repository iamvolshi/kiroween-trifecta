/**
 * The calendar face (visual direction from a reference mockup): heatmap,
 * hour rows, the knowledge-state snapshot and the tiered rail. Every value
 * comes from the record stub (a test double), never from the app.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { CalendarView, renderSnapshot } from './calendar.ts';
import { CalendarRail } from './calendar-rail.ts';
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
});

async function mount(target: ConstructorParameters<typeof CalendarView>[1], adapter = stub(ENTRIES)): Promise<void> {
  root = document.createElement('div');
  document.body.appendChild(root);
  view = new CalendarView(adapter, target);
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
  it('its counts match the two tables below it', async () => {
    await mount({ level: 'hour', year: 2026, month: 11, day: 18, hour: 14 });
    const snap = root.querySelector('.knowledge-state')!;
    expect(snap.querySelector('h2')?.textContent).toBe('Knowledge state at 14:00 UTC (hour #14 record closure)');
    expect(snap.querySelector('.knowledge-lede')?.textContent).toBe(
      'Everything recorded and believed by the agent in this 60-minute window.',
    );
    const stat = (k: string): string | null | undefined => snap.querySelector(`[data-stat="${k}"] dd`)?.textContent;
    const didRows = root.querySelectorAll('.hour-did tbody tr').length;
    const poolRows = root.querySelectorAll('.hour-believed tbody tr').length;
    expect(stat('recorded')).toBe(String(didRows));
    expect(stat('live')).toBe(String(poolRows));
    expect(didRows).toBe(entriesInHour(ENTRIES, 2026, 11, 18, 14).length);
    expect(poolRows).toBe(2); // m1 + n5: written before 14:00
    expect(stat('masks')).toBe('Frankenstein'); // named in a reason of the hour
    // The snapshot sits above the two tables.
    const order = [...root.querySelectorAll('.knowledge-state, .hour-did, .hour-believed')].map((s) => s.className);
    expect(order).toEqual(['knowledge-state', 'hour-did', 'hour-believed']);
  });

  it('names no mask when no reason names one', () => {
    const snap = renderSnapshot([at('2026-11-18T14:05:00.000Z', 'x', { reason: 'user turn (connector)' })], [], 14);
    expect(snap.querySelector('[data-stat="masks"] dd')?.textContent).toBe('None named');
    expect(snap.querySelector('[data-stat="live"] dd')?.textContent).toBe('0');
  });

  it('names the mask from the evidence when the reason carries none (live loop shape)', () => {
    // Live loop: reason "assistant turn (reply)", mask name in evidence.
    const snap = renderSnapshot(
      [at('2026-11-18T14:05:00.000Z', 'x', { reason: 'assistant turn (reply)', evidence: 'Frankenstein' })],
      [],
      14,
    );
    expect(snap.querySelector('[data-stat="masks"] dd')?.textContent).toBe('Frankenstein');
  });
});

describe('the rail', () => {
  const ticks = (rail: HTMLElement, tier: number): string[] =>
    [...rail.querySelectorAll(`.rail-tier[data-tier="${tier}"] .rail-tick`)].map((t) => t.querySelector('.rail-tick-label')!.textContent!);

  it('tiers hold only the quarters, weeks and days present in the loaded entries', () => {
    const rail = new CalendarRail(ENTRIES, { year: 2026, month: 11, day: 18 }, null).root;
    expect(ticks(rail, 1)).toEqual(['Q1', 'Q4']);
    expect(isoWeekOf({ year: 2026, month: 11, day: 18 }).week).toBe(47);
    expect(ticks(rail, 2)).toEqual(['W47']);
    expect(ticks(rail, 3)).toEqual(['17', '18']);
    expect(ticks(rail, 4)).toHaveLength(24);
    expect(rail.querySelector('.rail-tier[data-tier="1"] .rail-tier-head')?.textContent).toBe('Tier 1: Quarters (2026) \u2014 Q4');
    expect(rail.querySelector('.rail-tier[data-tier="2"] .rail-tier-head')?.textContent).toBe('Tier 2: Weeks of Q4 \u2014 Week 47');
    expect(rail.querySelector('.rail-tier[data-tier="3"] .rail-tier-head')?.textContent).toBe('Tier 3: Days (W47) \u2014 Wednesday 18 November');
    expect(rail.querySelectorAll('.rail-tier[data-tier="4"]')).toHaveLength(1); // the strip, once
  });

  it('a record with nothing shows NOT KNOWN on every tier, no ticks', () => {
    const rail = new CalendarRail([], null, null).root;
    expect(rail.querySelectorAll('.rail-tick')).toHaveLength(0);
    expect(rail.querySelectorAll('.rail-tier .empty-state')).toHaveLength(4);
  });

  it('the locked hour is marked Active with its live count', () => {
    const rail = new CalendarRail(ENTRIES, { year: 2026, month: 11, day: 18 }, 14).root;
    expect(rail.querySelector('.rail-tier[data-tier="4"] .rail-tier-head')?.textContent).toBe(
      'Tier 4: 24-hour strip (Nov 18) \u2014 Active \u2014 14:00 UTC (3 entries)',
    );
    expect(rail.querySelector('.rail-hour[aria-current="true"]')?.getAttribute('data-hour')).toBe('14');
  });

  it('hover and wheel change only the tier under the cursor', () => {
    const r = new CalendarRail(ENTRIES, { year: 2026, month: 11, day: 18 }, null);
    document.body.appendChild(r.root);
    const tier = (n: number): HTMLElement => r.root.querySelector<HTMLElement>(`.rail-tier[data-tier="${n}"]`)!;
    tier(3).dispatchEvent(new MouseEvent('mouseenter'));
    expect([1, 2, 3, 4].map((n) => tier(n).dataset.hover ?? null)).toEqual([null, null, 'true', null]);
    const pressed = (n: number): string[] =>
      [...tier(n).querySelectorAll('.rail-tick[aria-pressed="true"]')].map((t) => t.querySelector('.rail-tick-label')!.textContent!);
    expect(pressed(3)).toEqual(['18']);
    tier(3).dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
    expect(pressed(3)).toEqual(['17']); // the hovered tier moved
    expect(pressed(1)).toEqual(['Q4']); // the others did not
    expect(pressed(2)).toEqual(['W47']);
    expect(tier(3).dataset.hover).toBe('true'); // hover survives the re-render
    r.root.remove();
  });
});

describe('the rail and the day list open the same hour view', () => {
  it('clicking the rail hour tick routes to the same hour as the day list', async () => {
    window.history.replaceState({}, '', '/calendar/2026-11-18');
    root = document.createElement('div');
    document.body.appendChild(root);
    const router = new Router(stub(ENTRIES), root);
    for (let i = 0; i < 6; i++) await tick();
    const fromList = root.querySelectorAll<HTMLAnchorElement>('.hour-list .hour-link')[14]!.getAttribute('href');
    const tick14 = root.querySelector<HTMLAnchorElement>('.calendar-rail .rail-hour[data-hour="14"]')!;
    expect(tick14.getAttribute('href')).toBe(fromList);
    tick14.click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/calendar/2026-11-18/14');
    expect(root.querySelector('.knowledge-state h2')?.textContent).toContain('14:00 UTC');
    router.destroy();
  });
});

describe('unreachable connector', () => {
  it('the calendar says so in words, rail included', async () => {
    await mount({ level: 'month', year: 2026, month: 11 }, createLiveAdapter(''));
    expect(root.textContent).toContain(NO_ADDRESS_ERROR);
    expect(root.querySelector('.calendar-rail')).toBeNull(); // nothing built from a failed read
  });
});

describe('rail fixes (review round 1)', () => {
  const NOV18 = { year: 2026, month: 11, day: 18 };
  const wheel = (target: Element, deltaY: number): WheelEvent => {
    const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
  };
  const tierEl = (r: CalendarRail, n: number): HTMLElement => r.root.querySelector<HTMLElement>(`.rail-tier[data-tier="${n}"]`)!;

  it('a Tier 4 cursor move keeps the same hour anchors (no rebuild)', () => {
    const rail = new CalendarRail(ENTRIES, NOV18, 14);
    document.body.appendChild(rail.root);
    const before = rail.root.querySelector('.rail-hour[data-hour="15"]');
    expect(rail.move(4, 1)).toBe(true);
    const after = rail.root.querySelector('.rail-hour[data-hour="15"]');
    expect(after).toBe(before);
    expect(after?.getAttribute('data-cursor')).toBe('true');
    expect(rail.root.querySelectorAll('.rail-hour[data-cursor]')).toHaveLength(1);
    rail.root.remove();
  });

  it('the wheel claims the scroll only when the tier moved', () => {
    const rail = new CalendarRail(ENTRIES, NOV18, 23);
    document.body.appendChild(rail.root);
    expect(wheel(tierEl(rail, 4), 100).defaultPrevented).toBe(false); // at hour 23 already
    expect(wheel(tierEl(rail, 4), -100).defaultPrevented).toBe(true);
    // Tier 1: Q4 is the newest quarter, so a forward step does nothing.
    expect(wheel(tierEl(rail, 1), 100).defaultPrevented).toBe(false);
    expect(rail.move(1, 1)).toBe(false);
    rail.root.remove();
  });

  it('a pick keeps keyboard focus on the picked tick; arrow keys move a tier', () => {
    const rail = new CalendarRail(ENTRIES, NOV18, null);
    document.body.appendChild(rail.root);
    const q1 = [...tierEl(rail, 1).querySelectorAll<HTMLButtonElement>('.rail-tick')].find((b) => b.textContent === 'Q1')!;
    q1.focus();
    q1.click();
    const focused = document.activeElement as HTMLElement;
    expect(focused.textContent).toBe('Q1');
    expect(focused.getAttribute('aria-pressed')).toBe('true');
    expect(tierEl(rail, 1).contains(focused)).toBe(true);
    focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    const next = document.activeElement as HTMLElement;
    expect(next.textContent).toBe('Q4');
    expect(next.getAttribute('aria-pressed')).toBe('true');
    rail.root.remove();
  });
});

describe('rail keyboard (review round 2)', () => {
  const NOV18 = { year: 2026, month: 11, day: 18 };
  const key = (target: Element, k: string, mods: KeyboardEventInit = {}): KeyboardEvent => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods });
    target.dispatchEvent(e);
    return e;
  };

  it('Tier 4 arrows step from the focused hour', () => {
    const rail = new CalendarRail(ENTRIES, NOV18, null);
    document.body.appendChild(rail.root);
    const h5 = rail.root.querySelector<HTMLElement>('.rail-hour[data-hour="5"]')!;
    h5.focus();
    key(h5, 'ArrowRight');
    expect((document.activeElement as HTMLElement).dataset.hour).toBe('6');
    rail.root.remove();
  });

  it('modified arrows are left to the browser', () => {
    const rail = new CalendarRail(ENTRIES, NOV18, 10);
    document.body.appendChild(rail.root);
    const h10 = rail.root.querySelector<HTMLElement>('.rail-hour[data-hour="10"]')!;
    expect(key(h10, 'ArrowLeft', { altKey: true }).defaultPrevented).toBe(false);
    expect(rail.root.querySelector<HTMLElement>('.rail-hour[data-cursor]')?.dataset.hour).toBe('10');
    rail.root.remove();
  });
});
