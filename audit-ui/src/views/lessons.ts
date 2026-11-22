import type { Lesson, SeamAdapter } from '../adapter/seam.ts';
import type { ChatLog } from './chat-log.ts';

/**
 * The ELLE page (Lessons): what she is working on.
 *
 * (a) case files: her lessons grouped by subject (a lesson with no
 *     subject is unfiled, never forced into a folder),
 * (b) grey box: the candidate and held lessons, grey, not yet promoted:
 *     the open questions she is working on (the weight is the flag),
 * (c) answered: the promoted lessons, learned, with the turn that
 *     promoted them when the chat log carries it,
 * (d) per turn: what she recorded and promoted on each chat turn.
 *
 * Only the seam's own shapes: no case-file object, no greybox system, no
 * partially-answered state is invented. Empty sections say so in words.
 */

export const ELLE_NAME = 'ELLE';
/**
 * ELLE's expansion, in Darren's words. Not supplied yet: until it is, the
 * header shows ELLE alone. Never fill this with invented words.
 */
export const ELLE_EXPANSION: string | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** One labelled box; its body scrolls inside it, never the page. */
function box(cls: string): { section: HTMLElement; label: HTMLElement; body: HTMLElement } {
  const section = el('section', `elle-box ${cls}`);
  const label = el('p', 'elle-label');
  const body = el('div', 'elle-box-body');
  section.append(label, body);
  return { section, label, body };
}

/** A lesson as the seam sent it: every field, verbatim. Candidates read grey. */
export function renderLesson(l: Lesson, note?: string): HTMLElement {
  const dl = el('dl', `elle-lesson ${l.status === 'promoted' ? 'is-promoted' : 'is-grey'}`);
  dl.dataset.eventId = l.event_id;
  const rows: Array<[string, string]> = [
    ['detail', l.detail],
    ['rule', l.rule ?? 'null'],
    ['subject', l.subject ?? 'null'],
    ['status', l.status],
    ['event_type', l.event_type],
    ['event_id', l.event_id],
  ];
  for (const [k, v] of rows) {
    const row = el('div', 'elle-field');
    row.append(el('dt', '', k), el('dd', `elle-${k}`, v));
    dl.appendChild(row);
  }
  if (note) {
    const row = el('div', 'elle-field');
    row.append(el('dt', '', 'turn'), el('dd', 'elle-note', note));
    dl.appendChild(row);
  }
  return dl;
}

/**
 * Lessons by event id, in first-seen order. A promoted copy replaces a
 * candidate one (promotion is a later event on the same lesson).
 */
export function unique(lists: Lesson[][]): Lesson[] {
  const seen = new Map<string, Lesson>();
  for (const l of lists.flat()) {
    const had = seen.get(l.event_id);
    if (!had || (had.status !== 'promoted' && l.status === 'promoted')) seen.set(l.event_id, l);
  }
  return [...seen.values()];
}

/** Subject -> lessons, in first-seen order; null subjects go under `null` (unfiled). */
export function caseFiles(lessons: Lesson[]): Array<[string | null, Lesson[]]> {
  const files = new Map<string | null, Lesson[]>();
  for (const l of lessons) {
    const list = files.get(l.subject);
    if (list) list.push(l);
    else files.set(l.subject, [l]);
  }
  // Filed subjects first, the unfiled pile last.
  return [...files.entries()].sort(([a], [b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0));
}

export class LessonsView {
  private adapter: SeamAdapter;
  private log: ChatLog;
  private container: HTMLElement | null = null;
  private files: ReturnType<typeof box> | null = null;
  private grey: ReturnType<typeof box> | null = null;
  private answered: ReturnType<typeof box> | null = null;
  private turns: ReturnType<typeof box> | null = null;
  /** The last lessons read: null until the first read settles. */
  private read: { ok: true; data: Lesson[] } | { ok: false; error: string } | null = null;
  private unsubscribe: (() => void) | null = null;
  private token = 0;

  constructor(adapter: SeamAdapter, log: ChatLog) {
    this.adapter = adapter;
    this.log = log;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    const page = el('div', 'elle-page');
    const head = el('header', 'elle-head');
    head.appendChild(el('h1', 'elle-name', ELLE_NAME));
    if (ELLE_EXPANSION !== null) head.appendChild(el('p', 'elle-expansion', ELLE_EXPANSION));
    const body = el('div', 'view-body elle-view');
    body.dataset.view = 'Lessons';
    this.files = box('elle-files');
    this.grey = box('elle-grey');
    this.answered = box('elle-answered');
    this.turns = box('elle-turns');
    body.append(this.files.section, this.grey.section, this.answered.section, this.turns.section);
    page.append(head, body);
    container.appendChild(page);
    this.unsubscribe = this.log.subscribe(() => {
      this.render();
      void this.load();
    });
    this.render();
    void this.load();
  }

  private async load(): Promise<void> {
    const token = ++this.token;
    let r: { ok: true; data: Lesson[] } | { ok: false; error: string };
    try {
      r = await this.adapter.fetchLessons();
    } catch (e) {
      r = { ok: false, error: `The lessons read failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (token !== this.token || this.container === null) return;
    this.read = r;
    this.render();
  }

  private render(): void {
    const { files, grey, answered, turns } = this;
    if (!files || !grey || !answered || !turns) return;
    const log = this.log.turns();
    this.renderTurns(turns, log);

    const read = this.read;
    if (read === null || !read.ok) {
      const words = read === null ? 'Reading the lessons...' : read.error;
      const cls = read === null ? 'prompt-state' : 'error-state';
      files.label.textContent = 'case files';
      grey.label.textContent = 'grey box';
      answered.label.textContent = 'answered';
      for (const b of [files, grey, answered]) b.body.replaceChildren(el('p', cls, words));
      return;
    }

    // Every lesson she holds: the connector's read, then any the chat log carries.
    const fromLog = log.flatMap((t) => [
      ...t.engines.lessons_in_prompt.injected,
      ...t.engines.lessons_in_prompt.held,
      ...(t.engines.elle ? [t.engines.elle] : []),
      ...(t.engines.elle_promoted ? [t.engines.elle_promoted] : []),
    ]);
    const all = unique([read.data, fromLog]);
    const open = all.filter((l) => l.status !== 'promoted');
    const learned = all.filter((l) => l.status === 'promoted');

    // (a) case files.
    const filed = caseFiles(all);
    const subjects = filed.filter(([s]) => s !== null).length;
    files.label.textContent = `case files · ${plural(subjects, 'subject', 'subjects')} · ${plural(all.length, 'lesson', 'lessons')}`;
    files.body.replaceChildren(
      ...(all.length === 0
        ? [el('p', 'empty-state', 'No lessons yet.')]
        : filed.map(([subject, lessons]) => {
            const folder = el('section', `elle-file${subject === null ? ' is-unfiled' : ''}`);
            folder.dataset.subject = subject ?? '';
            folder.appendChild(el('p', 'elle-file-head', `${subject ?? 'unfiled'} · ${lessons.length}`));
            for (const l of lessons) folder.appendChild(renderLesson(l));
            return folder;
          })),
    );

    // (b) grey box: held, not yet promoted.
    grey.label.textContent = `grey box · ${plural(open.length, 'open question', 'open questions')}`;
    grey.body.replaceChildren(
      ...(open.length === 0
        ? [el('p', 'empty-state', 'Nothing is held. No lesson is waiting to be promoted.')]
        : open.map((l) => renderLesson(l))),
    );

    // (c) answered: promoted, with the turn that promoted it.
    const promotedOn = new Map<string, number>();
    log.forEach((t, i) => {
      const p = t.engines.elle_promoted;
      if (p && !promotedOn.has(p.event_id)) promotedOn.set(p.event_id, i + 1);
    });
    answered.label.textContent = `answered · ${plural(learned.length, 'lesson', 'lessons')} learned`;
    answered.body.replaceChildren(
      ...(learned.length === 0
        ? [el('p', 'empty-state', 'No lesson is learned yet.')]
        : learned.map((l) => {
            const n = promotedOn.get(l.event_id);
            return renderLesson(l, n === undefined ? undefined : `promoted on turn ${n}`);
          })),
    );
  }

  /** (d) per turn: what she recorded and what she promoted. */
  private renderTurns(turns: ReturnType<typeof box>, log: ReturnType<ChatLog['turns']>): void {
    turns.label.textContent = `per turn · ${plural(log.length, 'turn', 'turns')}`;
    if (log.length === 0) {
      turns.body.replaceChildren(el('p', 'empty-state', 'No chat turns in this session yet.'));
      return;
    }
    turns.body.replaceChildren(
      ...log.map((t, i) => {
        const article = el('article', 'elle-turn');
        article.appendChild(el('p', 'elle-turn-head', `turn ${i + 1}`));
        const { elle, elle_promoted: promoted } = t.engines;
        if (elle === null && promoted === null) {
          article.dataset.state = 'none';
          article.appendChild(el('p', 'elle-none', 'No action'));
          return article;
        }
        if (elle !== null) {
          article.appendChild(el('p', 'elle-sub', 'recorded'));
          article.appendChild(renderLesson(elle));
        }
        if (promoted !== null) {
          article.appendChild(el('p', 'elle-sub', 'promoted'));
          article.appendChild(renderLesson(promoted));
        }
        return article;
      }),
    );
  }

  unmount(): void {
    this.token++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.files = this.grey = this.answered = this.turns = null;
    this.read = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
