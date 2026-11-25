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

/**
 * `ownEntries`, when given, is the folder's own entries (a Curator folder's case
 * file: the turns it was read from, whatever their subject); otherwise the
 * entries whose subject is `subject`.
 */
export function renderFolder(subject: string, entries: Entry[], lessons: Lesson[], ownEntries?: Entry[]): HTMLElement {
  const folder = el('section', 'subject-folder');
  folder.dataset.subject = subject;
  folder.appendChild(el('h3', 'folder-subject', subject));

  const mine = [...(ownEntries ?? entries.filter((e) => e.subject === subject))].sort(compareKStart);
  const value = el('p', 'folder-authority');
  // No label: it said the same thing on every card ('authority of latest
  // entry'), which is noise. The number and its history are the content.
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
 * What a group head shows. The part of a name that is the same on every group
 * in the record carries no information in the left column, so the head shows
 * only what differs: the name with the shared prefix cut off. The cut stops
 * at a '-' so a name is never cut mid-word, and a shared prefix shorter than
 * 4 chars is not worth cutting. The full name stays on hover (title) and in
 * `data-group`; only the visible head text changes. With one group there is
 * nothing shared to cut.
 *
 * A prefix shared with only some groups still hides what differs between
 * those groups: two biographies both read "biography-…". So a second pass
 * cuts a prefix shared with any other group too, but only when what is left
 * is a real word, at least 4 chars with a letter in it, so a numbered group
 * never collapses to its number ("chapter-1" stays "chapter-1", never "1").
 *
 * A group that shares nothing worth cutting with any other group (a turn
 * recorded under 'turn') keeps its full name, and it does not hold the cut
 * back for the rest: the shared prefix is taken across the groups that do
 * share, so the chapters still read 'chapter-1' instead of the whole name.
 */
export function displayGroupName(name: string, all: string[]): string {
  if (all.length < 2) return name;
  const sharedLen = (a: string, b: string): number => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  const kept = all.filter((n) => all.some((o) => o !== n && sharedLen(n, o) >= 4));
  if (!kept.includes(name)) return name;
  // The prefix shared by every kept group, cut at a '-'.
  const globalTail = (n: string): string => {
    let shared = kept[0]!;
    for (const other of kept.slice(1)) {
      let i = 0;
      while (i < shared.length && i < other.length && shared[i] === other[i]) i++;
      shared = shared.slice(0, i);
      if (shared === '') break;
    }
    const cut = shared.lastIndexOf('-');
    const prefix = cut >= 0 ? shared.slice(0, cut + 1) : '';
    if (prefix.length < 4) return n;
    const tail = n.slice(prefix.length);
    return tail === '' ? n : tail;
  };
  let tail = globalTail(name);
  // Second pass: a prefix shared with only some groups.
  let best = '';
  for (const other of kept) {
    if (other === name) continue;
    const ot = globalTail(other);
    let i = 0;
    while (i < tail.length && i < ot.length && tail[i] === ot[i]) i++;
    const shared = tail.slice(0, i);
    if (shared.length > best.length) best = shared;
  }
  const cut = best.lastIndexOf('-');
  const prefix = cut >= 0 ? best.slice(0, cut + 1) : '';
  if (prefix.length >= 4) {
    const rest = tail.slice(prefix.length);
    if (rest.length >= 4 && /[a-zA-Z]/.test(rest)) tail = rest;
  }
  return tail;
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
