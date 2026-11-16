/**
 * Navigation on every view (task 6).
 */
import { describe, it, expect } from 'vitest';
import { ActionListView } from './action-list.ts';
import { TimeTravelView } from './time-travel.ts';
import { EntryDetailView } from './entry-detail.ts';
import { NotFoundView } from './not-found.ts';
import { createMockAdapter, createErrorMock } from '../adapter/mock.ts';
import type { View } from '../router/router.ts';
import { tick } from '../test-helpers.ts';

function hrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('nav a')).map((a) => a.getAttribute('href') ?? '');
}

async function check(make: () => View): Promise<void> {
  const container = document.createElement('div');
  const view = make();
  view.mount(container);
  await tick();
  const h = hrefs(container);
  expect(h).toContain('/actions');
  expect(h).toContain('/time-travel');
  view.unmount();
}

describe('every view renders links to the other views', () => {
  const ok = createMockAdapter();
  it('Action List', () => check(() => new ActionListView(ok)));
  it('Time Travel', () => check(() => new TimeTravelView(ok)));
  it('Entry Detail (found)', () => check(() => new EntryDetailView(ok, 1, 'temperature', 'entry-a1')));
  it('Entry Detail (unmatched id)', () => check(() => new EntryDetailView(ok, 1, 'temperature', 'zzz')));
  it('Not Found', () => check(() => new NotFoundView()));
  it('Action List and Entry Detail keep nav in the error state', async () => {
    await check(() => new ActionListView(createErrorMock()));
    await check(() => new EntryDetailView(createErrorMock(), 1, 'temperature', 'x'));
  });
});