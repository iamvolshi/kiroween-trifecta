/**
 * OCME-014-hack: Chat is a conversation (the connector's /chat, no Sherlock call);
 * Sherlock & Watson is its own page for deep investigations. Every service is a double.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { AdapterResult, AskResult, ChatTurn, SeamAdapter } from '../adapter/seam.ts';
import type { WatsonBridge, WatsonConclusion, WatsonInput } from '../watson/bridge.ts';
import { Router } from '../router/router.ts';
import { RAIL } from '../shell/rail.ts';
import { RepoSession } from './repo-session.ts';
import type { GithubClient, RepoAnswer, RepoStatus } from '../adapter/github-client.ts';
import { investigate, voiceMessage, watsonInputFor, repoAnswerAsAsk } from '../investigate/handoff.ts';
import { createRecordStub, createModelsStub, tick } from '../test-helpers.ts';

const REPORT: AskResult = {
  question: 'Who built the creature?', state: 'found', text: 'Victor Frankenstein built the creature.',
  provenance: [
    { source: 'ch-4.txt', content: 'p-12', excerpt: 'I collected bones from charnel houses.', kid: 12, authority: 6 },
    { source: 'K entry', content: 'k-266', excerpt: 'Victor is the maker.', kind: 'k_entry', kid_label: 'K-0266', kid: 266, authority: 8 },
  ],
};
const CONCLUSION: WatsonConclusion = {
  summary: 'Victor made the creature.', confidence: 0.82,
  claims: [{ id: 'c1', text: 'Victor built it', status: 'supported', confidence: 0.8 }],
  citations: [{ claimId: 'c1', evidenceId: 'e1', kid: '12', source: 'ch-4.txt' }],
};

function voiceTurn(text: string): ChatTurn {
  return {
    message: 'm', known: true, step: null, total_steps: 0,
    engines: { arche: { reply: text }, erie: null, elle: null, elle_promoted: null, lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [] },
  };
}

/** A Sherlock double and a connector double, each counting its calls. */
function services(opts: { ask?: AdapterResult<AskResult>; chat?: AdapterResult<ChatTurn> } = {}) {
  const calls = { sherlockAsk: 0, sherlockChat: 0, connectorChat: [] as Array<{ m: string; register?: string }> };
  const sherlock = {
    ...createRecordStub(),
    ask: async () => { calls.sherlockAsk++; return opts.ask ?? { ok: true as const, data: REPORT }; },
    chat: async () => { calls.sherlockChat++; return { ok: false as const, error: 'Sherlock must not be asked to chat' }; },
  } as SeamAdapter;
  const connector = {
    ...createRecordStub(),
    chat: async (m: string, o?: { register?: string }) => {
      calls.connectorChat.push({ m, ...(o?.register ? { register: o.register } : {}) });
      return opts.chat ?? { ok: true as const, data: voiceTurn('Ugh. Victor made me. See ch-4.txt.') };
    },
  } as SeamAdapter;
  return { calls, sherlock, connector };
}

function bridgeOf(result: WatsonConclusion | null): { bridge: WatsonBridge; inputs: WatsonInput[] } {
  const inputs: WatsonInput[] = [];
  return { inputs, bridge: { report: async (i) => { inputs.push(i); return result; } } };
}

describe('the handoff: Sherlock -> Watson -> the voice', () => {
  it('sends Sherlock\'s report and KIDs to Watson, then both to the persona', async () => {
    const s = services();
    const w = bridgeOf(CONCLUSION);
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge: w.bridge, repo: null }, REPORT.question, 'movie');
    expect(w.inputs[0]!.answer).toBe(REPORT.text);
    expect(w.inputs[0]!.citations.map((c) => c.kid)).toEqual(['12', 'K-0266']);
    const sent = s.calls.connectorChat[0]!;
    expect(sent.register).toBe('movie');
    expect(sent.m).toContain(REPORT.text);
    expect(sent.m).toContain('ch-4.txt (KID 12)');
    expect(sent.m).toContain('KID K-0266');
    expect(sent.m).toContain(CONCLUSION.summary);
    expect(inv.reply?.engines.arche.reply).toContain('Victor made me');
    expect(inv.problems).toEqual([]);
    expect(s.calls.sherlockChat).toBe(0);
  });

  it('Sherlock down: says so, asks neither Watson nor the voice', async () => {
    const s = services({ ask: { ok: false, error: 'Sherlock unreachable: boom' } });
    const w = bridgeOf(CONCLUSION);
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge: w.bridge, repo: null }, 'q', 'book');
    expect(inv.problems[0]).toBe('Sherlock did not answer: Sherlock unreachable: boom');
    expect(inv.report).toBeNull();
    expect(w.inputs).toHaveLength(0);
    expect(s.calls.connectorChat).toHaveLength(0);
  });

  it('Sherlock found nothing: no Watson, no voice, no invented answer', async () => {
    const s = services({ ask: { ok: true, data: { question: 'q', state: 'not_found', text: 'nothing', provenance: [] } } });
    const w = bridgeOf(CONCLUSION);
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge: w.bridge, repo: null }, 'q', 'book');
    expect(inv.reply).toBeNull();
    expect(inv.problems[0]).toContain('found nothing');
    expect(w.inputs).toHaveLength(0);
    expect(s.calls.connectorChat).toHaveLength(0);
  });

  it('Watson gives nothing: says so in words and the voice speaks from the report alone', async () => {
    const s = services();
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge: bridgeOf(null).bridge, repo: null }, 'q', 'book');
    expect(inv.problems[0]).toContain('Watson gave no conclusion');
    expect(inv.reply).not.toBeNull();
    expect(s.calls.connectorChat[0]!.m).not.toContain("Watson's conclusion");
  });

  it('the connector fails: says so, keeps the real report, shows no voice', async () => {
    const s = services({ chat: { ok: false, error: 'Connector unreachable: down' } });
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge: bridgeOf(CONCLUSION).bridge, repo: null }, 'q', 'book');
    expect(inv.reply).toBeNull();
    expect(inv.report).toEqual(REPORT);
    expect(inv.problems.join(' ')).toContain('The voice did not answer: Connector unreachable: down');
  });

  it('a throwing Watson bridge is reported, not thrown', async () => {
    const s = services();
    const bridge: WatsonBridge = { report: () => Promise.reject(new Error('x')) };
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge, repo: null }, 'q', 'book');
    expect(inv.problems[0]).toContain('Watson gave no conclusion');
  });

  it('pure helpers: a citation with no KID goes without one; a repo answer keeps path and KID', () => {
    expect(watsonInputFor({ ...REPORT, provenance: [{ source: 'a', content: 'a', excerpt: 'x' }] }).citations[0]).toEqual({ source: 'a', content: 'x' });
    const a: RepoAnswer = { text: 't', state: 'found', citations: [{ path: 'src/a.ts', kid: 3, excerpt: 'e', source: 's' }] };
    expect(repoAnswerAsAsk(a, 'q').provenance[0]).toMatchObject({ source: 'src/a.ts', kid: 3 });
    expect(voiceMessage('q', REPORT, null)).toContain('Add no fact that is not in it');
  });
});

describe('an attached repo', () => {
  const status = { state: 'ready', repo: 'octocat/Spoon-Knife' } as unknown as RepoStatus;
  function repoSession(): { repo: RepoSession; asked: string[] } {
    const asked: string[] = [];
    const client = {
      token: () => 't', attach: async () => ({ ok: true, data: status }), status: async () => ({ ok: true, data: status }), detach: async () => ({ ok: true, data: null }),
      ask: async (q: string): Promise<AdapterResult<RepoAnswer>> => { asked.push(q); return { ok: true, data: { text: 'Styled by styles.css.', state: 'found', citations: [{ path: 'styles.css', kid: 7, excerpt: 'body {}', source: 's' }] } }; },
    } as GithubClient;
    return { repo: new RepoSession(client), asked };
  }

  it('investigates the repo, not the book, and does not add a turn to the chat\'s repo list', async () => {
    const { repo, asked } = repoSession();
    await repo.refresh();
    repo.setSource('repo');
    const s = services();
    const inv = await investigate({ sherlock: s.sherlock, voiceAdapter: s.connector, bridge: bridgeOf(CONCLUSION).bridge, repo }, 'How is it styled?', 'book');
    expect(asked).toEqual(['How is it styled?']);
    expect(s.calls.sherlockAsk).toBe(0);
    expect(inv.source).toContain('octocat/Spoon-Knife');
    expect(inv.report?.provenance[0]).toMatchObject({ source: 'styles.css', kid: 7 });
    expect(repo.turns).toHaveLength(0);
  });
});

// ---- the app: Router, rail, chat, page ------------------------------------------------

let container: HTMLElement;
let router: Router;

function start(path: string, sherlock: SeamAdapter, connector: SeamAdapter, bridgeless = true): void {
  void bridgeless;
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
  router = new Router(sherlock, container, createModelsStub(), undefined, new RepoSession({ token: () => '', attach: async () => ({ ok: false, error: 'x' }), status: async () => ({ ok: true, data: null }), ask: async () => ({ ok: false, error: 'x' }), detach: async () => ({ ok: true, data: null }) } as GithubClient), connector);
}

afterEach(() => {
  router?.destroy();
  container?.remove();
  vi.restoreAllMocks();
});

describe('Chat is a conversation', () => {
  it('a chat turn goes to the connector and makes no Sherlock call (centre chat and mini chat)', async () => {
    const s = services();
    start('/chat', s.sherlock, s.connector);
    await tick(); await tick();
    router.getChatLog().setVoice('movie');
    for (const where of ['/chat', '/lessons'] as const) {
      if (where !== '/chat') { router.navigate(where); await tick(); await tick(); }
      const input = container.querySelector<HTMLInputElement>('#chat-message')!;
      const form = container.querySelector<HTMLFormElement>('.chat-composer')!;
      input.disabled = false;
      input.value = `hello from ${where}`;
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await tick(); await tick();
    }
    expect(s.calls.connectorChat.map((c) => c.m)).toEqual(['hello from /chat', 'hello from /lessons']);
    expect(s.calls.sherlockChat).toBe(0);
    expect(s.calls.sherlockAsk).toBe(0);
  });
});

describe('the Sherlock & Watson page', () => {
  it('has a rail entry and a route; the page says what it is for', async () => {
    expect(RAIL.map((r) => r.key)).toContain('investigate');
    const s = services();
    start('/chat', s.sherlock, s.connector);
    await tick();
    container.querySelector<HTMLButtonElement>('.rail-button[data-rail="investigate"]')!.click();
    await tick(); await tick();
    expect(window.location.pathname).toBe('/investigate');
    expect(container.querySelector('[data-view="Sherlock & Watson"]')).not.toBeNull();
    expect(container.querySelector('.sw-purpose')!.textContent).toContain('deep investigations');
    expect(container.querySelector('.shell-brand .brand-view')!.textContent).toContain('Sherlock & Watson');
  });

  it('a deep question reaches Sherlock, then the connector with the report, and shows file path and KID', async () => {
    const s = services();
    start('/investigate', s.sherlock, s.connector);
    await tick(); await tick();
    container.querySelector<HTMLButtonElement>('.voice-picker [data-voice="book"]')!.click();
    const input = container.querySelector<HTMLInputElement>('#sw-question')!;
    input.value = REPORT.question;
    container.querySelector<HTMLFormElement>('.sw-view .chat-composer')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    for (let i = 0; i < 6; i++) await tick();
    expect(s.calls.sherlockAsk).toBe(1);
    expect(s.calls.connectorChat).toHaveLength(1);
    expect(s.calls.connectorChat[0]!.m).toContain(REPORT.text);
    const turn = container.querySelector('.sw-turn')!;
    expect(turn.textContent).toContain('Victor made me');
    expect([...turn.querySelectorAll('.sw-path')].map((n) => n.textContent)).toEqual(['ch-4.txt', 'K entry']);
    expect(turn.querySelector('.sw-citation')!.textContent).toContain('KID 12');
  });

  it('a failed Sherlock shows its words on the page and no answer', async () => {
    const s = services({ ask: { ok: false, error: 'Sherlock unreachable: boom' } });
    start('/investigate', s.sherlock, s.connector);
    await tick(); await tick();
    container.querySelector<HTMLButtonElement>('.voice-picker [data-voice="book"]')!.click();
    container.querySelector<HTMLInputElement>('#sw-question')!.value = 'q';
    container.querySelector<HTMLFormElement>('.sw-view .chat-composer')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    for (let i = 0; i < 6; i++) await tick();
    expect(container.querySelector('.sw-problem')!.textContent).toContain('Sherlock did not answer: Sherlock unreachable: boom');
    expect(container.querySelector('.sw-reply .bubble-text')).toBeNull();
    expect(s.calls.connectorChat).toHaveLength(0);
  });
});

describe('the Watson bridge wait', () => {
  const slow = (ms: number, body: unknown) => (_u: string, init?: RequestInit) => new Promise<Response>((res, rej) => {
    const t = setTimeout(() => res(new Response(JSON.stringify(body))), ms);
    init?.signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); });
  });
  it('a bridge that wakes slowly still answers when the wait is long enough, and gives null when it is not', async () => {
    const { createWatsonBridge } = await import('../watson/bridge.ts');
    const input = { question: 'q', answer: 'a', citations: [{ source: 's', content: 'c' }] };
    expect(await createWatsonBridge('http://w', slow(60, CONCLUSION), 20).report(input)).toBeNull();
    expect((await createWatsonBridge('http://w', slow(60, CONCLUSION), 500).report(input))?.summary).toBe(CONCLUSION.summary);
  });
});