// The one client for Sherlock's /api/github routes (contract: docs/github-adapter-contract.md
// in the NewSherlock repo). A person attaches their own public repo and asks about it.
// The per-user token is made here (>= 128 bits), kept in localStorage and sent as
// X-Sherlock-Session on every call. There is no fallback: when Sherlock cannot
// answer, the result is { ok: false, error } in words.
import type { AdapterResult } from './seam';
import { NO_SHERLOCK_ADDRESS, type FetchLike } from './sherlock-client';

export const SESSION_KEY = 'sherlock-github-session';

export type RepoState = 'queued' | 'fetching' | 'indexing' | 'ready' | 'failed' | 'detached';

export interface RepoStatus {
  state: RepoState;
  repo: string;
  branch: string | null;
  folder: string;
  files_listed: number;
  files_ingested: number;
  files_skipped: number;
  passages: number;
  truncated: boolean;
  error: { code: string; message: string; reset_at?: number } | null;
}

export interface RepoCitation {
  path: string;
  kid?: number;
  kid_label?: string;
  excerpt: string;
  source: string;
}

export interface RepoAnswer {
  text: string;
  state: 'found' | 'not_found';
  status?: string;
  low_confidence?: boolean;
  rerank?: { used: boolean; model?: string; error?: string };
  citations: RepoCitation[];
}

export interface AttachRequest { repo: string; branch?: string; folder?: string }

/** `null` data on a 404 no_repo_attached from status. */
export interface GithubClient {
  token(): string;
  attach(req: AttachRequest): Promise<AdapterResult<RepoStatus>>;
  status(): Promise<AdapterResult<RepoStatus | null>>;
  ask(question: string): Promise<AdapterResult<RepoAnswer>>;
  detach(): Promise<AdapterResult<null>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** 43 URL-safe characters from 256 random bits. */
export function mintToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The service's error codes in plain words. `message` is the service's own text. */
export function errorWords(code: string, message: string, resetAt?: number): string {
  switch (code) {
    case 'repo_not_found': return 'GitHub could not find that repo. It may be private, or the name may be wrong. Only public repos can be attached.';
    case 'branch_not_found': return 'That branch was not found in the repo.';
    case 'github_rate_limited':
      return `GitHub's rate limit is used up${resetAt ? `. Try again after ${new Date(resetAt * 1000).toLocaleTimeString()}` : '. Try again later'}.`;
    case 'no_text_files': return 'The repo has no text or code files Sherlock can read there.';
    case 'invalid_repo': return 'That is not a repo name Sherlock accepts. Use owner/repo or a github.com link.';
    case 'busy': return 'Sherlock is reading another repo right now. Try again in a few seconds.';
    case 'ingest_in_progress': return 'This repo is still being read. Wait for it, or detach it first.';
    case 'not_ready': return 'The repo is not ready yet. Wait until it says ready.';
    case 'no_repo_attached': return 'No repo is attached.';
    case 'missing_session':
    case 'invalid_session': return 'Sherlock did not accept this browser\'s session key. Detach and attach the repo again.';
    default: return message !== '' ? message : `Sherlock reported an error (${code}).`;
  }
}

function toStatus(v: unknown): RepoStatus | null {
  if (!isObj(v) || typeof v.state !== 'string' || typeof v.repo !== 'string') return null;
  const e = isObj(v.error) && typeof v.error.code === 'string'
    ? { code: v.error.code, message: typeof v.error.message === 'string' ? v.error.message : '', ...(typeof v.error.reset_at === 'number' ? { reset_at: v.error.reset_at } : {}) }
    : null;
  return {
    state: v.state as RepoState, repo: v.repo, branch: typeof v.branch === 'string' ? v.branch : null,
    folder: typeof v.folder === 'string' ? v.folder : '', files_listed: num(v.files_listed),
    files_ingested: num(v.files_ingested), files_skipped: num(v.files_skipped), passages: num(v.passages),
    truncated: v.truncated === true, error: e,
  };
}

function toAnswer(v: unknown): RepoAnswer | null {
  if (!isObj(v) || typeof v.text !== 'string' || (v.state !== 'found' && v.state !== 'not_found') || !Array.isArray(v.provenance)) return null;
  const citations: RepoCitation[] = [];
  for (const p of v.provenance) {
    if (!isObj(p)) return null;
    const path = typeof p.path === 'string' ? p.path : typeof p.section === 'string' ? p.section : '';
    const c: RepoCitation = { path, excerpt: typeof p.excerpt === 'string' ? p.excerpt : '', source: typeof p.source === 'string' ? p.source : '' };
    if (typeof p.kid === 'number') c.kid = p.kid;
    if (typeof p.kid_label === 'string') c.kid_label = p.kid_label;
    citations.push(c);
  }
  const a: RepoAnswer = { text: v.text, state: v.state, citations };
  if (typeof v.status === 'string') a.status = v.status;
  if (typeof v.low_confidence === 'boolean') a.low_confidence = v.low_confidence;
  if (isObj(v.rerank) && typeof v.rerank.used === 'boolean') {
    a.rerank = { used: v.rerank.used };
    if (typeof v.rerank.model === 'string') a.rerank.model = v.rerank.model;
    if (typeof v.rerank.error === 'string') a.rerank.error = v.rerank.error;
  }
  return a;
}

export function createGithubClient(baseUrl: string, fetchImpl?: FetchLike, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): GithubClient {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));

  function token(): string {
    let t = '';
    try { t = storage.getItem(SESSION_KEY) ?? ''; } catch { /* storage blocked: a fresh key per call would lose the repo */ }
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(t)) {
      t = mintToken();
      try { storage.setItem(SESSION_KEY, t); } catch { /* kept for this page only below */ }
    }
    return t;
  }

  /** Returns the parsed body, or words. `missingOk` turns a 404 into null data. */
  async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<AdapterResult<{ status: number; json: unknown }>> {
    if (base === '') return { ok: false, error: NO_SHERLOCK_ADDRESS };
    const headers: Record<string, string> = { 'X-Sherlock-Session': token() };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await doFetch(`${base}/api/github${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (e) {
      return { ok: false, error: `Sherlock unreachable: ${e instanceof Error ? e.message : String(e)}. The app does not use any other search.` };
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* no body */ }
    if (res.ok) return { ok: true, data: { status: res.status, json } };
    const d = isObj(json) && isObj(json.detail) ? json.detail : {};
    const code = typeof d.error === 'string' ? d.error : '';
    const message = typeof d.message === 'string' ? d.message : '';
    if (res.status === 404 && code === 'no_repo_attached') return { ok: true, data: { status: 404, json: null } };
    const words = code !== '' ? errorWords(code, message) : `Sherlock answered HTTP ${res.status} for ${path}`;
    return { ok: false, error: words };
  }

  return {
    token,
    attach: async (req) => {
      const r = await call('/attach', 'POST', req);
      if (!r.ok) return r;
      const s = toStatus(r.data.json);
      return s ? { ok: true, data: s } : { ok: false, error: 'Sherlock reply to attach is not the contract shape' };
    },
    status: async () => {
      const r = await call('/status', 'GET');
      if (!r.ok) return r;
      if (r.data.status === 404) return { ok: true, data: null };
      const s = toStatus(r.data.json);
      return s ? { ok: true, data: s } : { ok: false, error: 'Sherlock reply to status is not the contract shape' };
    },
    ask: async (question) => {
      const r = await call('/ask', 'POST', { question });
      if (!r.ok) return r;
      if (r.data.status === 404) return { ok: false, error: errorWords('no_repo_attached', '') };
      const a = toAnswer(r.data.json);
      return a ? { ok: true, data: a } : { ok: false, error: 'Sherlock reply to ask is not an answer (see the GitHub adapter contract)' };
    },
    detach: async () => {
      const r = await call('/detach', 'POST', {});
      return r.ok ? { ok: true, data: null } : r;
    },
  };
}
