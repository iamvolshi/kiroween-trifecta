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

const marker = (subject: string, id = `f-${subject}`, over: Partial<Entry> = {}): Entry =>
  makeEntry({ id, kid: 40, subject: `curator-folder-${subject}`, authority: 5, ...over });

describe('LeftPanel', () => {
  it('renders the Curator heading (no directories nav), the folder rows, and the going-back links', async () => {
    const { slot } = mountLeft(adapterOf(async () => ({
      ok: true, data: [makeEntry({ id: 'a', subject: 'order-1042.status' }), marker('order-1042')],
    })));
    await tick();
    expect(slot.querySelector('nav')).toBeNull();
    expect(slot.querySelector('.left-record h2')?.textContent).toBe('Curator');
    expect(slot.querySelectorAll('.curator-row')).toHaveLength(1);
    const back = Array.from(slot.querySelectorAll('.left-back a')).map((a) => a.getAttribute('href'));
    expect(back).toEqual(['/calendar']);
  });

  it('empty record shows the empty state; error shows the error state', async () => {
    const empty = mountLeft(adapterOf(async () => ({ ok: true, data: [] })));
    await tick();
    expect(empty.slot.querySelector('.empty-state')?.textContent).toBe('No folders yet. Folders appear as the Curator files them.');
    const bad = mountLeft(adapterOf(async () => ({ ok: false, error: 'boom' })));
    await tick();
    expect(bad.slot.querySelector('.error-state')?.textContent).toBe('boom');
    expect(bad.slot.querySelector('nav')).toBeNull();
  });

  it('drops a late result superseded by a newer refresh, and after unmount', async () => {
    const first = deferred<AdapterResult<Entry[]>>();
    let calls = 0;
    const { slot, panel } = mountLeft(
      adapterOf(() => {
        calls++;
        return calls === 1 ? first.promise : Promise.resolve({ ok: true, data: [marker('new')] });
      }),
    );
    panel.refresh();
    await tick();
    first.resolve({ ok: true, data: [marker('stale')] });
    await tick();
    expect(Array.from(slot.querySelectorAll('.curator-row-name')).map((a) => a.textContent)).toEqual(['new']);

    const late = deferred<AdapterResult<Entry[]>>();
    const m = mountLeft(adapterOf(() => late.promise));
    m.panel.unmount();
    late.resolve({ ok: true, data: [marker('x')] });
    await tick();
    expect(m.slot.innerHTML).toBe('');
  });

  it('a refresh shows a folder the Curator filed since', async () => {
    const entries: Entry[] = [makeEntry({ id: 't1', subject: 'turn' })];
    const { slot, panel } = mountLeft(adapterOf(async () => ({ ok: true, data: [...entries] })));
    await tick();
    expect(slot.querySelector('.curator-row')).toBeNull();
    entries.push(marker('dog', 'f-dog', { case_file: ['t1'] }));
    panel.refresh();
    await tick();
    expect(Array.from(slot.querySelectorAll('.curator-row-name')).map((n) => n.textContent)).toEqual(['dog']);
  });
});
