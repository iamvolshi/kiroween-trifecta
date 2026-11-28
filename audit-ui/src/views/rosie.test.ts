/**
 * Attach a local drive through Rosie (OCME-013-hack): the /api/rosie client and its headers,
 * pairing (code, then connected), the asleep state, choosing a folder, the Ready line, asking
 * the folder (path + KID + machine), detach and unpair, per-person scope, and the read-only
 * words. Sherlock is a fetch double; no network, no Rosie.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { SeamAdapter, ChatOptions } from '../adapter/seam.ts';
import { SESSION_KEY } from '../adapter/github-client.ts';
import { createRosieClient } from '../adapter/rosie-client.ts';
import { RepoSession } from './repo-session.ts';
import { RosieSession } from './rosie-session.ts';
import { ROSIE_DOWNLOAD_URL, READ_ONLY_WORDS } from './rosie-panel.ts';
import { createGithubClient } from '../adapter/github-client.ts';
import { ChatView } from './chat.ts';
import { LeftPanel } from '../shell/left.ts';
import { ChatLog } from './chat-log.ts';
import { createModelsStub, tick } from '../test-helpers.ts';

interface Call { url: string; method: string; headers: Record<string, string>; body: unknown }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function status(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'ready', connection: 'connected', message: '', machine: { name: 'Sam-Laptop', version: '0.1.0', paired_ms: 0 },
    folder: 'C:\\Users\\sam\\notes', files_read: 12, files_skipped: 3, skipped: { binary: 3 }, passages: 31, truncated: false,
    error: null, pairing: { code_open: false }, ...over,
  };
}

function answer(): Record<string, unknown> {
  return {
    state: 'found', text: 'It prints hello.', status: 'SUPPORTED', confidence: 0.9, low_confidence: false, ranked_by: 'rerank',
    rerank: { used: true, model: 'rr' },
    provenance: [{ kid: 7, kid_label: 'KID 7', excerpt: 'print("hello")', evidence_id: 'e', score: 1, source: 'Sam-Laptop:src/app.py', section: 'src/app.py', machine: 'Sam-Laptop', folder: 'C:\\Users\\sam\\notes', path: 'src/app.py' }],
  };
}

function sherlock(handlers: Record<string, (c: Call) => Response>) {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (url: string, init?: RequestInit): Promise<Response> => {
      const path = new URL(url).pathname;
      calls.push({
        url, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      const h = handlers[path];
      return h ? Promise.resolve(h(calls[calls.length - 1]!)) : Promise.reject(new Error(`no handler for ${path}`));
    },
  };
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const BASE = 'https://sherlock.test';

/** A person with Rosie: the status answers walk through a script, one per poll. */
function scripted(statuses: Array<Record<string, unknown>>, extra: Record<string, (c: Call) => Response> = {}) {
  let i = 0;
  const s = sherlock({
    '/api/rosie/status': () => json(200, statuses[Math.min(i++, statuses.length - 1)]),
    '/api/rosie/pair': () => json(201, { code: 'K7QM-X2RD', expires_in: 600, expires_ms: Date.now() + 600_000 }),
    '/api/rosie/choose-folder': () => json(202, { requested: true }),
    '/api/rosie/ask': () => json(200, answer()),
    '/api/rosie/detach': () => json(200, { state: 'detached' }),
    '/api/rosie/unpair': () => json(200, { state: 'not_paired' }),
    ...extra,
  });
  const store = memoryStorage();
  const rosie = new RosieSession(createRosieClient(BASE, s.fetch, store), 600_000, 600_000);
  const repo = new RepoSession(createGithubClient(BASE, () => Promise.reject(new Error('no github call expected')), store), 0, rosie);
  return { s, rosie, repo, store };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.replaceChildren(container);
});

let leftPanel: LeftPanel | null = null;
async function openChat(repo: RepoSession): Promise<{ chats: string[] }> {
  const chats: string[] = [];
  const adapter = { chat: (m: string, _o?: ChatOptions) => { chats.push(m); return Promise.resolve({ ok: false as const, error: 'book down' }); } } as unknown as SeamAdapter;
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
const text = (sel: string): string => q(sel)?.textContent ?? '';

describe('rosie client', () => {
  it('sends the same per-person key as the GitHub adapter on every call, to /api/rosie only', async () => {
    const s = scripted([status()]);
    await s.rosie.refresh();
    await s.rosie.pair();
    await s.rosie.ask('hi');
    const key = s.store.map.get(SESSION_KEY)!;
    expect(key).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(s.s.calls.length).toBeGreaterThanOrEqual(3);
    for (const c of s.s.calls) {
      expect(c.headers['X-Sherlock-Session']).toBe(key);
      expect(new URL(c.url).pathname.startsWith('/api/rosie/')).toBe(true);
    }
  });

  it('keeps two people apart: each browser has its own key, and the key is never in a URL or body', async () => {
    const a = scripted([status()]);
    const b = scripted([status()]);
    await a.rosie.refresh();
    await b.rosie.refresh();
    const ka = a.s.calls[0]!.headers['X-Sherlock-Session'];
    const kb = b.s.calls[0]!.headers['X-Sherlock-Session'];
    expect(ka).not.toBe(kb);
    await a.rosie.pair();
    for (const c of a.s.calls) expect(JSON.stringify([c.url, c.body])).not.toContain(ka!);
  });

  it('says what went wrong in plain words', async () => {
    const cases: Array<[number, string, RegExp]> = [
      [409, 'rosie_asleep', /Rosie is asleep, start her again/],
      [409, 'not_paired', /not paired yet/],
      [409, 'ingest_in_progress', /still reading a folder/],
      [404, 'no_folder_attached', /Choose a folder first/],
      [409, 'not_ready', /Wait until it says Ready/],
    ];
    for (const [code, error, words] of cases) {
      const t = scripted([status()], { '/api/rosie/choose-folder': () => json(code, { detail: { error, message: 'm' } }) });
      await t.rosie.chooseFolder();
      expect(t.rosie.error).toMatch(words);
    }
    const down = new RosieSession(createRosieClient(BASE, sherlock({}).fetch, memoryStorage()), 0, 0);
    await down.refresh();
    expect(down.error).toMatch(/Sherlock unreachable.*does not use any other search/);
    const old = scripted([status()], { '/api/rosie/status': () => json(404, { detail: 'Not Found' }) });
    await old.rosie.refresh();
    expect(old.rosie.error).toMatch(/HTTP 404.*may not have the Rosie routes/);
  });
});

describe('the panel: download and pairing', () => {
  it('shows Download Rosie bridge and Attach local drive beside the GitHub control, with the read-only words', async () => {
    const { repo } = scripted([status({ state: 'not_paired', connection: 'not_paired', machine: null, folder: null })]);
    await openChat(repo);
    const dl = q<HTMLAnchorElement>('.rosie-download')!;
    expect(dl.textContent).toBe('Download Rosie bridge');
    expect(dl.href).toBe(ROSIE_DOWNLOAD_URL);
    expect(dl.href).toContain('github.com/iamvolshi/scribe/releases/download/rosie-v0.1.0/');
    expect(q('.repo-attach-btn')).not.toBeNull();
    expect(q('.rosie-attach-btn')!.textContent).toBe('Attach local drive');
    q<HTMLButtonElement>('.rosie-attach-btn')!.click();
    expect(text('.rosie-steps')).toContain(READ_ONLY_WORDS);
    expect(READ_ONLY_WORDS).toMatch(/never changes, deletes or runs anything.*only the one folder you choose/);
  });

  it('shows the code, then Rosie is connected, then the folder step', async () => {
    const { s, repo, rosie } = scripted([
      status({ state: 'not_paired', connection: 'not_paired', machine: null, folder: null }),
      status({ state: 'not_paired', connection: 'not_paired', machine: null, folder: null }),
      status({ state: 'connected', connection: 'connected', folder: null, files_read: 0, files_skipped: 0, passages: 0 }),
    ]);
    await openChat(repo);
    await rosie.refresh();
    q<HTMLButtonElement>('.rosie-attach-btn')!.click();
    q<HTMLButtonElement>('.rosie-go')!.click();
    await settle();
    expect(s.calls.some((c) => c.url.endsWith('/api/rosie/pair') && c.method === 'POST')).toBe(true);
    expect(text('.rosie-code')).toBe('K7QM-X2RD');
    expect(text('.rosie-steps')).toMatch(/Rosie\.exe K7QM-X2RD/);
    await rosie.refresh();
    await settle();
    expect(text('.rosie-progress')).toMatch(/Rosie is connected/);
    expect(q('.rosie-code')).toBeNull();
    expect(q<HTMLButtonElement>('.rosie-go')!.textContent).toBe('Choose folder');
    rosie.destroy();
  });

  it('says Rosie is asleep, start her again, and will not queue a folder pick', async () => {
    const { repo, rosie } = scripted([status({ state: 'asleep', connection: 'asleep', folder: null, files_read: 0, files_skipped: 0, passages: 0 })]);
    await openChat(repo);
    await rosie.refresh();
    expect(text('.rosie-progress')).toBe('Rosie is asleep, start her again on your computer.');
    expect(q<HTMLButtonElement>('.rosie-go')!.disabled).toBe(true);
    rosie.destroy();
  });

  it('sends choose-folder and shows the waiting words', async () => {
    const { s, repo, rosie } = scripted([
      status({ state: 'connected', folder: null }),
      status({ state: 'choosing_folder', folder: null }),
    ]);
    await openChat(repo);
    await rosie.refresh();
    q<HTMLButtonElement>('.rosie-go')!.click();
    await settle();
    expect(s.calls.some((c) => c.url.endsWith('/choose-folder') && c.method === 'POST')).toBe(true);
    expect(text('.rosie-progress')).toBe('Rosie is waiting for you to pick a folder on your computer.');
    rosie.destroy();
  });

  it('puts a refused choose-folder in words on the panel', async () => {
    const { repo, rosie } = scripted([status({ state: 'connected', folder: null })], {
      '/api/rosie/choose-folder': () => json(409, { detail: { error: 'rosie_asleep', message: 'x' } }),
    });
    await openChat(repo);
    await rosie.refresh();
    q<HTMLButtonElement>('.rosie-go')!.click();
    await settle();
    expect(text('.rosie-error')).toMatch(/Rosie is asleep, start her again/);
    rosie.destroy();
  });
});

describe('ready, ask, detach, unpair', () => {
  it('shows the Ready line with files read, skipped and passages, like GitHub', async () => {
    const { repo, rosie } = scripted([status()]);
    await openChat(repo);
    await rosie.refresh();
    expect(text('.rosie-progress')).toBe('Ready. 12 files read, 3 skipped, 31 passages.');
    expect(q('.rosie-progress')!.getAttribute('data-state')).toBe('ready');
    expect(repo.mode).toBe('folder'); // a folder that just became ready is asked first
    rosie.destroy();
  });

  it('says in words when she sleeps after the folder is ready: it still answers', async () => {
    const { repo, rosie } = scripted([status({ connection: 'asleep' })]);
    await openChat(repo);
    await rosie.refresh();
    expect(text('.rosie-progress')).toMatch(/^Ready\. 12 files read.*Rosie is asleep, but your folder is still here\.$/);
    expect(repo.rosie!.ready).toBe(true);
    rosie.destroy();
  });

  it('asks the folder (not the book, not GitHub) and shows machine, file path and KID', async () => {
    const { s, repo, rosie } = scripted([status()]);
    const { chats } = await openChat(repo);
    await rosie.refresh();
    const input = q<HTMLInputElement>('.chat-input, input[type="text"], textarea')!;
    expect(input.placeholder).toContain('C:\\Users\\sam\\notes');
    input.value = 'What does it print?';
    q<HTMLFormElement>('form.chat-form, form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const ask = s.calls.find((c) => c.url.endsWith('/api/rosie/ask'))!;
    expect(ask.body).toEqual({ question: 'What does it print?' });
    expect(chats).toEqual([]); // the book was not asked
    expect(text('.repo-path')).toBe('src/app.py');
    expect(text('.repo-kid')).toBe('KID 7');
    expect(text('.repo-machine')).toBe('Sam-Laptop');
    rosie.destroy();
  });

  it('goes back to the book on the switch, and back to the folder', async () => {
    const { repo, rosie } = scripted([status()]);
    await openChat(repo);
    await rosie.refresh();
    q<HTMLButtonElement>('.rosie-source-btn[data-source="book"]')!.click();
    expect(repo.mode).toBe('book');
    q<HTMLButtonElement>('.rosie-source-btn[data-source="folder"]')!.click();
    expect(repo.mode).toBe('folder');
    rosie.destroy();
  });

  it('detach drops the folder from the chat and keeps the pairing; unpair sends the unpair call', async () => {
    const { s, repo, rosie } = scripted([status(), status({ state: 'connected', folder: null, files_read: 0, files_skipped: 0, passages: 0 }), status({ state: 'not_paired', connection: 'not_paired', machine: null, folder: null })]);
    await openChat(repo);
    await rosie.refresh();
    q<HTMLButtonElement>('.rosie-detach-btn')!.click();
    await settle();
    expect(s.calls.some((c) => c.url.endsWith('/api/rosie/detach') && c.method === 'POST')).toBe(true);
    expect(repo.mode).toBe('book');
    expect(rosie.paired).toBe(true);
    await rosie.unpair();
    expect(s.calls.some((c) => c.url.endsWith('/api/rosie/unpair') && c.method === 'POST')).toBe(true);
    expect(rosie.paired).toBe(false);
    rosie.destroy();
  });

  it('a failed folder shows its words', async () => {
    const { repo, rosie } = scripted([status({ state: 'failed', error: { code: 'rosie_went_away', message: 'm' } })]);
    await openChat(repo);
    await rosie.refresh();
    expect(text('.rosie-error')).toMatch(/Rosie went to sleep while reading/);
    expect(q('.rosie-progress')).toBeNull();
    rosie.destroy();
  });
});

describe('nothing else changes', () => {
  it('a person who never pairs sends no Rosie call after the first status read', async () => {
    const { s, rosie } = scripted([status({ state: 'not_paired', connection: 'not_paired', machine: null, folder: null })]);
    await rosie.refresh();
    await settle();
    expect(s.calls.filter((c) => c.url.includes('/api/rosie/'))).toHaveLength(1);
  });

  it('a ready GitHub repo is still asked as the repo, and the folder does not take over', async () => {
    const { repo, rosie } = scripted([status({ state: 'not_paired', connection: 'not_paired', machine: null, folder: null })]);
    repo.status = { state: 'ready', repo: 'octo/hello', branch: 'main', folder: '', files_listed: 12, files_ingested: 10, files_skipped: 2, passages: 31, truncated: false, error: null };
    repo.setSource('repo');
    await rosie.refresh();
    expect(repo.mode).toBe('repo');
    expect(repo.activeName).toBe('octo/hello');
  });

  it('a build without Rosie (no session) draws no local-drive panel', async () => {
    const repo = new RepoSession(createGithubClient(BASE, () => Promise.reject(new Error('x')), memoryStorage()), 0);
    await openChat(repo);
    expect(q('.rosie-slot')).toBeNull();
    expect(q('.repo-attach-btn')).not.toBeNull();
  });
});
