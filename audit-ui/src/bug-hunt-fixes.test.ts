/**
 * Bug hunt round 2 (Elara, 2026-11-17): one regression test per fix.
 * MED-1, MED-2, LOW-1, LOW-3, LOW-4, LOW-6, LOW-7, LOW-8.
 * (LOW-5 tested a deleted fixture; LOW-2 was never built.)
 */
import { describe, it, expect, afterEach } from 'vitest';
import indexHtml from '../index.html?raw';
import faviconSvg from '../public/favicon.svg?raw';
import mainTs from './main.ts?raw';
import { ChatView } from './views/chat.ts';
import { ChatLog } from './views/chat-log.ts';
import { ActionListView } from './views/action-list.ts';
import { EntryDetailView } from './views/entry-detail.ts';
import { CalendarView } from './views/calendar.ts';
import { Router } from './router/router.ts';
import { createShell } from './shell/shell.ts';
import { createModelsStub, createRecordStub, createFailingStub } from './test-helpers.ts';
import { NO_ADDRESS_ERROR } from './adapter/live.ts';
import type { ChatTurn } from './adapter/seam.ts';
import { makeEntry, tick } from './test-helpers.ts';
import type { SeamAdapter } from './adapter/seam.ts';

let c: HTMLElement;
afterEach(() => c?.remove());

function host(): HTMLElement {
  c = document.createElement('div');
  document.body.appendChild(c);
  return c;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await tick();
}

describe('MED-1: a throwing chat adapter does not leave Send disabled', () => {
  it('shows the error and re-enables Send', async () => {
    const root = host();
    const throwing: SeamAdapter = {
      ...createRecordStub(),
      chat: async () => {
        throw new Error('network down');
      },
    };
    new ChatView(throwing, new ChatLog(), createModelsStub()).mount(root);
    await settle();
    root.querySelector<HTMLButtonElement>('.voice-picker [data-voice="book"]')!.click();
    const input = root.querySelector<HTMLInputElement>('#chat-message')!;
    const send = root.querySelector<HTMLButtonElement>('.chat-send')!;
    input.value = 'When will my order arrive?';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(send.disabled).toBe(true);
    await settle();
    expect(send.disabled).toBe(false);
    expect(root.querySelector('.chat-error .error-state')?.textContent).toContain('network down');
  });
});

describe('MED-2: card fields, chat lines and the no-match box carry real text labels', () => {
  it('every labelled card value has a spoken label in front of it', async () => {
    const root = host();
    new ActionListView(createRecordStub([makeEntry({ id: 'a' })])).mount(root);
    await settle();
    const li = root.querySelector('.action-list > li')!;
    const spoken = (cls: string) => {
      const v = li.querySelector(`.${cls}`)!;
      const prev = v.previousElementSibling;
      return prev?.classList.contains('sr-only') ? prev.textContent : null;
    };
    expect(spoken('kid')).toBe('KID: ');
    expect(spoken('authority')).toBe('Authority: ');
    expect(spoken('state')).toBe('State: ');
    expect(spoken('reason')).toBe('Why: ');
    expect(spoken('evidence')).toBe('Evidence: ');
    expect(spoken('k-start')).toBe('Live from: ');
    expect(spoken('t-time')).toBe('Wall time: ');
    expect(spoken('e-time')).toBe('Event time: ');
    expect(spoken('k-time')).toBe('Live until: ');
    // Values stay pure, as every older test expects.
    expect(li.querySelector('.authority')!.textContent).toBe('5');
  });

  it('chat lines say who spoke', async () => {
    const root = host();
    const log = new ChatLog();
    const turn: ChatTurn = {
      message: 'hi', known: true, step: null, total_steps: 0,
      engines: {
        arche: { reply: 'hello' }, erie: null, elle: null, elle_promoted: null,
        lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
      },
    };
    const view = new ChatView(createRecordStub(undefined, { chat: async () => ({ ok: true, data: turn }) }), log, createModelsStub());
    view.mount(root);
    await settle();
    root.querySelector<HTMLButtonElement>('.voice-picker [data-voice="young-frankenstein"]')!.click();
    root.querySelector<HTMLInputElement>('#chat-message')!.value = 'hi';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(root.querySelector('.chat-user .sr-only')?.textContent).toBe('You said: ');
    expect(root.querySelector('.chat-reply .sr-only')?.textContent).toBe('Frankenstein (Young Frankenstein) replied: ');
  });

  it('the filters no-match box starts with a spoken "No match" label', async () => {
    const root = host();
    new ActionListView(createRecordStub([makeEntry({ id: 'a', state: 'confirmed', authority: 7 })])).mount(root);
    await settle();
    const press = (filter: string, value: string) =>
      Array.from(root.querySelectorAll<HTMLButtonElement>('.action-filters button'))
        .find((b) => b.dataset.filter === filter && b.dataset.value === value)!
        .click();
    press('band', 'low');
    const empty = root.querySelector('.filter-empty')!;
    expect(empty.firstElementChild?.classList.contains('sr-only')).toBe(true);
    expect(empty.firstElementChild?.textContent).toBe('No match: ');
  });

  it('visible CSS captions that repeat a spoken label are marked decorative', async () => {
    // Vitest blanks CSS imports, so read the files from disk (Node built-in, no new dependency).
    const nodeFs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as unknown as {
      readFileSync(p: URL, enc: 'utf8'): string;
    };
    const css = ['./styles/record-card.css', './styles/chat.css']
      .map((p) => nodeFs.readFileSync(new URL(p, import.meta.url), 'utf8'))
      .join('');
    for (const label of ["'Authority '", "'KID '", "'live from '", "'Why'", "'Evidence'", "'Wall time (t_time)'",
      "'Event time (e_time)'", "'Live until (k_time)'", "'No match'"]) {
      expect(css).toContain(`content: ${label} / '';`);
    }
  });
});

describe('LOW-1: Entry Detail always has its heading and question', () => {
  it('empty and error states keep h1 + intro', async () => {
    for (const adapter of [createRecordStub([]), createFailingStub()]) {
      const root = host();
      new EntryDetailView(adapter, 999, 'nope', 'nope').mount(root);
      expect(root.querySelector('h1')?.textContent).toBe('Entry Detail');
      expect(root.querySelector('.view-intro')?.getAttribute('data-view')).toBe('Entry Detail');
      await settle();
      expect(root.querySelector('h1')?.textContent).toBe('Entry Detail');
      expect(root.querySelector('.empty-state, .error-state')).not.toBeNull();
      expect(root.querySelectorAll('h1')).toHaveLength(1);
      root.remove();
    }
  });

  it('not-found keeps one h1 (the section uses h2)', async () => {
    const root = host();
    new EntryDetailView(createRecordStub([makeEntry({ id: 'real' })]), 1, 'temperature', 'missing').mount(root);
    await settle();
    expect(root.querySelector('.entry-not-found h2')?.textContent).toBe('Entry not found');
    expect(root.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('LOW-3: the tab title and favicon are ours', () => {
  it('index.html title is "Hackenstein" and the favicon is not the Vite logo', () => {
    expect(indexHtml).toContain('<title>Hackenstein</title>');
    expect(faviconSvg).not.toContain('#863bff');
  });
});

describe('LOW-4: the app runs one adapter, the live one, and the header says the line', () => {
  it('main.ts builds the live adapter from the connector address; the header carries the line and no seam chip', () => {
    expect(mainTs).toContain('createLiveAdapter(CONNECTOR_URL)');
    expect(mainTs).not.toContain('createRecordStub');
    const root = host();
    createShell(root);
    expect(root.querySelector('.brand-tag')?.textContent).toBe('Never lies. Learns lessons. Develops identity through use. Multiple persona options.');
    // The seam chip is gone: it claimed "active" while the connector was
    // unreachable, so the header says nothing about the seam at all.
    expect(root.querySelector('.seam-chip')).toBeNull();
    expect(NO_ADDRESS_ERROR).toMatch(/^Connector unreachable: /);
  });
});

describe('LOW-6: the header view label is set from the mounted view', () => {
  const routes: Array<[string, string]> = [
    ['/actions', 'Action List'],
    ['/chat', 'Chat / Observability'],
    ['/calendar/2026-11', 'Calendar'],
    ['/record/order-1042', 'Record'],
    ['/entry/1/temperature/entry-a1', 'Entry Detail'],
    ['/entry/999/nope/nope', 'Entry Detail'],
    ['/no-such-page', 'Not Found'],
  ];
  for (const [path, name] of routes) {
    it(`${path} -> "View: ${name}"`, () => {
      window.history.replaceState({}, '', path);
      const root = host();
      const router = new Router(createRecordStub(), root);
      const label = root.querySelector<HTMLElement>('.brand-view')!;
      expect(label.hidden).toBe(false);
      expect(label.textContent).toBe(`View: ${name}`);
      router.destroy();
    });
  }
});

describe('LOW-7: the month grid has thead, tbody and column scope', () => {
  it('seven scoped column headers in thead, weeks in tbody', async () => {
    const root = host();
    new CalendarView(createRecordStub(), { level: 'month', year: 2026, month: 11 }).mount(root);
    await settle();
    const grid = root.querySelector('table.calendar-grid')!;
    const ths = grid.querySelectorAll('thead th[scope="col"]');
    expect(ths).toHaveLength(7);
    expect(grid.querySelectorAll(':scope > tr')).toHaveLength(0);
    expect(grid.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(4);
  });
});

describe('LOW-8: a skip link is the first Tab stop and moves focus to the view', () => {
  it('first focusable element; click focuses the center without changing the URL', () => {
    window.history.replaceState({}, '', '/actions');
    const root = host();
    const router = new Router(createRecordStub(), root);
    const first = root.querySelector<HTMLElement>('a[href], button')!;
    expect(first.classList.contains('skip-link')).toBe(true);
    first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(document.activeElement).toBe(root.querySelector('.shell-center'));
    expect(window.location.pathname).toBe('/actions');
    expect(window.location.hash).toBe('');
    router.destroy();
  });
});
