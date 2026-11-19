/** The four record reads on the live adapter: paths, guards, errors, fallback. */
import { describe, it, expect } from 'vitest';
import { createLiveAdapter, type FetchLike } from './live';
import { asEntries, asKidMap, isEntry } from './live-guards';
import type { Entry, Lesson } from './seam';
import { LeftPanel } from '../shell/left.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import { isLiveAt, parseMs } from '../util/interval.ts';

/** Answers each path from `routes`; unknown paths get a 404. Records every URL. */
function routed(routes: Record<string, { status?: number; body: unknown }>): { fetch: FetchLike; urls: string[] } {
  const urls: string[] = [];
  const fetch: FetchLike = async (url) => {
    urls.push(url);
    const path = new URL(url).pathname;
    const r = routes[path] ?? { status: 404, body: { error: `no ${path}` } };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, urls };
}

/** An entry as the connector maps it from the loop (notes.md). */
const LIVE: Entry = makeEntry({
  id: '019a7c3e-0000-7000-8000-000000000001',
  kid: 1,
  subject: 'turn',
  state: 'WILD',
  authority: 5,
  pool: '0',
  k_start: '2026-11-17T23:00:00.000Z',
  t_time: '2026-11-17T23:00:00.000Z',
  e_time: '',
  k_time: '',
  evidence: 'Audit UI',
  reason: 'user turn (connector)',
  prev_hash: 'GENESIS',
});

const BASE = 'http://connector.test';

describe('live record reads: happy path', () => {
  it('GET /entries returns the entries', async () => {
    const s = routed({ '/entries': { body: [LIVE] } });
    const r = await createLiveAdapter(BASE, s.fetch).fetchAllEntries();
    expect(r).toEqual({ ok: true, data: [LIVE] });
    expect(s.urls).toEqual([`${BASE}/entries`]);
  });

  it('GET /belief-pool sends the moment as whole epoch ms', async () => {
    const s = routed({ '/belief-pool': { body: [LIVE] } });
    const r = await createLiveAdapter(BASE, s.fetch).fetchBeliefPool(1763420400123.7);
    expect(r).toEqual({ ok: true, data: [LIVE] });
    expect(s.urls).toEqual([`${BASE}/belief-pool?at=1763420400123`]);
  });

  it('GET /chain encodes kid and subject and keeps record order', async () => {
    const second = { ...LIVE, id: 'b', k_start: '2026-11-17T23:00:01.000Z' };
    const s = routed({ '/chain': { body: [LIVE, second] } });
    const r = await createLiveAdapter(BASE, s.fetch).fetchChain(1, 'order 1042.date&x');
    expect(r.ok && r.data.map((e) => e.id)).toEqual([LIVE.id, 'b']);
    expect(s.urls).toEqual([`${BASE}/chain?kid=1&subject=order%201042.date%26x`]);
  });

  it('GET /kidmap turns the JSON string keys into KID numbers', async () => {
    const tag = 'AAAAAAAAAAEAAAAAaRt3gAOsN7k2b0xH';
    const s = routed({ '/kidmap': { body: { '1': tag } } });
    const r = await createLiveAdapter(BASE, s.fetch).fetchKidMap();
    expect(r).toEqual({ ok: true, data: { 1: tag } });
    expect(r.ok && r.data[1]).toBe(tag);
  });
});

describe('live record reads: errors in words', () => {
  it('HTTP errors carry the connector\'s own words when it gives them', async () => {
    const s = routed({ '/chain': { status: 404, body: { error: 'no KID 2: this connector serves one kernel, KID 1' } } });
    const a = createLiveAdapter(BASE, s.fetch);
    expect(await a.fetchChain(2, 'turn')).toEqual({
      ok: false,
      error: 'Connector answered HTTP 404 for /chain?kid=2&subject=turn: no KID 2: this connector serves one kernel, KID 1',
    });
    const bare = createLiveAdapter(BASE, async () => new Response('oops', { status: 500 }));
    expect(await bare.fetchAllEntries()).toEqual({ ok: false, error: 'Connector answered HTTP 500 for /entries' });
    expect(await bare.fetchKidMap()).toEqual({ ok: false, error: 'Connector answered HTTP 500 for /kidmap' });
  });

  it('an error body without words, or with non-string words, gives the status alone', async () => {
    for (const body of [{}, { error: 404 }, { error: '' }, null]) {
      const a = createLiveAdapter(BASE, routed({ '/entries': { status: 404, body } }).fetch);
      expect(await a.fetchAllEntries()).toEqual({ ok: false, error: 'Connector answered HTTP 404 for /entries' });
    }
  });

  it('a refused voice on /chat shows the connector\'s own words', async () => {
    const error = 'Young Frankenstein is not configured: YOUNG_FRANKENSTEIN_PROVIDER not set (Young Frankenstein has no default)';
    const s = routed({ '/chat': { status: 503, body: { error, register: 'young-frankenstein' } } });
    const r = await createLiveAdapter(BASE, s.fetch).chat('hi', { persona: 'Frankenstein', register: 'young-frankenstein' });
    expect(r).toEqual({ ok: false, error: `Connector answered HTTP 503 for /chat: ${error}` });
  });

  it('an unreachable connector is a typed error on every read', async () => {
    const a = createLiveAdapter(BASE, async () => {
      throw new Error('ECONNREFUSED');
    });
    for (const r of [await a.fetchAllEntries(), await a.fetchBeliefPool(0), await a.fetchChain(1, 's'), await a.fetchKidMap()]) {
      expect(r).toEqual({ ok: false, error: 'Connector unreachable: ECONNREFUSED' });
    }
  });

  it('a moment that is not a number is refused before any call', async () => {
    const s = routed({});
    const r = await createLiveAdapter(BASE, s.fetch).fetchBeliefPool(Number.NaN);
    expect(r).toEqual({ ok: false, error: 'Live adapter: the belief-pool moment is not a number' });
    expect(s.urls).toHaveLength(0);
  });
});

describe('live record reads: malformed replies are refused', () => {
  it('a non-list entries reply is refused', async () => {
    const s = routed({ '/entries': { body: { entries: [LIVE] } } });
    expect(await createLiveAdapter(BASE, s.fetch).fetchAllEntries()).toEqual({
      ok: false,
      error: 'Connector reply to /entries is not a list of entries (see docs/assembly-parts.md)',
    });
  });

  it('a string KID (the loop\'s raw tag) is refused, never coerced', async () => {
    const s = routed({ '/belief-pool': { body: [LIVE, { ...LIVE, kid: 'AAAAAAAAAAEAAAAA' }] } });
    expect(await createLiveAdapter(BASE, s.fetch).fetchBeliefPool(0)).toEqual({
      ok: false,
      error: 'Connector reply to /belief-pool: item 1 is not an Entry (see docs/assembly-parts.md)',
    });
  });

  it('a list evidence (the loop\'s raw field) is refused', () => {
    expect(isEntry({ ...LIVE, evidence: ['Audit UI'] })).toBe(false);
    expect(isEntry({ ...LIVE, k_time: null })).toBe(false);
    expect(isEntry({ ...LIVE, authority: 10 })).toBe(false);
    expect(isEntry({ ...LIVE, authority: 4.5 })).toBe(false);
    expect(isEntry({ ...LIVE, k_start: 'garbage' })).toBe(false);
    expect(isEntry({ ...LIVE, t_time: '' })).toBe(false);
    expect(isEntry(LIVE)).toBe(true);
    expect(asEntries([], '/chain')).toEqual({ ok: true, data: [] });
  });

  it('a malformed chain is refused', async () => {
    const s = routed({ '/chain': { body: [{ id: 'x' }] } });
    const r = await createLiveAdapter(BASE, s.fetch).fetchChain(1, 'turn');
    expect(r).toEqual({ ok: false, error: 'Connector reply to /chain: item 0 is not an Entry (see docs/assembly-parts.md)' });
  });

  it('a KID map with a non-number key or a non-string label is refused', async () => {
    expect(asKidMap({ abc: 'x' }, '/kidmap')).toEqual({ ok: false, error: 'Connector reply to /kidmap: key "abc" is not a KID number' });
    expect(asKidMap({ '01': 'x' }, '/kidmap').ok).toBe(false);
    expect(asKidMap({ '1': 7 }, '/kidmap')).toEqual({ ok: false, error: 'Connector reply to /kidmap: the label for KID 1 is not a string' });
    expect(asKidMap([], '/kidmap').ok).toBe(false);
    const s = routed({ '/kidmap': { body: ['1'] } });
    expect(await createLiveAdapter(BASE, s.fetch).fetchKidMap()).toEqual({
      ok: false,
      error: 'Connector reply to /kidmap is not a KID map object (see docs/assembly-parts.md)',
    });
  });
});

describe('left column on the live adapter', () => {
  const lesson: Lesson = {
    event_id: 'elle-1', event_type: 'derived:preference', detail: 'Audit UI loves storms',
    rule: null, subject: null, status: 'promoted',
  };

  async function mount(routes: Record<string, { status?: number; body: unknown }>): Promise<HTMLElement> {
    const slot = document.createElement('div');
    new LeftPanel(createLiveAdapter(BASE, routed(routes).fetch)).mount(slot);
    for (let i = 0; i < 6; i++) await tick();
    return slot;
  }

  it('folders come from the live entries; subject-less lessons stay unfiled', async () => {
    const slot = await mount({ '/entries': { body: [LIVE] }, '/lessons': { body: [lesson] } });
    expect(slot.querySelector('.prompt-state')).toBeNull();
    const f = slot.querySelector<HTMLElement>('.subject-folder[data-subject="turn"]')!;
    expect(f.querySelector('.folder-value')?.textContent).toBe('5');
    expect(slot.querySelector('.lessons-unfiled')?.textContent).toContain('Audit UI loves storms');
  });

  it('a malformed entries reply falls back to lessons only, and says why', async () => {
    const slot = await mount({ '/entries': { body: 'nope' }, '/lessons': { body: [{ ...lesson, subject: 'turn' }] } });
    expect(slot.querySelector('.prompt-state')?.textContent).toBe(
      'Record entries not available: Connector reply to /entries is not a list of entries (see docs/assembly-parts.md)',
    );
    const f = slot.querySelector('.subject-folder[data-subject="turn"]')!;
    expect(f.querySelector('.folder-value')?.textContent).toBe('--');
  });
});

describe('/chat options unchanged by this round', () => {
  it('the body is { message, persona, register } for each voice, { message } with no options', async () => {
    const bodies: unknown[] = [];
    const a = createLiveAdapter(BASE, async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 200 });
    });
    await a.chat('one', { persona: 'Frankenstein', register: 'young-frankenstein' });
    await a.chat('two', { persona: 'Frankenstein', register: 'movie' });
    await a.chat('three');
    expect(bodies).toEqual([
      { message: 'one', persona: 'Frankenstein', register: 'young-frankenstein' },
      { message: 'two', persona: 'Frankenstein', register: 'movie' },
      { message: 'three' },
    ]);
  });
});

describe('open live entries and isLiveAt (warning test)', () => {
  it('isLiveAt says false for an open live entry (k_time ""): never run it on live data', () => {
    // The connector applies the belief-pool rule; isLiveAt runs only in the record stub (a test double).
    // If a live path ever calls isLiveAt, it must first treat k_time "" as open.
    expect(isLiveAt(LIVE, parseMs(LIVE.k_start) + 1000)).toBe(false);
  });
});
