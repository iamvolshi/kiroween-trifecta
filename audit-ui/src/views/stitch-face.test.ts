/**
 * The engine boxes (KTIE / ERIE / ELLE down the reply's right side) and the
 * specific feed they open in the terminal, plus the shell pieces of the face
 * that stay (the empty feed, the folder value). Every value comes from stub
 * turns and the record stub (test doubles), never from the app.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ChatLog } from './chat-log.ts';
import { createLiveAdapter } from '../adapter/live.ts';
import type { ChatTurn, Entry, Lesson } from '../adapter/seam.ts';
import { createModelsStub, createRecordStub, makeEntry, tick } from '../test-helpers.ts';
import { Router } from '../router/router.ts';
import { engineLit, renderEngineBoxes } from './engine-boxes.ts';
import { renderChatTurn } from './chat-turn.ts';
import { engineFocusChannel } from '../shell/engine-focus-channel.ts';

const lesson = (rule: string, status: Lesson['status'] = 'promoted'): Lesson => ({
  event_id: `l-${rule}`, event_type: 'derived', detail: rule, rule: null, subject: null, status,
});

type Engines = ChatTurn['engines'];
const NONE: Omit<Engines, 'arche'> = {
  erie: null, elle: null, elle_promoted: null,
  lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
};
const WROTE = { katie: [{ kid: 1, subject: 'turn', entry_id: 'stub-e1', seated: true }, { kid: 1, subject: 'turn', entry_id: 'stub-e2', seated: true }] };
const FOUND = { erie: { question: 'q', state: 'found' as const, text: 'stub thunderstorms', provenance: [{ source: 'stub source', content: 'stub-e1', excerpt: 'stub excerpt' }] } };
const NOT_FOUND = { erie: { question: 'zzz', state: 'not_found' as const, text: '', provenance: [] } };

/** A stub turn with the engine activity given; everything else did nothing. */
function stubTurn(message: string, over: Partial<Omit<Engines, 'arche'>> = {}): ChatTurn {
  return {
    message, known: true, step: null, total_steps: 0,
    engines: { arche: { reply: `stub reply to ${message}` }, ...NONE, ...over },
  };
}

/** The turn each message gets from the stub chat. */
const TURNS: Record<string, ChatTurn> = {
  all: stubTurn('all', { ...WROTE, ...FOUND, elle_promoted: lesson('stub speaker loves thunderstorms') }),
  'elle-dark': stubTurn('elle-dark', { ...WROTE, ...NOT_FOUND }),
  nothing: stubTurn('nothing'),
};

let container: HTMLElement;
let router: Router | null = null;
afterEach(() => {
  router?.destroy();
  router = null;
  container?.remove();
  engineFocusChannel.publish(null);
});

async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await tick();
}

async function start(): Promise<void> {
  window.history.replaceState({}, '', '/chat');
  container = document.createElement('div');
  document.body.appendChild(container);
  const entries = [makeEntry({ id: 'stub-e1', subject: 'turn', evidence: 'stub evidence one' }), makeEntry({ id: 'stub-e2', subject: 'turn', evidence: 'Frankenstein' })];
  const adapter = createRecordStub(entries, { chat: async (m: string) => ({ ok: true as const, data: TURNS[m]! }) });
  router = new Router(adapter, container, createModelsStub());
  await settle();
  container.querySelector<HTMLButtonElement>('.voice-picker [data-voice="book"]')!.click();
}

async function say(message: string): Promise<void> {
  container.querySelector<HTMLInputElement>('#chat-message')!.value = message;
  container.querySelector<HTMLFormElement>('.chat-composer')!.requestSubmit();
  await settle();
}

const replyBoxes = (turn: number): HTMLButtonElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('.chat-turn')[turn]!.querySelectorAll<HTMLButtonElement>('.engine-box'));
const box = (turn: number, label: string): HTMLButtonElement => replyBoxes(turn).find((b) => b.textContent === label)!;
const right = (): HTMLElement => container.querySelector<HTMLElement>('.shell-right')!;

describe('engine boxes beside a reply', () => {
  it('three real buttons per reply, KTIE / ERIE / ELLE top to bottom, on the reply row only', async () => {
    await start();
    await say('all');
    const turn = container.querySelector('.chat-turn')!;
    expect(turn.querySelector('.bubble-row-user .engine-boxes')).toBeNull();
    const col = turn.querySelector('.bubble-row-reply > .engine-boxes')!;
    expect(col.getAttribute('aria-label')).toBe('Engines on this turn');
    // The column sits beside the bubble, on its right.
    expect(Array.from(turn.querySelector('.bubble-row-reply')!.children).map((c) => c.className)).toEqual(['bubble chat-reply', 'engine-boxes']);
    const boxes = replyBoxes(0);
    expect(boxes.map((b) => b.textContent)).toEqual(['KTIE', 'ERIE', 'ELLE']);
    expect(boxes.every((b) => b.tagName === 'BUTTON' && b.type === 'button')).toBe(true);
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Show KTIE detail for this turn', 'Show ERIE detail for this turn', 'Show ELLE detail for this turn',
    ]);
    expect(boxes.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
    expect(container.querySelector('.proof-card, .proof-cards')).toBeNull();
    // Lit or dark is said in words too, not by colour alone.
    expect(boxes.map((b) => b.getAttribute('aria-description'))).toEqual(['Worked this turn', 'Worked this turn', 'Worked this turn']);
  });

  it('lit when the engine worked the turn: all three; ELLE dark; none', async () => {
    await start();
    await say('all');
    await say('elle-dark');
    await say('nothing');
    const lit = (t: number): string[] => replyBoxes(t).map((b) => b.dataset.lit!);
    expect(lit(0)).toEqual(['true', 'true', 'true']);
    expect(lit(1)).toEqual(['true', 'true', 'false']); // ERIE looked and found nothing: still lit
    expect(lit(2)).toEqual(['false', 'false', 'false']);
    expect(replyBoxes(1)[2]!.getAttribute('aria-description')).toBe('Sat this turn out');
  });

  it('the lit rule reads each ELLE event: injected, held, recorded, promoted', () => {
    const elle = (over: Partial<Omit<Engines, 'arche'>>): boolean => engineLit(stubTurn('x', over), 'ELLE');
    expect(elle({})).toBe(false);
    expect(elle({ lessons_in_prompt: { subjects: [], injected: [lesson('a')], held: [] } })).toBe(true);
    expect(elle({ lessons_in_prompt: { subjects: [], injected: [], held: [lesson('b', 'candidate')] } })).toBe(true);
    expect(elle({ elle: lesson('c', 'candidate') })).toBe(true);
    expect(elle({ elle_promoted: lesson('d') })).toBe(true);
    expect(engineLit(stubTurn('x', NOT_FOUND), 'ERIE')).toBe(true);
    expect(engineLit(stubTurn('x', FOUND), 'ERIE')).toBe(true);
    expect(engineLit(stubTurn('x'), 'ERIE')).toBe(false);
    expect(engineLit(stubTurn('x', WROTE), 'KATIE')).toBe(true);
    expect(engineLit(stubTurn('x'), 'KATIE')).toBe(false);
  });

  it('a not-knowing turn gets its boxes too', () => {
    const t = { ...stubTurn('x', WROTE), known: false };
    const root = renderChatTurn(t, 'book', 4);
    expect(root.classList.contains('not-knowing')).toBe(true);
    expect(Array.from(root.querySelectorAll<HTMLElement>('.bubble-row-reply .engine-box')).map((b) => [b.textContent, b.dataset.turn])).toEqual([
      ['KTIE', '4'], ['ERIE', '4'], ['ELLE', '4'],
    ]);
    expect(renderEngineBoxes(t, 4).querySelectorAll('.engine-box')).toHaveLength(3);
  });
});

describe('a box opens its engine\'s feed for that turn', () => {
  it('clicking a box swaps the right column to that engine\'s events; the chat does not move', async () => {
    await start();
    await say('all');
    const center = container.querySelector('.shell-center')!.firstElementChild;
    box(0, 'KTIE').click();
    expect(window.location.pathname).toBe('/chat');
    expect(container.querySelector('.shell-center')!.firstElementChild).toBe(center);
    expect(right().querySelector('.engine-detail-title')?.textContent).toBe('KTIE \u2014 this turn');
    expect(right().querySelector('.engine-detail-name')?.textContent).toBe('KTIE');
    expect(right().querySelector('.engine-detail-back')?.textContent).toBe('\u2190 All activity');
    // The general feed is gone; the detail holds KATIE's item only, in the feed's own words.
    expect(right().querySelectorAll('.activity-feed')).toHaveLength(1);
    const items = Array.from(right().querySelectorAll<HTMLElement>('.engine-detail .feed-item'));
    expect(items.map((i) => i.dataset.engine)).toEqual(['KATIE']);
    expect(items[0]!.querySelector('.feed-text')?.textContent).toBe('KTIE recorded 2 entries for this turn.');
    expect(Array.from(items[0]!.querySelectorAll('.katie-link')).map((a) => a.getAttribute('href'))).toEqual(['/entry/1/turn/stub-e1', '/entry/1/turn/stub-e2']);
    expect(items[0]!.querySelector('.feed-from')?.textContent).toBe('from: "all"');
    expect(box(0, 'KTIE').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('dialog, .modal')).toBeNull();
  });

  it('ERIE shows its sources; ELLE shows its lessons', async () => {
    await start();
    await say('all');
    box(0, 'ERIE').click();
    expect(right().querySelector('.engine-detail .feed-text')?.textContent).toBe('ERIE found what this needs: stub thunderstorms');
    expect(right().querySelector('.engine-detail .feed-source')?.textContent).toBe('stub source stub excerpt');
    box(0, 'ELLE').click();
    expect(right().querySelector('.engine-detail .feed-text')?.textContent).toBe('ELLE promoted a lesson: stub speaker loves thunderstorms');
  });

  it('the back button returns to the general feed', async () => {
    await start();
    await say('all');
    box(0, 'KTIE').click();
    right().querySelector<HTMLButtonElement>('.engine-detail-back')!.click();
    expect(right().querySelector('.engine-detail-head')).toBeNull();
    expect(right().querySelectorAll('.activity-feed .feed-item')).toHaveLength(3);
    expect(replyBoxes(0).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false']);
  });

  it('clicking the focused box toggles back; a second box switches', async () => {
    await start();
    await say('all');
    box(0, 'KTIE').click();
    box(0, 'ERIE').click();
    expect(right().querySelector('.engine-detail-name')?.textContent).toBe('ERIE');
    expect(replyBoxes(0).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    box(0, 'ERIE').click();
    expect(right().querySelector('.engine-detail-head')).toBeNull();
    expect(engineFocusChannel.current()).toBeNull();
  });

  it('a dark box says, in words, that its engine did nothing', async () => {
    await start();
    await say('elle-dark');
    box(0, 'ELLE').click();
    expect(right().querySelector('.engine-detail-none')?.textContent).toBe('ELLE did nothing on this turn.');
    expect(right().querySelector('.engine-detail .feed-item, .empty-state, .error-state')).toBeNull();
    await say('nothing');
    box(1, 'KTIE').click();
    expect(right().querySelector('.engine-detail-none')?.textContent).toBe('KTIE did nothing on this turn.');
  });

  it('the focus sticks across a new turn; the new reply\'s boxes show it', async () => {
    await start();
    await say('all');
    box(0, 'KTIE').click();
    await say('elle-dark');
    expect(right().querySelector('.engine-detail-name')?.textContent).toBe('KTIE');
    expect(right().querySelector('.engine-detail .feed-from')?.textContent).toBe('from: "all"');
    expect(box(0, 'KTIE').getAttribute('aria-pressed')).toBe('true');
    expect(box(1, 'KTIE').getAttribute('aria-pressed')).toBe('false');
    // Back: the general feed now holds both turns, oldest first.
    right().querySelector<HTMLButtonElement>('.engine-detail-back')!.click();
    expect(Array.from(right().querySelectorAll('.feed-from')).map((f) => f.textContent)).toEqual([
      'from: "all"', 'from: "all"', 'from: "all"', 'from: "elle-dark"', 'from: "elle-dark"',
    ]);
  });
});

describe('the shell pieces of the face', () => {
  it('an empty feed is the NOT KNOWN box with the order\'s words', async () => {
    const { TelemetryPanel } = await import('../shell/telemetry.ts');
    container = document.createElement('div');
    document.body.appendChild(container);
    const adapter = createLiveAdapter('http://c.test', async () => new Response('[]', { status: 200 }));
    new TelemetryPanel(adapter, new ChatLog()).mount(container);
    for (let i = 0; i < 3; i++) await tick();
    const empty = container.querySelector('.empty-state')!;
    expect(empty.textContent).toBe('Nothing has happened yet. Each step the engines take shows up here.');
    // The "NOT KNOWN" label is the empty-state's own caption (style.css .empty-state::before).
    expect(empty.className).toBe('empty-state');
  });

  it('the folder value is the LATEST entry\'s authority, not the highest', async () => {
    const { LeftPanel } = await import('../shell/left.ts');
    const entries: Entry[] = [
      makeEntry({ id: 'a', subject: 'turn', authority: 8, k_start: '2026-11-18T15:00:00.000Z' }),
      makeEntry({ id: 'b', subject: 'turn', authority: 3, k_start: '2026-11-18T15:05:00.000Z' }),
    ];
    const adapter = createLiveAdapter('http://c.test', async (url) =>
      new Response(JSON.stringify(new URL(url).pathname === '/entries' ? entries : []), { status: 200 }));
    container = document.createElement('div');
    document.body.appendChild(container);
    new LeftPanel(adapter).mount(container);
    for (let i = 0; i < 4; i++) await tick();
    expect(container.querySelector('.folder-head-value')?.textContent).toBe('3');
    expect(container.querySelector('.folder-head-value')?.getAttribute('aria-label')).toBe('authority 3 of 9');
  });
});
