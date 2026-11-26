// The one Sherlock client. Every search in the app goes through it: there is
// no second address and no fallback. When Sherlock cannot answer, the result
// is { ok: false, error } in words, and the views show that.
// Routes are the ones in the Sherlock search contract (under /api/search).
import type { AdapterResult } from './seam';
import {
  isGraph, isNouns, isOverview,
  type CaseStatus, type CorpusReads,
} from './sherlock-types';

/** The words every call answers when no Sherlock address was set at build time. */
export const NO_SHERLOCK_ADDRESS =
  'Sherlock unreachable: no Sherlock address was set at build time (VITE_SHERLOCK_URL)';

/** The fetch the client uses; tests pass a double. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SherlockClient {
  /** GET a route under the case (e.g. 'entries'). */
  get<T>(route: string): Promise<AdapterResult<T>>;
  /** POST JSON to a route under the case (e.g. 'ask'). */
  post<T>(route: string, body: unknown): Promise<AdapterResult<T>>;
  corpus: CorpusReads;
}

/** A refusal body in words: 409 names the stages still missing. */
async function refusal(res: Response, what: string): Promise<string> {
  let words = '';
  try {
    const b = (await res.json()) as { detail?: unknown; error?: unknown; missing?: unknown } | null;
    if (b && Array.isArray(b.missing) && b.missing.length > 0) {
      words = `: not ready, Sherlock has not finished ${b.missing.join(', ')}`;
    } else if (b && typeof b.detail === 'string' && b.detail !== '') words = `: ${b.detail}`;
    else if (b && typeof b.error === 'string' && b.error !== '') words = `: ${b.error}`;
  } catch {
    // no JSON body: the status alone
  }
  return `Sherlock answered HTTP ${res.status} for ${what}${words}`;
}

export function createSherlockClient(baseUrl: string, caseId = '', fetchImpl?: FetchLike): SherlockClient {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  let resolved: Promise<AdapterResult<string>> | null = null;

  async function raw<T>(path: string, init?: RequestInit): Promise<AdapterResult<T>> {
    if (base === '') return { ok: false, error: NO_SHERLOCK_ADDRESS };
    try {
      const res = await doFetch(`${base}/api/search${path}`, init);
      if (!res.ok) return { ok: false, error: await refusal(res, path) };
      return { ok: true, data: (await res.json()) as T };
    } catch (e) {
      return { ok: false, error: `Sherlock unreachable: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /** The case to search: the one named at build time, else the first ready case Sherlock lists. */
  async function pickCase(): Promise<AdapterResult<string>> {
    if (caseId !== '') return { ok: true, data: caseId };
    const list = await raw<unknown>('/cases');
    if (!list.ok) return list;
    // The service answers { cases: [...] }; a bare list is read the same.
    const body = list.data as { cases?: unknown } | null;
    const listed = Array.isArray(list.data) ? list.data : body && Array.isArray(body.cases) ? body.cases : [];
    const cases = listed as CaseStatus[];
    const ready = cases.find((c) => c && c.ready === true);
    return ready && typeof ready.case_id === 'string'
      ? { ok: true, data: ready.case_id }
      : { ok: false, error: 'Sherlock has no corpus attached yet: no case is ready' };
  }

  async function inCase<T>(route: string, init?: RequestInit): Promise<AdapterResult<T>> {
    if (base === '') return { ok: false, error: NO_SHERLOCK_ADDRESS };
    resolved ??= pickCase();
    const c = await resolved;
    if (!c.ok) {
      resolved = null; // try again on the next call
      return c;
    }
    return raw<T>(`/cases/${encodeURIComponent(c.data)}/${route}`, init);
  }

  async function checked<T>(route: string, guard: (v: unknown) => v is T, what: string): Promise<AdapterResult<T>> {
    const r = await inCase<unknown>(route);
    if (!r.ok) return r;
    return guard(r.data) ? { ok: true, data: r.data } : { ok: false, error: `Sherlock reply to ${what} is not the contract shape` };
  }

  return {
    get: (route) => inCase(route),
    post: (route, body) =>
      inCase(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    corpus: {
      overview: () => checked('overview', isOverview, 'overview'),
      nouns: () => checked('nouns', isNouns, 'nouns'),
      graph: () => checked('graph', isGraph, 'graph'),
    },
  };
}
