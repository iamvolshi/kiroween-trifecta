import { describe, it, expect, vi } from 'vitest';
import type { SeamAdapter, Entry } from '../adapter/seam.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import { isLiveAt } from '../util/interval.ts';
import { entriesInHour } from '../util/calendar.ts';
import { parseUtcInput } from '../util/moment.ts';
import { CalendarView } from './calendar.ts';

function fakeAdapter(entries: Entry[]): SeamAdapter {
  const bad = async () => ({ ok: false as const, error: 'unused' });
  return {
    fetchAllEntries: async () => ({ ok: true, data: entries }),
    fetchBeliefPool: vi.fn(async (ms: number) => ({
      ok: true as const,
      data: entries.filter((e) => isLiveAt(e, ms)),
    })),
    fetchChain: bad,
    fetchKidMap: async () => ({ ok: true, data: { 1: 'alpha (mock)' } }),
    ask: bad, chat: bad, update: bad, fetchLessons: bad, fetchRecord: bad,
  } as unknown as SeamAdapter;
}

function errorAdapter(): SeamAdapter {
  const err = async () => ({ ok: false as const, error: 'boom' });
  return {
    fetchAllEntries: err, fetchBeliefPool: err, fetchChain: err, fetchKidMap: err,
    ask: err, chat: err, update: err, fetchLessons: err, fetchRecord: err,
  } as unknown as SeamAdapter;
}

const E = [
  makeEntry({ id: 'a', k_start: '2026-11-16T09:12:00.000Z', k_time: '2026-11-16T14:30:00.000Z' }),
  makeEntry({ id: 'b', kid: 2, subject: 's2', k_start: '2026-11-16T10:05:00.000Z', k_time: '2026-11-16T15:10:00.000Z' }),
  makeEntry({ id: 'c', k_start: '2026-11-16T14:30:00.000Z', k_time: '2026-11-17T00:00:00.000Z' }),
];

async function mount(adapter: SeamAdapter, target: ConstructorParameters<typeof CalendarView>[1]) {
  const root = document.createElement('div');
  const v = new CalendarView(adapter, target);
  v.mount(root);
  await tick();
  await tick();
  return { root, v };
}

describe('CalendarView', () => {
  it('month: dots only on days with entries, day links', async () => {
    const { root } = await mount(fakeAdapter(E), { level: 'month', year: 2026, month: 11 });
    expect(root.querySelector('h1')?.textContent).toBe('Calendar');
    expect(root.querySelector('.calendar-title')?.textContent).toBe('November 2026 (UTC)');
    const dotted = [...root.querySelectorAll('td')].filter((td) => td.querySelector('.day-dot'));
    expect(dotted).toHaveLength(1);
    expect(dotted[0].querySelector('a')?.getAttribute('href')).toBe('/calendar/2026-11-16');
    expect(dotted[0].querySelector('.day-dot')?.getAttribute('title')).toBe('3 entries');
    expect(root.querySelector('.cal-prev')?.getAttribute('href')).toBe('/calendar/2026-10');
    expect(root.querySelector('.cal-next')?.getAttribute('href')).toBe('/calendar/2026-12');
    expect(root.querySelector('nav.main-nav')).not.toBeNull();
  });

  it('day: empty day shows empty state, no dot in month', async () => {
    const day = await mount(fakeAdapter(E), { level: 'day', year: 2026, month: 11, day: 5 });
    expect(day.root.querySelector('.empty-state')?.textContent).toBe('No record entries on this day.');
    expect(day.root.querySelectorAll('.hour-link')).toHaveLength(24);
    expect(day.root.querySelector('.hour-link')?.getAttribute('href')).toBe('/calendar/2026-11-05/00');
    const month = await mount(fakeAdapter(E), { level: 'month', year: 2026, month: 11 });
    const fifth = [...month.root.querySelectorAll('td')].find((td) => td.textContent?.trim() === '5');
    expect(fifth?.querySelector('.day-dot')).toBeNull();
    expect(day.root.querySelector('nav.main-nav')).not.toBeNull();
  });

  it('day: hour links carry counts', async () => {
    const { root } = await mount(fakeAdapter(E), { level: 'day', year: 2026, month: 11, day: 16 });
    expect(root.querySelector('.empty-state')).toBeNull();
    const counts = [...root.querySelectorAll('.hour-list li')]
      .filter((li) => li.querySelector('.hour-count'))
      .map((li) => li.querySelector('a')?.textContent);
    expect(counts).toEqual(['09', '10', '14']);
  });

  it('hour: belief ids equal live entries; did list equals entriesInHour', async () => {
    const adapter = fakeAdapter(E);
    const { root } = await mount(adapter, { level: 'hour', year: 2026, month: 11, day: 16, hour: 14 });
    const moment = Date.UTC(2026, 10, 16, 14);
    const hrefId = (a: Element) => decodeURIComponent(a.getAttribute('href')!.split('/').pop()!);
    const believed = [...root.querySelectorAll('.hour-believed a')].map(hrefId);
    expect(believed).toEqual(E.filter((e) => isLiveAt(e, moment)).map((e) => e.id));
    const did = [...root.querySelectorAll('.hour-did a')].map(hrefId);
    expect(did).toEqual(entriesInHour(E, 2026, 11, 16, 14).map((e) => e.id));
    expect(root.querySelector('.hour-believed a')?.getAttribute('href')).toMatch(/^\/entry\/1\/temperature\//);
    expect(root.querySelector('.kid')?.textContent).toContain('alpha (mock)');
  });

  it('hour: displayed moment parses to the queried moment', async () => {
    const adapter = fakeAdapter(E);
    const { root } = await mount(adapter, { level: 'hour', year: 2026, month: 11, day: 16, hour: 9 });
    const shown = root.querySelector('.cursor-display')!.textContent!;
    expect(shown).toBe('Moment (UTC): 2026-11-16T09:00');
    const arg = (adapter.fetchBeliefPool as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg).toBe(parseUtcInput(shown.replace('Moment (UTC): ', '')));
  });

  it('hour: empty states', async () => {
    const { root } = await mount(fakeAdapter(E), { level: 'hour', year: 2026, month: 11, day: 16, hour: 3 });
    const texts = [...root.querySelectorAll('.empty-state')].map((n) => n.textContent);
    expect(texts).toEqual([
      'Nothing was recorded in this hour.',
      'No entries were live at this moment.',
    ]);
  });

  it('default picks the newest entry month', async () => {
    const entries = [
      makeEntry({ id: 'x', k_start: '2026-03-02T00:00:00.000Z' }),
      makeEntry({ id: 'y', k_start: '2026-08-20T00:00:00.000Z' }),
    ];
    const { root } = await mount(fakeAdapter(entries), null);
    expect(root.querySelector('.calendar-title')?.textContent).toBe('August 2026 (UTC)');
  });

  it('default with no entries uses the current UTC month', async () => {
    const { root } = await mount(fakeAdapter([]), null);
    const now = new Date();
    expect(root.querySelector('.calendar-title')?.textContent).toMatch(String(now.getUTCFullYear()));
  });

  it('error state keeps nav at every level', async () => {
    for (const t of [
      null,
      { level: 'month' as const, year: 2026, month: 11 },
      { level: 'day' as const, year: 2026, month: 11, day: 16 },
      { level: 'hour' as const, year: 2026, month: 11, day: 16, hour: 9 },
    ]) {
      const { root } = await mount(errorAdapter(), t);
      expect(root.querySelector('.error-state')?.textContent).toBe('boom');
      expect(root.querySelector('nav.main-nav')).not.toBeNull();
    }
  });

  it('unmount before load resolves renders nothing', async () => {
    const root = document.createElement('div');
    const v = new CalendarView(fakeAdapter(E), { level: 'month', year: 2026, month: 11 });
    v.mount(root);
    v.unmount();
    await tick();
    await tick();
    expect(root.innerHTML).toBe('');
  });
});
