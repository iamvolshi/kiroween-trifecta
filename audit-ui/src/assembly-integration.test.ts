/**
 * The shell on every route: one nav with all four destinations, NotFound for
 * a bad calendar path, and a chat transcript that survives navigation. Runs
 * on the record stub (a test double from test-helpers), with a stub chat.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createModelsStub, createRecordStub, tick } from './test-helpers.ts';
import type { ModelSource } from './views/chat.ts';
import type { ChatTurn } from './adapter/seam.ts';

let container: HTMLElement;
let router: Router | null = null;

function stubTurn(message: string): ChatTurn {
  return {
    message, known: true, step: null, total_steps: 0,
    engines: {
      arche: { reply: `stub reply to ${message}` }, erie: null, elle: null, elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
    },
  };
}

function start(path: string, models?: ModelSource): void {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createRecordStub(undefined, { chat: async (m) => ({ ok: true, data: stubTurn(m) }) }), container, models);
}

afterEach(() => {
  router?.destroy();
  router = null;
  container.remove();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await tick();
}

describe('the shell nav links all four destinations on every route', () => {
  const destinations = ['/actions', '/time-travel', '/chat', '/calendar'];
  const paths = [
    '/actions',
    '/time-travel',
    '/chat',
    '/calendar',
    '/calendar/2026-11',
    '/calendar/2026-11-16',
    '/calendar/2026-11-16/14',
    '/entry/1/temperature/entry-a1',
    '/record/order-1042',
    '/no-such-page',
  ];
  for (const path of paths) {
    it(`${path} renders one nav with all four links`, async () => {
      start(path);
      await settle();
      expect(container.querySelectorAll('nav')).toHaveLength(1);
      expect(container.querySelector('.shell-left nav')).not.toBeNull();
      const hrefs = Array.from(container.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
      for (const d of destinations) expect(hrefs).toContain(d);
      expect(container.querySelectorAll('nav > :not(a)')).toHaveLength(0); // links only, no badge
    });
  }

  it('an invalid calendar path is NotFound', async () => {
    start('/calendar/2026-13');
    await settle();
    expect(container.querySelector('.not-found')).not.toBeNull();
  });

  it('the chat transcript survives navigating away and back', async () => {
    start('/chat', createModelsStub());
    await settle();
    container.querySelector<HTMLButtonElement>('.voice-picker [data-voice="book"]')!.click();
    container.querySelector<HTMLInputElement>('#chat-message')!.value = 'hello';
    container.querySelector<HTMLFormElement>('.chat-composer')!.requestSubmit();
    await settle();
    router!.navigate('/actions');
    router!.navigate('/chat');
    await settle();
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(1);
    expect(container.querySelector('.chat-reply')?.textContent).toContain('stub reply to hello');
  });
});
