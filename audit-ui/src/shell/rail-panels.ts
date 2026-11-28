import type { Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import type { Panel } from './panel.ts';
import { compareKStart } from '../util/interval.ts';
import { compareNatural } from '../util/natural.ts';
import { groupOf, renderLesson } from './subject-folders.ts';
import { isWorkspace } from '../util/curator.ts';

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
    ] as const) {
      const li = el('li', '');
      li.appendChild(link(href, text));
      ul.appendChild(li);
    }
    views.appendChild(ul);
    const records = el('section', 'list-section');
    records.appendChild(el('h2', '', 'Records'));
    this.body = el('div', 'audit-records');
    this.body.appendChild(el('p', 'prompt-state', 'Reading the record...'));
    records.appendChild(this.body);
    slot.replaceChildren(views, records);
    this.refresh();
  }

  refresh(): void {
    const body = this.body;
    if (!body) return;
    const token = ++this.token;
    void this.adapter.fetchAllEntries().then(
      (r) => {
        if (token !== this.token || this.body !== body) return;
        if (!r.ok) {
          body.replaceChildren(el('p', 'error-state', r.error));
          return;
        }
        body.replaceChildren(...renderRecords(r.data));
      },
      (e: unknown) => {
        if (token === this.token && this.body === body) body.replaceChildren(el('p', 'error-state', failed('record', e)));
      },
    );
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
    if (isWorkspace(e)) continue; // listed on the Curator and Lessons pages
    const g = groupOf(e.subject);
    counts.set(g, [...(counts.get(g) ?? []), e]);
  }
  if (counts.size === 0) return [total];
  const ul = el('ul', 'left-links audit-accounts');
  const latestOf = (name: string): Entry => [...counts.get(name)!].sort((a, b) => compareKStart(b, a))[0]!;
  // Newest first: the few most recent show, the rest wait behind one control.
  const names = [...counts.keys()].sort((a, b) => compareKStart(latestOf(b), latestOf(a)) || compareNatural(a, b));
  names.forEach((name, i) => {
    const mine = counts.get(name)!;
    const li = el('li', i < RECORDS_SHOWN ? '' : 'is-more');
    if (i >= RECORDS_SHOWN) li.hidden = true;
    // An account with dotted subjects has a record view; a lone subject opens its latest entry.
    const latest = latestOf(name);
    const href = mine.some((e) => e.subject.includes('.'))
      ? `/record/${encodeURIComponent(name)}`
      : `/entry/${latest.kid}/${encodeURIComponent(latest.subject)}/${encodeURIComponent(latest.id)}`;
    li.append(link(href, name), el('span', 'folder-count', ` (${mine.length})`));
    ul.appendChild(li);
  });
  if (names.length <= RECORDS_SHOWN) return [total, ul];
  const more = el('button', 'list-more', `Show all ${names.length}`);
  more.type = 'button';
  more.setAttribute('aria-expanded', 'false');
  more.addEventListener('click', () => {
    const open = more.getAttribute('aria-expanded') !== 'true';
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? 'Show fewer' : `Show all ${names.length}`;
    for (const li of ul.querySelectorAll<HTMLElement>('.is-more')) li.hidden = !open;
  });
  return [total, ul, more];
}

/** How many records the Audit list shows before its Show all control. */
const RECORDS_SHOWN = 5;

/** Research: the corpus views (overview, nouns, graph). Asking goes through the chat on the right, not a search box here (Darren, Nov 27). */
export class ResearchPanel implements Panel {
  mount(slot: HTMLElement): void {
    const box = el('section', 'list-section');
    box.appendChild(el('h2', '', 'Knowledge'));
    const views = el('ul', 'left-links research-corpus');
    for (const [href, text] of [['/research/overview', 'Corpus overview'], ['/research/nouns', 'Nouns'], ['/research/graph', 'Graph']] as const) {
      const li = el('li', '');
      li.appendChild(link(href, text));
      views.appendChild(li);
    }
    box.append(views);
    slot.replaceChildren(box);
  }

  refresh(): void {}

  unmount(): void {}
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
    this.body.appendChild(el('p', 'prompt-state', 'Reading the lessons...'));
    box.appendChild(this.body);
    slot.replaceChildren(box);
    this.refresh();
  }

  refresh(): void {
    const body = this.body;
    if (!body) return;
    const token = ++this.token;
    void this.adapter.fetchLessons().then(
      (r) => {
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
      },
      (e: unknown) => {
        if (token === this.token && this.body === body) body.replaceChildren(el('p', 'error-state', failed('lessons', e)));
      },
    );
  }

  unmount(): void {
    this.token++;
    this.body = null;
  }
}

/** A thrown read, in words. */
function failed(what: string, e: unknown): string {
  return `The ${what} read failed: ${e instanceof Error ? e.message : String(e)}`;
}

/** Learned (promoted) lessons first; the order within each group is the connector's. */
export function promotedFirst(lessons: Lesson[]): Lesson[] {
  return [...lessons.filter((l) => l.status === 'promoted'), ...lessons.filter((l) => l.status !== 'promoted')];
}
