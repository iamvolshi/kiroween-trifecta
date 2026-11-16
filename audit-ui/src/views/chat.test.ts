import { describe, it, expect, beforeEach } from 'vitest';
import type { SeamAdapter, ChatTurn, AdapterResult } from '../adapter/seam.ts';
import { ChatView } from './chat.ts';
import { ChatLog } from './chat-log.ts';
import { tick, deferred } from '../test-helpers.ts';

function turn1(): ChatTurn {
  return {
    message: 'When will my order arrive?',
    known: true,
    step: 1,
    total_steps: 4,
    engines: {
      arche: { reply: 'Your order arrives 2026-11-18. (mock)' },
      erie: {
        question: 'When will my order arrive?',
        state: 'found',
        text: 'Order system says 2026-11-18',
        provenance: [{ source: 'order system', content: 'order-1042', excerpt: 'delivery 2026-11-18' }],
      },
      elle: null,
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
      arche: { reply: "I don't know. The script has no answer for that. (mock)" },
      erie: null,
      elle: null,
      katie: [],
    },
  };
}

function turnLesson(): ChatTurn {
  return {
    message: 'Thanks. What did you learn?',
    known: true,
    step: 4,
    total_steps: 4,
    engines: {
      arche: { reply: 'ok' },
      erie: null,
      elle: { event_id: 'l1', event_type: 'lesson', detail: 'detail text', rule: 'check the carrier feed' },
      katie: [],
    },
  };
}

function fake(fn: (m: string) => Promise<AdapterResult<ChatTurn>>): { adapter: SeamAdapter; calls: string[] } {
  const calls: string[] = [];
  const adapter = {
    chat: (m: string) => {
      calls.push(m);
      return fn(m);
    },
  } as unknown as SeamAdapter;
  return { adapter, calls };
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

  it('shows empty state, nav, labeled input, mock note before any turn', () => {
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    expect(container.querySelector('.empty-state')?.textContent).toMatch(/not started/);
    expect(container.querySelector('nav.main-nav')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Chat with the agent (ARCHE)');
    expect(container.querySelector('label[for="chat-message"]')?.textContent).toBe('Your message');
    expect(container.querySelector('.mock-note')?.textContent).toMatch(/mock/i);
    expect(container.querySelector('.step-progress')?.textContent).toBe('Scenario not started');
  });

  it('submit calls chat once, renders turn, progress, engines, provenance, link', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    send(container, 'When will my order arrive?');
    await tick();
    expect(calls).toEqual(['When will my order arrive?']);
    expect(container.querySelector('.empty-state')).toBeNull();
    expect(container.querySelector('.step-progress')?.textContent).toBe('Step 1 of 4');
    const labels = ['arche', 'erie', 'elle', 'katie'].map(
      (n) => container.querySelector(`.engine-${n} .engine-label`)?.textContent,
    );
    expect(labels).toEqual(['ARCHE', 'ERIE', 'ELLE', 'KATIE']);
    expect(container.querySelector('.engine-arche')?.textContent).toContain('talked');
    expect(container.querySelector('.engine-erie')?.textContent).toContain('found');
    expect(container.querySelector('.engine-erie')?.textContent).toContain('order system');
    expect(container.querySelector('.engine-erie')?.textContent).toContain('delivery 2026-11-18');
    expect(container.querySelector('.engine-elle')?.textContent).toContain('did not act this turn');
    expect(container.querySelector('.engine-katie')?.textContent).toContain('recorded');
    const a = container.querySelector<HTMLAnchorElement>('.engine-katie a')!;
    expect(a.getAttribute('href')).toBe('/entry/4/order-1042.delivery_date/scn-s1');
    expect(a.textContent).toBe('scn-s1');
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.value).toBe('');
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
  });

  it('renders ELLE learned rule and ERIE not-acted', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turnLesson() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    send(container, 'thanks');
    await tick();
    expect(container.querySelector('.engine-elle')?.textContent).toContain('learned');
    expect(container.querySelector('.engine-elle')?.textContent).toContain('check the carrier feed');
    expect(container.querySelector('.engine-erie')?.textContent).toContain('did not act this turn');
    expect(container.querySelector('.engine-katie')?.textContent).toContain('did not act this turn');
  });

  it('not-knowing turn has class, no KATIE link, progress unchanged', async () => {
    const { adapter } = fake(async () => ({ ok: true, data: turnUnknown() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    send(container, 'blah');
    await tick();
    expect(container.querySelector('.chat-turn.not-knowing')).not.toBeNull();
    expect(container.querySelector('.engine-katie a')).toBeNull();
    expect(container.querySelector('.step-progress')?.textContent).toBe('Scenario not started');
  });

  it('error result shows error-state and is not logged', async () => {
    const log = new ChatLog();
    const { adapter } = fake(async () => ({ ok: false, error: 'boom' }));
    new ChatView(adapter, log).mount(container);
    send(container, 'hi');
    await tick();
    expect(container.querySelector('.error-state')?.textContent).toBe('boom');
    expect(log.turns()).toHaveLength(0);
    expect(container.querySelector<HTMLButtonElement>('.chat-form button')!.disabled).toBe(false);
  });

  it('blank input does not call chat', async () => {
    const { adapter, calls } = fake(async () => ({ ok: true, data: turn1() }));
    new ChatView(adapter, new ChatLog()).mount(container);
    send(container, '   ');
    await tick();
    expect(calls).toHaveLength(0);
  });

  it('disables Send while waiting', async () => {
    const d = deferred<AdapterResult<ChatTurn>>();
    const { adapter } = fake(() => d.promise);
    new ChatView(adapter, new ChatLog()).mount(container);
    send(container, 'hi');
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
    send(container, 'hi');
    view.unmount();
    d.resolve({ ok: true, data: turn1() });
    await tick();
    expect(container.innerHTML).toBe('');
    // The agent already played the step; the transcript must not lose it.
    expect(log.turns()).toHaveLength(1);

    new ChatView(adapter, log).mount(container);
    expect(container.querySelector('.step-progress')?.textContent).toBe('Step 1 of 4');
  });

  it('log survives remount', async () => {
    const log = new ChatLog();
    const { adapter } = fake(async () => ({ ok: true, data: turn1() }));
    const v1 = new ChatView(adapter, log);
    v1.mount(container);
    send(container, 'hi');
    await tick();
    v1.unmount();
    new ChatView(adapter, log).mount(container);
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(1);
    expect(container.querySelector('.step-progress')?.textContent).toBe('Step 1 of 4');
    expect(container.querySelector('.empty-state')).toBeNull();
  });
});

describe('ERIE not_found is shown as not found', () => {
  it('a not_found retrieval does not read as "found"', async () => {
    const c = document.createElement('div');
    const notFound: ChatTurn = {
      ...turn1(),
      engines: {
        ...turn1().engines,
        erie: { question: 'q', state: 'not_found', text: 'nothing', provenance: [] },
      },
    };
    const { adapter } = fake(async () => ({ ok: true, data: notFound }));
    new ChatView(adapter, new ChatLog()).mount(c);
    send(c, 'hi');
    await tick();
    const action = c.querySelector('.engine-erie .engine-action')?.textContent;
    expect(action).toBe('looked, found nothing');
  });
});
