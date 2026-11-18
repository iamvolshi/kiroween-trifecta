/**
 * The live-model announcement under the chat box: status before a turn,
 * served_by after it (served_by wins), the unreachable words, the mock label,
 * and the visible change when the Book/Movie switch flips.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { announce, renderModelBanner } from './model-banner.ts';
import { ChatView, type ModelSource } from './chat.ts';
import { ChatLog } from './chat-log.ts';
import { fetchModelStatus, isModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import { createLiveAdapter, type FetchLike } from '../adapter/live.ts';
import { isChatTurn, type ChatTurn } from '../adapter/seam.ts';
import { tick } from '../test-helpers.ts';

// Test-only names: the app itself carries none (see the last test).
const MOVIE = { provider: 'prov-movie', model: 'model-movie-1' };
const BOOK = { provider: 'prov-book', model: 'model-book-1' };
const STATUS: ModelStatus = {
  persona: 'Frankenstein',
  default: MOVIE,
  registers: { movie: MOVIE, book: BOOK },
  register_voices: ['movie', 'book'],
};

function turn(message: string, served_by?: { provider: string; model: string }): ChatTurn {
  return {
    message, known: true, step: null, total_steps: 0, ...(served_by ? { served_by } : {}),
    engines: {
      arche: { reply: `reply to ${message}` }, erie: null, elle: null, elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
    },
  };
}

describe('announce()', () => {
  it('mock mode: the honest mock label, no model name', () => {
    const a = announce({ kind: 'mock', register: 'movie', status: { state: 'loading' }, served: null });
    expect(a.state).toBe('mock');
    expect(a.model).toBe('No live model');
    expect(a.provider).toBe('');
  });

  it('live: the status names the model for the switch position', () => {
    const ok = { state: 'ok' as const, data: STATUS };
    expect(announce({ kind: 'live', register: 'movie', status: ok, served: null })).toMatchObject({
      state: 'live', position: 'movie', label: 'MOVIE', model: 'model-movie-1', provider: 'prov-movie',
    });
    expect(announce({ kind: 'live', register: 'book', status: ok, served: null })).toMatchObject({
      position: 'book', label: 'BOOK', model: 'model-book-1', provider: 'prov-book',
    });
    expect(announce({ kind: 'live', register: null, status: ok, served: null })).toMatchObject({
      position: 'default', label: 'MODEL', model: 'model-movie-1',
    });
  });

  it('served_by wins over the status, and the disagreement is said', () => {
    const served = { provider: 'prov-other', model: 'model-other' };
    const a = announce({ kind: 'live', register: 'book', status: { state: 'ok', data: STATUS }, served });
    expect(a).toMatchObject({ model: 'model-other', provider: 'prov-other', source: 'Served the last reply' });
    expect(a.note).toContain('prov-book / model-book-1');
    const agree = announce({ kind: 'live', register: 'book', status: { state: 'ok', data: STATUS }, served: BOOK });
    expect(agree.note).toBe('');
  });

  it('an unreachable connector is said in words, never a stale name', () => {
    const a = announce({ kind: 'live', register: 'movie', status: { state: 'error', error: 'Connector unreachable: refused' }, served: null });
    expect(a.state).toBe('unreachable');
    expect(a.model).toBe('Model unknown');
    expect(a.source).toContain('Connector unreachable: refused');
  });

  it('an unconfigured position shows the config error', () => {
    const data = { ...STATUS, registers: { movie: MOVIE, book: { error: 'BOOK_PROVIDER not set' } } };
    const a = announce({ kind: 'live', register: 'book', status: { state: 'ok', data }, served: null });
    expect(a).toMatchObject({ state: 'unconfigured', model: 'Not configured', source: 'BOOK_PROVIDER not set' });
  });
});

describe('renderModelBanner()', () => {
  it('the band carries the position and the state; a flip adds the pulse', () => {
    const a = announce({ kind: 'live', register: 'book', status: { state: 'ok', data: STATUS }, served: null });
    const b = renderModelBanner(a, true);
    expect(b.dataset.position).toBe('book');
    expect(b.dataset.state).toBe('live');
    expect(b.classList.contains('model-flip')).toBe(true);
    expect(b.querySelector('.model-position')?.textContent).toBe('BOOK');
    expect(b.querySelector('.model-name')?.textContent).toBe('model-book-1');
    expect(renderModelBanner(a).classList.contains('model-flip')).toBe(false);
  });
});

describe('fetchModelStatus()', () => {
  it('reads GET /models and refuses a malformed reply in words', async () => {
    const ok: FetchLike = async () => new Response(JSON.stringify(STATUS), { status: 200 });
    expect(await fetchModelStatus('http://c.test/', ok)).toEqual({ ok: true, data: STATUS });
    const bad: FetchLike = async () => new Response('{"persona":1}', { status: 200 });
    expect(await fetchModelStatus('http://c.test', bad)).toEqual({
      ok: false, error: 'Connector reply to /models is not a model status (see docs/assembly-parts.md)',
    });
    const down: FetchLike = async () => { throw new Error('ECONNREFUSED'); };
    expect(await fetchModelStatus('http://c.test', down)).toEqual({ ok: false, error: 'Connector unreachable: ECONNREFUSED' });
    expect(isModelStatus({ ...STATUS, registers: { movie: MOVIE, book: { error: 'x' } } })).toBe(true);
  });

  it('a served_by that is not two strings makes the turn not a ChatTurn', () => {
    expect(isChatTurn(turn('x', MOVIE))).toBe(true);
    expect(isChatTurn({ ...turn('x'), served_by: { provider: 'p' } })).toBe(false);
  });
});

describe('ChatView: the announcement under the chat box', () => {
  let slot: HTMLElement;
  let view: ChatView | null = null;
  afterEach(() => { view?.unmount(); view = null; });

  async function mount(models: ModelSource, fetchImpl: FetchLike): Promise<{ log: ChatLog; bodies: unknown[] }> {
    const bodies: unknown[] = [];
    const wrapped: FetchLike = async (url, init) => {
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      return fetchImpl(url, init);
    };
    const log = new ChatLog();
    slot = document.createElement('div');
    document.body.appendChild(slot);
    view = new ChatView(createLiveAdapter('http://c.test', wrapped), log, models);
    view.mount(slot);
    await tick(); await tick();
    return { log, bodies };
  }

  const banner = (): HTMLElement => slot.querySelector<HTMLElement>('.chat-form .model-banner')!;
  const click = (sel: string): void => slot.querySelector<HTMLButtonElement>(sel)!.click();
  const send = async (text: string): Promise<void> => {
    slot.querySelector<HTMLInputElement>('#chat-message')!.value = text;
    slot.querySelector<HTMLFormElement>('.chat-form')!.requestSubmit();
    for (let i = 0; i < 4; i++) await tick();
  };

  it('flipping the switch changes the band, the word and the model name', async () => {
    const live: ModelSource = { kind: 'live', status: async () => ({ ok: true, data: STATUS }) };
    await mount(live, async () => new Response('{}', { status: 500 }));
    click('.persona-picker [data-value="Frankenstein"]');
    expect(banner().dataset.position).toBe('movie');
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-movie-1');
    click('.register-switch [data-value="book"]');
    expect(banner().dataset.position).toBe('book');
    expect(banner().querySelector('.model-position')?.textContent).toBe('BOOK');
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-book-1');
    expect(banner().classList.contains('model-flip')).toBe(true);
  });

  it('a reply\'s served_by replaces the status for that position', async () => {
    const live: ModelSource = { kind: 'live', status: async () => ({ ok: true, data: STATUS }) };
    const other = { provider: 'prov-other', model: 'model-other' };
    const { bodies } = await mount(live, async () => new Response(JSON.stringify(turn('hi', other)), { status: 200 }));
    click('.persona-picker [data-value="Frankenstein"]');
    click('.register-switch [data-value="book"]');
    await send('hi');
    expect(bodies).toEqual([{ message: 'hi', persona: 'Frankenstein', register: 'book' }]); // options unchanged
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-other');
    expect(banner().querySelector('.model-note')?.textContent).toContain('prov-book / model-book-1');
    // The other position still shows its own status.
    click('.register-switch [data-value="movie"]');
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-movie-1');
  });

  it('a failed turn drops the old served_by and re-reads the live map', async () => {
    let reads = 0;
    let data: ModelStatus = STATUS;
    const live: ModelSource = { kind: 'live', status: async () => { reads++; return { ok: true, data }; } };
    const other = { provider: 'prov-other', model: 'model-other' };
    let fail = false;
    await mount(live, async () => (fail
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify(turn('hi', other)), { status: 200 })));
    click('.persona-picker [data-value="Frankenstein"]');
    await send('hi');
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-other');
    const before = reads;
    data = { ...STATUS, registers: { ...STATUS.registers, movie: { provider: 'prov-new', model: 'model-new' } } };
    fail = true;
    await send('again');
    expect(reads).toBe(before + 1);
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-new');
    expect(banner().querySelector('.model-source')?.textContent).toBe("From the connector's status");
  });

  it('a flip re-reads the live map, so a config change shows', async () => {
    let reads = 0;
    let data: ModelStatus = STATUS;
    const live: ModelSource = { kind: 'live', status: async () => { reads++; return { ok: true, data }; } };
    await mount(live, async () => new Response('{}', { status: 500 }));
    click('.persona-picker [data-value="Frankenstein"]');
    data = { ...STATUS, registers: { movie: MOVIE, book: { provider: 'prov-book-2', model: 'model-book-2' } } };
    click('.register-switch [data-value="book"]');
    await tick(); await tick();
    expect(reads).toBe(2);
    expect(banner().querySelector('.model-name')?.textContent).toBe('model-book-2');
  });

  it('an unreachable connector says so under the chat box', async () => {
    const down: ModelSource = { kind: 'live', status: async () => ({ ok: false, error: 'Connector unreachable: refused' }) };
    await mount(down, async () => new Response('{}', { status: 500 }));
    expect(banner().dataset.state).toBe('unreachable');
    expect(banner().textContent).toContain('Connector unreachable: refused');
  });

  it('mock mode shows the mock label and never asks for a status', async () => {
    let asked = 0;
    const mock: ModelSource = { kind: 'mock', status: async () => { asked++; return { ok: true, data: STATUS }; } };
    await mount(mock, async () => new Response('{}', { status: 500 }));
    expect(banner().dataset.state).toBe('mock');
    expect(banner().textContent).toContain('No live model');
    expect(asked).toBe(0);
  });
});

describe('no provider or model name is written in the app', () => {
  it('src carries none of the connector\'s names', () => {
    const sources = import.meta.glob(['../**/*.ts', '../**/*.css', '!../**/*.test.ts'], {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    const hits = Object.entries(sources)
      .filter(([, text]) => /mercury|subq|spark|inception|openrouter|muse-/i.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
