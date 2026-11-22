/**
 * The ERIE page (Research): the pool, the retrieval per turn, the injection.
 * Record reads come from the record stub and chat turns are pushed into the
 * session's ChatLog (test doubles, never app data).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AskResult, ChatTurn, Lesson } from '../adapter/seam.ts';
import { ChatLog } from './chat-log.ts';
import { ERIE_EXPANSION, ResearchView } from './research.ts';
import { resetGridState } from './entry-grid.ts';
import { Router } from '../router/router.ts';
import { createFailingStub, createModelsStub, createRecordStub, makeEntry, tick } from '../test-helpers.ts';

const lesson = (id: string, detail: string, status: Lesson['status'], subject: string | null = null): Lesson => ({
  event_id: id, event_type: 'derived', detail, rule: null, subject, status,
});

function turn(message: string, erie: AskResult | null, injected: Lesson[] = [], held: Lesson[] = []): ChatTurn {
  return {
    message, known: true, step: null, total_steps: 0,
    engines: {
      arche: { reply: 'a reply' }, erie, elle: null, elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected, held }, katie: [],
    },
  };
}

const FOUND: AskResult = {
  question: 'a female of another sex, as hideous as myself',
  state: 'found',
  text: 'CHAPTER IX.\n\nYou must create a female for me',
  provenance: [
    { source: 'K-record day 20412 tick 19, Mary Shelley', content: '019a-ev-16', excerpt: 'CHAPTER IX.\n\nYou must create a female for me' },
    { source: 'K-record day 20412 tick 26, Mary Shelley', content: '019a-ev-23', excerpt: 'CHAPTER VII.' },
  ],
};
const NOT_FOUND: AskResult = { question: 'zorbleflux', state: 'not_found', text: '', provenance: [] };

// Live now: k_start in the past, k_time far ahead (the stub applies the seam's interval rule).
const LIVE = [
  makeEntry({ id: 'p1', kid: 2, subject: 'frankenstein-letter-1', authority: 5, k_start: '2026-11-20T23:46:00.000Z', k_time: '2999-01-01T00:00:00.000Z' }),
  makeEntry({ id: 'p2', kid: 10, subject: 'frankenstein-chapter-6', authority: 7, k_start: '2026-11-20T23:46:00.000Z', k_time: '2999-01-01T00:00:00.000Z' }),
  makeEntry({ id: 'gone', kid: 3, subject: 'turn', authority: 5, k_start: '2026-11-20T00:00:00.000Z', k_time: '2026-11-20T01:00:00.000Z' }),
];

let container: HTMLElement;
let view: ResearchView | null = null;
let router: Router | null = null;

afterEach(() => {
  view?.unmount();
  view = null;
  router?.destroy();
  router = null;
  container?.remove();
  resetGridState();
});

async function mount(log = new ChatLog(), adapter = createRecordStub(LIVE)): Promise<ChatLog> {
  container = document.createElement('div');
  document.body.appendChild(container);
  view = new ResearchView(adapter, log, 'UTC');
  view.mount(container);
  for (let i = 0; i < 4; i++) await tick();
  return log;
}

const q = (sel: string): HTMLElement => container.querySelector<HTMLElement>(sel)!;
const texts = (sel: string): string[] => [...container.querySelectorAll(sel)].map((n) => n.textContent ?? '');

describe('the ERIE page', () => {
  it('header: ERIE over her expansion, the poster one Darren chose', async () => {
    await mount();
    expect(ERIE_EXPANSION).toBe('Epistemic Retrieval and Investigation Engine');
    expect(q('.erie-head h1').textContent).toBe('ERIE');
    expect(q('.erie-expansion').textContent).toBe('Epistemic Retrieval and Investigation Engine');
  });

  it('the three boxes in order: pool, retrieval, injection', async () => {
    await mount();
    expect([...container.querySelectorAll('.erie-box')].map((b) => b.classList[1])).toEqual(
      ['erie-pool', 'erie-retrieval', 'erie-injection'],
    );
    expect(q('.erie-view').dataset.view).toBe('Research');
  });

  it('pool: the record live at this moment, KID as a number and authority', async () => {
    await mount();
    expect(q('.erie-pool .erie-label').textContent).toBe('pool · 2 live of 3 entries · 2 subjects');
    expect(texts('.erie-pool tbody .kid')).toEqual(['2', '10']);
    expect(texts('.erie-pool tbody .cell-authority')).toEqual(['5', '7']);
    expect(texts('.erie-pool tbody .cell-subject')).toEqual(['frankenstein-letter-1', 'frankenstein-chapter-6']);
    expect(q('.erie-pool tbody .kid').getAttribute('href')).toBe('/entry/2/frankenstein-letter-1/p1');
  });

  it('pool: empty and failed reads say so in words', async () => {
    await mount(new ChatLog(), createRecordStub([]));
    expect(q('.erie-pool .erie-box-body').textContent).toBe('Nothing in the record is live at this moment.');
    view!.unmount();
    container.remove();
    await mount(new ChatLog(), createFailingStub('Connector unreachable: refused'));
    expect(q('.erie-pool .error-state').textContent).toBe('Connector unreachable: refused');
  });

  it('no turns yet: retrieval and injection say so, never a bare box', async () => {
    await mount();
    expect(q('.erie-retrieval .erie-box-body').textContent).toBe('No chat turns in this session yet.');
    expect(q('.erie-injection .erie-box-body').textContent).toBe('No chat turns in this session yet.');
  });

  it('retrieval: question, state, text and every provenance field verbatim', async () => {
    const log = await mount();
    log.push(turn('What did the creature ask Victor to make?', FOUND));
    await tick();
    const t = q('.erie-retrieval .erie-turn');
    expect(t.querySelector('.erie-turn-head')!.textContent).toBe('turn 1');
    expect(t.querySelector('.erie-question .erie-value')!.textContent).toBe(FOUND.question);
    expect(t.querySelector('.erie-state .erie-value')!.textContent).toBe('found');
    expect(t.querySelector('.erie-text .erie-value')!.textContent).toBe(FOUND.text);
    const items = [...t.querySelectorAll('.erie-source-item')].map((li) => ({
      source: li.querySelector('.erie-source .erie-value')!.textContent,
      content: li.querySelector('.erie-content .erie-value')!.textContent,
      excerpt: li.querySelector('.erie-excerpt .erie-value')!.textContent,
    }));
    expect(items).toEqual(FOUND.provenance);
    expect(q('.erie-retrieval .erie-label').textContent).toBe('retrieval · 1 turn');
  });

  it('cannot-answer: a not_found turn shows the question and says ERIE could not answer', async () => {
    const log = await mount();
    log.push(turn('zorbleflux?', NOT_FOUND));
    await tick();
    const t = q('.erie-retrieval .erie-turn');
    expect(t.dataset.state).toBe('not_found');
    expect(t.querySelector('.erie-question .erie-value')!.textContent).toBe('zorbleflux');
    expect(t.querySelector('.erie-cannot')!.textContent).toBe('ERIE could not answer.');
    expect(t.querySelector('.erie-text')).toBeNull();
    expect(t.querySelector('.erie-provenance')).toBeNull();
  });

  it('a turn ERIE did not act on says "No action", with the message it was asked', async () => {
    const log = await mount();
    log.push(turn('hello', null));
    await tick();
    expect(q('.erie-retrieval .erie-question .erie-value').textContent).toBe('hello');
    expect(q('.erie-retrieval .erie-cannot').textContent).toBe('No action');
  });

  it('injection: injected lessons verbatim; held ones grey, as questions for ELLE', async () => {
    const log = await mount();
    const inj = lesson('ev-1', 'Darren loves prog rock', 'promoted', 'music');
    const held = lesson('ev-2', 'Darren may dislike jazz', 'candidate');
    log.push(turn('hi', FOUND, [inj], [held]));
    await tick();
    const t = q('.erie-injection .erie-turn');
    expect(texts('.erie-injection .erie-sub')).toEqual(['injected · 1 lesson', 'held · 1 question for ELLE']);
    const fields = (sel: string): Record<string, string> => Object.fromEntries(
      [...t.querySelectorAll(`${sel} .erie-field`)].map((f) => [f.querySelector('dt')!.textContent, f.querySelector('dd')!.textContent]),
    );
    expect(fields('.erie-injected .erie-lesson')).toEqual({
      detail: 'Darren loves prog rock', rule: 'null', subject: 'music', status: 'promoted', event_type: 'derived', event_id: 'ev-1',
    });
    expect(fields('.erie-held .erie-lesson')).toEqual({
      detail: 'Darren may dislike jazz', rule: 'null', subject: 'null', status: 'candidate', event_type: 'derived', event_id: 'ev-2',
    });
    expect(t.querySelector('.erie-injected .erie-lesson')!.classList.contains('is-injected')).toBe(true);
    expect(t.querySelector('.erie-held .erie-lesson')!.classList.contains('is-held')).toBe(true);
    // A held lesson is never shown as injected.
    expect(t.querySelector('.erie-injected')!.textContent).not.toContain('dislike jazz');
  });

  it('a turn with nothing injected or held says so', async () => {
    const log = await mount();
    log.push(turn('hi', NOT_FOUND));
    await tick();
    expect(texts('.erie-injection .erie-none')).toEqual(['Nothing was injected on this turn.', 'Nothing was held on this turn.']);
  });

  it('turns arrive live, in order, and the pool re-reads', async () => {
    const log = await mount();
    log.push(turn('one', NOT_FOUND));
    log.push(turn('two', FOUND));
    for (let i = 0; i < 4; i++) await tick();
    expect(texts('.erie-retrieval .erie-turn-head')).toEqual(['turn 1', 'turn 2']);
    expect(texts('.erie-injection .erie-turn-head')).toEqual(['turn 1', 'turn 2']);
    expect(q('.erie-injection .erie-label').textContent).toBe('injection · 2 turns');
  });

  it('no assembled prompt text and no teaching or storyboard lines anywhere', async () => {
    const log = await mount();
    log.push(turn('hi', FOUND, [lesson('ev-1', 'x', 'promoted')], [lesson('ev-2', 'y', 'candidate')]));
    await tick();
    const text = container.textContent!.toLowerCase();
    for (const banned of ['prompt', 'system:', 'engine context', 'you are', 'frame', 'clip', 'timecode', 'script', 'how to', 'tip:']) {
      expect(text, banned).not.toContain(banned);
    }
    expect(container.querySelector('.view-intro, .how-line, .helper-line, .teaching')).toBeNull();
  });

  it('unmount stops listening to the log', async () => {
    const log = await mount();
    view!.unmount();
    view = null;
    log.push(turn('after', FOUND));
    expect(container.textContent).toBe('');
  });
});

describe('the way to the ERIE page', () => {
  async function start(path: string): Promise<void> {
    window.history.replaceState({}, '', path);
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(createRecordStub(LIVE), container, createModelsStub());
    for (let i = 0; i < 6; i++) await tick();
  }
  const rail = (key: string): HTMLButtonElement => container.querySelector<HTMLButtonElement>(`.rail-button[data-rail="${key}"]`)!;

  it('/research renders the ERIE page', async () => {
    await start('/research');
    expect(container.querySelector('.shell-center .erie-head h1')?.textContent).toBe('ERIE');
    expect(container.querySelector('.brand-view')?.textContent).toBe('View: Research');
  });

  it('the Research icon takes the center to /research and shows the search, untouched', async () => {
    await start('/chat');
    rail('research').click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/research');
    expect(container.querySelector('.shell-center .erie-page')).not.toBeNull();
    const list = container.querySelector<HTMLElement>('.shell-left')!;
    expect(list.dataset.panel).toBe('research');
    expect(list.querySelector('#research-q')).not.toBeNull();
    expect(list.querySelector('.research-form button')?.textContent).toBe('Search');
  });

  it('tapping Research on the ERIE page does not remount it', async () => {
    await start('/research');
    const page = container.querySelector('.shell-center')!.firstElementChild;
    const before = window.history.length;
    rail('research').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(window.location.pathname).toBe('/research');
    expect(window.history.length).toBe(before);
    expect(container.querySelector('.shell-center')!.firstElementChild).toBe(page);
  });

  it('the nav reads Chat / Action List / Calendar / Research, and Research lands on /research', async () => {
    await start('/chat');
    const links = [...container.querySelectorAll<HTMLAnchorElement>('nav.main-nav a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Chat', '/chat'], ['Action List', '/actions'], ['Calendar', '/calendar'], ['Research', '/research'], ['Lessons', '/lessons'], ['Curator', '/curator'],
    ]);
    links[3]!.click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/research');
    expect(container.querySelector('.shell-center .erie-page')).not.toBeNull();
    expect(container.querySelector('nav.main-nav a[aria-current="page"]')?.textContent).toBe('Research');
  });
});
