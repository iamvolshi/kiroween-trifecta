/**
 * Navigation (task 6): built once by the shell's left column, never by a view.
 */
import { describe, it, expect } from 'vitest';
import { ActionListView } from './action-list.ts';
import { TimeTravelView } from './time-travel.ts';
import { EntryDetailView } from './entry-detail.ts';
import { NotFoundView } from './not-found.ts';
import { RecordView } from './record.ts';
import { createNav } from './nav.ts';
import { createMockAdapter, createErrorMock } from '../adapter/mock.ts';
import type { View } from '../router/router.ts';
import { tick } from '../test-helpers.ts';

async function check(make: () => View): Promise<void> {
  const container = document.createElement('div');
  const view = make();
  view.mount(container);
  await tick();
  expect(container.querySelector('nav')).toBeNull();
  view.unmount();
}

describe('views do not render the nav themselves', () => {
  const ok = createMockAdapter();
  it('Action List', () => check(() => new ActionListView(ok)));
  it('Time Travel', () => check(() => new TimeTravelView(ok)));
  it('Entry Detail (found)', () => check(() => new EntryDetailView(ok, 1, 'temperature', 'entry-a1')));
  it('Entry Detail (unmatched id)', () => check(() => new EntryDetailView(ok, 1, 'temperature', 'zzz')));
  it('Not Found', () => check(() => new NotFoundView()));
  it('Record', () => check(() => new RecordView(ok, 'order-1042')));
  it('Action List and Entry Detail in the error state', async () => {
    await check(() => new ActionListView(createErrorMock()));
    await check(() => new EntryDetailView(createErrorMock(), 1, 'temperature', 'x'));
  });
});

describe('createNav', () => {
  const current = (nav: HTMLElement): string[] =>
    Array.from(nav.querySelectorAll('a[aria-current="page"]')).map((a) => a.getAttribute('href')!);

  it('links all four destinations and carries the MOCK badge', () => {
    const nav = createNav();
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/actions', '/time-travel', '/chat', '/calendar']);
    expect(nav.querySelector('.mock-badge')?.textContent).toMatch(/MOCK/);
  });

  it('marks the current destination only', () => {
    expect(current(createNav())).toEqual([]);
    expect(current(createNav('/chat'))).toEqual(['/chat']);
    expect(current(createNav('/calendar/2026-11-16'))).toEqual(['/calendar']);
    expect(current(createNav('/record/order-1042'))).toEqual([]);
  });
});
