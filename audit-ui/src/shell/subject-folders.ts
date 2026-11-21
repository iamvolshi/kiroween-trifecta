import type { Entry, Lesson } from '../adapter/seam.ts';
import { compareKStart } from '../util/interval.ts';

/**
 * Subject folders: one per subject, with the 0-9 authority of its latest
 * entry (and the 9-cell meter the CSS draws from that same number), the
 * authority history, and the lessons ELLE filed under that subject (grey
 * until learned, green once learned). Everything comes from the record
 * entries and the lessons the seam returns.
 */

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderLesson(l: Lesson): HTMLElement {
  const promoted = l.status === 'promoted';
  const li = el('li', promoted ? 'lesson lesson-promoted' : 'lesson lesson-candidate');
  li.appendChild(el('span', 'lesson-status', promoted ? 'learned' : 'not learned yet'));
  li.appendChild(el('span', 'lesson-rule', l.rule ?? l.detail));
  return li;
}

export function renderFolder(subject: string, entries: Entry[], lessons: Lesson[]): HTMLElement {
  const folder = el('section', 'subject-folder');
  folder.dataset.subject = subject;
  folder.appendChild(el('h3', 'folder-subject', subject));

  const mine = entries.filter((e) => e.subject === subject).sort(compareKStart);
  const value = el('p', 'folder-authority');
  const label = el('span', 'folder-label', 'authority of latest entry: ');
  label.title = 'authority of latest entry: ';
  value.appendChild(label);
  if (mine.length === 0) {
    value.appendChild(el('span', 'folder-value', '--'));
    value.appendChild(el('span', 'folder-history', 'no entry recorded'));
  } else {
    const latest = mine[mine.length - 1].authority;
    // Presentational hook: the CSS meter reads the same number, nothing else.
    folder.dataset.authority = String(latest);
    value.appendChild(el('span', 'folder-value', String(latest)));
    // The history sits on one line and ends in …; the full chain is on hover.
    const chain = mine.map((e) => String(e.authority)).join(' -> ');
    const history = el('span', 'folder-history', chain);
    history.title = chain;
    value.appendChild(history);
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

/** The account / project a subject belongs to: its prefix before the first '.'. */
export function groupOf(subject: string): string {
  const dot = subject.indexOf('.');
  return dot === -1 ? subject : subject.slice(0, dot);
}

/**
 * Subjects per group, from the record entries and the lessons, in the order
 * first seen. Nothing is named that the data did not name.
 */
export function subjectsByGroup(entries: Entry[], lessons: Lesson[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const see = (s: string | null): void => {
    if (s === null) return;
    const g = groupOf(s);
    const list = groups.get(g) ?? [];
    if (!list.includes(s)) list.push(s);
    groups.set(g, list);
  };
  for (const e of entries) see(e.subject);
  for (const l of lessons) see(l.subject);
  return groups;
}
