import type { FetchLike } from './adapter/sherlock-client.ts';
import type { CorpusGraph, CorpusNouns, CorpusOverview } from './adapter/sherlock-types.ts';
import { makeEntry } from './test-helpers.ts';

/**
 * TEST DOUBLE of the Sherlock search service (never imported by app code).
 * It follows the contract's shapes for health, cases, overview, nouns, graph
 * and ask; the record-read, curator and chat routes follow the shapes the app
 * asked the Sherlock worker for. It records every URL it was asked for, so a
 * test can prove nothing went anywhere else. Its corpus is a tiny made-up
 * one: it says nothing about Frankenstein.
 */
export const SHERLOCK_BASE = 'http://sherlock.test';
export const DOUBLE_CASE = 'double-case';

export const DOUBLE_OVERVIEW: CorpusOverview = {
  case_id: DOUBLE_CASE, source: 'double.txt', word_count: 120, char_count: 700, entry_count: 4,
  sections: [
    { name: 'Letter 1', kind: 'letter', start_kid: 1, end_kid: 2, word_count: 70, opening: 'To Mrs. Saville' },
    { name: 'Chapter 1', kind: 'chapter', start_kid: 3, end_kid: 4, word_count: 50, opening: 'I am by birth a Genevese' },
  ],
  top_terms: [{ term: 'father', count: 9 }, { term: 'ice', count: 4 }],
  opening_excerpt: 'You will rejoice to hear', closing_excerpt: 'lost in darkness',
  built_by: 'deterministic',
};
export const DOUBLE_NOUNS: CorpusNouns = {
  case_id: DOUBLE_CASE, count: 3,
  nouns: [
    { noun: 'Victor', kind: 'person', count: 7, first_kid: 3, kids: [3, 4] },
    { noun: 'Geneva', kind: 'place', count: 3, first_kid: 3, kids: [3] },
    { noun: 'Ice', kind: 'thing', count: 2, first_kid: 1, kids: [1, 2] },
  ],
};
export const DOUBLE_GRAPH: CorpusGraph = {
  case_id: DOUBLE_CASE,
  nodes: DOUBLE_NOUNS.nouns.map((n) => ({ id: n.noun, label: n.noun, kind: n.kind, count: n.count })),
  edges: [{ source: 'Geneva', target: 'Victor', weight: 3, kids: [3] }, { source: 'Ice', target: 'Victor', weight: 1, kids: [1] }],
  built_by: 'deterministic co-occurrence of nouns in one passage',
};
const ANSWER = {
  question: 'q', state: 'found', text: 'a passage about the ice', status: 'SUPPORTED', confidence: 0.8,
  provenance: [{ source: 'double.txt', content: 'kid:1', excerpt: 'the ice broke', kid: 1, authority: 2, section: 'Letter 1', evidence_id: 'ev1', score: 1 }],
};

export interface SherlockDouble {
  fetch: FetchLike;
  /** Every URL asked for, in order. */
  urls: string[];
}

/** `down` makes every request fail like an unreachable host. */
export function createSherlockDouble(opts: { down?: boolean; overviewStatus?: number } = {}): SherlockDouble {
  const urls: string[] = [];
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetch: FetchLike = async (url, init) => {
    urls.push(url);
    if (opts.down) throw new TypeError('fetch failed');
    const path = url.slice(SHERLOCK_BASE.length).split('?')[0]!;
    const post = init?.method === 'POST';
    const c = `/api/search/cases/${DOUBLE_CASE}`;
    if (path === '/api/search/cases') return json({ cases: [{ case_id: DOUBLE_CASE, name: 'double', ready: true, entry_count: 4, word_count: 120 }] });
    if (path === `${c}/overview`) return opts.overviewStatus === 409
      ? json({ error: 'stage_incomplete', missing: ['overview'] }, 409) : json(DOUBLE_OVERVIEW);
    if (path === `${c}/nouns`) return json(DOUBLE_NOUNS);
    if (path === `${c}/graph`) return json(DOUBLE_GRAPH);
    if (post && path === `${c}/ask`) return json({ ...ANSWER, question: JSON.parse(String(init?.body)).question });
    if (post && path === `${c}/curator/ask`) return json({ ...ANSWER, found: true });
    if (post && path === `${c}/chat`) return json({
      message: 'hi', known: true, step: null, total_steps: 0,
      engines: { arche: { reply: 'r' }, erie: null, elle: null, elle_promoted: null,
        lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [] },
    });
    if (path === `${c}/entries` || path === `${c}/belief-pool` || path === `${c}/chain`) return json([makeEntry()]);
    if (path === `${c}/kidmap`) return json({ 1: 'a' });
    if (path === `${c}/lessons`) return json([]);
    if (path === `${c}/questions`) return json([{ id: 'q1', question: 'who?' }]);
    if (path.startsWith(`${c}/record/`)) return json({ account_id: 'x', fields: {} });
    return json({ detail: 'not found' }, 404);
  };
  return { fetch, urls };
}
