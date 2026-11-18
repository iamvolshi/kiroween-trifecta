// The connector's model status (GET /models): which provider + model each
// register position points at, read from the loop's own config. No provider
// or model name is written in this app:
// every name shown comes from here or from a turn's served_by.
import type { AdapterResult, ServedBy } from './seam';
import { isServedBy } from './seam';
import { NO_ADDRESS_ERROR, type FetchLike } from './live';

/** One position: the route it points at, or the config error naming what is missing. */
export type ModelRoute = ServedBy | { error: string };

export interface ModelStatus {
  /** "entity": one shared entity behind every mask. */
  persona: string;
  /** The loop's own route; reported only, no connector turn runs on it. */
  default: ModelRoute;
  /** Frankenstein's two register positions. */
  registers: { movie: ModelRoute; book: ModelRoute };
  /** Registers whose voice the register mask's cartridge carries. */
  register_voices: string[];
  /** The masks the connector serves, by name. */
  personas?: string[];
  /** Each mask without registers (Elara, ARCHETRON) -> its route. */
  persona_routes?: Record<string, ModelRoute>;
}

function isRoute(v: unknown): v is ModelRoute {
  if (isServedBy(v)) return true;
  const e = v as { error?: unknown } | null;
  return typeof e === 'object' && e !== null && typeof e.error === 'string';
}

export function isModelStatus(v: unknown): v is ModelStatus {
  const s = v as ModelStatus | null;
  return (
    typeof s === 'object' && s !== null &&
    typeof s.persona === 'string' &&
    isRoute(s.default) &&
    typeof s.registers === 'object' && s.registers !== null &&
    isRoute(s.registers.movie) && isRoute(s.registers.book) &&
    Array.isArray(s.register_voices) &&
    (s.personas === undefined || (Array.isArray(s.personas) && s.personas.every((p) => typeof p === 'string'))) &&
    (s.persona_routes === undefined ||
      (typeof s.persona_routes === 'object' && s.persona_routes !== null && !Array.isArray(s.persona_routes) &&
        Object.values(s.persona_routes).every(isRoute)))
  );
}

/** GET /models on the connector. Errors come back in words. */
export async function fetchModelStatus(baseUrl: string, fetchImpl?: FetchLike): Promise<AdapterResult<ModelStatus>> {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base === '') return { ok: false, error: NO_ADDRESS_ERROR };
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));
  try {
    const res = await doFetch(`${base}/models`);
    if (!res.ok) return { ok: false, error: `Connector answered HTTP ${res.status} for /models` };
    const data: unknown = await res.json();
    return isModelStatus(data)
      ? { ok: true, data }
      : { ok: false, error: 'Connector reply to /models is not a model status (see docs/assembly-parts.md)' };
  } catch (e) {
    return { ok: false, error: `Connector unreachable: ${e instanceof Error ? e.message : String(e)}` };
  }
}
