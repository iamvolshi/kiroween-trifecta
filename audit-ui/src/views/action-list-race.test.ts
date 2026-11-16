/**
 * Action List: unmounting during a pending fetch writes nothing (task 7).
 */
import { describe, it, expect } from 'vitest';
import { ActionListView } from './action-list.ts';
import { createMockAdapter } from '../adapter/mock.ts';
import type { AdapterResult, Entry, KidMap, SeamAdapter } from '../adapter/seam.ts';
import { deferred, tick } from '../test-helpers.ts';

describe('ActionListView unmount guard', () => {
  it('unmount while fetchAllEntries is pending: nothing is written afterwards', async () => {
    const pending = deferred<AdapterResult<Entry[]>>();
    const adapter: SeamAdapter = { ...createMockAdapter(), fetchAllEntries: () => pending.promise };
    const container = document.createElement('div');
    const view = new ActionListView(adapter);
    view.mount(container);
    await tick();
    view.unmount();

    // Another view now owns the container.
    container.innerHTML = '<p id="other">other view</p>';
    pending.resolve({ ok: true, data: [] });
    await tick();
    expect(container.innerHTML).toBe('<p id="other">other view</p>');
  });

  it('unmount while the error result is pending: no container wipe', async () => {
    const pending = deferred<AdapterResult<Entry[]>>();
    const adapter: SeamAdapter = { ...createMockAdapter(), fetchAllEntries: () => pending.promise };
    const container = document.createElement('div');
    const view = new ActionListView(adapter);
    view.mount(container);
    await tick();
    view.unmount();
    container.innerHTML = '<p id="other">other view</p>';
    pending.resolve({ ok: false, error: 'boom' });
    await tick();
    expect(container.innerHTML).toBe('<p id="other">other view</p>');
  });

  it('unmount while fetchKidMap is pending: nothing is written and entries are not fetched into the view', async () => {
    const pending = deferred<AdapterResult<KidMap>>();
    const adapter: SeamAdapter = { ...createMockAdapter(), fetchKidMap: () => pending.promise };
    const container = document.createElement('div');
    const view = new ActionListView(adapter);
    view.mount(container);
    view.unmount();
    container.innerHTML = '<p id="other">other view</p>';
    pending.resolve({ ok: true, data: {} });
    await tick();
    expect(container.innerHTML).toBe('<p id="other">other view</p>');
  });
});