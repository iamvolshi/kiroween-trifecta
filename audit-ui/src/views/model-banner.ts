// The model announcement under the chat box. It says which model is live,
// from LIVE data only: the connector's status (GET /models) before a turn,
// and each reply's served_by after it. When the two disagree, served_by wins.
// No provider or model name is written here; every name is the connector's.
// With no connector address, or no answer, it says the connector is unreachable.
import type { Persona, Register, ServedBy } from '../adapter/seam.ts';
import type { ModelRoute, ModelStatus } from '../adapter/live-models.ts';

export type StatusState =
  | { state: 'loading' }
  | { state: 'ok'; data: ModelStatus }
  | { state: 'error'; error: string };

export interface BannerInput {
  /** The picked mask. null: nothing is announced (no band at all). */
  persona: Persona | null;
  /** The switch position (Frankenstein), or null for a mask without the switch. */
  register: Register | null;
  status: StatusState;
  /** served_by of the last reply on this position, if any. */
  served: ServedBy | null;
}

export interface Announcement {
  state: 'loading' | 'live' | 'unconfigured' | 'unreachable';
  /** 'book' | 'movie' | 'mask': drives the colour band. */
  position: Register | 'mask';
  label: string;
  model: string;
  provider: string;
  source: string;
  note: string;
}

const POSITION_LABEL: Record<Register, string> = { book: 'BOOK', movie: 'MOVIE' };

function same(a: ServedBy, b: ServedBy): boolean {
  return a.provider === b.provider && a.model === b.model;
}

/** The route of the picked mask: Frankenstein's register position, else the mask's own route. */
function routeFor(status: ModelStatus, persona: Persona, register: Register | null): ModelRoute {
  if (register !== null) return status.registers[register];
  return status.persona_routes?.[persona] ?? { error: `The connector reports no route for ${persona}.` };
}

/** What to announce, or null before a mask is picked. Pure: the same input always gives the same words. */
export function announce(input: BannerInput): Announcement | null {
  if (input.persona === null) return null;
  const position: Register | 'mask' = input.register ?? 'mask';
  const label = input.register !== null ? POSITION_LABEL[input.register] : input.persona.toUpperCase();
  const base = { position, label, model: '', provider: '', source: '', note: '' };
  const route: ModelRoute | null =
    input.status.state === 'ok' ? routeFor(input.status.data, input.persona, input.register) : null;
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
