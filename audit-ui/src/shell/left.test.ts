import { describe, it, expect } from 'vitest';
import { LeftPanel } from './left.ts';
import type { SeamAdapter, Entry, AdapterResult } from '../adapter/seam.ts';
import { makeEntry, assemblyNotUsed, tick, deferred } from '../test-helpers.ts';

function adapterOf(result: () => Promise<AdapterResult<Entry[]>>): SeamAdapter {
  return {
    fetchAllEntries: result,
    fetchBeliefPool: async () => ({ ok: true, data: [] }),
    fetchChain: async () => ({ ok: true, data: [] }),
    fetchKidMap: async () => ({ ok: true, data: {} }),
    ...assemblyNotUsed(),
  };
}

function mountLeft(adapter: SeamAdapter): { slot: HTMLElement; panel: LeftPanel } {
  const slot = document.createElement('div');
  const panel = new LeftPanel(adapter);
  panel.mount(slot);
  return { slot, panel };
}

describe('LeftPanel', () => {
  it('renders nav, record folders with counts, and the going-back links', async () => {
    const { slot } = mountLeft(
      adapterOf(async () => ({
        ok: true,
        data: [
          makeEntry({ id: 'a', subject: 'order-1042.delivery_date' }),
          makeEntry({ id: 'b', subject: 'order-1042.status' }),
          makeEntry({ id: 'c', subject: 'parcel-77.status' }),
        ],
      })),
    );
    await tick();
    expect(slot.querySelectorAll('nav')).toHaveLength(1);
    const folders = Array.from(slot.querySelectorAll('.folder-head')).map((f) => [
      f.querySelector('a')?.getAttribute('href'),
      f.textContent,
    ]);
    // Name, count, then the folder's 0-9 value (latest entry's authority) on the folder.
    expect(folders).toEqual([
      ['/record/order-1042', 'order-1042 (2)5'],
      ['/record/parcel-77', 'parcel-77 (1)5'],
    ]);
    expect(slot.querySelector('.folder-head-value')?.getAttribute('aria-label')).toBe('authority 5 of 9');
    const back = Array.from(slot.querySelectorAll('.left-back a')).map((a) => a.getAttribute('href'));
    expect(back).toEqual(['/calendar']);
  });

  it('a subject without a dot links to the latest entry of its chain', async () => {
    const { slot } = mountLeft(
      adapterOf(async () => ({
        ok: true,
        data: [
          makeEntry({ id: 'old', subject: 'temperature', k_start: '2024-01-01T00:00:00.000Z' }),
          makeEntry({ id: 'new', subject: 'temperature', k_start: '2024-03-01T00:00:00.000Z' }),
        ],
      })),
    );
    await tick();
    expect(slot.querySelector('.folder-head a')?.getAttribute('href')).toBe('/entry/1/temperature/new');
    expect(slot.querySelector('.folder-count')?.textContent).toBe(' (2)');
  });

  it('empty record shows the empty state; error shows the error state', async () => {
    const empty = mountLeft(adapterOf(async () => ({ ok: true, data: [] })));
    await tick();
    expect(empty.slot.querySelector('.empty-state')).not.toBeNull();
    const bad = mountLeft(adapterOf(async () => ({ ok: false, error: 'boom' })));
    await tick();
    expect(bad.slot.querySelector('.error-state')?.textContent).toBe('boom');
    expect(bad.slot.querySelectorAll('nav')).toHaveLength(1);
  });

  it('drops a late result superseded by a newer refresh, and after unmount', async () => {
    const first = deferred<AdapterResult<Entry[]>>();
    let calls = 0;
    const { slot, panel } = mountLeft(
      adapterOf(() => {
        calls++;
        return calls === 1
          ? first.promise
          : Promise.resolve({ ok: true, data: [makeEntry({ id: 'n', subject: 'new.x' })] });
      }),
    );
    panel.refresh();
    await tick();
    first.resolve({ ok: true, data: [makeEntry({ id: 'o', subject: 'stale.x' })] });
    await tick();
    expect(Array.from(slot.querySelectorAll('.folder-head a')).map((a) => a.textContent)).toEqual(['new']);

    const late = deferred<AdapterResult<Entry[]>>();
    const m = mountLeft(adapterOf(() => late.promise));
    m.panel.unmount();
    late.resolve({ ok: true, data: [makeEntry()] });
    await tick();
    expect(m.slot.innerHTML).toBe('');
  });
});
