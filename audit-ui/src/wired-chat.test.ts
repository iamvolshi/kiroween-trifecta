/**
 * Wired chat: provenance link spans authored by the responding side, proven
 * against the LIVE path with a stub fetch (a test double),
 * through the real Router, ChatView and TelemetryPanel.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createLiveAdapter, type FetchLike } from './adapter/live.ts';
import { validLinks } from './views/chat-turn.ts';
import type { ChatTurn } from './adapter/seam.ts';
import { tick } from './test-helpers.ts';

const SUBJ = 'order-1042.delivery_date';
const REPLY = 'Your order is due on 2026-11-19, after the delay.';

function liveTurn(message: string): ChatTurn {
  const start = REPLY.indexOf('2026-11-19');
  return {
    message,
    known: true,
    step: null,
    total_steps: 0,
    engines: {
      arche: { reply: REPLY },
      erie: null,
      elle: null,
      elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] },
      katie: [
        { kid: 4, subject: SUBJ, entry_id: 'live-1', seated: true },
        { kid: 5, subject: 'parcel-77.status', entry_id: 'live-2', seated: true },
      ],
    },
    links: [{ start, end: start + '2026-11-19'.length, kid: 4, subject: SUBJ, entry_id: 'live-1' }],
  };
}

/** Stub connector: answers /chat with a turn carrying link spans, records the bodies. */
function stubConnector(): { fetch: FetchLike; bodies: unknown[] } {
  const bodies: unknown[] = [];
  const fetch: FetchLike = async (url, init) => {
    if (url.endsWith('/chat')) {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return new Response(JSON.stringify(liveTurn(body.message)), { status: 200 });
    }
    if (url.endsWith('/lessons')) return new Response('[]', { status: 200 });
    return new Response('{}', { status: 404 });
  };
  return { fetch, bodies };
}

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

function start(adapter = createLiveAdapter('http://connector.test', stubConnector().fetch)): void {
  window.history.replaceState({}, '', '/chat');
  root = document.createElement('div');
  document.body.appendChild(root);
  router = new Router(adapter, root);
}

async function chatAs(persona: string, message: string): Promise<void> {
  root.querySelector<HTMLButtonElement>(`.persona-picker [data-value="${persona}"]`)!.click();
  root.querySelector<HTMLInputElement>('#chat-message')!.value = message;
  root.querySelector('.chat-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
}

describe('provenance links (live path, stub connector)', () => {
  it('the live adapter sends persona + register with the chat call', async () => {
    const c = stubConnector();
    start(createLiveAdapter('http://connector.test', c.fetch));
    await chatAs('Frankenstein', 'hello');
    root.querySelector<HTMLButtonElement>('.register-switch [data-value="book"]')!.click();
    await chatAs('Frankenstein', 'again');
    await chatAs('ARCHETRON', 'third');
    expect(c.bodies).toEqual([
      { message: 'hello', persona: 'Frankenstein', register: 'movie' },
      { message: 'again', persona: 'Frankenstein', register: 'book' },
      { message: 'third', persona: 'ARCHETRON' },
    ]);
  });

  it('spans render as links on the words; activating one highlights the feed item, keeps focus, keeps the route', async () => {
    start();
    await chatAs('Elara', 'when?');
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.chat-reply .provenance-link'));
    expect(links.map((a) => a.textContent)).toEqual(['2026-11-19']);
    expect(root.querySelector('.chat-reply .bubble-text')?.textContent).toBe(`Elara replied: ${REPLY}`);
    expect(root.querySelector('.chat-reply')?.textContent).not.toMatch(/provenance:/i);

    const a = links[0]!;
    a.focus();
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    expect(window.location.pathname).toBe('/chat');
    expect(document.activeElement).toBe(a);
    const hit = Array.from(root.querySelectorAll<HTMLElement>('.shell-right .feed-item.is-highlighted'));
    expect(hit.map((li) => li.dataset.entryId)).toEqual(['live-1']);
    expect(root.querySelector('.shell-center .chat-view')).not.toBeNull();
  });

  it('Space on a focused link does the same; no route change', async () => {
    start();
    await chatAs('Elara', 'when?');
    const a = root.querySelector<HTMLAnchorElement>('.provenance-link')!;
    a.focus();
    a.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(root.querySelector<HTMLElement>('.feed-item.is-highlighted')?.dataset.entryId).toBe('live-1');
    expect(window.location.pathname).toBe('/chat');
    expect(document.activeElement).toBe(a);
  });

  it('a link whose feed item is not rendered breaks nothing', async () => {
    start();
    await chatAs('Elara', 'when?');
    root.querySelector('.shell-right .activity-feed')!.replaceChildren();
    const a = root.querySelector<HTMLAnchorElement>('.provenance-link')!;
    expect(() => a.click()).not.toThrow();
    expect(window.location.pathname).toBe('/chat');
  });

  it('out-of-range or overlapping spans render as plain text', () => {
    const ok = { start: 0, end: 4, kid: 1, subject: 's', entry_id: 'a' };
    expect(
      validLinks('abcdefgh', [
        { ...ok, start: 2, end: 6 },
        ok,
        { ...ok, start: 5, end: 99 },
        { ...ok, start: 6, end: 6 },
        { ...ok, start: 6, end: 8, entry_id: 'b' },
      ]).map((l) => [l.start, l.end]),
    ).toEqual([[0, 4], [6, 8]]);
  });
});

describe('review-1 fixes', () => {
  it('a connector reply that is not a ChatTurn is refused in words, and the chat keeps working', async () => {
    let n = 0;
    const fetch: FetchLike = async (url, init) => {
      if (url.endsWith('/chat')) {
        n++;
        const body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify(n === 1 ? { reply: 'wrong shape' } : liveTurn(body.message)), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    };
    start(createLiveAdapter('http://connector.test', fetch));
    await chatAs('Elara', 'first');
    expect(root.querySelector('.chat-error .error-state')?.textContent).toMatch(/not a ChatTurn/);
    expect(root.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
    await chatAs('Elara', 'second');
    expect(root.querySelectorAll('.chat-turn')).toHaveLength(1);
  });

  it('a highlight survives the feed re-rendering after the next turn', async () => {
    start();
    await chatAs('Elara', 'one');
    root.querySelector<HTMLAnchorElement>('.provenance-link')!.click();
    await chatAs('Elara', 'two');
    const hit = Array.from(root.querySelectorAll<HTMLElement>('.shell-right .feed-item.is-highlighted'));
    expect(hit).toHaveLength(1);
    expect(hit[0]!.dataset.entryId).toBe('live-1');
  });
});
