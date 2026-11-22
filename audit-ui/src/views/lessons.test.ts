/**
 * The ELLE page (Lessons): case files, grey box, answered, per turn.
 * Lessons come from a lessons stub and chat turns are pushed into the
 * session's ChatLog (test doubles, never app data).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatTurn, Lesson, SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from './chat-log.ts';
import { ELLE_EXPANSION, LessonsView, caseFiles, unique } from './lessons.ts';
import { Router } from '../router/router.ts';
import { createFailingStub, createModelsStub, createRecordStub, tick } from '../test-helpers.ts';

const lesson = (id: string, detail: string, status: Lesson['status'], subject: string | null = null): Lesson => ({
  event_id: id, event_type: 'derived', detail, rule: null, subject, status,
});

const MUSIC_1 = lesson('ev-1', 'Darren loves prog rock', 'promoted', 'music');
const MUSIC_2 = lesson('ev-2', 'Darren may dislike jazz', 'candidate', 'music');
const ORDER = lesson('ev-3', 'Order 1042 ships late', 'candidate', 'order-1042');
const LOOSE = lesson('ev-4', 'Darren writes at night', 'promoted');

const lessonsStub = (lessons: Lesson[]): SeamAdapter => createRecordStub([], { fetchLessons: async () => ({ ok: true, data: lessons }) });

function turn(message: string, elle: Lesson | null, promoted: Lesson | null): ChatTurn {
  return {
    message, known: true, step: null, total_steps: 0,
    engines: {
      arche: { reply: 'a reply' }, erie: null, elle, elle_promoted: promoted,
      lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
    },
  };
}

let container: HTMLElement;
let view: LessonsView | null = null;
let router: Router | null = null;

afterEach(() => {
  view?.unmount();
  view = null;
  router?.destroy();
  router = null;
  container?.remove();
});

async function mount(adapter: SeamAdapter, log = new ChatLog()): Promise<ChatLog> {
  container = document.createElement('div');
  document.body.appendChild(container);
  view = new LessonsView(adapter, log);
  view.mount(container);
  for (let i = 0; i < 4; i++) await tick();
  return log;
}

const q = (sel: string): HTMLElement => container.querySelector<HTMLElement>(sel)!;
const texts = (sel: string): string[] => [...container.querySelectorAll(sel)].map((n) => n.textContent ?? '');
const details = (sel: string): string[] => texts(`${sel} .elle-detail`);

describe('the ELLE page', () => {
  it('header: ELLE alone, no expansion until Darren supplies it', async () => {
    await mount(lessonsStub([]));
    expect(ELLE_EXPANSION).toBeNull();
    expect(q('.elle-head').textContent).toBe('ELLE');
    expect(container.querySelector('.elle-expansion')).toBeNull();
  });

  it('four boxes in order: case files, grey box, answered, per turn', async () => {
    await mount(lessonsStub([]));
    expect([...container.querySelectorAll('.elle-box')].map((b) => b.classList[1])).toEqual(
      ['elle-files', 'elle-grey', 'elle-answered', 'elle-turns'],
    );
    expect(q('.elle-view').dataset.view).toBe('Lessons');
  });

  it('case files: lessons grouped by subject; no subject reads unfiled, last', async () => {
    await mount(lessonsStub([LOOSE, MUSIC_1, ORDER, MUSIC_2]));
    expect(q('.elle-files .elle-label').textContent).toBe('case files · 2 subjects · 4 lessons');
    expect(texts('.elle-file-head')).toEqual(['music · 2', 'order-1042 · 1', 'unfiled · 1']);
    expect(details('.elle-file[data-subject="music"]')).toEqual(['Darren loves prog rock', 'Darren may dislike jazz']);
    expect(q('.elle-file.is-unfiled').dataset.subject).toBe('');
    expect(details('.elle-file.is-unfiled')).toEqual(['Darren writes at night']);
  });

  it('grey box: the candidates, grey; answered: the promoted ones', async () => {
    await mount(lessonsStub([LOOSE, MUSIC_1, ORDER, MUSIC_2]));
    expect(q('.elle-grey .elle-label').textContent).toBe('grey box · 2 open questions');
    expect(details('.elle-grey')).toEqual(['Order 1042 ships late', 'Darren may dislike jazz']);
    expect([...container.querySelectorAll('.elle-grey .elle-lesson')].every((d) => d.classList.contains('is-grey'))).toBe(true);
    expect(q('.elle-answered .elle-label').textContent).toBe('answered · 2 lessons learned');
    expect(details('.elle-answered')).toEqual(['Darren writes at night', 'Darren loves prog rock']);
    expect([...container.querySelectorAll('.elle-answered .elle-lesson')].every((d) => d.classList.contains('is-promoted'))).toBe(true);
    // Every field verbatim, null as null.
    const first = container.querySelector('.elle-grey .elle-lesson')!;
    const f = Object.fromEntries([...first.querySelectorAll('.elle-field')].map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]));
    expect(f).toEqual({ detail: 'Order 1042 ships late', rule: 'null', subject: 'order-1042', status: 'candidate', event_type: 'derived', event_id: 'ev-3' });
  });

  it('the live record as it is today: every lesson promoted, no subject', async () => {
    await mount(lessonsStub([LOOSE]));
    expect(texts('.elle-file-head')).toEqual(['unfiled · 1']);
    expect(q('.elle-grey .elle-box-body').textContent).toBe('Nothing is held. No lesson is waiting to be promoted.');
  });

  it('nothing yet: every box says so in words', async () => {
    await mount(lessonsStub([]));
    expect(q('.elle-files .elle-box-body').textContent).toBe('No lessons yet.');
    expect(q('.elle-grey .elle-box-body').textContent).toBe('Nothing is held. No lesson is waiting to be promoted.');
    expect(q('.elle-answered .elle-box-body').textContent).toBe('No lesson is learned yet.');
    expect(q('.elle-turns .elle-box-body').textContent).toBe('No chat turns in this session yet.');
  });

  it('a failed read says so in the lesson boxes', async () => {
    await mount(createFailingStub('Connector unreachable: refused'));
    expect(texts('.elle-files .error-state, .elle-grey .error-state, .elle-answered .error-state')).toEqual(
      Array(3).fill('Connector unreachable: refused'),
    );
  });

  it('per turn: what she recorded, what she promoted, and "No action"', async () => {
    const log = await mount(lessonsStub([]));
    log.push(turn('one', MUSIC_2, null));
    log.push(turn('two', null, null));
    log.push(turn('three', null, { ...MUSIC_2, status: 'promoted' }));
    for (let i = 0; i < 4; i++) await tick();
    const turns = [...container.querySelectorAll('.elle-turn')];
    expect(turns.map((t) => t.querySelector('.elle-turn-head')!.textContent)).toEqual(['turn 1', 'turn 2', 'turn 3']);
    expect([...turns[0]!.querySelectorAll('.elle-sub')].map((s) => s.textContent)).toEqual(['recorded']);
    expect(turns[0]!.querySelector('.elle-lesson')!.classList.contains('is-grey')).toBe(true);
    expect(turns[1]!.querySelector('.elle-none')!.textContent).toBe('No action');
    expect(turns[1]!.querySelector('.elle-lesson')).toBeNull();
    expect([...turns[2]!.querySelectorAll('.elle-sub')].map((s) => s.textContent)).toEqual(['promoted']);
    // The promotion moved it out of the grey box and into answered, with its turn.
    expect(details('.elle-grey')).toEqual([]);
    expect(details('.elle-answered')).toEqual(['Darren may dislike jazz']);
    expect(texts('.elle-answered .elle-note')).toEqual(['promoted on turn 3']);
    expect(q('.elle-turns .elle-label').textContent).toBe('per turn · 3 turns');
  });

  it('a promoted copy replaces its candidate, in first-seen order', () => {
    const later = { ...MUSIC_2, status: 'promoted' as const };
    expect(unique([[MUSIC_2, ORDER], [later]])).toEqual([later, ORDER]);
    expect(unique([[later], [MUSIC_2]])).toEqual([later]);
    expect(caseFiles([LOOSE, ORDER]).map(([s]) => s)).toEqual(['order-1042', null]);
  });

  it('no invented state: no partial answer, no greybox system, no teaching lines', async () => {
    const log = await mount(lessonsStub([LOOSE, MUSIC_1, ORDER, MUSIC_2]));
    log.push(turn('two', null, null));
    await tick();
    const text = container.textContent!.toLowerCase();
    for (const banned of ['partial', 'concluded', 'rejected', 'stage', 'judgment', 'three-model', 'queue',
      'how to', 'tip:', 'frame', 'clip', 'timecode', 'script', 'prompt']) {
      expect(text, banned).not.toContain(banned);
    }
    expect(container.querySelector('.view-intro, .how-line, .helper-line, .teaching')).toBeNull();
  });

  it('unmount stops listening to the log', async () => {
    const log = await mount(lessonsStub([]));
    view!.unmount();
    view = null;
    log.push(turn('after', MUSIC_1, null));
    expect(container.textContent).toBe('');
  });
});

describe('the way to the ELLE page', () => {
  async function start(path: string): Promise<void> {
    window.history.replaceState({}, '', path);
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(lessonsStub([LOOSE]), container, createModelsStub());
    for (let i = 0; i < 6; i++) await tick();
  }
  const rail = (key: string): HTMLButtonElement => container.querySelector<HTMLButtonElement>(`.rail-button[data-rail="${key}"]`)!;

  it('/lessons renders the ELLE page', async () => {
    await start('/lessons');
    expect(container.querySelector('.shell-center .elle-head h1')?.textContent).toBe('ELLE');
    expect(container.querySelector('.brand-view')?.textContent).toBe('View: Lessons');
  });

  it('the Lessons icon takes the center to /lessons and shows the lessons list, untouched', async () => {
    await start('/chat');
    rail('lessons').click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/lessons');
    expect(container.querySelector('.shell-center .elle-page')).not.toBeNull();
    const list = container.querySelector<HTMLElement>('.shell-left')!;
    expect(list.dataset.panel).toBe('lessons');
    expect(list.querySelector('.lessons-list')).not.toBeNull();
  });

  it('tapping Lessons on the ELLE page does not remount it', async () => {
    await start('/lessons');
    const page = container.querySelector('.shell-center')!.firstElementChild;
    const before = window.history.length;
    rail('lessons').click();
    for (let i = 0; i < 4; i++) await tick();
    expect(window.location.pathname).toBe('/lessons');
    expect(window.history.length).toBe(before);
    expect(container.querySelector('.shell-center')!.firstElementChild).toBe(page);
  });

  it('the nav ends Research / Lessons, and Lessons lands on /lessons', async () => {
    await start('/chat');
    const links = [...container.querySelectorAll<HTMLAnchorElement>('nav.main-nav a')];
    expect(links.map((a) => a.textContent)).toEqual(['Chat', 'Action List', 'Calendar', 'Research', 'Lessons']);
    links[4]!.click();
    for (let i = 0; i < 6; i++) await tick();
    expect(window.location.pathname).toBe('/lessons');
    expect(container.querySelector('nav.main-nav a[aria-current="page"]')?.textContent).toBe('Lessons');
  });
});
