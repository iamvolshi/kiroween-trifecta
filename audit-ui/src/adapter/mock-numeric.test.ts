/**
 * The mock adapter uses the one tested interval predicate (task 10), and
 * k_start values in mixed formats sort chronologically everywhere (task 11).
 */
import { describe, it, expect } from 'vitest';
import { createMockAdapter } from './mock.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import { compareKStart, parseMs } from '../util/interval.ts';
import { ActionListView } from '../views/action-list.ts';
import { EntryDetailView } from '../views/entry-detail.ts';

const T = Date.UTC(2024, 5, 1); // 2024-06-01T00:00:00Z

describe('mock adapter with numeric unix-ms k_start / k_time', () => {
  const entry = makeEntry({ id: 'num', k_start: String(T), k_time: String(T + 1000) });
  const adapter = createMockAdapter([entry]);

  it('is live at k_start (inclusive) and just before k_time', async () => {
    for (const m of [T, T + 999]) {
      const r = await adapter.fetchBeliefPool(m);
      expect(r.ok && r.data.map((e) => e.id)).toEqual(['num']);
    }
  });

  it('is not live just before k_start or at k_time (exclusive)', async () => {
    for (const m of [T - 1, T + 1000]) {
      const r = await adapter.fetchBeliefPool(m);
      expect(r.ok && r.data).toEqual([]);
    }
  });
});

describe('mixed-format k_start sorting', () => {
  // Chronological: first (ISO, Jan) < second (numeric, Jun) < third (ISO, Dec)
  const first = makeEntry({ id: 'first', k_start: '2024-01-01T00:00:00.000Z' });
  const second = makeEntry({ id: 'second', k_start: String(T) });
  const third = makeEntry({ id: 'third', k_start: '2024-12-01T00:00:00.000Z' });
  const shuffled = [third, first, second];

  it('parseMs reads both formats', () => {
    expect(parseMs(String(T))).toBe(T);
    expect(parseMs('2024-06-01T00:00:00.000Z')).toBe(T);
  });

  it('compareKStart orders chronologically (string order would put numeric last or first)', () => {
    expect([...shuffled].sort(compareKStart).map((e) => e.id)).toEqual(['first', 'second', 'third']);
  });

  it('mock fetchChain is chronological', async () => {
    const r = await createMockAdapter(shuffled).fetchChain(1, 'temperature');
    expect(r.ok && r.data.map((e) => e.id)).toEqual(['first', 'second', 'third']);
  });

  it('Action List is newest first', async () => {
    const c = document.createElement('div');
    const v = new ActionListView(createMockAdapter(shuffled));
    v.mount(c);
    await tick();
    const hrefs = Array.from(c.querySelectorAll('.action-list a')).map((a) => a.getAttribute('href')!.split('/').pop());
    expect(hrefs).toEqual(['third', 'second', 'first']);
    v.unmount();
  });

  it('Entry Detail chain history is oldest first', async () => {
    const c = document.createElement('div');
    const v = new EntryDetailView(createMockAdapter(shuffled), 1, 'temperature', 'first');
    v.mount(c);
    await tick();
    const starts = Array.from(c.querySelectorAll('.chain-list .k-start')).map((s) => s.textContent);
    expect(starts).toEqual([first.k_start, second.k_start, third.k_start]);
    v.unmount();
  });
});