/**
 * Time Travel: UTC moment (task 5), stale-response race and empty input (task 13).
 */
import { describe, it, expect } from 'vitest';
import { TimeTravelView } from './time-travel.ts';
import { createMockAdapter } from '../adapter/mock.ts';
import type { AdapterResult, Entry, SeamAdapter } from '../adapter/seam.ts';
import { deferred, makeEntry, tick } from '../test-helpers.ts';

function setup(adapter: SeamAdapter) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const view = new TimeTravelView(adapter);
  view.mount(container);
  const input = container.querySelector<HTMLInputElement>('#moment-cursor')!;
  const set = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('change'));
  };
  const done = () => {
    view.unmount();
    container.remove();
  };
  return { container, set, done };
}

const ids = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('.belief-pool li .subject')).map((s) => s.textContent);

describe('Time Travel reads the input as UTC', () => {
  it('2024-01-01T00:00 (UTC) is exactly T0: entries A and D are live (k_start inclusive)', async () => {
    const { container, set, done } = setup(createMockAdapter());
    set('2024-01-01T00:00');
    await tick();
    expect(ids(container).sort()).toEqual(['pressure', 'temperature']);
    done();
  });

  it('2024-03-31T23:59 (UTC) is still in A, 2024-04-01T00:00 (UTC) is in B (half-open boundary)', async () => {
    const { container, set, done } = setup(createMockAdapter());
    set('2024-03-31T23:59');
    await tick();
    expect(container.querySelector('.belief-pool .state')?.textContent).toBe('confirmed');
    set('2024-04-01T00:00');
    await tick();
    expect(container.querySelectorAll('.belief-pool li')).toHaveLength(1);
    expect(container.querySelector('.belief-pool .state')?.textContent).toBe('revised');
    done();
  });

  it('queries the same moment it displays, labeled UTC', async () => {
    let queried = NaN;
    const base = createMockAdapter();
    const adapter: SeamAdapter = {
      ...base,
      fetchBeliefPool: (ms) => {
        queried = ms;
        return base.fetchBeliefPool(ms);
      },
    };
    const { container, set, done } = setup(adapter);
    set('2024-05-06T07:08');
    await tick();
    expect(queried).toBe(Date.UTC(2024, 4, 6, 7, 8));
    expect(container.querySelector('.cursor-display')?.textContent).toBe(
      'Moment (UTC): 2024-05-06T07:08',
    );
    done();
  });
});

describe('Time Travel: stale responses are discarded', () => {
  it('a slow earlier request resolving after a later one does not overwrite it', async () => {
    const slow = deferred<AdapterResult<Entry[]>>();
    const fast = deferred<AdapterResult<Entry[]>>();
    const queue = [slow, fast];
    const base = createMockAdapter();
    const adapter: SeamAdapter = {
      ...base,
      fetchBeliefPool: () => queue.shift()!.promise,
    };
    const { container, set, done } = setup(adapter);

    set('2024-01-01T00:00'); // request 1 (slow)
    set('2024-04-01T00:00'); // request 2 (fast)
    fast.resolve({ ok: true, data: [makeEntry({ subject: 'NEW' })] });
    await tick();
    slow.resolve({ ok: true, data: [makeEntry({ subject: 'STALE' })] });
    await tick();

    expect(ids(container)).toEqual(['NEW']);
    expect(container.querySelector('.cursor-display')?.textContent).toContain('2024-04-01T00:00');
    done();
  });

  it('a pending response arriving after the input was cleared does not replace the prompt', async () => {
    const pending = deferred<AdapterResult<Entry[]>>();
    const adapter: SeamAdapter = { ...createMockAdapter(), fetchBeliefPool: () => pending.promise };
    const { container, set, done } = setup(adapter);

    set('2024-01-01T00:00');
    set('');
    pending.resolve({ ok: true, data: [makeEntry({ subject: 'STALE' })] });
    await tick();

    expect(container.querySelector('.prompt-state')).not.toBeNull();
    expect(container.querySelector('.belief-pool')).toBeNull();
    done();
  });

  it('a response arriving after unmount writes nothing', async () => {
    const pending = deferred<AdapterResult<Entry[]>>();
    const adapter: SeamAdapter = { ...createMockAdapter(), fetchBeliefPool: () => pending.promise };
    const { container, set, done } = setup(adapter);
    set('2024-01-01T00:00');
    done();
    pending.resolve({ ok: true, data: [makeEntry()] });
    await tick();
    expect(container.innerHTML).toBe('');
  });
});

describe('Time Travel: empty input', () => {
  it('clearing the input shows a "Select a moment" prompt, not the empty-pool message', async () => {
    const { container, set, done } = setup(createMockAdapter());
    set('2024-01-01T00:00');
    await tick();
    set('');
    await tick();

    const prompt = container.querySelector('.prompt-state');
    expect(prompt?.textContent).toBe('Select a moment');
    expect(container.querySelector('.empty-state')).toBeNull();
    expect(container.querySelector('.belief-pool')).toBeNull();
    expect(container.textContent).not.toContain('No entries were live');
    done();
  });
});