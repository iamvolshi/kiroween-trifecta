/**
 * The inspector drawer's data source: the live TRIFACTA API, a second
 * backend beside the connector (never through the connector seam).
 *
 * Auth is the X-API-Key header. The demo key is public by design: it is
 * read once from GET /config (no key needed) and sent on every call. No
 * key is written in this file or anywhere in the app.
 *
 * Read only, with one exception the API owns: POST /ask is TRIFACTA's own
 * query call, and TRIFACTA logs each ask as an ELLE event. The drawer asks
 * only when the user presses Ask.
 */

/** The API's base URL; VITE_TRIFACTA_URL overrides it at build time. Not a secret. */
export const TRIFACTA_URL: string =
  String(import.meta.env.VITE_TRIFACTA_URL ?? '').trim() || 'https://trifacta-api.onrender.com';

/** The demo cast the RATR picker offers (the API's seeded accounts). */
export const DEMO_ACCOUNTS = ['acct-001', 'acct-002', 'acct-003', 'acct-004', 'acct-005'] as const;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** One interval of one field (mirrors GET /record/{account_id}). */
export interface Interval {
  value: unknown;
  state: string;
  authority: number;
  k_start: number;
  k_end: number | null;
  reason: string;
  kid: string;
  entry_hash: string;
  held?: boolean;
}

export interface AccountRecord {
  account_id: string;
  fields: Record<string, Interval[]>;
}

/** One piece of supporting evidence behind an answer (POST /ask). */
export interface Provenance {
  source: string;
  content: string;
  excerpt: string;
}

export interface AskReply {
  question: string;
  state: string;
  text: string;
  docket_id?: string;
  provenance: Provenance[];
}

export interface LessonEvent {
  event_id: string;
  event_type: string;
  gossip_state?: string;
  rule?: string | null;
}

export interface LessonsReply {
  events_recorded: number;
  rules_formed: unknown[];
  note?: string;
  events: LessonEvent[];
}

export interface InsightsReply {
  accounts: number;
  entries: number;
  kids: number;
  standing_values: number;
  superseded_values: number;
  held_candidates: number;
  confirmed_standing: number;
  authority_distribution: Record<string, number>;
  k_min: number;
  k_max: number;
  distinct_fields: number;
}

export interface TrifactaClient {
  readonly base: string;
  ask(question: string): Promise<Result<AskReply>>;
  record(accountId: string): Promise<Result<AccountRecord>>;
  lessons(): Promise<Result<LessonsReply>>;
  insights(): Promise<Result<InsightsReply>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function isRecord(v: unknown): v is AccountRecord {
  return isObj(v) && typeof v.account_id === 'string' && isObj(v.fields)
    && Object.values(v.fields).every((list) => Array.isArray(list) && list.every((i) =>
      isObj(i) && typeof i.authority === 'number' && typeof i.k_start === 'number'
      && typeof i.kid === 'string' && typeof i.entry_hash === 'string'));
}

function isAsk(v: unknown): v is AskReply {
  return isObj(v) && typeof v.state === 'string' && Array.isArray(v.provenance)
    && v.provenance.every((p) => isObj(p) && typeof p.source === 'string' && typeof p.content === 'string');
}

const isLessons = (v: unknown): v is LessonsReply =>
  isObj(v) && typeof v.events_recorded === 'number' && Array.isArray(v.events);

const isInsights = (v: unknown): v is InsightsReply =>
  isObj(v) && typeof v.entries === 'number' && isObj(v.authority_distribution);

export function createTrifactaClient(baseUrl: string = TRIFACTA_URL, fetchImpl?: FetchLike): TrifactaClient {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  let key: Promise<Result<string>> | null = null;

  async function readKey(): Promise<Result<string>> {
    try {
      const res = await doFetch(`${base}/config`);
      if (!res.ok) return { ok: false, error: `TRIFACTA answered HTTP ${res.status} for /config` };
      const body = (await res.json()) as unknown;
      if (!isObj(body) || typeof body.api_key !== 'string' || body.api_key === '') {
        return { ok: false, error: 'TRIFACTA /config carries no api_key' };
      }
      return { ok: true, data: body.api_key };
    } catch (e) {
      return { ok: false, error: `TRIFACTA unreachable: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  /** The demo key, read once; a failed read is tried again on the next call. */
  async function demoKey(): Promise<Result<string>> {
    key ??= readKey();
    const got = await key;
    if (!got.ok) key = null;
    return got;
  }

  async function call<T>(path: string, guard: (v: unknown) => v is T, init?: RequestInit): Promise<Result<T>> {
    if (base === '') return { ok: false, error: 'TRIFACTA unreachable: no API address (VITE_TRIFACTA_URL)' };
    const k = await demoKey();
    if (!k.ok) return k;
    try {
      const headers = { ...(init?.headers as Record<string, string> | undefined), 'X-API-Key': k.data };
      const res = await doFetch(`${base}${path}`, { ...init, headers });
      if (!res.ok) return { ok: false, error: `TRIFACTA answered HTTP ${res.status} for ${path}` };
      const body = (await res.json()) as unknown;
      return guard(body) ? { ok: true, data: body } : { ok: false, error: `TRIFACTA reply to ${path} is not the shape the drawer reads` };
    } catch (e) {
      return { ok: false, error: `TRIFACTA unreachable: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  return {
    base,
    ask: (question) => call('/ask', isAsk, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    }),
    record: (accountId) => call(`/record/${encodeURIComponent(accountId)}`, isRecord),
    lessons: () => call('/lessons', isLessons),
    insights: () => call('/insights', isInsights),
  };
}

/** "acct-001.city@1-2" / "acct-001.city@3-live" -> its parts, or null. */
export function parseContent(content: string): { account: string; field: string; kStart: number; kEnd: number | null } | null {
  const m = /^((acct-[^.@\s]+)\.[^@\s]+)@(\d+)-(\d+|live)$/.exec(content.trim());
  if (!m) return null;
  return { field: m[1]!, account: m[2]!, kStart: Number(m[3]), kEnd: m[4] === 'live' ? null : Number(m[4]) };
}

/** Every interval of a record, flat, in k order then field order. */
export function flatten(rec: AccountRecord): Array<Interval & { field: string }> {
  const rows = Object.entries(rec.fields).flatMap(([field, list]) => list.map((i) => ({ ...i, field })));
  return rows.sort((a, b) => a.k_start - b.k_start || a.field.localeCompare(b.field));
}
