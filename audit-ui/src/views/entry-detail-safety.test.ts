/**
 * Entry Detail: unmatched id.
 */
import { describe, it, expect } from 'vitest';
import { EntryDetailView } from './entry-detail.ts';
import { createRecordStub } from '../test-helpers.ts';
import type { SeamAdapter } from '../adapter/seam.ts';
import { makeEntry, tick } from '../test-helpers.ts';

async function mountDetail(adapter: SeamAdapter, kid: number, subject: string, id: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const view = new EntryDetailView(adapter, kid, subject, id);
  view.mount(container);
  await tick();
  return { container, view };
}

describe('Entry Detail: unmatched id', () => {
  it('shows an explicit not-found state naming the id, not another entry', async () => {
    const adapter = createRecordStub([makeEntry({ id: 'real', reason: 'REAL-REASON' })]);
    const { container, view } = await mountDetail(adapter, 1, 'temperature', 'missing-id');

    const nf = container.querySelector('.entry-not-found');
    expect(nf).not.toBeNull();
    expect(nf!.textContent).toContain('missing-id');
    expect(container.querySelector('.entry-primary')).toBeNull();
    expect(container.textContent).not.toContain('REAL-REASON');
    view.unmount();
    container.remove();
  });

  it('still shows the entry when the id matches', async () => {
    const adapter = createRecordStub([makeEntry({ id: 'real' })]);
    const { container, view } = await mountDetail(adapter, 1, 'temperature', 'real');
    expect(container.querySelector('.entry-primary')).not.toBeNull();
    expect(container.querySelector('.entry-not-found')).toBeNull();
    view.unmount();
    container.remove();
  });
});