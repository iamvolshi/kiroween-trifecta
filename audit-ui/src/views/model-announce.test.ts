/**
 * The live-model announcement in the picker row: nothing before a voice is
 * picked; after it, the picked voice's model from the status, served_by
 * after a turn (served_by wins); the unconfigured words (Young Frankenstein
 * unpicked); the unreachable words (also with no connector address); the
 * visible change when the voice switches.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { announce } from './model-announce.ts';
import { ChatView, type ModelSource } from './chat.ts';
import { ChatLog } from './chat-log.ts';
import { fetchModelStatus, isModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import { createLiveAdapter, NO_ADDRESS_ERROR, type FetchLike } from '../adapter/live.ts';
import { isChatTurn, type ChatTurn } from '../adapter/seam.ts';
import { tick } from '../test-helpers.ts';

// Test-only names: the app itself carries none (see the last test).
const MOVIE = { provider: 'prov-movie', model: 'model-movie-1' };
const BOOK = { provider: 'prov-book', model: 'model-book-1' };
const YF_UNSET = { error: 'YOUNG_FRANKENSTEIN_PROVIDER not set (Young Frankenstein has no default)' };
const STATUS: ModelStatus = {
  persona: 'entity',
  personas: ['Frankenstein'],
  default: { provider: 'prov-default', model: 'model-default' },
  registers: { movie: MOVIE, book: BOOK, 'young-frankenstein': YF_UNSET },
  register_voices: ['movie', 'book', 'young-frankenstein'],
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
  it('before a voice is picked: nothing to announce', () => {
    for (const status of [{ state: 'ok' as const, data: STATUS }, { state: 'loading' as const }, { state: 'error' as const, error: 'x' }]) {
      expect(announce({ register: null, status, served: null })).toBeNull();
    }
  });

  it('live: the status names the model for the picked voice', () => {
    const ok = { state: 'ok' as const, data: STATUS };
    expect(announce({ register: 'movie', status: ok, served: null })).toMatchObject({
      state: 'live', position: 'movie', label: 'MOVIE', model: 'model-movie-1', provider: 'prov-movie',
    });
    expect(announce({ register: 'book', status: ok, served: null })).toMatchObject({
      position: 'book', label: 'BOOK', model: 'model-book-1', provider: 'prov-book',
    });
  });

  it('Young unconfigured: the connector\'s own words, no model name', () => {
    const a = announce({ register: 'young-frankenstein', status: { state: 'ok', data: STATUS }, served: null });
    expect(a).toMatchObject({
      state: 'unconfigured', position: 'young-frankenstein', label: 'YOUNG',
      model: 'Not configured', provider: '', source: YF_UNSET.error,
    });
  });

  it('a voice the connector reports no route for is said in words', () => {
    const data = { ...STATUS, registers: { movie: MOVIE, book: BOOK } };
    expect(announce({ register: 'young-frankenstein', status: { state: 'ok', data }, served: null })).toMatchObject({
      state: 'unconfigured', source: 'The connector reports no route for Young.',
    });
  });

  it('served_by wins over the status, and the disagreement is said', () => {
    const served = { provider: 'prov-other', model: 'model-other' };
    const a = announce({ register: 'book', status: { state: 'ok', data: STATUS }, served });
    expect(a).toMatchObject({ model: 'model-other', provider: 'prov-other', source: 'Served the last reply' });
    expect(a!.note).toContain('prov-book / model-book-1');
    const agree = announce({ register: 'book', status: { state: 'ok', data: STATUS }, served: BOOK });
    expect(agree!.note).toBe('');
  });

  it('an unreachable connector is said in words, never a stale name', () => {
    const a = announce({ register: 'movie', status: { state: 'error', error: 'Connector unreachable: refused' }, served: null });
    expect(a!.state).toBe('unreachable');
    expect(a!.model).toBe('Model unknown');
    expect(a!.source).toContain('Connector unreachable: refused');
  });

  it('an unconfigured voice shows the config error', () => {
    const data = { ...STATUS, registers: { ...STATUS.registers, book: { error: 'BOOK_PROVIDER not set' } } };
    const a = announce({ register: 'book', status: { state: 'ok', data }, served: null });
    expect(a).toMatchObject({ state: 'unconfigured', model: 'Not configured', source: 'BOOK_PROVIDER not set' });
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
  });

  it('accepts the three-voice shape and the older two-voice one; refuses a malformed one', () => {
    expect(isModelStatus(STATUS)).toBe(true);
    // The live connector before the three voices: two registers, extra fields ignored.
    expect(isModelStatus({ ...STATUS, registers: { movie: MOVIE, book: BOOK }, register_voices: ['movie', 'book'], persona_routes: {} })).toBe(true);
    const { personas: _p, ...older } = STATUS;
    void _p;
    expect(isModelStatus(older)).toBe(true);
    expect(isModelStatus({ ...STATUS, personas: 'Frankenstein' })).toBe(false);
    expect(isModelStatus({ ...STATUS, registers: [] })).toBe(false);
    expect(isModelStatus({ ...STATUS, registers: { book: { provider: 'p' } } })).toBe(false);
    expect(isModelStatus({ ...STATUS, register_voices: [1] })).toBe(false);
  });

  it('a served_by that is not two strings makes the turn not a ChatTurn', () => {
    expect(isChatTurn(turn('x', MOVIE))).toBe(true);
    expect(isChatTurn({ ...turn('x'), served_by: { provider: 'p' } })).toBe(false);
  });
});

describe('ChatView: the model rides in the picker row', () => {
  let slot: HTMLElement;
  let view: ChatView | null = null;
  afterEach(() => { view?.unmount(); view = null; slot?.remove(); });

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

  const model = (): HTMLElement | null => slot.querySelector<HTMLElement>('.voice-picker .voice-model');
  const pick = (voice: string): void => slot.querySelector<HTMLButtonElement>(`.voice-picker [data-voice="${voice}"]`)!.click();
  const send = async (text: string): Promise<void> => {
    slot.querySelector<HTMLInputElement>('#chat-message')!.value = text;
    slot.querySelector<HTMLFormElement>('.chat-composer')!.requestSubmit();
    for (let i = 0; i < 4; i++) await tick();
  };

  it('switching voice changes the model at the row\'s right end', async () => {
    const live: ModelSource = { status: async () => ({ ok: true, data: STATUS }) };
    await mount(live, async () => new Response('{}', { status: 500 }));
    pick('movie');
    expect(model()?.textContent).toBe('model-movie-1');
    expect(model()?.dataset.state).toBe('live');
    pick('book');
    expect(model()?.textContent).toBe('model-book-1');
    expect(model()?.dataset.state).toBe('live');
    // The model sits in the chip row, after the chips.
    const row = slot.querySelector('.voice-picker')!;
    expect(row.lastElementChild).toBe(model());
  });

  it('Young Frankenstein unconfigured shows "Not configured" in the row', async () => {
    const live: ModelSource = { status: async () => ({ ok: true, data: STATUS }) };
    await mount(live, async () => new Response('{}', { status: 500 }));
    pick('young-frankenstein');
    expect(model()?.dataset.state).toBe('unconfigured');
    expect(model()?.textContent).toBe('Not configured');
  });

  it('a reply\'s served_by replaces the status for that voice only', async () => {
    const live: ModelSource = { status: async () => ({ ok: true, data: STATUS }) };
    const other = { provider: 'prov-other', model: 'model-other' };
    const { bodies } = await mount(live, async () => new Response(JSON.stringify(turn('hi', other)), { status: 200 }));
    pick('book');
    await send('hi');
    expect(bodies).toEqual([{ message: 'hi', persona: 'Frankenstein', register: 'book' }]);
    expect(model()?.textContent).toBe('model-other');
    // The other voice still shows its own status.
    pick('movie');
    expect(model()?.textContent).toBe('model-movie-1');
  });

  it('a failed turn drops the old served_by and re-reads the live map', async () => {
    let reads = 0;
    let data: ModelStatus = STATUS;
    const live: ModelSource = { status: async () => { reads++; return { ok: true, data }; } };
    const other = { provider: 'prov-other', model: 'model-other' };
    let fail = false;
    await mount(live, async () => (fail
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify(turn('hi', other)), { status: 200 })));
    pick('movie');
    await send('hi');
    expect(model()?.textContent).toBe('model-other');
    const before = reads;
    data = { ...STATUS, registers: { ...STATUS.registers, movie: { provider: 'prov-new', model: 'model-new' } } };
    fail = true;
    await send('again');
    expect(reads).toBe(before + 1);
    expect(model()?.textContent).toBe('model-new');
  });

  it('a switch re-reads the live map, so a config change shows', async () => {
    let reads = 0;
    let data: ModelStatus = STATUS;
    const live: ModelSource = { status: async () => { reads++; return { ok: true, data }; } };
    await mount(live, async () => new Response('{}', { status: 500 }));
    pick('movie');
    data = { ...STATUS, registers: { ...STATUS.registers, book: { provider: 'prov-book-2', model: 'model-book-2' } } };
    pick('book');
    await tick(); await tick();
    expect(reads).toBe(2);
    expect(model()?.textContent).toBe('model-book-2');
  });

  it('an older /models answer that lands late is dropped', async () => {
    const answers: Array<(d: ModelStatus) => void> = [];
    const live: ModelSource = {
      status: () => new Promise((res) => answers.push((d) => res({ ok: true, data: d }))),
    };
    const p = mount(live, async () => new Response('{}', { status: 500 }));
    answers[0]!(STATUS); // read 1: the voices arrive
    await p;
    pick('movie'); // the first pick is not a switch: no re-read
    pick('book'); // read 2
    pick('movie'); // read 3
    const late = { ...STATUS, registers: { ...STATUS.registers, book: { provider: 'prov-old', model: 'model-old' } } };
    answers[2]!(STATUS);
    await tick();
    answers[1]!(late); // read 2, older, lands last: dropped
    await tick();
    pick('book'); // read 4, unanswered: the row keeps read 3's map
    expect(model()?.textContent).toBe('model-book-1');
  });

  it('before a voice is picked the row is chips only: no model, no model slot', async () => {
    const live: ModelSource = { status: async () => ({ ok: true, data: STATUS }) };
    await mount(live, async () => new Response('{}', { status: 500 }));
    expect(model()).toBeNull();
    expect(slot.querySelector('.model-slot')).toBeNull();
    const down: ModelSource = { status: async () => ({ ok: false, error: 'Connector unreachable: refused' }) };
    view?.unmount();
    slot.remove();
    await mount(down, async () => new Response('{}', { status: 500 }));
    expect(model()).toBeNull();
  });

  it('an unreachable connector: no voices to pick, the words in the picker slot, no model', async () => {
    const down: ModelSource = { status: async () => ({ ok: false, error: 'Connector unreachable: refused' }) };
    await mount(down, async () => new Response('{}', { status: 500 }));
    expect(slot.querySelector('.voice-picker')).toBeNull();
    expect(slot.querySelector('.voice-slot .error-state')?.textContent).toBe('Connector unreachable: refused');
    expect(model()).toBeNull();
  });

  it('a build with no connector address says the connector is unreachable', async () => {
    const noAddress: ModelSource = { status: () => fetchModelStatus('') };
    await mount(noAddress, async () => new Response('{}', { status: 500 }));
    expect(slot.querySelector('.voice-slot .error-state')?.textContent).toBe(NO_ADDRESS_ERROR);
    expect((slot.querySelector<HTMLInputElement>('#chat-message'))!.disabled).toBe(true);
  });

  it('a voice switch that fails to re-read keeps the chips; the model says it is unknown', async () => {
    let up = true;
    const live: ModelSource = { status: async () => (up ? { ok: true, data: STATUS } : { ok: false, error: 'Connector unreachable: refused' }) };
    await mount(live, async () => new Response('{}', { status: 500 }));
    pick('movie');
    up = false;
    pick('book');
    await tick(); await tick();
    expect(slot.querySelectorAll('.voice-picker .voice-chip')).toHaveLength(3);
    expect(model()?.dataset.state).toBe('unreachable');
    expect(model()?.textContent).toBe('Model unknown');
  });
});

describe('no provider or model name is written in the app', () => {
  it('src carries none of the connector\'s names', () => {
    const sources = import.meta.glob(['../**/*.ts', '../**/*.css', '!../**/*.test.ts'], {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    const hits = Object.entries(sources)
      .filter(([, text]) => /mercury|subq|spark|inception|openrouter|muse-|nvidia/i.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
