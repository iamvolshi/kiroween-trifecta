import type { Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import type { ChatLog } from '../views/chat-log.ts';
import type { Panel } from './panel.ts';
import { compareKStart } from '../util/interval.ts';

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderLesson(l: Lesson): HTMLElement {
  const promoted = l.status === 'promoted';
  const li = el('li', promoted ? 'lesson lesson-promoted' : 'lesson lesson-candidate');
  li.appendChild(el('span', 'lesson-status', promoted ? 'learned' : 'not learned yet'));
  li.appendChild(el('span', 'lesson-rule', l.rule ?? l.detail));
  return li;
}

function renderFolder(subject: string, entries: Entry[], lessons: Lesson[]): HTMLElement {
  const folder = el('section', 'subject-folder');
  folder.appendChild(el('h3', 'folder-subject', subject));

  const mine = entries.filter((e) => e.subject === subject).sort(compareKStart);
  const value = el('p', 'folder-authority');
  value.appendChild(el('span', 'folder-label', 'authority of latest entry: '));
  if (mine.length === 0) {
    value.appendChild(el('span', 'folder-value', '--'));
    value.appendChild(el('span', 'folder-history', 'no entry recorded'));
  } else {
    const latest = mine[mine.length - 1].authority;
    // Presentational hook: the CSS meter reads the same number, nothing else.
    folder.dataset.authority = String(latest);
    value.appendChild(el('span', 'folder-value', String(latest)));
    value.appendChild(
      el('span', 'folder-history', mine.map((e) => String(e.authority)).join(' -> ')),
    );
  }
  folder.appendChild(value);

  const own = lessons.filter((l) => l.subject === subject);
  if (own.length > 0) {
    const ul = el('ul', 'folder-lessons');
    for (const l of own) ul.appendChild(renderLesson(l));
    folder.appendChild(ul);
  }
  return folder;
}

/** Right column: Curator + ELLE as one worker. Everything derives from the seam and the log. */
export class TelemetryPanel implements Panel {
  private root: HTMLElement | null = null;
  private token = 0;
  private unsubscribe: (() => void) | null = null;
  private adapter: SeamAdapter;
  private log: ChatLog;

  constructor(adapter: SeamAdapter, log: ChatLog) {
    this.adapter = adapter;
    this.log = log;
  }

  mount(slot: HTMLElement): void {
    this.root = el('div', 'telemetry');
    slot.appendChild(this.root);
    this.unsubscribe = this.log.subscribe(() => this.refresh());
    this.render([], [], []);
    this.refresh();
  }

  refresh(): void {
    if (!this.root) return;
    const my = ++this.token;
    void (async () => {
      const [entries, lessons] = await Promise.all([
        this.adapter.fetchAllEntries(),
        this.adapter.fetchLessons(),
      ]);
      if (my !== this.token || !this.root) return;
      if (!entries.ok || !lessons.ok) {
        if (!entries.ok) this.renderError(entries.error);
        else if (!lessons.ok) this.renderError(lessons.error);
        return;
      }
      this.render(entries.data, lessons.data, this.log.turns());
    })();
  }

  unmount(): void {
    this.token++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root?.remove();
    this.root = null;
  }

  private renderError(message: string): void {
    if (!this.root) return;
    this.root.replaceChildren(el('h2', 'telemetry-heading', 'Curator + ELLE (mock)'));
    this.root.appendChild(el('p', 'error-state', message));
  }

  private render(entries: Entry[], lessons: Lesson[], turns: ReturnType<ChatLog['turns']>): void {
    const root = this.root;
    if (!root) return;
    root.replaceChildren(el('h2', 'telemetry-heading', 'Curator + ELLE (mock)'));

    // Subject folders: KATIE subjects from the log, then lesson subjects, first-seen order.
    const subjects: string[] = [];
    const see = (s: string | null): void => {
      if (s !== null && !subjects.includes(s)) subjects.push(s);
    };
    for (const t of turns) for (const u of t.engines.katie) see(u.subject);
    for (const l of lessons) see(l.subject);

    const folders = el('div', 'subject-folders');
    if (subjects.length === 0) {
      folders.appendChild(
        el('p', 'empty-state', 'No subjects yet. Folders appear as the conversation records them.'),
      );
    } else {
      for (const s of subjects) folders.appendChild(renderFolder(s, entries, lessons));
    }
    root.appendChild(folders);

    const unfiled = lessons.filter((l) => l.subject === null);
    if (unfiled.length > 0) {
      const box = el('div', 'lessons-unfiled-box');
      box.appendChild(el('h3', '', 'Lessons without a subject'));
      const ul = el('ul', 'lessons-unfiled');
      for (const l of unfiled) ul.appendChild(renderLesson(l));
      box.appendChild(ul);
      root.appendChild(box);
    }

    root.appendChild(this.renderFeed(entries, turns));
  }

  private renderFeed(entries: Entry[], turns: ReturnType<ChatLog['turns']>): HTMLElement {
    const box = el('div', 'katie-box');
    box.appendChild(el('h3', '', 'KATIE feed'));
    const feed = el('ul', 'katie-feed');
    let any = false;
    for (const t of [...turns].reverse()) {
      for (const u of [...t.engines.katie].reverse()) {
        any = true;
        const li = el('li', 'katie-item');
        const a = document.createElement('a');
        a.className = 'katie-link';
        a.setAttribute(
          'href',
          `/entry/${u.kid}/${encodeURIComponent(u.subject)}/${encodeURIComponent(u.entry_id)}`,
        );
        a.textContent = u.subject;
        li.appendChild(a);
        const entry = entries.find(
          (e) => e.id === u.entry_id && e.kid === u.kid && e.subject === u.subject,
        );
        li.appendChild(
          el('span', 'katie-evidence', entry ? entry.evidence : 'entry not visible'),
        );
        const step = t.step !== null ? ` (step ${t.step})` : '';
        li.appendChild(el('span', 'katie-from', `from: "${t.message}"${step}`));
        feed.appendChild(li);
      }
    }
    if (!any) box.appendChild(el('p', 'empty-state', 'KATIE has recorded nothing yet.'));
    box.appendChild(feed);
    return box;
  }
}
