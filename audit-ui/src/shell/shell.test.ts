import { describe, it, expect, afterEach } from 'vitest';
import { createShell } from './shell.ts';
import { Router } from '../router/router.ts';
import type { SeamAdapter, Entry, ChatTurn } from '../adapter/seam.ts';
import { makeEntry, assemblyNotUsed, tick } from '../test-helpers.ts';

describe('createShell', () => {
  it('builds the three slots, right shows only the Telemetry heading', () => {
    const c = document.createElement('div');
    const s = createShell(c);
    expect(c.querySelectorAll('.shell')).toHaveLength(1);
    expect(s.left.classList.contains('shell-left')).toBe(true);
    expect(s.center.classList.contains('shell-center')).toBe(true);
    expect(s.right.classList.contains('shell-right')).toBe(true);
    expect(s.right.children).toHaveLength(0);
  });
});

function fakeAdapter(entries: () => Entry[]): SeamAdapter {
  return {
    fetchAllEntries: async () => ({ ok: true, data: entries() }),
    fetchBeliefPool: async () => ({ ok: true, data: [] }),
    fetchChain: async () => ({ ok: true, data: [] }),
    fetchKidMap: async () => ({ ok: true, data: { 1: 'alpha' } }),
    ...assemblyNotUsed(),
    fetchRecord: async (accountId: string) => {
      const fields: Record<string, Entry[]> = {};
      for (const e of entries()) {
        if (e.subject.startsWith(`${accountId}.`)) (fields[e.subject] ??= []).push(e);
      }
      return { ok: true, data: { account_id: accountId, fields } };
    },
  };
}

const ROUTES = [
  '/actions',
  '/chat',
  '/calendar',
  '/calendar/2026-11',
  '/calendar/2026-11-16',
  '/calendar/2026-11-16/14',
  '/entry/1/order-1042.delivery_date/a',
  '/record/order-1042',
  '/no-such-page',
];

let container: HTMLElement;
let router: Router | null = null;
let entries: Entry[];

function start(path: string): Router {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(fakeAdapter(() => entries), container);
  return router;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await tick();
}

const folderNames = (): string[] =>
  Array.from(container.querySelectorAll('.shell-left .folder a')).map((a) => a.textContent ?? '');

afterEach(() => {
  router?.destroy();
  router = null;
  container?.remove();
});

describe('Router shell', () => {
  it('builds the shell once and lands the routed view in the center', async () => {
    entries = [makeEntry({ id: 'a', subject: 'order-1042.delivery_date' })];
    start('/actions');
    await settle();
    expect(container.querySelectorAll('.shell')).toHaveLength(1);
    expect(container.querySelector('.shell-center .action-list')).not.toBeNull();
    expect(container.querySelector('.shell-left .action-list')).toBeNull();
    expect(container.querySelector('.shell-right .telemetry')).not.toBeNull();
    const shell = container.querySelector('.shell');
    router!.navigate('/chat');
    await settle();
    expect(container.querySelector('.shell')).toBe(shell);
    expect(container.querySelector('.shell-center .chat-view')).not.toBeNull();
  });

  for (const path of ROUTES) {
    it(`${path}: the nav exists exactly once, with six destinations`, async () => {
      entries = [makeEntry({ id: 'a', subject: 'order-1042.delivery_date' })];
      start(path);
      await settle();
      expect(container.querySelectorAll('nav')).toHaveLength(1);
      expect(container.querySelector('.shell-left nav')).not.toBeNull();
      const hrefs = Array.from(container.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
      expect(hrefs).toEqual(['/chat', '/actions', '/calendar', '/research', '/lessons', '/curator']);
      expect(container.querySelectorAll('nav > :not(a)')).toHaveLength(0);
    });
  }

  it('aria-current follows navigation', async () => {
    entries = [];
    start('/actions');
    await settle();
    const current = (): string[] =>
      Array.from(container.querySelectorAll('nav a[aria-current="page"]')).map((a) =>
        a.getAttribute('href')!,
      );
    expect(current()).toEqual(['/actions']);
    router!.navigate('/chat');
    await settle();
    expect(current()).toEqual(['/chat']);
    router!.navigate('/calendar/2026-11');
    await settle();
    expect(current()).toEqual(['/calendar']);
    router!.navigate('/no-such-page');
    await settle();
    expect(current()).toEqual([]);
  });

  it('left folders are the record accounts and update when the chat log grows', async () => {
    entries = [makeEntry({ id: 'a', subject: 'order-1042.delivery_date' })];
    start('/chat');
    await settle();
    expect(folderNames()).toEqual(['order-1042']);

    entries = [
      ...entries,
      makeEntry({ id: 'p', subject: 'parcel-77.status', kid: 2 }),
    ];
    router!.getChatLog().push({} as ChatTurn);
    await settle();
    expect(folderNames()).toEqual(['order-1042', 'parcel-77']);
  });

  it('/record/:account renders the record view in the center', async () => {
    entries = [makeEntry({ id: 'a', subject: 'order-1042.delivery_date' })];
    start('/record/order-1042');
    await settle();
    expect(container.querySelector('.shell-center .record-view .record-entries a')).not.toBeNull();
  });

  it('malformed /record/%E0%A4%A is NotFound', async () => {
    entries = [];
    start('/record/%E0%A4%A');
    await settle();
    expect(container.querySelector('.shell-center .not-found')).not.toBeNull();
  });

  it('destroy() empties the container and stops listening to the chat log', async () => {
    entries = [makeEntry({ id: 'a', subject: 'order-1042.delivery_date' })];
    const r = start('/actions');
    await settle();
    const log = r.getChatLog();
    r.destroy();
    router = null;
    expect(container.innerHTML).toBe('');
    entries = [...entries, makeEntry({ id: 'p', subject: 'parcel-77.status' })];
    log.push({} as ChatTurn);
    await settle();
    expect(container.innerHTML).toBe('');
  });
});
