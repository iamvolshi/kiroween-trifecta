/**
 * Attach a public GitHub repo from the chat (OCME-009-hack): the /api/github
 * client and its headers, the attach flow and its progress, the error words,
 * asking the repo (path + KID per citation), switching back to the book, detach.
 * Sherlock is a fetch double; no network.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { SeamAdapter, ChatOptions } from '../adapter/seam.ts';
import { createGithubClient, mintToken, SESSION_KEY } from '../adapter/github-client.ts';
import { RepoSession } from './repo-session.ts';
import { ChatView } from './chat.ts';
import { LeftPanel } from '../shell/left.ts';
import { ChatLog } from './chat-log.ts';
import { createModelsStub, tick } from '../test-helpers.ts';

interface Call { url: string; method: string; headers: Record<string, string>; body: unknown }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function statusBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'ready', repo: 'octo/hello', branch: 'main', folder: '', files_listed: 12, files_ingested: 10,
    files_skipped: 2, passages: 31, truncated: false, error: null, ...over,
  };
}

function answerBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'found', text: 'It prints hello.', status: 'SUPPORTED', confidence: 0.9, low_confidence: false,
    ranked_by: 'rerank', rerank: { used: true, model: 'rr' },
    provenance: [{ kid: 7, kid_label: 'KID 7', excerpt: 'print("hello")', evidence_id: 'e', score: 1, source: 'octo/hello@main:src/app.py', section: 'src/app.py', repo: 'octo/hello', branch: 'main', path: 'src/app.py' }],
    ...over,
  };
}

/** A fetch double: one handler per path; every call is recorded. */
function sherlock(handlers: Record<string, (c: Call) => Response>): { fetch: (u: string, i?: RequestInit) => Promise<Response>; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (url, init) => {
      const path = new URL(url).pathname;
      const c: Call = {
        url, method: init?.method ?? 'GET',
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(c);
      const h = handlers[path];
      return h ? Promise.resolve(h(c)) : Promise.reject(new Error(`no handler for ${path}`));
    },
  };
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const BASE = 'https://sherlock.test';

describe('github client', () => {
  it('mints a token of at least 128 bits, keeps it, and sends it on every call', async () => {
    const s = sherlock({
      '/api/github/status': () => json(200, statusBody()),
      '/api/github/attach': () => json(202, statusBody({ state: 'queued' })),
      '/api/github/detach': () => json(200, { state: 'detached' }),
    });
    const store = memoryStorage();
    const c = createGithubClient(BASE, s.fetch, store);
    await c.status();
    await c.attach({ repo: 'octo/hello' });
    await c.detach();
    const tok = store.map.get(SESSION_KEY)!;
    expect(tok).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(s.calls).toHaveLength(3);
    for (const call of s.calls) expect(call.headers['X-Sherlock-Session']).toBe(tok);
    expect(mintToken()).not.toBe(mintToken());
  });

  it('never sends another browser\'s token', async () => {
    const s = sherlock({ '/api/github/status': () => json(200, statusBody()) });
    const a = memoryStorage();
    const b = memoryStorage();
    await createGithubClient(BASE, s.fetch, a).status();
    await createGithubClient(BASE, s.fetch, b).status();
    expect(s.calls[0]!.headers['X-Sherlock-Session']).not.toBe(s.calls[1]!.headers['X-Sherlock-Session']);
    expect(s.calls[0]!.headers['X-Sherlock-Session']).toBe(a.map.get(SESSION_KEY));
    expect(s.calls[1]!.headers['X-Sherlock-Session']).toBe(b.map.get(SESSION_KEY));
  });

  it('replaces a stored token that is too short to be safe', async () => {
    const s = sherlock({ '/api/github/status': () => json(200, statusBody()) });
    const store = memoryStorage();
    store.setItem(SESSION_KEY, 'short');
    await createGithubClient(BASE, s.fetch, store).status();
    expect(s.calls[0]!.headers['X-Sherlock-Session']).not.toBe('short');
  });

  it('says in words when Sherlock is down, and uses no other path', async () => {
    const s = sherlock({});
    const r = await createGithubClient(BASE, s.fetch, memoryStorage()).ask('hi');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Sherlock unreachable.*does not use any other search/);
    expect(s.calls).toHaveLength(1);
    const none = await createGithubClient('', s.fetch, memoryStorage()).status();
    expect(none.ok).toBe(false);
    expect(s.calls).toHaveLength(1);
  });

  it('reads 404 no_repo_attached from status as "nothing attached"', async () => {
    const s = sherlock({ '/api/github/status': () => json(404, { detail: { error: 'no_repo_attached', message: 'x' } }) });
    const r = await createGithubClient(BASE, s.fetch, memoryStorage()).status();
    expect(r).toEqual({ ok: true, data: null });
  });

  it('turns busy and invalid_repo into words', async () => {
    const s = sherlock({ '/api/github/attach': (c) => ((c.body as { repo: string }).repo === 'x' ? json(400, { detail: { error: 'invalid_repo', message: 'no' } }) : json(429, { detail: { error: 'busy', message: 'b' } })) });
    const c = createGithubClient(BASE, s.fetch, memoryStorage());
    const bad = await c.attach({ repo: 'x' });
    const busy = await c.attach({ repo: 'a/b' });
    expect(!bad.ok && bad.error).toMatch(/owner\/repo or a github\.com link/);
    expect(!busy.ok && busy.error).toMatch(/reading another repo/);
  });
});

/** A session whose status answers walk through a script, one per poll. */
function scripted(statuses: Array<Record<string, unknown>>, extra: Record<string, (c: Call) => Response> = {}) {
  let i = 0;
  const s = sherlock({
    '/api/github/attach': () => json(202, statusBody({ state: 'queued', files_ingested: 0, files_listed: 0, passages: 0 })),
    '/api/github/status': () => json(200, statuses[Math.min(i++, statuses.length - 1)]),
    '/api/github/detach': () => json(200, { state: 'detached' }),
    ...extra,
  });
  const client = createGithubClient(BASE, s.fetch, memoryStorage());
  const repo = new RepoSession(client, 0);
  return { s, repo };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
}

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.replaceChildren(container);
});

function chatAdapter(): { adapter: SeamAdapter; chats: string[] } {
  const chats: string[] = [];
  const adapter = { chat: (m: string, _o?: ChatOptions) => { chats.push(m); return Promise.resolve({ ok: false as const, error: 'book down' }); } } as unknown as SeamAdapter;
  return { adapter, chats };
}

let leftPanel: LeftPanel | null = null;

/** The shell in miniature: the left column (with the repo panel) beside the chat view. */
async function openChat(repo: RepoSession): Promise<{ chats: string[] }> {
  const { adapter, chats } = chatAdapter();
  const log = new ChatLog();
  log.setVoice('book');
  leftPanel?.unmount();
  const left = document.createElement('div');
  left.className = 'shell-left';
  const center = document.createElement('div');
  container.replaceChildren(left, center);
  const folderless = { fetchAllEntries: () => Promise.resolve({ ok: true as const, data: [] }) } as unknown as SeamAdapter;
  leftPanel = new LeftPanel(folderless, true, repo);
  leftPanel.mount(left);
  new ChatView(adapter, log, createModelsStub(), repo).mount(center);
  await tick();
  return { chats };
}

const q = <T extends Element>(sel: string): T | null => container.querySelector<T>(sel);

function attachFromForm(repoText: string): void {
  q<HTMLButtonElement>('.repo-attach-btn')!.click();
  const input = q<HTMLInputElement>('.repo-form input[name="repo"]')!;
  input.value = repoText;
  input.dispatchEvent(new Event('input'));
  q<HTMLFormElement>('.repo-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('attach flow in the chat', () => {
  it('offers the control, sends the repo, shows progress then ready with file counts', async () => {
    const { s, repo } = scripted([
      statusBody({ state: 'fetching', files_listed: 12, files_ingested: 3, passages: 0 }),
      statusBody({ state: 'indexing', files_listed: 12, files_ingested: 10, passages: 20 }),
      statusBody(),
    ]);
    await openChat(repo);
    expect(q('.repo-attach-btn')!.textContent).toBe('Attach GitHub repo');
    attachFromForm(' octo/hello ');
    await settle();
    const attach = s.calls.find((c) => c.url.endsWith('/attach'))!;
    expect(attach.body).toEqual({ repo: 'octo/hello' });
    const ready = q('.repo-progress')!;
    expect(ready.getAttribute('data-state')).toBe('ready');
    expect(ready.textContent).toMatch(/10 files read, 2 skipped, 31 passages/);
    // it went through fetching and indexing on the way
    expect(s.calls.filter((c) => c.url.endsWith('/status')).length).toBeGreaterThanOrEqual(3);
  });

  it('shows fetching and indexing words while it works', async () => {
    const { repo } = scripted([statusBody({ state: 'fetching', files_ingested: 3 })]);
    await openChat(repo);
    attachFromForm('octo/hello');
    await Promise.resolve();
    await tick();
    await repo.refresh();
    expect(q('.repo-progress')!.textContent).toMatch(/Fetching octo\/hello.*3 of 12 files read/);
    repo.detach();
  });

  it('sends branch and folder when given', async () => {
    const { s, repo } = scripted([statusBody()]);
    await openChat(repo);
    q<HTMLButtonElement>('.repo-attach-btn')!.click();
    for (const [n, v] of [['repo', 'https://github.com/octo/hello'], ['branch', 'dev'], ['folder', 'src']] as const) {
      const i = q<HTMLInputElement>(`.repo-form input[name="${n}"]`)!;
      i.value = v;
      i.dispatchEvent(new Event('input'));
    }
    q<HTMLFormElement>('.repo-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(s.calls.find((c) => c.url.endsWith('/attach'))!.body).toEqual({ repo: 'https://github.com/octo/hello', branch: 'dev', folder: 'src' });
  });

  it('states repo_not_found, rate limit and no_text_files in words from a failed status', async () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ code: 'repo_not_found', message: 'm' }, /could not find that repo.*private.*public repos/],
      [{ code: 'github_rate_limited', message: 'm', reset_at: 1790000000 }, /rate limit is used up\. Try again after/],
      [{ code: 'no_text_files', message: 'm' }, /no text or code files/],
    ];
    for (const [error, words] of cases) {
      const { repo } = scripted([statusBody({ state: 'failed', error })]);
      container.replaceChildren();
      await openChat(repo);
      attachFromForm('octo/hello');
      await settle();
      expect(q('.repo-error')!.textContent).toMatch(words);
      expect(q('.repo-progress')).toBeNull();
    }
  });

  it('states a refused attach (busy) and a downed service in words', async () => {
    const busy = scripted([statusBody()], { '/api/github/attach': () => json(429, { detail: { error: 'busy', message: 'b' } }) });
    await openChat(busy.repo);
    attachFromForm('octo/hello');
    await settle();
    expect(q('.repo-error')!.textContent).toMatch(/reading another repo/);

    const down = new RepoSession(createGithubClient(BASE, sherlock({}).fetch, memoryStorage()), 0);
    container.replaceChildren();
    await openChat(down);
    attachFromForm('octo/hello');
    await settle();
    expect(q('.repo-error')!.textContent).toMatch(/Sherlock unreachable/);
    expect(q('.repo-error')!.textContent).toMatch(/does not use any other search/);
  });
});

describe('asking the attached repo', () => {
  async function ready(extra: Record<string, (c: Call) => Response> = {}) {
    const r = scripted([statusBody()], extra);
    const { chats } = await openChat(r.repo);
    attachFromForm('octo/hello');
    await settle();
    return { ...r, chats };
  }

  async function send(text: string): Promise<void> {
    const input = q<HTMLInputElement>('#chat-message')!;
    input.value = text;
    q<HTMLFormElement>('.chat-composer')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  it('routes the question to /api/github/ask with the token, not to the book', async () => {
    const { s, repo, chats } = await ready({ '/api/github/ask': () => json(200, answerBody()) });
    expect(repo.source).toBe('repo');
    await send('What does it print?');
    const ask = s.calls.find((c) => c.url.endsWith('/ask'))!;
    expect(ask.body).toEqual({ question: 'What does it print?' });
    expect(ask.headers['X-Sherlock-Session']).toBe(s.calls[0]!.headers['X-Sherlock-Session']);
    expect(chats).toEqual([]);
    expect(q('.chat-reply .bubble-text')!.textContent).toBe('It prints hello.');
  });

  it('shows the file path and the KID for each citation', async () => {
    await ready({ '/api/github/ask': () => json(200, answerBody()) });
    await send('What does it print?');
    const li = q('.repo-citation')!;
    expect(li.querySelector('.repo-path')!.textContent).toBe('src/app.py');
    expect(li.querySelector('.repo-kid')!.textContent).toBe('KID 7');
  });

  it('says in words when nothing in the repo answers, instead of an empty bubble', async () => {
    await ready({ '/api/github/ask': () => json(200, answerBody({ state: 'not_found', text: '', rerank: { used: false }, provenance: [] })) });
    await send('hello');
    expect(q('.chat-reply .bubble-text')!.textContent).toBe('Nothing in this repo answers that.');
    expect(q('.repo-citation')).toBeNull();
  });

  it('uses the same low-confidence wording as the book answers', async () => {
    await ready({ '/api/github/ask': () => json(200, answerBody({ status: 'WEAK_SUPPORT', low_confidence: true })) });
    await send('Anything?');
    expect(q('.sherlock-weak')!.textContent).toBe('Sherlock is only weakly sure of this answer. These are its best matches, not a confirmed answer.');
  });

  it('says which source is asked and lets the user switch back to the book', async () => {
    const { chats } = await ready({ '/api/github/ask': () => json(200, answerBody()) });
    expect(q('.repo-source-btn[data-source="repo"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(q<HTMLInputElement>('#chat-message')!.placeholder).toBe('Ask octo/hello');
    q<HTMLButtonElement>('.repo-source-btn[data-source="book"]')!.click();
    expect(q('.repo-source-btn[data-source="book"]')!.getAttribute('aria-pressed')).toBe('true');
    await send('Who is Victor?');
    expect(chats).toEqual(['Who is Victor?']);
  });

  it('reports a failed ask in words and keeps the question in the box', async () => {
    await ready({ '/api/github/ask': () => json(409, { detail: { error: 'not_ready', message: 'n' } }) });
    await send('Hi?');
    expect(q('.chat-error .error-state')!.textContent).toMatch(/not ready yet/);
    expect(q<HTMLInputElement>('#chat-message')!.value).toBe('Hi?');
  });
});

describe('detach', () => {
  it('calls /detach, clears the repo and its answers, and returns to the book', async () => {
    const r = scripted([statusBody()], { '/api/github/ask': () => json(200, answerBody()) });
    await openChat(r.repo);
    attachFromForm('octo/hello');
    await settle();
    q<HTMLButtonElement>('.repo-detach-btn')!.click();
    await settle();
    expect(r.s.calls.some((c) => c.url.endsWith('/detach') && c.method === 'POST')).toBe(true);
    expect(r.repo.status).toBeNull();
    expect(r.repo.source).toBe('book');
    expect(q('.repo-source')).toBeNull();
    expect(q('.repo-attach-btn')!.textContent).toBe('Attach GitHub repo');
  });
});
