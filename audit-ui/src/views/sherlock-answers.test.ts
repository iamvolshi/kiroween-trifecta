/**
 * Sherlock's fixed answer shape: a K-entry hit shows its K label and authority,
 * a weak answer says so in words, the rerank state shows small, and a plain
 * passage answer reads as before. The service is a test double (a fetch that
 * answers the ask route with the contract's fields), never app code.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createSherlockAdapter } from '../adapter/sherlock.ts';
import type { FetchLike } from '../adapter/sherlock-client.ts';
import { renderAnswer } from './curator.ts';
import { renderRetrieval } from './research.ts';
import { watsonInput } from '../watson/conclusion.ts';
import { SHERLOCK_BASE, createSherlockDouble } from '../sherlock-double.ts';

afterEach(() => { document.body.innerHTML = ''; });

const K_HIT = {
  source: 'k_record', content: 'kid:K-0266', excerpt: 'Victor travels alone to the Orkneys.',
  kid: 266, kid_label: 'K-0266', kind: 'k_entry', authority: 8, section: 'Chapter 19', evidence_id: '', score: 7.4, rerank_score: -1.96,
};
const WEAK = {
  question: 'q', state: 'found', text: 'best matches', status: 'WEAK_SUPPORT', confidence: 0.29, low_confidence: true,
  ranked_by: 'rerank', rerank: { used: true, model: 'nvidia/nemotron-3.5-rerank-8b', error: null }, provenance: [K_HIT],
};
const PLAIN = {
  question: 'q', state: 'found', text: 'a passage', status: 'SUPPORTED', confidence: 0.8, low_confidence: false,
  provenance: [{ source: 'double.txt', content: 'kid:1', excerpt: 'the ice broke', kid: 1, authority: 2 }],
};

/** The double, with the ask route answering `body`. */
function withAsk(body: unknown): FetchLike {
  const d = createSherlockDouble();
  return (url, init) => url.endsWith('/ask') && init?.method === 'POST'
    ? Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
    : d.fetch(url, init);
}

describe('K-entry hits', () => {
  it('Research ask turn shows the K label and authority', async () => {
    const a = await createSherlockAdapter(SHERLOCK_BASE, '', withAsk(WEAK)).ask('q');
    if (!a.ok) throw new Error(a.error);
    const turn = renderRetrieval(a.data, 1, 'q');
    expect(turn.querySelector('.erie-KID .erie-value')?.textContent).toBe('K-0266');
    expect(turn.querySelector('.erie-authority .erie-value')?.textContent).toBe('8 of 9');
  });

  it('Curator ask shows the K label and authority', async () => {
    const a = await createSherlockAdapter(SHERLOCK_BASE, '', withAsk(WEAK)).curatorAsk('q');
    // The double's curator route is its own; build the answer the same way the adapter does.
    expect(a.ok).toBe(true);
    const text = renderAnswer('q', { ok: true, data: { ...(a as { data: object }).data, ...WEAK, provenance: [K_HIT], found: true } as never }).textContent ?? '';
    expect(text).toContain('K-0266');
    expect(text).toContain('authority 8 of 9');
  });

  it('Watson gets the K label as the KID', () => {
    const a = { question: 'q', state: 'found' as const, text: 't', provenance: [K_HIT as never] };
    expect(watsonInput(a, []).citations[0]!.kid).toBe('K-0266');
  });

  it('the adapter keeps kind, kid_label, rerank_score and the rerank fields', async () => {
    const a = await createSherlockAdapter(SHERLOCK_BASE, '', withAsk(WEAK)).ask('q');
    expect(a.ok && a.data).toMatchObject({
      status: 'WEAK_SUPPORT', low_confidence: true, ranked_by: 'rerank', rerank: { used: true, model: 'nvidia/nemotron-3.5-rerank-8b' },
      provenance: [{ kind: 'k_entry', kid_label: 'K-0266', rerank_score: -1.96 }],
    });
  });
});

describe('low confidence', () => {
  it('says it in the Research ask turn and the Curator answer', async () => {
    const a = await createSherlockAdapter(SHERLOCK_BASE, '', withAsk(WEAK)).ask('q');
    if (!a.ok) throw new Error(a.error);
    expect(renderRetrieval(a.data, 1, 'q').querySelector('.sherlock-weak')).not.toBeNull();
    const cur = renderAnswer('q', { ok: true, data: { ...a.data, found: true } });
    expect(cur.querySelector('.sherlock-weak')?.textContent).toMatch(/weakly sure/);
  });

  it('says when the reranker was not used', async () => {
    const a = await createSherlockAdapter(SHERLOCK_BASE, '', withAsk({ ...WEAK, ranked_by: 'erie', rerank: { used: false, model: null, error: 'no key' } })).ask('q');
    if (!a.ok) throw new Error(a.error);
    expect(renderRetrieval(a.data, 1, 'q').querySelector('.sherlock-rerank')?.textContent).toContain('Not reranked');
  });
});

describe('unchanged behaviour', () => {
  it('a plain passage answer shows KID and authority and no weak or rerank note', async () => {
    const a = await createSherlockAdapter(SHERLOCK_BASE, '', withAsk(PLAIN)).ask('q');
    if (!a.ok) throw new Error(a.error);
    const turn = renderRetrieval(a.data, 1, 'q');
    expect(turn.querySelector('.erie-KID .erie-value')?.textContent).toBe('1');
    expect(turn.querySelector('.erie-authority .erie-value')?.textContent).toBe('2 of 9');
    expect(turn.querySelector('.sherlock-notes')).toBeNull();
  });
});
