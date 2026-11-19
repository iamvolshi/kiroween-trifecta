/**
 * The chat face (visual direction from a reference mockup): mask cards
 * before a pick, the locked composer, the band after a pick, and
 * proof-anchor cards under replies that carry links. Every value comes from
 * the stub connector (a test double), never from the app.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ChatView, type ModelSource } from './chat.ts';
import { ChatLog } from './chat-log.ts';
import { createLiveAdapter, type FetchLike } from '../adapter/live.ts';
import type { ModelStatus } from '../adapter/live-models.ts';
import type { ChatTurn, Entry } from '../adapter/seam.ts';
import { makeEntry, tick } from '../test-helpers.ts';

const STUB_STATUS: ModelStatus = {
  persona: 'entity',
  personas: ['Frankenstein', 'Elara', 'ARCHETRON'],
  default: { provider: 'stub-p0', model: 'stub-m0' },
  registers: { movie: { provider: 'stub-p1', model: 'stub-movie' }, book: { provider: 'stub-p2', model: 'stub-book' } },
  register_voices: ['movie', 'book'],
  persona_routes: {
    Elara: { error: 'ELARA_PROVIDER not set (the Elara mask has no default model)' },
    ARCHETRON: { provider: 'stub-p3', model: 'stub-tron' },
  },
};

const REPLY = 'Audit UI loves thunderstorms at night, the record says.';
const LINKED: Entry = makeEntry({ id: 'stub-e7', kid: 1, subject: 'turn', reason: 'user turn (connector)' });

function stubTurn(message: string, withLinks: boolean): ChatTurn {
  const end = 'Audit UI loves thunderstorms at night'.length;
  return {
    message, known: true, step: null, total_steps: 0,
    served_by: { provider: 'stub-p3', model: 'stub-tron' },
    engines: {
      arche: { reply: REPLY }, erie: null, elle: null, elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
    },
    ...(withLinks ? { links: [{ start: 0, end, kid: 1, subject: 'turn', entry_id: 'stub-e7' }] } : {}),
  };
}

let slot: HTMLElement;
let view: ChatView | null = null;
afterEach(() => {
  view?.unmount();
  view = null;
  slot?.remove();
});

/** A stub connector: /chat answers `turnFor`, /chain answers `chain`. */
function stubFetch(turnFor: (msg: string) => ChatTurn, chain: () => Response): { fetch: FetchLike; chainCalls: string[] } {
  const chainCalls: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    const u = new URL(url);
    if (u.pathname === '/chat') {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(turnFor(body.message)), { status: 200 });
    }
    if (u.pathname === '/chain') {
      chainCalls.push(u.search);
      return chain();
    }
    return new Response('{}', { status: 404 });
  };
  return { fetch, chainCalls };
}

async function mount(fetchImpl: FetchLike, models: ModelSource = { status: async () => ({ ok: true, data: STUB_STATUS }) }) {
  slot = document.createElement('div');
  document.body.appendChild(slot);
  view = new ChatView(createLiveAdapter('http://c.test', fetchImpl), new ChatLog(), models);
  view.mount(slot);
  await tick();
  await tick();
}

const q = <T extends HTMLElement>(sel: string): T | null => slot.querySelector<T>(sel);
async function send(text: string): Promise<void> {
  q<HTMLInputElement>('#chat-message')!.value = text;
  q<HTMLFormElement>('.chat-form')!.requestSubmit();
  for (let i = 0; i < 6; i++) await tick();
}
const noChain = (): Response => new Response('[]', { status: 200 });

describe('before a pick', () => {
  it('three mask cards, Frankenstein with its two positions; composer locked; nothing under the chat box', async () => {
    await mount(stubFetch((m) => stubTurn(m, false), noChain).fetch);
    const cards = Array.from(slot.querySelectorAll<HTMLElement>('.mask-cards .mask-card'));
    expect(cards.map((c) => c.querySelector('.mask-code')?.textContent)).toEqual(['MASK_01', 'MASK_02', 'MASK_03']);
    expect(cards.map((c) => c.dataset.mask)).toEqual(['Frankenstein', 'Elara', 'ARCHETRON']);
    expect(cards.every((c) => (c.querySelector('.mask-voice')?.textContent ?? '') !== '')).toBe(true);
    const positions = Array.from(cards[0]!.querySelectorAll('.mask-position')).map((b) => b.textContent);
    expect(positions).toEqual(['[BOOK] 1818', '[MOVIE] 1931']);
    expect(cards[1]!.querySelector('.mask-position')).toBeNull();
    expect(q('h1')?.textContent).toBe('Chat with [nothing yet]');
    expect(q<HTMLInputElement>('#chat-message')!.disabled).toBe(true);
    expect(q<HTMLInputElement>('#chat-message')!.placeholder).toBe('INPUT // AWAITING_MASK');
    expect(q<HTMLButtonElement>('.chat-form button')!.disabled).toBe(true);
    expect(q('.empty-state')?.textContent).toBe('No messages yet. Choose a persona, then send a message.');
    expect(q('.chat-form .model-slot')!.childNodes).toHaveLength(0);
  });
});

describe('after a pick', () => {
  it('picking a mask unlocks the composer and shows its band; the cards give way to the switcher', async () => {
    await mount(stubFetch((m) => stubTurn(m, false), noChain).fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="ARCHETRON"]')!.click();
    expect(q('.mask-cards')).toBeNull();
    expect(q('.persona-picker [aria-checked="true"]')?.getAttribute('data-value')).toBe('ARCHETRON');
    expect(q('h1')?.textContent).toBe('Chat with ARCHETRON');
    expect(q<HTMLInputElement>('#chat-message')!.disabled).toBe(false);
    expect(q<HTMLInputElement>('#chat-message')!.placeholder).toBe('Message ARCHETRON');
    expect(q('.model-banner .model-position')?.textContent).toBe('ARCHETRON');
    expect(q('.model-banner .model-name')?.textContent).toBe('stub-tron');
    expect(q('.model-banner .model-source')?.textContent).toBe("From the connector's status");
  });

  it('[BOOK] 1818 picks Frankenstein on the Book position', async () => {
    await mount(stubFetch((m) => stubTurn(m, false), noChain).fetch);
    q<HTMLButtonElement>('.mask-cards .mask-position[data-register="book"]')!.click();
    expect(q('.persona-picker [aria-checked="true"]')?.getAttribute('data-value')).toBe('Frankenstein');
    expect(q('.register-switch [aria-checked="true"]')?.getAttribute('data-value')).toBe('book');
    expect(q('.model-banner .model-position')?.textContent).toBe('BOOK');
    expect(q('.model-banner .model-name')?.textContent).toBe('stub-book');
  });

  it('an unconfigured mask shows the connector\'s own words', async () => {
    await mount(stubFetch((m) => stubTurn(m, false), noChain).fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="Elara"]')!.click();
    expect(q('.model-banner')?.getAttribute('data-state')).toBe('unconfigured');
    expect(q('.model-banner .model-name')?.textContent).toBe('Not configured');
    expect(q('.model-banner .model-source')?.textContent).toBe('ELARA_PROVIDER not set (the Elara mask has no default model)');
  });
});

describe('proof-anchor cards', () => {
  it('a reply with links gets one card per linked entry, read live', async () => {
    const s = stubFetch((m) => stubTurn(m, true), () => new Response(JSON.stringify([LINKED]), { status: 200 }));
    await mount(s.fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="ARCHETRON"]')!.click();
    await send('what do you know about me?');
    const link = q<HTMLAnchorElement>('.chat-reply .provenance-link')!;
    expect(link.textContent).toBe('Audit UI loves thunderstorms at night');
    const cards = Array.from(slot.querySelectorAll<HTMLElement>('.chat-turn .proof-card'));
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.dataset.entryId).toBe('stub-e7');
    expect(card.querySelector('.proof-kid')?.textContent).toBe('KID 1');
    expect(card.querySelector('.proof-subject')?.textContent).toBe('turn');
    expect(card.querySelector('.proof-reason')?.textContent).toBe('user turn (connector)');
    expect(card.querySelector('.proof-inspect')?.getAttribute('href')).toBe('/entry/1/turn/stub-e7');
    expect(s.chainCalls).toEqual(['?kid=1&subject=turn']);
  });

  it('a reply without links gets no cards and reads nothing', async () => {
    const s = stubFetch((m) => stubTurn(m, false), noChain);
    await mount(s.fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="ARCHETRON"]')!.click();
    await send('hi');
    expect(q('.chat-turn')).not.toBeNull();
    expect(q('.proof-cards')).toBeNull();
    expect(s.chainCalls).toEqual([]);
  });

  it('a missing entry or a failed read is said in words', async () => {
    await mount(stubFetch((m) => stubTurn(m, true), noChain).fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="ARCHETRON"]')!.click();
    await send('hi');
    expect(q('.proof-reason')?.textContent).toBe('This entry is not in the record.');
    view?.unmount();
    slot.remove();
    await mount(stubFetch((m) => stubTurn(m, true), () => new Response('{"error":"down"}', { status: 503 })).fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="ARCHETRON"]')!.click();
    await send('hi');
    expect(q('.proof-reason')?.textContent).toBe('Connector answered HTTP 503 for /chain?kid=1&subject=turn: down');
    expect(q('.proof-reason')?.getAttribute('data-state')).toBe('error');
  });
});

describe('review-1 additions', () => {
  it('mask cards are plain buttons in Tab order, Frankenstein positions inside its card', async () => {
    await mount(stubFetch((m) => stubTurn(m, false), noChain).fetch);
    expect(q('.mask-cards')?.getAttribute('role')).toBe('group');
    const order = Array.from(slot.querySelectorAll<HTMLButtonElement>('.mask-cards button')).map(
      (b) => b.dataset.value ?? b.textContent,
    );
    expect(order).toEqual(['Frankenstein', '[BOOK] 1818', '[MOVIE] 1931', 'Elara', 'ARCHETRON']);
    expect(slot.querySelectorAll('.mask-cards [role="radio"]')).toHaveLength(0);
    expect(Array.from(slot.querySelectorAll<HTMLButtonElement>('.mask-cards button')).every((b) => b.tabIndex === 0)).toBe(true);
  });

  it('a failed proof read is read again on the next render, and a thrown read is said in words', async () => {
    let fail = true;
    const s = stubFetch((m) => stubTurn(m, true), () =>
      fail ? new Response('{"error":"down"}', { status: 503 }) : new Response(JSON.stringify([LINKED]), { status: 200 }));
    await mount(s.fetch);
    q<HTMLButtonElement>('.mask-cards [data-value="ARCHETRON"]')!.click();
    await send('one');
    expect(q('.proof-reason')?.getAttribute('data-state')).toBe('error');
    fail = false;
    await send('two'); // re-renders the transcript
    const reasons = Array.from(slot.querySelectorAll('.proof-reason')).map((r) => r.textContent);
    expect(reasons).toEqual(['user turn (connector)', 'user turn (connector)']);
    expect(s.chainCalls.length).toBe(2); // the failure was not cached; the success was
  });

  it('a rejected entry read becomes words, never a card stuck on "Reading"', async () => {
    const { renderProofCards } = await import('./proof-cards.ts');
    const box = renderProofCards(stubTurn('x', true), () => Promise.reject(new Error('socket closed')))!;
    for (let i = 0; i < 3; i++) await tick();
    expect(box.querySelector('.proof-reason')?.textContent).toBe('The entry read failed: socket closed');
  });
});

describe('the shell pieces of the face', () => {
  it('an empty feed is the NOT KNOWN box with the order\'s words', async () => {
    const { TelemetryPanel } = await import('../shell/telemetry.ts');
    slot = document.createElement('div');
    document.body.appendChild(slot);
    const adapter = createLiveAdapter('http://c.test', async () => new Response('[]', { status: 200 }));
    new TelemetryPanel(adapter, new ChatLog()).mount(slot);
    for (let i = 0; i < 3; i++) await tick();
    const box = q('.empty-state')!;
    expect(box.textContent).toBe('Nothing has happened yet. Each step the engines take shows up here.');
    // The "NOT KNOWN" label is the empty-state's own caption (style.css .empty-state::before).
    expect(box.className).toBe('empty-state');
  });

  it('the folder value is the LATEST entry\'s authority, not the highest', async () => {
    const { LeftPanel } = await import('../shell/left.ts');
    const entries: Entry[] = [
      makeEntry({ id: 'a', subject: 'turn', authority: 8, k_start: '2026-11-18T15:00:00.000Z' }),
      makeEntry({ id: 'b', subject: 'turn', authority: 3, k_start: '2026-11-18T15:05:00.000Z' }),
    ];
    const adapter = createLiveAdapter('http://c.test', async (url) =>
      new Response(JSON.stringify(new URL(url).pathname === '/entries' ? entries : []), { status: 200 }));
    slot = document.createElement('div');
    document.body.appendChild(slot);
    new LeftPanel(adapter).mount(slot);
    for (let i = 0; i < 4; i++) await tick();
    expect(q('.folder-head-value')?.textContent).toBe('3');
    expect(q('.folder-head-value')?.getAttribute('aria-label')).toBe('authority 3 of 9');
  });
});