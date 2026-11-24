/**
 * Watson, the mouth: an ERIE answer goes to the watson-bridge with each
 * citation's KID, and Watson's conclusion shows beside the answer. The
 * bridge here is a stub fetch (a test double shaped like the bridge's live
 * POST /report reply), never app data.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AskResult, ChatTurn } from '../adapter/seam.ts';
import { ChatLog } from '../views/chat-log.ts';
import { ResearchView } from '../views/research.ts';
import { resetGridState } from '../views/entry-grid.ts';
import { ResearchPanel } from '../shell/rail-panels.ts';
import { createRecordStub, makeEntry, tick } from '../test-helpers.ts';
import { createWatsonBridge, type FetchLike } from './bridge.ts';
import { watsonInput } from './conclusion.ts';

const ANSWER: AskResult = {
  question: 'a female of another sex, as hideous as myself',
  state: 'found',
  text: 'CHAPTER XVII. You must create a female for me',
  provenance: [
    { source: 'K-record day 20412 tick 19, Mary Shelley', content: 'ev-ch17', excerpt: 'You must create a female for me' },
    { source: 'K-record day 20412 tick 26, Mary Shelley', content: 'ev-gone', excerpt: 'CHAPTER VII.' },
  ],
};
const ENTRIES = [makeEntry({ id: 'ev-ch17', kid: 21, subject: 'frankenstein-chapter-17' }),
  makeEntry({ id: 'ev-other', kid: 5, subject: 'frankenstein-chapter-1' })];

/** The bridge's reply for the request it got: one claim per citation, KIDs carried through. */
function bridgeStub(opts: { fail?: 'throw' | 500 | 'shape'; delayMs?: number } = {}) {
  const calls: Array<{ url: string; body: { question: string; answer: string; citations: Array<{ kid?: string }> } }> = [];
  const fetch: FetchLike = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url, body });
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.fail === 'throw') throw new TypeError('Failed to fetch');
    if (opts.fail === 500) return new Response(JSON.stringify({ error: 'investigation failed' }), { status: 500 });
    if (opts.fail === 'shape') return new Response(JSON.stringify({ nope: true }));
    const claims = body.citations.map((c: { content: string }, i: number) =>
      ({ id: `c${i}`, text: c.content, status: 'supported', confidence: 1 }));
    return new Response(JSON.stringify({
      investigationId: 'inv-stub', question: body.question, answer: body.answer,
      summary: 'The available evidence supports the claims.', confidence: 0.75, claims,
      citations: body.citations.map((c: { kid?: string; source: string }, i: number) =>
        ({ claimId: `c${i}`, evidenceId: `e${i}`, kid: c.kid ?? null, source: c.source, offsetStart: 0, offsetEnd: 1 })),
      evidence: [],
    }));
  };
  return { fetch, calls };
}

function turn(erie: AskResult | null): ChatTurn {
  return {
    message: ANSWER.question, known: true, step: null, total_steps: 0,
    engines: { arche: { reply: 'a reply' }, erie, elle: null, elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [] },
  };
}

let container: HTMLElement;
let view: ResearchView | null = null;

afterEach(() => {
  view?.unmount();
  view = null;
  container?.remove();
  resetGridState();
});

async function settle(n = 10): Promise<void> {
  for (let i = 0; i < n; i++) await tick();
}

async function research(fetch: FetchLike): Promise<ChatLog> {
  container = document.createElement('div');
  document.body.appendChild(container);
  const log = new ChatLog();
  view = new ResearchView(createRecordStub(ENTRIES), log, 'UTC', createWatsonBridge('https://watson.stub', fetch));
  view.mount(container);
  await settle();
  return log;
}

const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((n) => n.textContent ?? '');

describe('the KIDs', () => {
  it('each citation carries the KID the record holds for its entry; none is invented', () => {
    expect(watsonInput(ANSWER, ENTRIES)).toEqual({
      question: ANSWER.question, answer: ANSWER.text,
      citations: [
        { source: ANSWER.provenance[0]!.source, content: 'You must create a female for me', kid: '21' },
        { source: ANSWER.provenance[1]!.source, content: 'CHAPTER VII.' },
      ],
    });
  });
});

describe('an /ask answer to a Watson conclusion', () => {
  it('the conclusion shows beside the answer with the KIDs carried through', async () => {
    const bridge = bridgeStub();
    const log = await research(bridge.fetch);
    log.push(turn(ANSWER));
    await settle();
    expect(bridge.calls).toHaveLength(1);
    expect(bridge.calls[0]!.url).toBe('https://watson.stub/report');
    expect(bridge.calls[0]!.body.citations.map((c) => c.kid)).toEqual(['21', undefined]);
    const t = container.querySelector('.erie-turn')!;
    // The answer stands as ERIE gave it, and Watson sits after it.
    expect(t.querySelector('.erie-text .erie-value')!.textContent).toBe(ANSWER.text);
    expect(t.lastElementChild!.className).toBe('watson-conclusion');
    expect(texts(t, '.watson-summary')).toEqual(['The available evidence supports the claims.']);
    expect(texts(t, '.watson-confidence')).toEqual(['confidence 0.75']);
    expect(texts(t, '.watson-claim-text')).toEqual(['You must create a female for me', 'CHAPTER VII.']);
    expect(texts(t, '.watson-claim-kids')).toEqual(['KID 21', 'no KID']);
  });

  it('the rail search (/ask) shows the conclusion after its hits', async () => {
    const bridge = bridgeStub();
    const adapter = createRecordStub(ENTRIES, { ask: async () => ({ ok: true, data: ANSWER }) });
    const panel = new ResearchPanel(adapter, createWatsonBridge('https://watson.stub', bridge.fetch));
    container = document.createElement('div');
    document.body.appendChild(container);
    panel.mount(container);
    const input = container.querySelector<HTMLInputElement>('#research-q')!;
    input.value = ANSWER.question;
    container.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(texts(container, '.research-excerpt')).toEqual(['You must create a female for me', 'CHAPTER VII.']);
    expect(texts(container, '.watson-claim-kids')).toEqual(['KID 21', 'no KID']);
    panel.unmount();
  });

  it('no answer, no call: a not-found turn is never sent', async () => {
    const bridge = bridgeStub();
    const log = await research(bridge.fetch);
    log.push(turn({ question: 'zorbleflux', state: 'not_found', text: '', provenance: [] }));
    log.push(turn(null));
    await settle();
    expect(bridge.calls).toEqual([]);
    expect(container.querySelector('.watson-conclusion')).toBeNull();
  });
});

describe('a bridge failure never breaks the answer', () => {
  for (const fail of ['throw', 500, 'shape'] as const) {
    it(`bridge ${fail}: the answer stands, no conclusion shows`, async () => {
      const bridge = bridgeStub({ fail });
      const log = await research(bridge.fetch);
      log.push(turn(ANSWER));
      await settle();
      expect(bridge.calls).toHaveLength(1);
      const t = container.querySelector('.erie-turn')!;
      expect(t.querySelector('.erie-text .erie-value')!.textContent).toBe(ANSWER.text);
      expect(texts(t, '.erie-source-item .erie-content .erie-value')).toEqual(['ev-ch17', 'ev-gone']);
      expect(t.querySelector('.watson-conclusion, .error-state')).toBeNull();
    });
  }

  it('no bridge address: no call at all, the answer stands', async () => {
    const calls: string[] = [];
    const bridge = createWatsonBridge('', async (u) => { calls.push(u); return new Response('{}'); });
    expect(await bridge.report(watsonInput(ANSWER, ENTRIES))).toBeNull();
    expect(calls).toEqual([]);
  });

  it('a slow bridge never holds the answer back', async () => {
    const bridge = bridgeStub({ delayMs: 200 });
    const log = await research(bridge.fetch);
    log.push(turn(ANSWER));
    await settle(2);
    const t = container.querySelector('.erie-turn')!;
    expect(t.querySelector('.erie-text .erie-value')!.textContent).toBe(ANSWER.text); // already on screen
    expect(t.querySelector('.watson-conclusion')).toBeNull();
    await new Promise((r) => setTimeout(r, 260));
    await settle();
    expect(container.querySelector('.erie-turn .watson-conclusion')).not.toBeNull();
  });
});
