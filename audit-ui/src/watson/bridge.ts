/**
 * Watson, the mouth: the watson-bridge (iamvolshi/scribe, branch
 * watson-bridge) turns an ERIE answer plus its K-record citations into
 * Watson's conclusion. The head speaks TypeScript and Node; the body runs
 * Python. This is the caller.
 *
 * The address comes from VITE_WATSON_URL at build time; none is written
 * here. The bridge runs Watson's deterministic path: no key, no model call.
 *
 * A failure never reaches the answer: `report` never throws, and on any
 * failure (no address, unreachable, a refusal, a reply in the wrong
 * shape) it answers null, and the caller shows no conclusion.
 */

export const WATSON_URL: string = String(import.meta.env.VITE_WATSON_URL ?? '').trim();

export interface WatsonCitationIn {
  source: string;
  content: string;
  kid?: string;
}

export interface WatsonInput {
  question: string;
  answer: string;
  citations: WatsonCitationIn[];
}

export interface WatsonClaim {
  id: string;
  text: string;
  status: string;
  confidence: number;
}

export interface WatsonCitation {
  claimId: string;
  evidenceId: string;
  kid: string | null;
  source: string;
}

/** Watson's conclusion (the bridge's POST /report reply, the fields shown). */
export interface WatsonConclusion {
  summary: string;
  confidence: number;
  claims: WatsonClaim[];
  citations: WatsonCitation[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 15_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function asConclusion(v: unknown): WatsonConclusion | null {
  if (!isObj(v) || typeof v.summary !== 'string' || typeof v.confidence !== 'number') return null;
  if (!Array.isArray(v.claims) || !Array.isArray(v.citations)) return null;
  const claims = v.claims.filter((c): c is Record<string, unknown> => isObj(c) && typeof c.text === 'string')
    .map((c) => ({ id: String(c.id ?? ''), text: c.text as string, status: String(c.status ?? ''),
      confidence: typeof c.confidence === 'number' ? c.confidence : 0 }));
  const citations = v.citations.filter((c): c is Record<string, unknown> => isObj(c))
    .map((c) => ({ claimId: String(c.claimId ?? ''), evidenceId: String(c.evidenceId ?? ''),
      kid: typeof c.kid === 'string' ? c.kid : null, source: String(c.source ?? '') }));
  return { summary: v.summary, confidence: v.confidence, claims, citations };
}

export interface WatsonBridge {
  report(input: WatsonInput): Promise<WatsonConclusion | null>;
}

export function createWatsonBridge(baseUrl: string = WATSON_URL, fetchImpl?: FetchLike): WatsonBridge {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  return {
    async report(input) {
      if (base === '' || input.citations.length === 0) return null;
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
      try {
        const res = await doFetch(`${base}/report`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
          ...(ctl ? { signal: ctl.signal } : {}),
        });
        if (!res.ok) return null;
        return asConclusion(await res.json());
      } catch {
        return null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
