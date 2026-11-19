import type { Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import type { Panel } from './panel.ts';
import { compareKStart } from '../util/interval.ts';
import { groupOf, renderLesson } from './subject-folders.ts';

/**
 * The list panels the rail swaps in besides Chat (the left column, see
 * left.ts): Audit, Research and Lessons. Live data only: every count, name
 * and line comes from the connector; a failed read says so in words.
 */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = el('a', '', text);
  a.setAttribute('href', href);
  return a;
}

/** Audit: the record views, with the live entry count, and each account's record. */
export class AuditPanel implements Panel {
  private body: HTMLElement | null = null;
  private token = 0;

  private adapter: SeamAdapter;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(slot: HTMLElement): void {
    const views = el('section', 'list-section');
    views.appendChild(el('h2', '', 'Record views'));
    const ul = el('ul', 'left-links');
    for (const [href, text] of [
      ['/actions', 'Action List'],
      ['/calendar', 'Calendar'],
      ['/time-travel', 'Time Travel'],
    ] as const) {
      const li = el('li', '');
      li.appendChild(link(href, text));
      ul.appendChild(li);
    }
    views.appendChild(ul);
    const records = el('section', 'list-section');
    records.appendChild(el('h2', '', 'Records'));
    this.body = el('div', 'audit-records');
    records.appendChild(this.body);
    slot.replaceChildren(views, records);
    this.refresh();
  }

  refresh(): void {
    const body = this.body;
    if (!body) return;
    const token = ++this.token;
    void this.adapter.fetchAllEntries().then((r) => {
      if (token !== this.token || this.body !== body) return;
      if (!r.ok) {
        body.replaceChildren(el('p', 'error-state', r.error));
        return;
      }
      body.replaceChildren(...renderRecords(r.data));
    });
  }

  unmount(): void {
    this.token++;
    this.body = null;
  }
}

/** One line per account (subject prefix before the first '.'), its entry count, linking to its record. */
function renderRecords(entries: Entry[]): HTMLElement[] {
  const total = el('p', 'list-meta', `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} in the record`);
  const counts = new Map<string, Entry[]>();
  for (const e of entries) {
    const g = groupOf(e.subject);
    counts.set(g, [...(counts.get(g) ?? []), e]);
  }
  if (counts.size === 0) return [total];
  const ul = el('ul', 'left-links audit-accounts');
  for (const name of [...counts.keys()].sort((a, b) => a.localeCompare(b))) {
    const mine = counts.get(name)!;
    const li = el('li', '');
    // An account with dotted subjects has a record view; a lone subject opens its latest entry.
    const latest = [...mine].sort((a, b) => compareKStart(b, a))[0]!;
    const href = mine.some((e) => e.subject.includes('.'))
      ? `/record/${encodeURIComponent(name)}`
      : `/entry/${latest.kid}/${encodeURIComponent(latest.subject)}/${encodeURIComponent(latest.id)}`;
    li.append(link(href, name), el('span', 'folder-count', ` (${mine.length})`));
    ul.appendChild(li);
  }
  return [total, ul];
}

/** Research: ERIE's retrieval over the live record (POST /ask), each hit with its source name. */
export class ResearchPanel implements Panel {
  private results: HTMLElement | null = null;
  private token = 0;

  private adapter: SeamAdapter;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(slot: HTMLElement): void {
    const box = el('section', 'list-section');
    box.appendChild(el('h2', '', 'Knowledge'));
    const form = el('form', 'research-form');
    const label = el('label', 'sr-only', 'Search the knowledge');
    label.setAttribute('for', 'research-q');
    const input = el('input', '');
    input.type = 'search';
    input.id = 'research-q';
    input.autocomplete = 'off';
    input.placeholder = 'Search';
    const go = el('button', '', 'Search');
    go.type = 'submit';
    form.append(label, input, go);
    this.results = el('div', 'research-results');
    this.results.setAttribute('aria-live', 'polite');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q !== '') this.search(q);
    });
    box.append(form, this.results);
    slot.replaceChildren(box);
  }

  private search(question: string): void {
    const out = this.results;
    if (!out) return;
    const token = ++this.token;
    void this.adapter.ask(question).then((r) => {
      if (token !== this.token || this.results !== out) return;
      if (!r.ok) {
        out.replaceChildren(el('p', 'error-state', r.error));
        return;
      }
      if (r.data.provenance.length === 0) {
        out.replaceChildren(el('p', 'empty-state', 'Nothing found.'));
        return;
      }
      const ul = el('ul', 'research-hits');
      for (const p of r.data.provenance) {
        const li = el('li', 'research-hit');
        li.append(el('span', 'research-source', p.source), el('span', 'research-excerpt', p.excerpt));
        ul.appendChild(li);
      }
      out.replaceChildren(ul);
    });
  }

  refresh(): void {}

  unmount(): void {
    this.token++;
    this.results = null;
  }
}

/** Lessons: ELLE's lessons, live, learned ones first. */
export class LessonsPanel implements Panel {
  private body: HTMLElement | null = null;
  private token = 0;

  private adapter: SeamAdapter;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(slot: HTMLElement): void {
    const box = el('section', 'list-section');
    box.appendChild(el('h2', '', 'Lessons'));
    this.body = el('div', 'lessons-list');
    box.appendChild(this.body);
    slot.replaceChildren(box);
    this.refresh();
  }

  refresh(): void {
    const body = this.body;
    if (!body) return;
    const token = ++this.token;
    void this.adapter.fetchLessons().then((r) => {
      if (token !== this.token || this.body !== body) return;
      if (!r.ok) {
        body.replaceChildren(el('p', 'error-state', r.error));
        return;
      }
      if (r.data.length === 0) {
        body.replaceChildren(el('p', 'empty-state', 'No lessons yet.'));
        return;
      }
      const ul = el('ul', 'lessons-unfiled');
      for (const l of promotedFirst(r.data)) ul.appendChild(renderLesson(l));
      body.replaceChildren(ul);
    });
  }

  unmount(): void {
    this.token++;
    this.body = null;
  }
}

/** Learned (promoted) lessons first; the order within each group is the connector's. */
export function promotedFirst(lessons: Lesson[]): Lesson[] {
  return [...lessons.filter((l) => l.status === 'promoted'), ...lessons.filter((l) => l.status !== 'promoted')];
}
