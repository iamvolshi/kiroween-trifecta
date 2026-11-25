/**
 * Telemetry only on /chat; a mini chat (the same ChatView, on the Router's one
 * chatLog) in the right column on every other page. Stub connector = test double.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createLiveAdapter, type FetchLike } from './adapter/live.ts';
import type { ChatTurn } from './adapter/seam.ts';
import { createModelsStub, tick } from './test-helpers.ts';

function turn(message: string): ChatTurn {
  return {
    message,
    known: true,
    step: null,
    total_steps: 0,
    engines: {
      arche: { reply: 'Noted.' },
      erie: null,
      elle: null,
      elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] },
      katie: [],
    },
  };
}

const stub: FetchLike = async (url, init) => {
  if (url.endsWith('/chat')) return new Response(JSON.stringify(turn(JSON.parse(String(init?.body)).message)), { status: 200 });
  if (url.endsWith('/lessons')) return new Response('[]', { status: 200 });
  return new Response('{}', { status: 404 });
};

let root: HTMLElement;
let router: Router | null = null;
afterEach(() => {
  router?.destroy();
  router = null;
  root?.remove();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await tick();
}

async function start(path: string): Promise<void> {
  window.history.replaceState({}, '', path);
  root = document.createElement('div');
  document.body.appendChild(root);
  router = new Router(createLiveAdapter('http://connector.test', stub), root, createModelsStub());
  await settle();
}

const right = (): HTMLElement => root.querySelector<HTMLElement>('.shell-right')!;
const OFF_CHAT = ['/calendar', '/research', '/lessons', '/curator', '/actions', '/record/order-1042', '/entry/1/turn/x'];

describe('right column by page', () => {
  it('/chat: telemetry, no mini chat', async () => {
    await start('/chat');
    expect(right().querySelector('.telemetry')).not.toBeNull();
    expect(right().querySelector('.mini-chat')).toBeNull();
    expect(right().dataset.pane).toBe('telemetry');
  });

  it.each(OFF_CHAT)('%s: mini chat, telemetry not mounted', async (path) => {
    await start(path);
    expect(right().querySelector('.telemetry')).toBeNull();
    expect(right().querySelector('.mini-chat .chat-composer')).not.toBeNull();
    expect(right().querySelector('.mini-chat .voice-picker')).not.toBeNull();
    expect(right().dataset.pane).toBe('mini');
  });

  it('moving between pages swaps the column and /chat gets its telemetry back', async () => {
    await start('/calendar');
    router!.navigate('/chat');
    await settle();
    expect(right().querySelector('.telemetry')).not.toBeNull();
    expect(right().querySelector('.mini-chat')).toBeNull();
    expect(root.querySelectorAll('#chat-message')).toHaveLength(1);
    router!.navigate('/research');
    await settle();
    expect(right().querySelector('.telemetry')).toBeNull();
    expect(right().querySelectorAll('.mini-chat')).toHaveLength(1);
  });
});

describe('the mini chat is the one conversation', () => {
  it('a message sent from the mini chat lands in the shared chat log and shows in /chat', async () => {
    await start('/calendar');
    const log = router!.getChatLog();
    expect(log.turns()).toHaveLength(0);
    right().querySelector<HTMLButtonElement>('.voice-picker [data-voice="book"]')!.click();
    const input = right().querySelector<HTMLInputElement>('.mini-chat #chat-message')!;
    input.value = 'Hello from the side';
    right().querySelector('.mini-chat .chat-composer')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(log.turns().map((t) => t.message)).toEqual(['Hello from the side']);
    expect(log.voice()).toBe('book');
    expect(right().querySelector('.mini-chat .chat-user')?.textContent).toContain('Hello from the side');
    router!.navigate('/chat');
    await settle();
    expect(root.querySelector('.shell-center .chat-transcript')?.textContent).toContain('Hello from the side');
    expect(root.querySelector('.shell-center .chat-transcript')?.textContent).toContain('Noted.');
  });
});