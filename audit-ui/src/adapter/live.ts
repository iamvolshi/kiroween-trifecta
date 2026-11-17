// LIVE ADAPTER -- a rough HTTP client for the connector to the bot loop.
// No engine code lives here: it sends names and reads the seam shapes back.
// The connector contract (plain JSON over HTTP, no auth) is in
// docs/assembly-parts.md; the request/response shapes are the types in seam.ts.
//
// With no base URL, every call returns the typed "Live adapter not wired"
// error, as before. Calls outside the connector contract (the record-wide
// reads the viewer uses, and update) also return a typed error that says so.
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
      if (!res.ok) return { ok: false, error: `Connector answered HTTP ${res.status} for ${path}` };
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

  return {
    fetchAllEntries: (): Promise<AdapterResult<Entry[]>> => outside('the whole-record read'),
    fetchBeliefPool: (momentMs: number): Promise<AdapterResult<Entry[]>> => {
      void momentMs;
      return outside('the belief-pool read');
    },
    fetchChain: (kid: number, subject: string): Promise<AdapterResult<Entry[]>> => {
      void kid;
      void subject;
      return outside('the chain read');
    },
    fetchKidMap: (): Promise<AdapterResult<KidMap>> => outside('the KID map read'),
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
