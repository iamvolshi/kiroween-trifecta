/**
 * ELLE's question folders on the Lessons page (Darren, Nov 22): one folder
 * per open question, named after the question, holding its observations,
 * concerns, scratch pad and ideas, with the state the connector sent.
 * Questions come from a stub fetchQuestions (a test double, never app data).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { QUESTION_STATES, type Lesson, type Question, type QuestionsResult, type SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from './chat-log.ts';
import { LessonsView } from './lessons.ts';
import { createRecordStub, makeEntry, tick } from '../test-helpers.ts';
import { Router } from '../router/router.ts';
import { createModelsStub } from '../test-helpers.ts';

const question = (n: number, over: Partial<Question> = {}): Question => ({
  kid: 60 + n, event_id: `ev-q${n}`, subject: `elle-question-${n}`,
  question: `Is it so: Darren loves thing ${n}?`, state: null,
  source: `Darren loves thing ${n}`, rule: 'derived:preference',
  observations: [], concerns: [], scratch: [], ideas: [],
  open: true, closed: null, versions: 1, ...over,
});
const lesson = (id: string, detail: string, status: Lesson['status'], subject: string | null = null): Lesson => ({
  event_id: id, event_type: 'derived', detail, rule: null, subject, status,
});

function stub(questions: Question[], lessons: Lesson[] = [], entries = [makeEntry({ id: 'x' })]): SeamAdapter {
  const data: QuestionsResult = { questions, reasoning: null };
  return createRecordStub(entries, {
    fetchLessons: async () => ({ ok: true, data: lessons }),
    fetchQuestions: async () => ({ ok: true, data }),
  });
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

async function mount(adapter: SeamAdapter): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  view = new LessonsView(adapter, new ChatLog());
  view.mount(container);
  for (let i = 0; i < 4; i++) await tick();
}

const q = (sel: string): HTMLElement => container.querySelector<HTMLElement>(sel)!;
const texts = (sel: string): string[] => [...container.querySelectorAll(sel)].map((n) => n.textContent ?? '');

describe('question folders in the grey box', () => {
  it('one folder per open question, named after the question', async () => {
    await mount(stub([question(1), question(2)]));
    expect(q('.elle-grey .elle-label').textContent).toBe('grey box · 2 open questions');
    expect(texts('.elle-grey .elle-question-name')).toEqual(['Is it so: Darren loves thing 1?', 'Is it so: Darren loves thing 2?']);
    const f = q('.elle-question[data-subject="elle-question-1"]');
    expect(f.tagName).toBe('SECTION');
    expect(f.querySelector('a.kid')!.getAttribute('href')).toBe('/entry/61/elle-question-1/ev-q1');
  });

  it('the folder holds its observations, concerns, scratch pad and ideas, in that order', async () => {
    await mount(stub([question(1, {
      ideas: ['check the next turn'], observations: ['said twice', 'said loudly'],
      scratch: ['ask about Rush'], concerns: ['only one source'], versions: 3,
    })]));
    const f = q('.elle-question');
    expect([...f.querySelectorAll('.elle-question-part-head')].map((h) => h.textContent)).toEqual(
      ['Observations', 'Concerns', 'Scratch pad', 'Ideas'],
    );
    expect([...f.querySelectorAll('.elle-question-observations li')].map((l) => l.textContent)).toEqual(['said twice', 'said loudly']);
    expect(f.querySelector('.elle-question-concerns li')!.textContent).toBe('only one source');
    expect(f.querySelector('.elle-question-scratch li')!.textContent).toBe('ask about Rush');
    expect(f.querySelector('.elle-question-ideas li')!.textContent).toBe('check the next turn');
    expect(f.querySelector('.elle-question-versions')!.textContent).toBe('worked 2 times');
  });

  for (const state of QUESTION_STATES) {
    it(`shows the state the connector sent: ${state}`, async () => {
      await mount(stub([question(1, { state })]));
      expect(q('.elle-question').dataset.state).toBe(state);
      expect(q('.elle-question-state').textContent).toBe(state);
    });
  }

  it('a folder with no state from the connector shows none', async () => {
    await mount(stub([question(1)]));
    expect(q('.elle-question').dataset.state).toBeUndefined();
    expect(container.querySelector('.elle-question-state')).toBeNull();
    for (const state of QUESTION_STATES) expect(q('.elle-question').textContent).not.toContain(state);
    expect(q('.elle-question .elle-none').textContent).toBe('Not worked yet.');
  });

  it('a closed question leaves the grey box', async () => {
    await mount(stub([question(1, { open: false, closed: 'answered', state: 'answer' }), question(2)]));
    expect(texts('.elle-question-name')).toEqual(['Is it so: Darren loves thing 2?']);
  });

  it('a candidate the connector opened a question for shows once, as its folder', async () => {
    await mount(stub([question(1)], [lesson('c1', 'Darren loves thing 1', 'candidate'), lesson('c2', 'Darren may dislike jazz', 'candidate')]));
    expect(texts('.elle-grey .elle-question-name')).toEqual(['Is it so: Darren loves thing 1?']);
    expect(texts('.elle-grey .elle-lesson .elle-detail')).toEqual(['Darren may dislike jazz']);
    expect(q('.elle-grey .elle-label').textContent).toBe('grey box · 2 open questions');
  });

  it('a failed questions read says so in the grey box; the lessons still show', async () => {
    const adapter = createRecordStub([], {
      fetchLessons: async () => ({ ok: true, data: [lesson('l1', 'Darren writes at night', 'promoted')] }),
      fetchQuestions: async () => ({ ok: false, error: 'Connector unreachable: refused' }),
    });
    await mount(adapter);
    expect(q('.elle-grey .error-state').textContent).toBe('Connector unreachable: refused');
    expect(texts('.elle-answered .elle-detail')).toEqual(['Darren writes at night']);
  });

  it('the case files still group by subject; a book subject gets no question folder', async () => {
    await mount(stub([], [lesson('b1', 'chapter seven is about the trial', 'promoted', 'frankenstein-chapter-7'),
      lesson('m1', 'Darren loves prog rock', 'promoted', 'music')]));
    expect(texts('.elle-file-head')).toEqual(['frankenstein-chapter-7 · 1', 'music · 1']);
    expect(container.querySelector('.elle-question')).toBeNull();
  });

  it('no grid: no table, no column header, no resize edge anywhere on the page', async () => {
    await mount(stub([question(1, { state: 'opinion', ideas: ['x'] })], [lesson('l1', 'y', 'promoted', 's')]));
    expect(container.querySelector('table, th, [role="columnheader"], [role="grid"], .col-grip')).toBeNull();
  });
});

describe('the record lists ELLE question folders as hers', () => {
  it('the left column never shows a question folder as a subject', async () => {
    window.history.replaceState({}, '', '/chat');
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(stub([], [], [makeEntry({ id: 'f', subject: 'elle-question-1' }), makeEntry({ id: 't', subject: 'turn' })]), container, createModelsStub());
    for (let i = 0; i < 6; i++) await tick();
    expect(container.querySelector('.left-folders')!.textContent).not.toContain('elle-question');
  });
});

describe('the questions are read on every turn', () => {
  const quietTurn = (message: string) => ({
    message, known: true, step: null, total_steps: 0,
    engines: {
      arche: { reply: 'a reply' }, erie: null, elle: null, elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
    },
  });

  it('a new turn re-reads the questions, even when ELLE recorded or promoted nothing', async () => {
    let reads = 0;
    let lessonReads = 0;
    const states: Array<Question['state']> = ['rumor', 'suspicion'];
    const adapter = createRecordStub([], {
      fetchLessons: async () => { lessonReads++; return { ok: true, data: [] }; },
      fetchQuestions: async () => {
        const state = states[Math.min(reads, states.length - 1)];
        reads++;
        return { ok: true, data: { questions: [question(1, { state })], reasoning: null } };
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    const log = new ChatLog();
    view = new LessonsView(adapter, log);
    view.mount(container);
    for (let i = 0; i < 4; i++) await tick();
    expect(reads).toBe(1);
    expect(q('.elle-question-state').textContent).toBe('rumor');
    log.push(quietTurn('quiet') as never);
    for (let i = 0; i < 4; i++) await tick();
    expect(reads).toBe(2);
    expect(lessonReads).toBe(1);
    expect(q('.elle-question-state').textContent).toBe('suspicion');
  });

  it('no open question says so in words, apart from the lessons line', async () => {
    await mount(stub([question(1, { open: false, closed: 'answered' })], [lesson('ev-1', 'Darren likes tea', 'candidate')]));
    expect(q('.elle-grey .elle-no-questions').textContent).toBe('No question is open.');
    expect(container.querySelector('.elle-grey .elle-question')).toBeNull();
    expect(container.querySelector('.elle-grey')!.textContent).not.toContain('Nothing is held.');
  });
});

describe('the reasoning under the folders', () => {
  const withReasoning = (reasoning: string | null, lessons: Lesson[] = []): SeamAdapter =>
    createRecordStub([makeEntry({ id: 'x' })], {
      fetchLessons: async () => ({ ok: true, data: lessons }),
      fetchQuestions: async () => ({ ok: true, data: { questions: [question(1), question(2)], reasoning } }),
    });

  it('shows the last sectioned request verbatim, under the folders', async () => {
    const sent = '[QUESTION elle-question-1]\nIs it so?\n\n[QUESTION elle-question-2]\nAnd this?';
    await mount(withReasoning(sent, [lesson('ev-9', 'Darren writes at night', 'candidate')]));
    const pre = q('.elle-grey .elle-reasoning-text');
    expect(pre.tagName).toBe('PRE');
    expect(pre.textContent).toBe(sent);
    const kids = [...q('.elle-grey .elle-box-body').children];
    const at = kids.indexOf(q('.elle-grey .elle-reasoning'));
    const folders = kids.filter((n) => n.classList.contains('elle-question'));
    expect(folders.every((f) => kids.indexOf(f) < at)).toBe(true);
    expect(folders).toHaveLength(2);
    // The held lesson still shows, after the reasoning.
    expect(at).toBe(kids.length - 2);
    expect(kids[kids.length - 1].textContent).toContain('Darren writes at night');
  });

  it('no reasoning from the connector shows none', async () => {
    await mount(withReasoning(null));
    expect(container.querySelector('.elle-reasoning')).toBeNull();
  });
});
