import { describe, it, expect } from 'vitest';
import { RecordView } from './record.ts';
import type { SeamAdapter, Entry, AdapterResult, RecordResult } from '../adapter/seam.ts';
import { makeEntry, assemblyNotUsed, tick } from '../test-helpers.ts';

function adapterOf(result: AdapterResult<RecordResult>): SeamAdapter {
  return {
    fetchAllEntries: async () => ({ ok: true, data: [] }),
    fetchBeliefPool: async () => ({ ok: true, data: [] }),
    fetchChain: async () => ({ ok: true, data: [] }),
    fetchKidMap: async () => ({ ok: true, data: { 1: 'alpha' } }),
    ...assemblyNotUsed(),
    fetchRecord: async () => result,
  };
}

async function mountView(adapter: SeamAdapter, account: string): Promise<HTMLElement> {
  const root = document.createElement('div');
  new RecordView(adapter, account).mount(root);
  await tick();
  return root;
}

describe('RecordView', () => {
  it('lists each subject in k_start order, linking to Entry Detail', async () => {
    const subject = 'order-1042.delivery_date';
    const late = makeEntry({ id: 'late', subject, state: 'revised', authority: 7, k_start: '2026-11-16T12:00:00.000Z', evidence: 'ev-late' });
    const early = makeEntry({ id: 'early', subject, state: 'confirmed', authority: 5, k_start: '2026-11-16T09:00:00.000Z', evidence: 'ev-early' });
    const fields: Record<string, Entry[]> = { [subject]: [late, early] };
    const root = await mountView(adapterOf({ ok: true, data: { account_id: 'order-1042', fields } }), 'order-1042');

    expect(root.querySelector('h1')?.textContent).toContain('order-1042');
    expect(root.querySelector('h2')?.textContent).toBe(subject);
    // An Explorer grid: the KID links to Entry Detail, oldest first.
    const links = Array.from(root.querySelectorAll('.record-entries tbody a.kid'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `/entry/1/${encodeURIComponent(subject)}/early`,
      `/entry/1/${encodeURIComponent(subject)}/late`,
    ]);
    const first = root.querySelector('.record-entries tbody tr.log-line')!;
    const cell = (k: string) => first.querySelector(`.cell-${k}`)?.textContent;
    expect(cell('time')).toBe('2026-11-16 09:00:00');
    expect(cell('kid')).toBe('1');
    expect(cell('subject')).toBe(subject);
    expect(cell('state')).toBe('confirmed');
    expect(cell('authority')).toBe('5');
    expect(cell('evidence')).toBe('ev-early');
    // Its details row keeps the full times.
    const details = first.nextElementSibling!;
    expect(details.querySelector('.k-start')?.textContent).toBe('2026-11-16T09:00:00.000Z');
    expect(details.querySelector('.k-time')?.textContent).toBe(early.k_time);
  });

  it('unknown account shows the empty state', async () => {
    const root = await mountView(adapterOf({ ok: true, data: { account_id: 'nope', fields: {} } }), 'nope');
    expect(root.querySelector('.empty-state')?.textContent).toBe('No record entries for this account.');
  });

  it('error shows the error state', async () => {
    const root = await mountView(adapterOf({ ok: false, error: 'boom' }), 'x');
    expect(root.querySelector('.error-state')?.textContent).toBe('boom');
  });

  it('unmount before the load resolves renders nothing', async () => {
    const root = document.createElement('div');
    const v = new RecordView(adapterOf({ ok: true, data: { account_id: 'a', fields: { 'a.b': [makeEntry()] } } }), 'a');
    v.mount(root);
    v.unmount();
    await tick();
    expect(root.innerHTML).toBe('');
  });
});
