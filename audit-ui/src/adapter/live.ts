// LIVE ADAPTER -- a rough HTTP client for the connector to the bot loop.
// No engine code lives here: it sends names and reads the seam shapes back.
// The connector contract (plain JSON over HTTP, no auth) is in
// docs/assembly-parts.md; the request/response shapes are the types in seam.ts.
//
// With no base URL, every call returns the typed "Live adapter not wired"
// error, as before. The record reads (entries, belief pool, chain, KID map)
// are in the contract and their replies pass shape guards (live-guards.ts).
// update is outside the contract and returns a typed error that says so.
import type {
  AdapterResult,
  AskResult,
  ChatOptions,
  ChatTurn,
  Entry,
  KidMap,
  Lesson,
  RecordResult,
  SeamAdapter,
  UpdateRequest,
  UpdateResult,
} from './seam';
import { isChatTurn } from './seam';
import { asEntries, asKidMap } from './live-guards';

const NOT_WIRED = Object.freeze({ ok: false as const, error: 'Live adapter not wired' });

function notInContract(what: string): { ok: false; error: string } {
  return { ok: false, error: `Live adapter: ${what} is not in the connector contract yet` };
}

/** The fetch the adapter uses; tests pass a double. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** The JSON body of POST /chat. `register` only for Frankenstein. */
export function chatBody(message: string, options?: ChatOptions): Record<string, string> {
  const body: Record<string, string> = { message };
  if (options) {
    body.persona = options.persona;
    if (options.persona === 'Frankenstein' && options.register) body.register = options.register;
  }
  return body;
}

export function createLiveAdapter(baseUrl: string, fetchImpl?: FetchLike): SeamAdapter {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));

  async function call<T>(path: string, init?: RequestInit): Promise<AdapterResult<T>> {
    if (base === '') return NOT_WIRED;
    try {
      const res = await doFetch(`${base}${path}`, init);
      if (!res.ok) {
        // The connector's refusals carry an { "error": "..." } body; say it.
        let words = '';
        try {
          const body = (await res.json()) as { error?: unknown } | null;
          if (body && typeof body.error === 'string' && body.error !== '') words = `: ${body.error}`;
        } catch {
          // no JSON body: the status alone
        }
        return { ok: false, error: `Connector answered HTTP ${res.status} for ${path}${words}` };
      }
      return { ok: true, data: (await res.json()) as T };
    } catch (e) {
      return { ok: false, error: `Connector unreachable: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const outside = <T>(what: string): Promise<AdapterResult<T>> =>
    Promise.resolve(base === '' ? NOT_WIRED : notInContract(what));

  async function entries(path: string): Promise<AdapterResult<Entry[]>> {
    const r = await call<unknown>(path);
    return r.ok ? asEntries(r.data, path.split('?')[0]!) : r;
  }

  return {
    fetchAllEntries: (): Promise<AdapterResult<Entry[]>> => entries('/entries'),
    fetchBeliefPool: (momentMs: number): Promise<AdapterResult<Entry[]>> => {
      if (base === '') return Promise.resolve(NOT_WIRED);
      if (!Number.isFinite(momentMs)) {
        return Promise.resolve({ ok: false, error: 'Live adapter: the belief-pool moment is not a number' });
      }
      return entries(`/belief-pool?at=${Math.floor(momentMs)}`);
    },
    fetchChain: (kid: number, subject: string): Promise<AdapterResult<Entry[]>> =>
      entries(`/chain?kid=${encodeURIComponent(String(kid))}&subject=${encodeURIComponent(subject)}`),
    fetchKidMap: async (): Promise<AdapterResult<KidMap>> => {
      const r = await call<unknown>('/kidmap');
      return r.ok ? asKidMap(r.data, '/kidmap') : r;
    },
    update: (req: UpdateRequest): Promise<AdapterResult<UpdateResult>> => {
      void req;
      return outside('update');
    },

    ask: (question: string): Promise<AdapterResult<AskResult>> => call('/ask', post({ question })),
    chat: async (message: string, options?: ChatOptions): Promise<AdapterResult<ChatTurn>> => {
      const r = await call<unknown>('/chat', post(chatBody(message, options)));
      if (!r.ok) return r;
      return isChatTurn(r.data)
        ? { ok: true, data: r.data }
        : { ok: false, error: 'Connector reply to /chat is not a ChatTurn (see docs/assembly-parts.md)' };
    },
    fetchLessons: (): Promise<AdapterResult<Lesson[]>> => call('/lessons'),
    fetchRecord: (accountId: string): Promise<AdapterResult<RecordResult>> =>
      call(`/record/${encodeURIComponent(accountId)}`),
  };
}
