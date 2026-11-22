/**
 * The Curator page and the CURATOR label. Record reads come from the
 * record stub and catalog answers from a stub curatorAsk (test doubles,
 * never app data).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { CuratorAnswer, SeamAdapter } from '../adapter/seam.ts';
import { CuratorView } from './curator.ts';
import { catalog } from '../util/curator.ts';
import { Router } from '../router/router.ts';
import { createFailingStub, createModelsStub, createRecordStub, makeEntry, tick } from '../test-helpers.ts';

const CH7 = makeEntry({ id: 'c7', kid: 11, subject: 'frankenstein-chapter-7', k_time: '2999-01-01T00:00:00.000Z' });
const T1 = makeEntry({ id: 't1', kid: 28, subject: 'turn', k_time: '2999-01-01T00:00:00.000Z' });
const T2 = makeEntry({ id: 't2', kid: 29, subject: 'turn', k_time: '2999-01-01T00:00:00.000Z' });
const F7 = makeEntry({ id: 'f7', kid: 30, subject: 'curator-folder-frankenstein-chapter-7' });
const FT1 = makeEntry({ id: 'ft1', kid: 31, subject: 'curator-folder-turn' });
const FT2 = makeEntry({ id: 'ft2', kid: 32, subject: 'curator-folder-turn' });
const ENTRIES = [CH7, T1, F7, FT1, T2, FT2];

const FOUND: CuratorAnswer = {
  found: true, question: 'turn', state: 'found',
  text: 'Curator folder: turn\nentries: 2\nKIDs: 28, 29',
  provenance: [{ source: 'K-record day 20779 tick 60, Curator', content: 'ft2', excerpt: 'Curator folder: turn' }],
};
const NONE: CuratorAnswer = { found: false, question: 'zorbleflux', state: 'not_found', text: '', provenance: [] };

let container: HTMLElement;
let view: CuratorView | null = null;
let router: Router | null = null;

afterEach(() => {
  view?.unmount();
  view = null;
  router?.destroy();
  router = null;
  container?.remove();
});

function adapter(asked: string[] = []): SeamAdapter {
  return createRecordStub(ENTRIES, {
    curatorAsk: async (q: string) => {
      asked.push(q);
      return { ok: true, data: q === 'turn' ? FOUND : { ...NONE, question: q } };
    },
  });
}

async function mount(a: SeamAdapter = adapter()): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  view = new CuratorView(a);
  view.mount(container);
  for (let i = 0; i < 4; i++) await tick();
}

const q = (sel: string): HTMLElement => container.querySelector<HTMLElement>(sel)!;
const texts = (sel: string): string[] => [...container.querySelectorAll(sel)].map((n) => n.textContent ?? '');

async function ask(question: string): Promise<void> {
  (q('#curator-q') as HTMLInputElement).value = question;
  (q('.curator-composer') as HTMLFormElement).requestSubmit();
  for (let i = 0; i < 4; i++) await tick();
}

describe('the catalog', () => {
  it('a folder per subject, newest version standing, case file from the record', () => {
    const c = catalog(ENTRIES);
    expect(c.map((f) => f.subject)).toEqual(['frankenstein-chapter-7', 'turn']);
    expect(c[1]!.folder.id).toBe('ft2');
    expect(c[1]!.versions.map((v) => v.id)).toEqual(['ft1', 'ft2']);
    expect(c[1]!.caseFile.map((e) => e.id)).toEqual(['t1', 't2']);
  });
});

describe('the Curator page', () => {
  it('header says Curator; no engine voice, no teaching lines', async () => {
    await mount();
    expect(q('.curator-head').textContent).toBe('Curator');
    expect(q('.curator-view').dataset.view).toBe('Curator');
    const text = container.textContent!.toLowerCase();
    for (const banned of ['prompt', 'persona', 'how to', 'tip:']) expect(text, banned).not.toContain(banned);
  });

  it('lists each folder: subject, its KID, the count and the case file by KID, all links', async () => {
    await mount();
    expect(q('.curator-catalog .curator-label').textContent).toBe('folders · 2 subjects');
    expect(texts('.curator-subject')).toEqual(['frankenstein-chapter-7', 'turn']);
    expect(texts('.curator-folder-kid')).toEqual(['30', '32']);
    expect(texts('.curator-count')).toEqual(['1 entry', '2 entries']);
    const turn = q('.curator-folder[data-subject="turn"]');
    expect([...turn.querySelectorAll('.curator-case-file a')].map((a) => a.textContent)).toEqual(['28', '29']);
    expect(turn.querySelector('.curator-versions')!.textContent).toBe('filed 2 times');
    expect(turn.querySelector('.curator-folder-kid')!.getAttribute('href')).toBe('/entry/32/curator-folder-turn/ft2');
    expect(turn.querySelector('.curator-case-file a')!.getAttribute('href')).toBe('/entry/28/turn/t1');
    expect(q('.curator-folder[data-subject="frankenstein-chapter-7"] .curator-versions')).toBeNull();
  });

  it('no folders yet, or a failed read, says so in words', async () => {
    await mount(createRecordStub([CH7]));
    expect(q('.curator-catalog .curator-box-body').textContent).toBe('Curator has filed no folders yet.');
    view!.unmount();
    container.remove();
    await mount(createFailingStub('Connector unreachable: refused'));
    expect(q('.curator-catalog .error-state').textContent).toBe('Connector unreachable: refused');
  });

  it('the chat asks the catalog: a found answer verbatim, with provenance', async () => {
    const asked: string[] = [];
    await mount(adapter(asked));
    await ask('turn');
    expect(asked).toEqual(['turn']);
    const t = q('.curator-turn');
    expect(t.dataset.state).toBe('found');
    expect(t.querySelector('.curator-question')!.textContent).toBe('turn');
    expect(t.querySelector('.curator-answer')!.textContent).toBe(FOUND.text);
    expect(texts('.curator-source')).toEqual(['K-record day 20779 tick 60, Curator']);
  });

  it('the chat says when the catalog does not say', async () => {
    await mount();
    await ask('zorbleflux');
    const t = q('.curator-turn');
    expect(t.dataset.state).toBe('not_found');
    expect(t.querySelector('.curator-cannot')!.textContent).toBe('The catalog does not say.');
    expect(t.querySelector('.curator-answer')).toBeNull();
  });

  it('an empty question asks nothing; a failed ask says so', async () => {
    const asked: string[] = [];
    await mount(adapter(asked));
    await ask('   ');
    expect(asked).toEqual([]);
    view!.unmount();
    container.remove();
    await mount(createFailingStub('Connector unreachable: refused'));
    await ask('turn');
    expect(q('.curator-turn .error-state').textContent).toBe('Connector unreachable: refused');
  });
});

describe('the way to the Curator page, and the CURATOR label', () => {
  async function start(path: string): Promise<void> {
    window.history.replaceState({}, '', path);
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(adapter(), container, createModelsStub());
    for (let i = 0; i < 6; i++) await tick();
  }

  it('/curator renders the page; the nav ends with Curator', async () => {
    await start('/curator');
    expect(container.querySelector('.shell-center .curator-head h1')?.textContent).toBe('Curator');
    expect(container.querySelector('.brand-view')?.textContent).toBe('View: Curator');
    const links = [...container.querySelectorAll<HTMLAnchorElement>('nav.main-nav a')];
    expect(links.at(-1)?.textContent).toBe('Curator');
    expect(links.at(-1)?.getAttribute('aria-current')).toBe('page');
  });

  it('the left column says Curator above the folders, and files no folder as a subject', async () => {
    await start('/chat');
    const left = container.querySelector<HTMLElement>('.shell-left')!;
    const head = left.querySelector('.left-record h2');
    expect(head?.textContent).toBe('Curator');
    expect(head?.nextElementSibling?.classList.contains('left-folders')).toBe(true);
    expect(left.querySelector('.left-folders')!.textContent).not.toContain('curator-folder');
  });
});
