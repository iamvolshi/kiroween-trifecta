/**
 * The chat face after the restart: a centered chat-app column, nothing on
 * screen before a pick but the voice chips and the locked composer; three
 * small chips from /models; the picked voice's accent; bubbles user right,
 * replies left. Voices and models come from a /models test double.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { SeamAdapter, ChatTurn, AdapterResult, ChatOptions, Register } from '../adapter/seam.ts';
import { ChatView, AWAITING_MASK, type ModelSource } from './chat.ts';
import { ChatLog } from './chat-log.ts';
import { createModelsStub, tick, deferred } from '../test-helpers.ts';
import { renderChatTurn } from './chat-turn.ts';

function turn1(): ChatTurn {
  return {
    message: 'When will my order arrive?',
    known: true,
    step: 1,
    total_steps: 4,
    engines: {
      arche: { reply: 'Your order arrives 2026-11-18.' },
      erie: {
        question: 'When will my order arrive?',
        state: 'found',
        text: 'Order system says 2026-11-18',
        provenance: [{ source: 'order system', content: 'order-1042', excerpt: 'delivery 2026-11-18' }],
      },
      elle: null,
      elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] },
      katie: [{ kid: 4, subject: 'order-1042.delivery_date', entry_id: 'scn-s1', seated: true }],
    },
  };
}

function turnUnknown(): ChatTurn {
  return { ...turn1(), message: 'blah', known: false, engines: { ...turn1().engines, arche: { reply: "I don't know." }, erie: null, katie: [] } };
}

/** A chat adapter double: records each call and its options. */
function fake(fn: (m: string) => Promise<AdapterResult<ChatTurn>>): {
  adapter: SeamAdapter;
  calls: string[];
  options: Array<ChatOptions | undefined>;
} {
  const calls: string[] = [];
  const options: Array<ChatOptions | undefined> = [];
  const adapter = {
    chat: (m: string, o?: ChatOptions) => {
      calls.push(m);
      options.push(o);
      return fn(m);
    },
  } as unknown as SeamAdapter;
  return { adapter, calls, options };
}

let container: HTMLElement;

async function open(adapter: SeamAdapter, log = new ChatLog(), models: ModelSource = createModelsStub()): Promise<ChatView> {
  const view = new ChatView(adapter, log, models);
  view.mount(container);
  await tick();
  await tick();
  return view;
}

function pick(voice: Register): void {
  container.querySelector<HTMLButtonElement>(`.voice-picker [data-voice="${voice}"]`)!.click();
}

function send(text: string): void {
  container.querySelector<HTMLInputElement>('#chat-message')!.value = text;
  container.querySelector<HTMLFormElement>('.chat-composer')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

const input = (): HTMLInputElement => container.querySelector<HTMLInputElement>('#chat-message')!;
const sendBtn = (): HTMLButtonElement => container.querySelector<HTMLButtonElement>('.chat-send')!;

beforeEach(() => {
  container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
});

describe('before the first pick: the picker and the composer, nothing else', () => {
  it('no greeting, no explainer, no mask cards, no NOT KNOWN panel, no "Chat with" strip', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    const view = container.querySelector<HTMLElement>('.chat-view')!;
    // What is on screen: three chips, the composer's button. The h1 and label are screen-reader only.
    expect(container.querySelector('h1')?.classList.contains('sr-only')).toBe(true);
    expect(container.querySelector('label[for="chat-message"]')?.classList.contains('sr-only')).toBe(true);
    const visible = Array.from(view.querySelectorAll<HTMLElement>('*'))
      .filter((e) => e.children.length === 0 && !e.closest('.sr-only'))
      .map((e) => e.textContent)
      .filter((t) => t !== '');
    expect(visible).toEqual(['[BOOK]', '1818', '[MOVIE]', '1931', '[YOUNG FRANKENSTEIN]', '1974', 'Send']);
    for (const gone of ['.mask-cards', '.mask-card', '.view-intro', '.empty-state', '.persona-picker', '.chat-controls']) {
      expect(container.querySelector(gone)).toBeNull();
    }
    expect(view.textContent).not.toMatch(/who do you want|ARCHE runs|Chat with|nothing yet|No messages yet|NOT KNOWN/i);
    expect(container.querySelector('.chat-transcript')!.childNodes).toHaveLength(0);
    expect(container.querySelector('.model-slot')!.childNodes).toHaveLength(0);
  });

  it('the composer is locked, with the awaiting placeholder; a submit does nothing', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    expect(input().disabled).toBe(true);
    expect(input().placeholder).toBe(AWAITING_MASK);
    expect(AWAITING_MASK).toBe('INPUT // AWAITING_MASK');
    expect(sendBtn().disabled).toBe(true);
    // The send button sits inside the composer box.
    expect(sendBtn().parentElement?.classList.contains('chat-composer')).toBe(true);
    send('hi');
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('the chips sit directly above the composer, in the column, in order Book, Movie, Young Frankenstein', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    const dock = container.querySelector('.chat-column > .chat-dock')!;
    expect(Array.from(dock.children).map((c) => c.className)).toEqual(['voice-slot', 'chat-composer', 'model-slot']);
    const chips = Array.from(container.querySelectorAll<HTMLButtonElement>('.voice-picker .voice-chip'));
    expect(chips.map((c) => c.textContent)).toEqual(['[BOOK] 1818', '[MOVIE] 1931', '[YOUNG FRANKENSTEIN] 1974']);
    expect(chips.map((c) => c.dataset.voice)).toEqual(['book', 'movie', 'young-frankenstein']);
    expect(container.querySelector('.voice-picker')?.getAttribute('role')).toBe('radiogroup');
    expect(chips.every((c) => c.getAttribute('role') === 'radio' && c.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('the picker renders the voices /models reports, and only those', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    // The live connector before the third voice reports two.
    await open(adapter, new ChatLog(), createModelsStub({}, ['movie', 'book']));
    expect(Array.from(container.querySelectorAll('.voice-chip')).map((c) => c.textContent)).toEqual(['[BOOK] 1818', '[MOVIE] 1931']);
  });

  it('a /models answer with no voice the app knows says so in words', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter, new ChatLog(), createModelsStub({}, ['radio']));
    expect(container.querySelector('.voice-picker')).toBeNull();
    expect(container.querySelector('.voice-slot .error-state')?.textContent).toBe('The connector reports no voices.');
    expect(input().disabled).toBe(true);
  });
});

describe('picking a voice', () => {
  it('unlocks the composer, checks the chip, names the voice in the placeholder', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    pick('book');
    expect(input().disabled).toBe(false);
    expect(sendBtn().disabled).toBe(false);
    expect(input().placeholder).toBe('Message Book');
    expect(container.querySelector('.voice-picker [data-voice="book"]')?.getAttribute('aria-checked')).toBe('true');
    // Focus stays on the chip just picked; the picker stays for switching.
    expect((document.activeElement as HTMLElement).dataset.voice).toBe('book');
    pick('young-frankenstein');
    expect(input().placeholder).toBe('Message Young Frankenstein');
    expect(container.querySelectorAll('.voice-chip[aria-checked="true"]')).toHaveLength(1);
  });

  it('the accent follows the voice: the view, the picked chip and each reply carry it', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    const view = container.querySelector<HTMLElement>('.chat-view')!;
    expect(view.dataset.voice).toBeUndefined();
    pick('book');
    expect(view.dataset.voice).toBe('book');
    send('one');
    await tick();
    pick('movie');
    expect(view.dataset.voice).toBe('movie');
    send('two');
    await tick();
    pick('young-frankenstein');
    expect(view.dataset.voice).toBe('young-frankenstein');
    const replies = Array.from(container.querySelectorAll<HTMLElement>('.chat-reply'));
    expect(replies.map((r) => r.dataset.voice)).toEqual(['book', 'movie']);
    expect(container.querySelector('.model-banner')?.getAttribute('data-position')).toBe('young-frankenstein');
  });

  it('arrow keys move through the chips and pick', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    const log = new ChatLog();
    await open(adapter, log);
    pick('book');
    container.querySelector('.voice-picker [data-voice="book"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(log.voice()).toBe('movie');
    container.querySelector('.voice-picker [data-voice="movie"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, altKey: true }));
    expect(log.voice()).toBe('movie'); // modified arrows are the browser's
  });
});

describe('talking', () => {
  it('submit renders the user bubble on the right and the reply on the left, no engine grid', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    pick('movie');
    send('When will my order arrive?');
    await tick();
    expect(calls).toEqual(['When will my order arrive?']);
    expect(container.querySelector('.bubble-row-user .chat-user')?.textContent).toContain('When will my order arrive?');
    expect(container.querySelector('.bubble-row-reply .chat-reply')?.textContent).toContain('Your order arrives');
    expect(container.querySelector('.engines, .engine, .engine-label, .provenance')).toBeNull();
    expect(input().value).toBe('');
    expect(sendBtn().disabled).toBe(false);
  });

  it('attribution names the voice that replied; switching changes later replies only', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    pick('book');
    send('one');
    await tick();
    pick('young-frankenstein');
    send('two');
    await tick();
    const replies = Array.from(container.querySelectorAll('.chat-reply'));
    expect(replies.map((r) => r.querySelector('.sr-only')?.textContent)).toEqual([
      'Frankenstein (Book) replied: ',
      'Frankenstein (Young Frankenstein) replied: ',
    ]);
    expect(replies.map((r) => r.querySelector('.bubble-name')?.textContent)).toEqual(['Frankenstein (Book)', 'Frankenstein (Young Frankenstein)']);
    expect(container.textContent).not.toContain('ARCHE replied');
  });

  it('sends the mask and the picked voice with every call', async () => {
    const { adapter, options } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    for (const v of ['movie', 'book', 'young-frankenstein'] as const) {
      pick(v);
      send(v);
      await tick();
    }
    expect(options).toEqual([
      { persona: 'Frankenstein', register: 'movie' },
      { persona: 'Frankenstein', register: 'book' },
      { persona: 'Frankenstein', register: 'young-frankenstein' },
    ]);
  });

  it('not-knowing reply keeps its own treatment', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turnUnknown() }));
    await open(adapter);
    pick('book');
    send('blah');
    await tick();
    expect(container.querySelector('.chat-turn.not-knowing .chat-reply')).not.toBeNull();
  });

  it('an error result shows error-state and is not logged', async () => {
    const log = new ChatLog();
    const { adapter } = fake(async () => ({ ok: false, error: 'Young Frankenstein is not configured: YOUNG_FRANKENSTEIN_PROVIDER not set' }));
    await open(adapter, log);
    pick('young-frankenstein');
    send('hi');
    await tick();
    expect(container.querySelector('.chat-error .error-state')?.textContent).toBe('Young Frankenstein is not configured: YOUNG_FRANKENSTEIN_PROVIDER not set');
    expect(log.turns()).toHaveLength(0);
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(0);
    expect(sendBtn().disabled).toBe(false);
  });

  it('blank input does not call chat', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    await open(adapter);
    pick('book');
    send('   ');
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('disables Send while waiting, also across a voice switch', async () => {
    const d = deferred<AdapterResult<ChatTurn>>();
    const { adapter } = fake(() => d.promise);
    await open(adapter);
    pick('book');
    send('hi');
    expect(sendBtn().disabled).toBe(true);
    pick('movie');
    expect(sendBtn().disabled).toBe(true);
    d.resolve({ ok: true, data: turn1() });
    await tick();
    expect(sendBtn().disabled).toBe(false);
  });

  it('a reply after unmount does not render, but the turn is still logged with its voice', async () => {
    const d = deferred<AdapterResult<ChatTurn>>();
    const log = new ChatLog();
    const { adapter } = fake(() => d.promise);
    const view = await open(adapter, log);
    pick('book');
    send('hi');
    view.unmount();
    d.resolve({ ok: true, data: turn1() });
    await tick();
    expect(container.innerHTML).toBe('');
    expect(log.turns()).toHaveLength(1);
    expect(log.voiceAt(0)).toBe('book');
  });

  it('the log and the picked voice survive a remount', async () => {
    const log = new ChatLog();
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    const v1 = await open(adapter, log);
    pick('movie');
    send('hi');
    await tick();
    v1.unmount();
    await open(adapter, log);
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(1);
    expect(container.querySelector('.voice-picker [data-voice="movie"]')?.getAttribute('aria-checked')).toBe('true');
    expect(input().disabled).toBe(false);
    expect(container.querySelector<HTMLElement>('.chat-view')!.dataset.voice).toBe('movie');
  });
});

describe('renderChatTurn', () => {
  it('a turn with no recorded voice still names the mask, never ARCHE', () => {
    const root = renderChatTurn(turn1(), null);
    expect(root.querySelector('.chat-reply .sr-only')?.textContent).toBe('Frankenstein replied: ');
    expect(root.querySelector<HTMLElement>('.chat-reply')!.dataset.voice).toBeUndefined();
  });

  it('no provenance list and no engine panel in a turn', () => {
    const root = renderChatTurn(turn1(), 'book');
    expect(root.querySelector('.engines')).toBeNull();
    expect(root.textContent).not.toContain('order system');
  });
});
