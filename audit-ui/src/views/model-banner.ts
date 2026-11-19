// The model announcement under the chat box. It says which model is live,
// from LIVE data only: the connector's status (GET /models) before a turn,
// and each reply's served_by after it. When the two disagree, served_by wins.
// No provider or model name is written here; every name is the connector's.
// With no connector address, or no answer, it says the connector is unreachable.
import type { Register, ServedBy } from '../adapter/seam.ts';
import type { ModelRoute, ModelStatus } from '../adapter/live-models.ts';
import { VOICE_LABELS } from './voices.ts';

export type StatusState =
  | { state: 'loading' }
  | { state: 'ok'; data: ModelStatus }
  | { state: 'error'; error: string };

export interface BannerInput {
  /** The picked voice. null: nothing is announced (no band at all). */
  register: Register | null;
  status: StatusState;
  /** served_by of the last reply on this position, if any. */
  served: ServedBy | null;
}

export interface Announcement {
  state: 'loading' | 'live' | 'unconfigured' | 'unreachable';
  /** The voice: drives the band's accent. */
  position: Register;
  label: string;
  model: string;
  provider: string;
  source: string;
  note: string;
}

function same(a: ServedBy, b: ServedBy): boolean {
  return a.provider === b.provider && a.model === b.model;
}

/** The route of the picked voice, or the words saying the connector reports none. */
function routeFor(status: ModelStatus, register: Register): ModelRoute {
  return status.registers[register] ?? { error: `The connector reports no route for ${VOICE_LABELS[register].name}.` };
}

/** What to announce, or null before a voice is picked. Pure: the same input always gives the same words. */
export function announce(input: BannerInput): Announcement | null {
  if (input.register === null) return null;
  const position = input.register;
  const label = VOICE_LABELS[position].tag;
  const base = { position, label, model: '', provider: '', source: '', note: '' };
  const route: ModelRoute | null =
    input.status.state === 'ok' ? routeFor(input.status.data, position) : null;
  if (input.served) {
    const note =
      route && 'provider' in route && !same(route, input.served)
        ? `The connector's status said ${route.provider} / ${route.model}; the reply says this one served it.`
        : '';
    return {
      ...base, state: 'live', model: input.served.model, provider: input.served.provider,
      source: 'Served the last reply', note,
    };
  }
  if (input.status.state === 'loading') {
    return { ...base, state: 'loading', model: 'Checking...', source: 'Asking the connector which model is live.' };
  }
  if (input.status.state === 'error') {
    return {
      ...base, state: 'unreachable', model: 'Model unknown',
      source: `Cannot say which model is live. ${input.status.error}`,
    };
  }
  if (route && 'error' in route) {
    return { ...base, state: 'unconfigured', model: 'Not configured', source: route.error };
  }
  const r = route as ServedBy;
  return { ...base, state: 'live', model: r.model, provider: r.provider, source: "From the connector's status" };
}

function el(tag: string, className: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  return e;
}

/** The band. `flipped` adds a short highlight when the position just changed. */
export function renderModelBanner(a: Announcement, flipped = false): HTMLElement {
  const box = document.createElement('section');
  box.className = flipped ? 'model-banner model-flip' : 'model-banner';
  box.dataset.position = a.position;
  box.dataset.state = a.state;
  box.setAttribute('aria-live', 'polite');
  box.setAttribute('aria-label', 'Live model');

  box.appendChild(el('span', 'model-position', a.label));
  const main = el('div', 'model-main', '');
  const name = el('span', 'model-name', a.model);
  main.appendChild(name);
  if (a.provider) main.appendChild(el('span', 'model-provider', a.provider));
  box.appendChild(main);
  box.appendChild(el('span', 'model-source', a.source));
  if (a.note) box.appendChild(el('span', 'model-note', a.note));
  return box;
}
