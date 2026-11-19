import { describe, it, expect, beforeEach } from 'vitest';
import type { SeamAdapter, ChatTurn, AdapterResult, ChatOptions, Persona } from '../adapter/seam.ts';
import { ChatView } from './chat.ts';
import { ChatLog } from './chat-log.ts';
import { tick, deferred } from '../test-helpers.ts';
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
  return {
    message: 'blah',
    known: false,
    step: null,
    total_steps: 4,
    engines: {
      arche: { reply: "I don't know. There is no record of that." },
      erie: null,
      elle: null,
      elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] },
      katie: [],
    },
  };
}

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

function pick(container: HTMLElement, persona: Persona): void {
  container.querySelector<HTMLButtonElement>(`.persona-picker [data-value="${persona}"]`)!.click();
}

function send(container: HTMLElement, text: string): void {
  const input = container.querySelector<HTMLInputElement>('#chat-message')!;
  input.value = text;
  container.querySelector<HTMLFormElement>('.chat-form')!.dispatchEvent(
    new Event('submit', { cancelable: true, bubbles: true }),
  );
}

describe('ChatView', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  it('before a persona is chosen: picker, disabled composer, words, labeled input', () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    expect(container.querySelector('nav.main-nav')).toBeNull(); // the shell owns the nav
    expect(container.querySelector('h1')?.textContent).toBe('Chat with [nothing yet]');
    const radios = Array.from(container.querySelectorAll<HTMLButtonElement>('.persona-picker [role="radio"]'));
    expect(radios.map((b) => b.dataset.value)).toEqual(['Frankenstein', 'Elara', 'ARCHETRON']);
    expect(radios.map((b) => b.querySelector('.mask-name')?.textContent)).toEqual(['Frankenstein', 'Elara', 'ARCHETRON']);
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.placeholder).toBe('INPUT // AWAITING_MASK');
    expect(radios.every((b) => b.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(container.querySelector('.persona-picker')?.getAttribute('role')).toBe('radiogroup');
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(true);
    expect(container.querySelector('.persona-required')?.textContent).toBe('Choose a persona to start chatting.');
    const label = container.querySelector('label[for="chat-message"]')!;
    expect(label.textContent).toBe('Your message');
    expect(label.classList.contains('sr-only')).toBe(true);
    expect(container.querySelector('.step-progress')).toBeNull();
    expect(container.querySelector('.empty-state')?.textContent).toMatch(/No messages yet/);
  });

  it('a submit before choosing a persona does nothing', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    send(container, 'hi');
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('choosing a persona enables the composer, checks it and names it in the heading', () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'Elara');
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
    expect(container.querySelector('.persona-picker [data-value="Elara"]')?.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('h1')?.textContent).toBe('Chat with Elara');
    expect(container.querySelector('.persona-required')).toBeNull();
    // focus stays on the chosen option after the picker re-renders
    expect((document.activeElement as HTMLElement).dataset.value).toBe('Elara');
  });

  it('arrow keys move through the picker and choose', () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    const log = new ChatLog();
    new ChatView(adapter, log).mount(container);
    pick(container, 'Frankenstein');
    container
      .querySelector('.persona-picker [data-value="Frankenstein"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(log.persona()).toBe('Elara');
  });

  it('submit renders the user bubble on the right and the reply on the left, no engine grid', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'ARCHETRON');
    send(container, 'When will my order arrive?');
    await tick();
    expect(calls).toEqual(['When will my order arrive?']);
    expect(container.querySelector('.bubble-row-user .chat-user')?.textContent).toContain('When will my order arrive?');
    expect(container.querySelector('.bubble-row-reply .chat-reply')?.textContent).toContain('Your order arrives');
    expect(container.querySelector('.engines, .engine, .engine-label, .provenance')).toBeNull();
    expect(container.textContent).not.toContain('did not act this turn');
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.value).toBe('');
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
  });

  it('attribution names the persona that replied; switching changes later replies only', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'Frankenstein');
    send(container, 'one');
    await tick();
    pick(container, 'Elara');
    send(container, 'two');
    await tick();
    const replies = Array.from(container.querySelectorAll('.chat-reply'));
    expect(replies.map((r) => r.querySelector('.sr-only')?.textContent)).toEqual([
      'Frankenstein replied: ',
      'Elara replied: ',
    ]);
    expect(replies.map((r) => r.querySelector('.bubble-name')?.textContent)).toEqual(['Frankenstein', 'Elara']);
    expect(container.textContent).not.toContain('ARCHE replied');
    expect(container.querySelector('h1')?.textContent).toBe('Chat with Elara');
  });

  it('the Book / Movie switch shows only for Frankenstein and defaults to Movie', () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    expect(container.querySelector('.register-switch')).toBeNull();
    pick(container, 'Elara');
    expect(container.querySelector('.register-switch')).toBeNull();
    pick(container, 'Frankenstein');
    const sw = container.querySelector('.register-switch')!;
    expect(sw.getAttribute('role')).toBe('radiogroup');
    expect(sw.querySelector('[data-value="movie"]')?.getAttribute('aria-checked')).toBe('true');
    expect(sw.querySelector('[data-value="book"]')?.getAttribute('aria-checked')).toBe('false');
    sw.querySelector<HTMLButtonElement>('[data-value="book"]')!.click();
    expect(container.querySelector('.register-switch [data-value="book"]')?.getAttribute('aria-checked')).toBe('true');
    pick(container, 'ARCHETRON');
    expect(container.querySelector('.register-switch')).toBeNull();
  });

  it('sends the persona with every call, and the register only for Frankenstein', async () => {
    const { adapter, options } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'Frankenstein');
    send(container, 'a');
    await tick();
    container.querySelector<HTMLButtonElement>('.register-switch [data-value="book"]')!.click();
    send(container, 'b');
    await tick();
    pick(container, 'Elara');
    send(container, 'c');
    await tick();
    expect(options).toEqual([
      { persona: 'Frankenstein', register: 'movie' },
      { persona: 'Frankenstein', register: 'book' },
      { persona: 'Elara' },
    ]);
  });

  it('not-knowing reply keeps its own treatment', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turnUnknown() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'Elara');
    send(container, 'blah');
    await tick();
    expect(container.querySelector('.chat-turn.not-knowing .chat-reply')).not.toBeNull();
  });

  it('error result shows error-state and is not logged', async () => {
    const log = new ChatLog();
    const { adapter } = fake(async () => ({ ok: false, error: 'boom' }));
    new ChatView(adapter, log).mount(container);
    pick(container, 'Elara');
    send(container, 'hi');
    await tick();
    expect(container.querySelector('.chat-error .error-state')?.textContent).toBe('boom');
    expect(log.turns()).toHaveLength(0);
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
  });

  it('blank input does not call chat', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'Elara');
    send(container, '   ');
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('disables Send while waiting, also across a persona switch', async () => {
    const d = deferred<AdapterResult<ChatTurn>>();
    const { adapter } = fake(() => d.promise);
    new ChatView(adapter, new ChatLog()).mount(container);
    pick(container, 'Elara');
    send(container, 'hi');
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(true);
    pick(container, 'ARCHETRON');
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(true);
    d.resolve({ ok: true, data: turn1() });
    await tick();
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
  });

  it('a reply after unmount does not render, but the turn is still logged', async () => {
    const d = deferred<AdapterResult<ChatTurn>>();
    const log = new ChatLog();
    const { adapter } = fake(() => d.promise);
    const view = new ChatView(adapter, log);
    view.mount(container);
    pick(container, 'Elara');
    send(container, 'hi');
    view.unmount();
    d.resolve({ ok: true, data: turn1() });
    await tick();
    expect(container.innerHTML).toBe('');
    expect(log.turns()).toHaveLength(1);
    expect(log.personaAt(0)).toBe('Elara');

    new ChatView(adapter, log).mount(container);
  });

  it('the log and the chosen persona survive a remount', async () => {
    const log = new ChatLog();
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    const v1 = new ChatView(adapter, log);
    v1.mount(container);
    pick(container, 'ARCHETRON');
    send(container, 'hi');
    await tick();
    v1.unmount();
    new ChatView(adapter, log).mount(container);
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(1);
    expect(container.querySelector('.persona-picker [data-value="ARCHETRON"]')?.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.disabled).toBe(false);
  });
});

describe('renderChatTurn', () => {
  it('a turn with no recorded persona still never says ARCHE replied', () => {
    const root = renderChatTurn(turn1(), null);
    expect(root.querySelector('.chat-reply .sr-only')?.textContent).toBe('The persona replied: ');
  });

  it('no provenance list and no engine panel in a turn', () => {
    const root = renderChatTurn(turn1(), 'Elara');
    expect(root.querySelector('.engines')).toBeNull();
    expect(root.textContent).not.toContain('order system');
  });
});
