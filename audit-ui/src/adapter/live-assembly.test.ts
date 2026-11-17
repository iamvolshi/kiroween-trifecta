import { describe, it, expect } from 'vitest';
import { createLiveAdapter, type FetchLike } from './live';
import type { ChatTurn } from './seam';

describe('live adapter without a base URL', () => {
  it('every method returns ok:false "Live adapter not wired"', async () => {
    const a = createLiveAdapter('');
    const results = await Promise.all([
      a.ask('q'),
      a.chat('m', { persona: 'Elara' }),
      a.update({ kid: 1, subject: 's', value: 'v', reason: 'r', authority: 1 }),
      a.fetchLessons(),
      a.fetchRecord('acct'),
      a.fetchAllEntries(),
      a.fetchBeliefPool(0),
      a.fetchChain(1, 's'),
      a.fetchKidMap(),
    ]);
    for (const r of results) {
      expect(r).toEqual({ ok: false, error: 'Live adapter not wired' });
    }
  });
});

/** A fetch double that records each call and answers with `body`. */
function stubFetch(body: unknown, status = 200): { fetch: FetchLike; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const TURN: ChatTurn = {
  message: 'm',
  known: true,
  step: null,
  total_steps: 0,
  engines: {
    arche: { reply: 'r' },
    erie: null,
    elle: null,
    elle_promoted: null,
    lessons_in_prompt: { subjects: [], injected: [], held: [] },
    katie: [],
  },
};

describe('live adapter against the connector contract', () => {
  it('POST /chat sends message, persona and the Frankenstein register', async () => {
    const s = stubFetch(TURN);
    const a = createLiveAdapter('http://connector.test/', s.fetch);
    const r = await a.chat('hello', { persona: 'Frankenstein', register: 'book' });
    expect(r).toEqual({ ok: true, data: TURN });
    expect(s.calls[0]!.url).toBe('http://connector.test/chat');
    expect(s.calls[0]!.init?.method).toBe('POST');
    expect(JSON.parse(String(s.calls[0]!.init?.body))).toEqual({ message: 'hello', persona: 'Frankenstein', register: 'book' });
  });

  it('a register is never sent for a persona other than Frankenstein', async () => {
    const s = stubFetch(TURN);
    const a = createLiveAdapter('http://connector.test', s.fetch);
    await a.chat('hello', { persona: 'Elara', register: 'book' });
    expect(JSON.parse(String(s.calls[0]!.init?.body))).toEqual({ message: 'hello', persona: 'Elara' });
  });

  it('GET /record/{account}, GET /lessons and POST /ask hit the contract paths', async () => {
    const s = stubFetch({});
    const a = createLiveAdapter('http://connector.test', s.fetch);
    await a.fetchRecord('order 1042');
    await a.fetchLessons();
    await a.ask('why?');
    expect(s.calls.map((c) => [c.init?.method ?? 'GET', c.url])).toEqual([
      ['GET', 'http://connector.test/record/order%201042'],
      ['GET', 'http://connector.test/lessons'],
      ['POST', 'http://connector.test/ask'],
    ]);
    expect(JSON.parse(String(s.calls[2]!.init?.body))).toEqual({ question: 'why?' });
  });

  it('HTTP errors and a throwing fetch come back as typed errors', async () => {
    const bad = createLiveAdapter('http://connector.test', stubFetch({}, 503).fetch);
    expect(await bad.fetchLessons()).toEqual({ ok: false, error: 'Connector answered HTTP 503 for /lessons' });
    const down = createLiveAdapter('http://connector.test', async () => {
      throw new Error('refused');
    });
    expect(await down.chat('x', { persona: 'Elara' })).toEqual({ ok: false, error: 'Connector unreachable: refused' });
  });

  it('reads outside the contract say so instead of guessing an endpoint', async () => {
    const s = stubFetch({});
    const a = createLiveAdapter('http://connector.test', s.fetch);
    const r = await a.fetchAllEntries();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/not in the connector contract/);
    expect(s.calls).toHaveLength(0);
  });
});
