/**
 * Navigation (task 6): built once by the shell's left column, never by a view.
 */
import { describe, it, expect } from 'vitest';
import { ActionListView } from './action-list.ts';
import { EntryDetailView } from './entry-detail.ts';
import { NotFoundView } from './not-found.ts';
import { RecordView } from './record.ts';
import { createNav } from './nav.ts';
import { createRecordStub, createFailingStub } from '../test-helpers.ts';
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
  const ok = createRecordStub();
  it('Action List', () => check(() => new ActionListView(ok)));
  it('Entry Detail (found)', () => check(() => new EntryDetailView(ok, 1, 'temperature', 'entry-a1')));
  it('Entry Detail (unmatched id)', () => check(() => new EntryDetailView(ok, 1, 'temperature', 'zzz')));
  it('Not Found', () => check(() => new NotFoundView()));
  it('Record', () => check(() => new RecordView(ok, 'order-1042')));
  it('Action List and Entry Detail in the error state', async () => {
    await check(() => new ActionListView(createFailingStub()));
    await check(() => new EntryDetailView(createFailingStub(), 1, 'temperature', 'x'));
  });
});

describe('createNav', () => {
  const current = (nav: HTMLElement): string[] =>
    Array.from(nav.querySelectorAll('a[aria-current="page"]')).map((a) => a.getAttribute('href')!);

  it('links all five destinations and nothing else', () => {
    const nav = createNav();
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/chat', '/actions', '/calendar', '/research', '/lessons']);
    expect(nav.querySelectorAll(':scope > :not(a)')).toHaveLength(0);
  });

  it('marks the current destination only', () => {
    expect(current(createNav())).toEqual([]);
    expect(current(createNav('/chat'))).toEqual(['/chat']);
    expect(current(createNav('/calendar/2026-11-16'))).toEqual(['/calendar']);
    expect(current(createNav('/record/order-1042'))).toEqual([]);
  });
});
