// THE SEAM ADAPTER over Sherlock. Every search and every record read in the
// app is one call here, and each is one request to Sherlock (sherlock-client.ts).
// Nothing here reaches the old connector; when Sherlock is down a call fails in
// words and is not retried anywhere else. No engine code lives here.
//
// Routes under /api/search/cases/{case}/ :
//   ask                       contract: question -> AskResult (extended)
//   curator/ask, chat         NOT in the contract yet: asked of the Sherlock worker
//   entries, belief-pool, chain, kidmap, lessons, questions, record/{account}
//                             NOT in the contract yet: asked of the Sherlock worker
import type {
  AdapterResult, AskResult, ChatOptions, ChatTurn, CuratorAnswer, Entry, KidMap, Lesson,
  Provenance, QuestionsResult, RecordResult, SeamAdapter, UpdateRequest, UpdateResult,
} from './seam';
import { isChatTurn } from './seam';
import { chatBody } from './live';
import { asEntries, asKidMap } from './live-guards';
import { createSherlockClient, type FetchLike } from './sherlock-client';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Sherlock's provenance, kept in the seam's shape; KID and authority ride along. */
function toProvenance(v: unknown): Provenance | null {
  if (!isObj(v) || typeof v.source !== 'string' || typeof v.content !== 'string' || typeof v.excerpt !== 'string') return null;
  const p: Provenance = { source: v.source, content: v.content, excerpt: v.excerpt };
  if (typeof v.kid === 'number') p.kid = v.kid;
  if (typeof v.authority === 'number') p.authority = v.authority;
  return p;
}

/** The AskResult in a Sherlock reply, or a sentence saying why it is not one. */
export function asAnswer(v: unknown): AdapterResult<AskResult & { found?: boolean }> {
  if (!isObj(v) || typeof v.question !== 'string' || typeof v.text !== 'string' ||
      (v.state !== 'found' && v.state !== 'not_found') || !Array.isArray(v.provenance)) {
    return { ok: false, error: 'Sherlock reply to ask is not an answer (see the Sherlock search contract)' };
  }
  const provenance = v.provenance.map(toProvenance);
  if (provenance.some((p) => p === null)) return { ok: false, error: 'Sherlock reply to ask has a provenance item that is not one' };
  return { ok: true, data: { question: v.question, state: v.state, text: v.text, provenance: provenance as Provenance[] } };
}

export function createSherlockAdapter(baseUrl: string, caseId = '', fetchImpl?: FetchLike): SeamAdapter {
  const sherlock = createSherlockClient(baseUrl, caseId, fetchImpl);

  async function entries(route: string): Promise<AdapterResult<Entry[]>> {
    const r = await sherlock.get<unknown>(route);
    return r.ok ? asEntries(r.data, route.split('?')[0]!) : r;
  }

  async function ask(route: string, question: string): Promise<AdapterResult<AskResult>> {
    const r = await sherlock.post<unknown>(route, { question });
    return r.ok ? asAnswer(r.data) : r;
  }

  return {
    corpus: sherlock.corpus,
    fetchAllEntries: () => entries('entries'),
    fetchBeliefPool: (momentMs: number) =>
      Number.isFinite(momentMs)
        ? entries(`belief-pool?at=${Math.floor(momentMs)}`)
        : Promise.resolve({ ok: false as const, error: 'Sherlock adapter: the belief-pool moment is not a number' }),
    fetchChain: (kid: number, subject: string) =>
      entries(`chain?kid=${encodeURIComponent(String(kid))}&subject=${encodeURIComponent(subject)}`),
    fetchKidMap: async (): Promise<AdapterResult<KidMap>> => {
      const r = await sherlock.get<unknown>('kidmap');
      return r.ok ? asKidMap(r.data, 'kidmap') : r;
    },
    update: (req: UpdateRequest): Promise<AdapterResult<UpdateResult>> => {
      void req;
      return Promise.resolve({ ok: false, error: 'Sherlock adapter: update is not a search and is not in the Sherlock contract' });
    },
    ask: (question: string) => ask('ask', question),
    curatorAsk: async (question: string): Promise<AdapterResult<CuratorAnswer>> => {
      const r = await sherlock.post<unknown>('curator/ask', { question });
      if (!r.ok) return r;
      const a = asAnswer(r.data);
      if (!a.ok) return a;
      return { ok: true, data: { ...a.data, found: isObj(r.data) && typeof r.data.found === 'boolean' ? r.data.found : a.data.state === 'found' } };
    },
    chat: async (message: string, options?: ChatOptions): Promise<AdapterResult<ChatTurn>> => {
      const r = await sherlock.post<unknown>('chat', chatBody(message, options));
      if (!r.ok) return r;
      return isChatTurn(r.data)
        ? { ok: true, data: r.data }
        : { ok: false, error: 'Sherlock reply to chat is not a ChatTurn (see docs/assembly-parts.md)' };
    },
    fetchLessons: (): Promise<AdapterResult<Lesson[]>> => sherlock.get('lessons'),
    // Sherlock sends [{ id, question }] (no states, no reasoning): each becomes a question folder with its blanks left blank.
    fetchQuestions: async (): Promise<AdapterResult<QuestionsResult>> => {
      const r = await sherlock.get<unknown>('questions');
      if (!r.ok) return r;
      if (isObj(r.data) && Array.isArray(r.data.questions)) return { ok: true, data: r.data as unknown as QuestionsResult };
      if (!Array.isArray(r.data) || !r.data.every((q) => isObj(q) && typeof q.id === 'string' && typeof q.question === 'string')) {
        return { ok: false, error: 'Sherlock reply to questions is not the contract shape' };
      }
      const questions = (r.data as Array<{ id: string; question: string }>).map((q) => ({
        kid: null, event_id: q.id, subject: q.id, question: q.question, state: null, source: '', rule: '',
        observations: [], concerns: [], scratch: [], ideas: [], open: true, closed: null, versions: 0,
      }));
      return { ok: true, data: { questions, reasoning: null } };
    },
    fetchRecord: (accountId: string): Promise<AdapterResult<RecordResult>> =>
      sherlock.get(`record/${encodeURIComponent(accountId)}`),
  };
}
