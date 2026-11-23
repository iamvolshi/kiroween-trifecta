/**
 * The PEEP / RATR inspector drawer, against a stub fetch (a test double
 * shaped like the live TRIFACTA replies, never app data).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Inspector } from './drawer.ts';
import { PEEP_QUESTION } from './peep.ts';
import { createTrifactaClient, parseContent, type FetchLike } from './trifacta.ts';
import { Router } from '../router/router.ts';
import { createRecordStub, tick } from '../test-helpers.ts';

const BASE = 'https://trifacta.stub';
const KID = 'AAAAAAAAAAAAAAAAawSUhQAAAAAAAAAB';
const city = (value: string, authority: number, k_start: number, k_end: number | null, reason: string, state = 'CANDIDATE') =>
  ({ value, state, authority, k_start, k_end, reason, kid: KID, entry_hash: `hash-${value.replace(' ', '')}`, held: false });

const RECORD = {
  account_id: 'acct-001',
  fields: {
    'acct-001.city': [
      city('Raleigh', 5, 1, 2, 'user provided, 2024-03'),
      city('Charlotte', 3, 2, 3, 'crm import, 2025-06'),
      city('Chapel Hill', 8, 3, null, 'correction, 2025-06: the Charlotte interval was a CRM import error', 'CONFIRMED'),
    ],
    'acct-001.cust_name': [{ ...city('Darren Hall', 8, 1, null, 'signup form, 2024-03', 'CONFIRMED'), entry_hash: 'hash-name' }],
  },
};
const ASK = {
  question: PEEP_QUESTION, state: 'answered', text: 'Sufficient', docket_id: 'docket_stub',
  provenance: [
    { source: `krecord:${KID}`, content: 'acct-001.city@2-3', excerpt: "acct-001's city was 'Charlotte' from k=2 to k=3" },
    { source: `krecord:${KID}`, content: 'acct-001.city@3-live', excerpt: "acct-001's city was 'Chapel Hill' from k=3 (live)" },
    { source: 'elsewhere', content: 'not-a-record-key', excerpt: '' },
  ],
};
const INSIGHTS = {
  accounts: 5, entries: 74, kids: 5, standing_values: 49, superseded_values: 25, held_candidates: 0,
  confirmed_standing: 22, authority_distribution: { '0': 0, '5': 2, '9': 11 }, k_min: 1, k_max: 4, distinct_fields: 17,
};
const LESSONS = { events_recorded: 1, rules_formed: [], events: [{ event_id: 'ev-1', event_type: 'trifecta.ask', gossip_state: 'DISCARDED' }] };

interface Call { url: string; init?: RequestInit }

function stubFetch(over: Partial<Record<string, unknown>> = {}): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const replies: Record<string, unknown> = {
    '/config': { api_key: 'demo-key-stub' }, '/ask': ASK, '/record/acct-001': RECORD,
    '/insights': INSIGHTS, '/lessons': LESSONS, ...over,
  };
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const path = url.slice(BASE.length);
    const body = replies[path];
    if (body === undefined) return new Response('{}', { status: 404 });
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return { fetch, calls };
}

const header = (c: Call) => (c.init?.headers as Record<string, string> | undefined)?.['X-API-Key'];

let inspector: Inspector | null = null;
let router: Router | null = null;
let host: HTMLElement;

afterEach(() => {
  inspector?.unmount();
  inspector = null;
  router?.destroy();
  router = null;
  host?.remove();
});

function mount(fetch: FetchLike): Inspector {
  host = document.createElement('div');
  const head = document.createElement('header');
  host.appendChild(head);
  document.body.appendChild(host);
  inspector = new Inspector(createTrifactaClient(BASE, fetch));
  inspector.mount(head, host);
  return inspector;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await tick();
}

const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((n) => n.textContent ?? '');

describe('the inspector drawer', () => {
  it('two small buttons side by side, PEEP then RATR; the drawer is shut until one is pressed', () => {
    const { fetch, calls } = stubFetch();
    const i = mount(fetch);
    expect(texts(i.buttons, '.insp-btn')).toEqual(['PEEP', 'RATR']);
    expect(i.drawer.hidden).toBe(true);
    expect(calls).toEqual([]); // nothing is read until it opens
  });

  it('opens on either button and shows both tabs', async () => {
    const { fetch } = stubFetch();
    const i = mount(fetch);
    i.buttons.querySelector<HTMLButtonElement>('[data-open="ratr"]')!.click();
    expect(i.drawer.hidden).toBe(false);
    expect(texts(i.drawer, '.insp-tab')).toEqual(['PEEP', 'RATR']);
    expect(i.tab).toBe('ratr');
    expect(i.ratr.section.hidden).toBe(false);
    expect(i.peep.section.hidden).toBe(true);
    i.drawer.querySelector<HTMLButtonElement>('.insp-tab[data-tab="peep"]')!.click();
    expect(i.peep.section.hidden).toBe(false);
    expect(i.drawer.querySelector('.insp-tab[data-tab="peep"]')!.getAttribute('aria-selected')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(i.drawer.hidden).toBe(true);
    await settle();
  });

  it('the shell carries the pair on every view, beside the view label', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    window.history.replaceState({}, '', '/lessons');
    router = new Router(createRecordStub([]), host, undefined, createTrifactaClient(BASE, stubFetch().fetch));
    const pair = host.querySelector('.shell-brand .insp-pair')!;
    expect(texts(pair, '.insp-btn')).toEqual(['PEEP', 'RATR']);
    expect(host.querySelector('.shell > .insp-drawer')).not.toBeNull();
    router.navigate('/chat');
    expect(host.querySelector('.shell-brand .insp-pair')).toBe(pair);
  });
});

describe('the demo key', () => {
  it('is read once from /config and sent as X-API-Key on every call', async () => {
    const { fetch, calls } = stubFetch();
    const api = createTrifactaClient(BASE, fetch);
    await api.insights();
    await api.lessons();
    await api.record('acct-001');
    expect(calls.filter((c) => c.url === `${BASE}/config`)).toHaveLength(1);
    expect(header(calls[0]!)).toBeUndefined(); // /config needs no key
    const rest = calls.slice(1);
    expect(rest.map((c) => c.url)).toEqual([`${BASE}/insights`, `${BASE}/lessons`, `${BASE}/record/acct-001`]);
    expect(rest.every((c) => header(c) === 'demo-key-stub')).toBe(true);
  });

  it('a failed /config is tried again on the next call', async () => {
    let n = 0;
    const fetch: FetchLike = async (url) => {
      if (url.endsWith('/config')) return n++ === 0 ? new Response('', { status: 503 }) : new Response(JSON.stringify({ api_key: 'k2' }));
      return new Response(JSON.stringify(LESSONS));
    };
    const api = createTrifactaClient(BASE, fetch);
    expect(await api.lessons()).toEqual({ ok: false, error: 'TRIFACTA answered HTTP 503 for /config' });
    expect((await api.lessons()).ok).toBe(true);
  });
});

describe('PEEP: the trace', () => {
  it('opens with the Darren city question and asks only when pressed', async () => {
    const { fetch, calls } = stubFetch();
    const i = mount(fetch);
    i.open('peep');
    await settle();
    expect(i.drawer.querySelector<HTMLInputElement>('.peep-q')!.value).toBe('What city does Darren live in?');
    expect(calls).toEqual([]);
  });

  it('shows the call, each entry touched, its authority from the record, and the provenance', async () => {
    const { fetch, calls } = stubFetch();
    const i = mount(fetch);
    i.open('peep');
    i.drawer.querySelector<HTMLFormElement>('.peep-form')!.requestSubmit();
    await settle();
    const ask = calls.find((c) => c.url === `${BASE}/ask`)!;
    expect(ask.init?.method).toBe('POST');
    expect(JSON.parse(String(ask.init?.body))).toEqual({ question: PEEP_QUESTION });
    expect(header(ask)).toBe('demo-key-stub');
    const out = i.peep.section;
    expect(texts(out, '.peep-call dd')).toEqual(['POST /ask', PEEP_QUESTION, 'answered', 'Sufficient', 'docket_stub', '3']);
    expect(texts(out, '.peep-content')).toEqual(['acct-001.city@2-3', 'acct-001.city@3-live', 'not-a-record-key']);
    expect(texts(out, '.insp-auth')).toEqual(['authority 3', 'authority 8', 'authority: not in the record read']);
    expect(texts(out, '.insp-state')).toEqual(['CANDIDATE', 'CONFIRMED']);
    expect(texts(out, '.peep-source')[0]).toBe(`krecord:${KID}`);
    expect(texts(out, '.peep-excerpt')).toEqual([ASK.provenance[0]!.excerpt, ASK.provenance[1]!.excerpt]);
    expect(texts(out, '.insp-hash')).toEqual([`KID ${KID} · hash-Charlotte`, `KID ${KID} · hash-ChapelHill`]);
    // One record read for the one account touched.
    expect(calls.filter((c) => c.url === `${BASE}/record/acct-001`)).toHaveLength(1);
  });

  it('never explains, grades or narrates', async () => {
    const i = mount(stubFetch().fetch);
    await i.peep.run(PEEP_QUESTION);
    expect(i.peep.section.textContent).not.toMatch(/because|means|wrong|correct answer|good|bad import/i);
  });
});

describe('RATR: the witness log', () => {
  it('opens on acct-001 and lists every interval flat, k order, with KID, entry hash, authority, reason', async () => {
    const { fetch, calls } = stubFetch();
    const i = mount(fetch);
    i.open('ratr');
    await settle();
    const rows = [...i.ratr.section.querySelectorAll('.ratr-table tbody tr')];
    expect(rows.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent))).toEqual([
      ['1', '2', 'acct-001.city', 'Raleigh', 'CANDIDATE', '5', KID, 'hash-Raleigh', 'user provided, 2024-03'],
      ['1', 'live', 'acct-001.cust_name', 'Darren Hall', 'CONFIRMED', '8', KID, 'hash-name', 'signup form, 2024-03'],
      ['2', '3', 'acct-001.city', 'Charlotte', 'CANDIDATE', '3', KID, 'hash-Charlotte', 'crm import, 2025-06'],
      ['3', 'live', 'acct-001.city', 'Chapel Hill', 'CONFIRMED', '8', KID, 'hash-ChapelHill',
        'correction, 2025-06: the Charlotte interval was a CRM import error'],
    ]);
    expect(texts(i.ratr.section, '.ratr-table th')).toEqual(
      ['k_start', 'k_end', 'field', 'value', 'state', 'authority', 'KID', 'entry_hash', 'reason']);
    expect(texts(i.ratr.section, '.ratr-counts dd')).toEqual(['5', '74', '5', '49', '25', '0', '22', '1-4', '17', '0 2 11']);
    expect(texts(i.ratr.section, '.ratr-events li')).toEqual(['trifecta.ask · DISCARDED · ev-1']);
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false); // RATR never posts
  });

  it('the picker offers the five demo accounts and reads the one picked', async () => {
    const { fetch, calls } = stubFetch({ '/record/acct-004': { account_id: 'acct-004', fields: {} } });
    const i = mount(fetch);
    i.open('ratr');
    await settle();
    const pick = i.drawer.querySelector<HTMLSelectElement>('.ratr-account')!;
    expect([...pick.options].map((o) => o.value)).toEqual(['acct-001', 'acct-002', 'acct-003', 'acct-004', 'acct-005']);
    pick.value = 'acct-004';
    pick.dispatchEvent(new Event('change'));
    await settle();
    expect(calls.some((c) => c.url === `${BASE}/record/acct-004`)).toBe(true);
    expect(texts(i.ratr.section, '.ratr-log .insp-empty')).toEqual(['The record holds no interval for this account.']);
  });
});

describe('an unreachable API', () => {
  it('says so in both tabs, and shows no entry at all', async () => {
    const fetch: FetchLike = async () => { throw new TypeError('Failed to fetch'); };
    const i = mount(fetch);
    i.open('ratr');
    await settle();
    expect(texts(i.ratr.section, '.insp-error')).toEqual(Array(3).fill('TRIFACTA unreachable: Failed to fetch'));
    expect(i.ratr.section.querySelector('.ratr-table, .ratr-counts, .ratr-events')).toBeNull();
    await i.peep.run(PEEP_QUESTION);
    expect(texts(i.peep.section, '.insp-error')).toEqual(['TRIFACTA unreachable: Failed to fetch']);
    expect(i.peep.section.querySelector('.peep-hit, .peep-call')).toBeNull();
  });

  it('a reply in the wrong shape is an error, never shown as data', async () => {
    const i = mount(stubFetch({ '/ask': { nope: true } }).fetch);
    await i.peep.run('x');
    expect(texts(i.peep.section, '.insp-error')).toEqual(['TRIFACTA reply to /ask is not the shape the drawer reads']);
  });
});

describe('parseContent', () => {
  it('reads a provenance key', () => {
    expect(parseContent('acct-001.city@1-2')).toEqual({ account: 'acct-001', field: 'acct-001.city', kStart: 1, kEnd: 2 });
    expect(parseContent('acct-005.birth_city@1-live')).toEqual({ account: 'acct-005', field: 'acct-005.birth_city', kStart: 1, kEnd: null });
    expect(parseContent('krecord:x')).toBeNull();
  });
});
