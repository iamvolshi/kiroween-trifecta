/**
 * The UI restart: the app is Hackenstein; an icon rail (Chat, Audit,
 * Research, Lessons) swaps the list panel while the center and the right
 * column stay; the app boots into the chat; none of the old face's words or
 * masks remain. Record data comes from the record stub (a test double).
 */
import { describe, it, expect, afterEach } from 'vitest';
import indexHtml from '../index.html?raw';
import { Router } from './router/router.ts';
import { createModelsStub, createRecordStub, createFailingStub, makeEntry, tick } from './test-helpers.ts';
import { RAIL } from './shell/rail.ts';
import { promotedFirst } from './shell/rail-panels.ts';
import type { Lesson, SeamAdapter } from './adapter/seam.ts';

let container: HTMLElement;
let router: Router | null = null;

afterEach(() => {
  router?.destroy();
  router = null;
  container?.remove();
});

async function start(path: string, adapter: SeamAdapter = createRecordStub()): Promise<void> {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(adapter, container, createModelsStub());
  for (let i = 0; i < 6; i++) await tick();
}

const rail = (key: string): HTMLButtonElement => container.querySelector<HTMLButtonElement>(`.rail-button[data-rail="${key}"]`)!;
const list = (): HTMLElement => container.querySelector<HTMLElement>('.shell-left')!;

const lesson = (id: string, detail: string, status: Lesson['status']): Lesson => ({
  event_id: id, event_type: 'derived', detail, rule: null, subject: null, status,
});

describe('rename', () => {
  it('the header says Hackenstein; the tagline says what it can do and the seam chip is gone', async () => {
    await start('/chat');
    expect(container.querySelector('.brand-mark')?.textContent).toBe('Hackenstein');
    expect(container.querySelector('.brand-tag')?.textContent).toBe('Never lies. Learns lessons. Develops identity through use. Multiple persona options.');
    expect(container.querySelector('.seam-chip')).toBeNull();
    expect(container.querySelector('.brand-view')?.textContent).toBe('View: Chat / Observability');
    expect(container.querySelector('.shell-brand')?.textContent).not.toContain('Audit UI');
    expect(indexHtml).toContain('<title>Hackenstein</title>');
  });
});

describe('the rail', () => {
  it('four icons in order: Chat, Audit, Research, Lessons; Chat is on at boot', async () => {
    await start('/chat');
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.shell-rail .rail-button'));
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Chat', 'Audit', 'Research', 'Lessons']);
    expect(RAIL.map((r) => r.key)).toEqual(['chat', 'audit', 'research', 'lessons']);
    expect(buttons.every((b) => b.querySelector('svg') !== null)).toBe(true);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
    // Icons, not engine names.
    expect(container.querySelector('.shell-rail')?.textContent).toBe('');
    expect(container.querySelector('.shell-rail')?.innerHTML).not.toMatch(/KATIE|ERIE|ELLE|ARCHE/);
  });

  it('Chat is the left column as it was: Directories, Record, Going back', async () => {
    await start('/chat');
    expect(list().getAttribute('aria-label')).toBe('Directories');
    expect(Array.from(list().querySelectorAll('h2')).map((h) => h.textContent)).toEqual(['Record', 'Going back']);
    expect(list().querySelector('nav.main-nav')).not.toBeNull();
    expect(Array.from(list().querySelectorAll('.left-back a')).map((a) => a.textContent)).toEqual(['Calendar Index']);
  });

  it('tapping Chat, Research or Lessons swaps the list panel only; Audit also goes to the KTIE page', async () => {
    await start('/chat');
    const center = container.querySelector('.shell-center')!;
    const right = container.querySelector('.shell-right')!;
    const view = center.firstElementChild;
    const feed = right.innerHTML;
    for (const [key, caption] of [['research', 'Research'], ['lessons', 'Lessons'], ['chat', 'Directories']] as const) {
      rail(key).click();
      for (let i = 0; i < 4; i++) await tick();
      expect(list().dataset.panel).toBe(key);
      expect(list().getAttribute('aria-label')).toBe(caption);
      expect(rail(key).getAttribute('aria-pressed')).toBe('true');
      expect(center.firstElementChild).toBe(view);
      expect(right.innerHTML).toBe(feed);
      expect(window.location.pathname).toBe('/chat');
    }
  });

  it('tapping Audit takes the center to the KTIE page and swaps the list panel', async () => {
    await start('/chat');
    const right = container.querySelector('.shell-right')!;
    const feed = right.innerHTML;
    rail('audit').click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/calendar');
    expect(list().dataset.panel).toBe('audit');
    expect(rail('audit').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.shell-center .ktie-head h1')?.textContent).toBe('KTIE');
    expect(container.querySelector('.shell-center .ktie-drums')).not.toBeNull();
    expect(right.innerHTML).toBe(feed); // the telemetry column does not move
  });

  it('tapping Audit while already on the KTIE page only swaps the list panel: no remount', async () => {
    await start('/calendar/2026-11-16');
    const center = container.querySelector('.shell-center')!;
    const view = center.firstElementChild;
    const before = window.history.length;
    rail('audit').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(window.location.pathname).toBe('/calendar/2026-11-16');
    expect(window.history.length).toBe(before);
    expect(center.firstElementChild).toBe(view);
    expect(list().dataset.panel).toBe('audit');
  });

  it('Audit lists the record views and each account with its live entry count', async () => {
    const entries = [
      makeEntry({ id: 'a', subject: 'order-1042.delivery_date' }),
      makeEntry({ id: 'b', subject: 'order-1042.status' }),
      makeEntry({ id: 'c', subject: 'turn' }),
    ];
    await start('/chat', createRecordStub(entries));
    rail('audit').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(Array.from(list().querySelectorAll('.list-section:first-child a')).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Action List', '/actions'], ['Calendar', '/calendar'],
    ]);
    expect(list().querySelector('.list-meta')?.textContent).toBe('3 entries in the record');
    const accounts = Array.from(list().querySelectorAll('.audit-accounts li')).map((li) => li.textContent);
    expect(accounts).toEqual(['order-1042 (2)', 'turn (1)']);
    expect(list().querySelector('.audit-accounts a')?.getAttribute('href')).toBe('/record/order-1042');
  });

  it('Research asks ERIE over the live record and lists each hit with its source name', async () => {
    const asked: string[] = [];
    const adapter = createRecordStub(undefined, {
      ask: async (question: string) => {
        asked.push(question);
        return {
          ok: true as const,
          data: {
            question, state: 'found' as const, text: 'thunderstorms',
            provenance: [{ source: 'K-record day 3 tick 7, Audit UI', content: 'e1', excerpt: 'I love thunderstorms at night' }],
          },
        };
      },
    });
    await start('/chat', adapter);
    rail('research').click();
    const input = list().querySelector<HTMLInputElement>('#research-q')!;
    input.value = 'thunderstorms';
    list().querySelector<HTMLFormElement>('.research-form')!.requestSubmit();
    for (let i = 0; i < 4; i++) await tick();
    expect(asked).toEqual(['thunderstorms']);
    const hit = list().querySelector('.research-hit')!;
    expect(hit.querySelector('.research-source')?.textContent).toBe('K-record day 3 tick 7, Audit UI');
    expect(hit.querySelector('.research-excerpt')?.textContent).toBe('I love thunderstorms at night');
  });

  it('Lessons lists ELLE\'s lessons, learned ones first', async () => {
    const lessons = [lesson('1', 'held one', 'candidate'), lesson('2', 'learned one', 'promoted'), lesson('3', 'learned two', 'promoted')];
    await start('/chat', createRecordStub(undefined, { fetchLessons: async () => ({ ok: true as const, data: lessons }) }));
    rail('lessons').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(Array.from(list().querySelectorAll('.lesson .lesson-rule')).map((r) => r.textContent)).toEqual(['learned one', 'learned two', 'held one']);
    expect(promotedFirst(lessons).map((l) => l.event_id)).toEqual(['2', '3', '1']);
  });

  it('a failed read on any panel says so in words', async () => {
    await start('/chat', createFailingStub('Connector unreachable: refused'));
    for (const key of ['audit', 'lessons'] as const) {
      rail(key).click();
      for (let i = 0; i < 4; i++) await tick();
      expect(list().textContent).toContain('Connector unreachable: refused');
    }
    rail('research').click();
    list().querySelector<HTMLInputElement>('#research-q')!.value = 'x';
    list().querySelector<HTMLFormElement>('.research-form')!.requestSubmit();
    for (let i = 0; i < 4; i++) await tick();
    expect(list().querySelector('.research-results')?.textContent).toContain('Connector unreachable: refused');
  });
});

describe('rail review-1 fixes', () => {
  it('a late answer for a panel that was switched away is dropped', async () => {
    let release: (v: unknown) => void = () => {};
    const slow = new Promise((r) => { release = r; });
    const adapter = createRecordStub(undefined, {
      fetchLessons: async () => { await slow; return { ok: true as const, data: [lesson('9', 'late lesson', 'promoted')] }; },
    });
    await start('/chat', adapter);
    rail('lessons').click();
    expect(list().textContent).toContain('Reading the lessons...');
    rail('audit').click();
    release(null);
    for (let i = 0; i < 6; i++) await tick();
    expect(list().dataset.panel).toBe('audit');
    expect(list().textContent).not.toContain('late lesson');
  });

  it('the active panel is the one refreshed on a navigation; Chat refreshes again when it is back', async () => {
    let entryReads = 0;
    const adapter = createRecordStub(undefined, {
      fetchAllEntries: async () => { entryReads++; return { ok: true as const, data: [makeEntry({ id: 'a', subject: 'turn' })] }; },
    });
    await start('/chat', adapter);
    rail('audit').click();
    for (let i = 0; i < 4; i++) await tick();
    const before = entryReads;
    router!.navigate('/actions');
    for (let i = 0; i < 6; i++) await tick();
    expect(entryReads).toBeGreaterThan(before);
    expect(list().querySelector('.audit-accounts')?.textContent).toBe('turn (1)');
    rail('chat').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(list().querySelector('nav.main-nav a[aria-current="page"]')?.getAttribute('href')).toBe('/actions');
  });

  it('a thrown read on a panel becomes words', async () => {
    const adapter = createRecordStub(undefined, { fetchLessons: async () => { throw new Error('socket closed'); } });
    await start('/chat', adapter);
    rail('lessons').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(list().querySelector('.error-state')?.textContent).toBe('The lessons read failed: socket closed');
  });

  it('the last search is kept across a rail switch', async () => {
    const adapter = createRecordStub(undefined, {
      ask: async (question: string) => ({ ok: true as const, data: { question, state: 'found' as const, text: '', provenance: [{ source: 'stub source', content: 'e', excerpt: 'stub excerpt' }] } }),
    });
    await start('/chat', adapter);
    rail('research').click();
    list().querySelector<HTMLInputElement>('#research-q')!.value = 'storm';
    list().querySelector<HTMLFormElement>('.research-form')!.requestSubmit();
    for (let i = 0; i < 4; i++) await tick();
    rail('lessons').click();
    rail('research').click();
    expect(list().querySelector<HTMLInputElement>('#research-q')!.value).toBe('storm');
    expect(list().querySelector('.research-source')?.textContent).toBe('stub source');
  });
});

describe('boot and the banned list', () => {
  it('the app source names neither cut mask, nor the old app name, nor the old face\'s words', () => {
    const sources = import.meta.glob(['./**/*.ts', './**/*.css', '!./**/*.test.ts', '!./test-helpers.ts'], {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    const banned = /Elara|ARCHETRON|Who do you want|ARCHE runs the persona|Chat with \[|mask-card|AUDIT UI|'Audit UI'|SyncSpace|Acme|proj-apollo|KATIE_CORE|FEED_STATUS|120 FPS|Checkpoint Diffs/;
    const hits = Object.entries(sources).filter(([, text]) => banned.test(text)).map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
