import type { SeamAdapter, Entry, Lesson } from '../adapter/seam.ts';
import type { Panel } from './panel.ts';
import { createNav } from '../views/nav.ts';
import { compareKStart } from '../util/interval.ts';
import { groupOf, renderFolder, renderLesson, subjectsByGroup } from './subject-folders.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = el('a', '', text);
  a.setAttribute('href', href);
  return a;
}

function entryHref(e: Entry): string {
  return `/entry/${e.kid}/${encodeURIComponent(e.subject)}/${encodeURIComponent(e.id)}`;
}

/** Where a group's folder link goes: the account record, or the lone subject's latest entry. */
function groupHref(name: string, entries: Entry[]): string | null {
  const mine = entries.filter((e) => groupOf(e.subject) === name);
  if (mine.length === 0) return null;
  if (mine.some((e) => e.subject.includes('.'))) return `/record/${encodeURIComponent(name)}`;
  return entryHref([...mine].sort((a, b) => compareKStart(b, a))[0]!);
}

/**
 * Left column: destinations nav; the record, one group
 * per account / project (subject prefix) with its subject folders nested
 * inside (0-9 meter, history, lessons); any lessons without a subject; and
 * the Calendar / Time Travel "going back" links. Stays mounted across
 * navigation; the Router refreshes it after every navigation and chat turn.
 */
export class LeftPanel implements Panel {
  private adapter: SeamAdapter;
  private slot: HTMLElement | null = null;
  private folderBody: HTMLElement | null = null;
  private navHost: HTMLElement | null = null;
  private requestToken = 0;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(slot: HTMLElement): void {
    this.slot = slot;
    slot.replaceChildren();

    this.navHost = el('div', 'left-nav');
    slot.appendChild(this.navHost);

    const record = el('section', 'left-record');
    record.appendChild(el('h2', '', 'Record'));
    this.folderBody = el('div', 'left-folders');
    record.appendChild(this.folderBody);
    slot.appendChild(record);

    const back = el('section', 'left-back');
    back.appendChild(el('h2', '', 'Going back'));
    const ul = el('ul', 'left-links');
    for (const [href, text] of [
      ['/calendar', 'Calendar'],
      ['/time-travel', 'Time Travel'],
    ] as const) {
      const li = el('li', '');
      li.appendChild(link(href, text));
      ul.appendChild(li);
    }
    back.appendChild(ul);
    slot.appendChild(back);

    this.refresh();
  }

  refresh(): void {
    const slot = this.slot;
    const folderBody = this.folderBody;
    if (!slot || !folderBody || !this.navHost) return;

    // Mark the current destination right away; the folders follow the seam.
    this.navHost.replaceChildren(createNav(window.location.pathname));

    const token = ++this.requestToken;
    void Promise.all([this.adapter.fetchAllEntries(), this.adapter.fetchLessons()]).then(
      ([entries, lessons]) => {
        if (token !== this.requestToken || this.folderBody !== folderBody) return;
        const lessonData = lessons.ok ? lessons.data : [];
        if (!entries.ok) {
          // The whole-record read can be unavailable (on the live path it is not
          // in the connector contract yet). Folders still come from the lessons.
          if (lessonData.length === 0) {
            folderBody.replaceChildren(el('p', 'error-state', entries.error));
            return;
          }
          this.render(folderBody, [], lessonData);
          folderBody.prepend(el('p', 'prompt-state', `Record entries not available: ${entries.error}`));
          return;
        }
        // Lessons are optional here: a failed read leaves the folders without them.
        this.render(folderBody, entries.data, lessonData);
      },
    );
  }

  private render(body: HTMLElement, entries: Entry[], lessons: Lesson[]): void {
    const groups = subjectsByGroup(entries, lessons);
    if (groups.size === 0) {
      body.replaceChildren(
        el('p', 'empty-state', 'No subjects yet. Folders appear as the conversation records them.'),
      );
      return;
    }
    const ul = el('ul', 'folder-list');
    for (const name of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
      const li = el('li', 'folder');
      li.dataset.group = name;
      const head = el('div', 'folder-head');
      const href = groupHref(name, entries);
      head.appendChild(href ? link(href, name) : el('span', 'folder-name', name));
      const count = entries.filter((e) => groupOf(e.subject) === name).length;
      head.appendChild(el('span', 'folder-count', ` (${count})`));
      li.appendChild(head);
      const nested = el('div', 'group-subjects');
      for (const s of groups.get(name)!) {
        const folder = renderFolder(s, entries, lessons);
        // A subject with no '.' is its own group: keep its name for screen
        // readers but do not show it twice.
        if (s === name) folder.querySelector('.folder-subject')?.classList.add('sr-only');
        nested.appendChild(folder);
      }
      li.appendChild(nested);
      ul.appendChild(li);
    }
    const parts: HTMLElement[] = [ul];
    const unfiled = lessons.filter((l) => l.subject === null);
    if (unfiled.length > 0) {
      const box = el('div', 'lessons-unfiled-box');
      box.appendChild(el('h3', '', 'Lessons without a subject'));
      const list = el('ul', 'lessons-unfiled');
      for (const l of unfiled) list.appendChild(renderLesson(l));
      box.appendChild(list);
      parts.push(box);
    }
    body.replaceChildren(...parts);
  }

  unmount(): void {
    this.requestToken++;
    if (this.slot) this.slot.replaceChildren();
    this.slot = null;
    this.folderBody = null;
    this.navHost = null;
  }
}
