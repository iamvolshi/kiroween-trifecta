// The one client for Sherlock's /api/rosie app routes (contract: docs/rosie-contract.md in the
// NewSherlock repo, branch feat/sherlock-rosie). Rosie is a small program on the person's own
// computer; she reaches out to Sherlock, so the app only talks to Sherlock. The per-person key is
// the same one the GitHub adapter uses (X-Sherlock-Session). No fallback: when Sherlock cannot
// answer, the result is { ok: false, error } in words.
import type { AdapterResult } from './seam';
import { NO_SHERLOCK_ADDRESS, type FetchLike } from './sherlock-client';
import { sessionToken, toAnswer, type RepoAnswer } from './github-client';

export type RosieState = 'not_paired' | 'asleep' | 'connected' | 'choosing_folder' | 'reading' | 'indexing' | 'ready' | 'failed';
export type RosieConnection = 'not_paired' | 'asleep' | 'connected';

export interface RosieStatus {
  state: RosieState;
  connection: RosieConnection;
  message: string;
  machine: { name: string; version: string } | null;
  folder: string | null;
  files_read: number;
  files_skipped: number;
  passages: number;
  truncated: boolean;
  error: { code: string; message: string } | null;
}

export interface PairingCode { code: string; expiresMs: number }

export interface RosieClient {
  token(): string;
  status(): Promise<AdapterResult<RosieStatus>>;
  pair(): Promise<AdapterResult<PairingCode>>;
  chooseFolder(): Promise<AdapterResult<null>>;
  ask(question: string): Promise<AdapterResult<RepoAnswer>>;
  detach(): Promise<AdapterResult<null>>;
  unpair(): Promise<AdapterResult<null>>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const STATES = new Set(['not_paired', 'asleep', 'connected', 'choosing_folder', 'reading', 'indexing', 'ready', 'failed']);

/** The service's error codes in plain words. */
export function rosieErrorWords(code: string, message: string): string {
  switch (code) {
    case 'not_paired': return 'Rosie is not paired yet. Get a pairing code first.';
    case 'rosie_asleep': return 'Rosie is asleep, start her again on your computer.';
    case 'ingest_in_progress': return 'Rosie is still reading a folder. Wait for it, or detach it first.';
    case 'not_ready': return 'The folder is not ready yet. Wait until it says Ready.';
    case 'no_folder_attached': return 'No local folder is attached. Choose a folder first.';
    case 'empty_question': return 'Type a question first.';
    case 'busy': return 'Sherlock is reading another folder or repo right now. Try again in a few seconds.';
    case 'too_many_attempts': return 'Too many wrong codes were tried. Wait a little, then get a new code.';
    case 'no_text_files': return 'That folder has no text or code files Sherlock can read.';
    case 'rosie_went_away': return 'Rosie went to sleep while reading. Start her again, then choose the folder again.';
    case 'intake_failed': return 'Sherlock could not index that folder.';
    case 'interrupted': return 'Sherlock restarted while reading. Choose the folder again.';
    case 'missing_session':
    case 'invalid_session': return 'Sherlock did not accept this browser\'s session key. Unpair Rosie and pair her again.';
    default: return message !== '' ? message : `Sherlock reported an error (${code}).`;
  }
}

function toStatus(v: unknown): RosieStatus | null {
  if (!isObj(v) || typeof v.state !== 'string' || !STATES.has(v.state)) return null;
  const m = isObj(v.machine) && typeof v.machine.name === 'string'
    ? { name: v.machine.name, version: typeof v.machine.version === 'string' ? v.machine.version : '' } : null;
  const e = isObj(v.error) && typeof v.error.code === 'string'
    ? { code: v.error.code, message: typeof v.error.message === 'string' ? v.error.message : '' } : null;
  return {
    state: v.state as RosieState,
    connection: v.connection === 'connected' || v.connection === 'asleep' ? v.connection : 'not_paired',
    message: typeof v.message === 'string' ? v.message : '',
    machine: m, folder: typeof v.folder === 'string' ? v.folder : null,
    files_read: num(v.files_read), files_skipped: num(v.files_skipped), passages: num(v.passages),
    truncated: v.truncated === true, error: e,
  };
}

export function createRosieClient(baseUrl: string, fetchImpl?: FetchLike, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): RosieClient {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  const token = (): string => sessionToken(storage);

  async function call(path: string, method: 'GET' | 'POST', body?: unknown): Promise<AdapterResult<unknown>> {
    if (base === '') return { ok: false, error: NO_SHERLOCK_ADDRESS };
    const headers: Record<string, string> = { 'X-Sherlock-Session': token() };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await doFetch(`${base}/api/rosie${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch (e) {
      return { ok: false, error: `Sherlock unreachable: ${e instanceof Error ? e.message : String(e)}. The app does not use any other search.` };
    }
    let json: unknown = null;
    try { json = await res.json(); } catch { /* no body */ }
    if (res.ok) return { ok: true, data: json };
    const d = isObj(json) && isObj(json.detail) ? json.detail : {};
    const code = typeof d.error === 'string' ? d.error : '';
    const message = typeof d.message === 'string' ? d.message : '';
    return { ok: false, error: code !== '' ? rosieErrorWords(code, message) : `Sherlock answered HTTP ${res.status} for ${path}. It may not have the Rosie routes yet.` };
  }

  const none = async (path: string, body: unknown): Promise<AdapterResult<null>> => {
    const r = await call(path, 'POST', body);
    return r.ok ? { ok: true, data: null } : r;
  };

  return {
    token,
    status: async () => {
      const r = await call('/status', 'GET');
      if (!r.ok) return r;
      const s = toStatus(r.data);
      return s ? { ok: true, data: s } : { ok: false, error: 'Sherlock reply to status is not the Rosie contract shape' };
    },
    pair: async () => {
      const r = await call('/pair', 'POST', {});
      if (!r.ok) return r;
      const d = r.data;
      if (!isObj(d) || typeof d.code !== 'string' || d.code === '') return { ok: false, error: 'Sherlock reply to pair is not the Rosie contract shape' };
      return { ok: true, data: { code: d.code, expiresMs: num(d.expires_ms) } };
    },
    chooseFolder: () => none('/choose-folder', {}),
    ask: async (question) => {
      const r = await call('/ask', 'POST', { question });
      if (!r.ok) return r;
      const a = toAnswer(r.data);
      return a ? { ok: true, data: a } : { ok: false, error: 'Sherlock reply to ask is not an answer (see the Rosie contract)' };
    },
    detach: () => none('/detach', {}),
    unpair: () => none('/unpair', {}),
  };
}
