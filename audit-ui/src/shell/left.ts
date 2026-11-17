import type { SeamAdapter, Entry } from '../adapter/seam.ts';
import type { Panel } from './panel.ts';
import { createNav } from '../views/nav.ts';
import { compareKStart } from '../util/interval.ts';

interface Folder {
  /** Account id, or the whole subject when it has no '.'. */
  name: string;
  count: number;
  href: string;
}

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

/** One folder per account (subject prefix before the first '.'). */
function foldersOf(entries: Entry[]): Folder[] {
  const groups = new Map<string, { entries: Entry[]; dotted: boolean }>();
  for (const e of entries) {
    const dot = e.subject.indexOf('.');
    const name = dot === -1 ? e.subject : e.subject.slice(0, dot);
    const g = groups.get(name) ?? { entries: [], dotted: dot !== -1 };
    g.entries.push(e);
    g.dotted = g.dotted || dot !== -1;
    groups.set(name, g);
  }
  const folders: Folder[] = [];
  for (const [name, g] of groups) {
    let href: string;
    if (g.dotted) {
      href = `/record/${encodeURIComponent(name)}`;
    } else {
      const latest = [...g.entries].sort((a, b) => compareKStart(b, a))[0]!;
      href = entryHref(latest);
    }
    folders.push({ name, count: g.entries.length, href });
  }
  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Left column: destinations nav (with the MOCK label), the record's folders
 * per account, and the Calendar / Time Travel "going back" links. Stays
 * mounted across navigation; the Router refreshes it.
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
    void this.adapter.fetchAllEntries().then((result) => {
      if (token !== this.requestToken || this.folderBody !== folderBody) return;
      if (!result.ok) {
        folderBody.replaceChildren(el('p', 'error-state', result.error));
        return;
      }
      if (result.data.length === 0) {
        folderBody.replaceChildren(el('p', 'empty-state', 'No entries in the record.'));
        return;
      }
      const ul = el('ul', 'folder-list');
      for (const f of foldersOf(result.data)) {
        const li = el('li', 'folder');
        li.appendChild(link(f.href, f.name));
        li.appendChild(el('span', 'folder-count', ` (${f.count})`));
        ul.appendChild(li);
      }
      folderBody.replaceChildren(ul);
    });
  }

  unmount(): void {
    this.requestToken++;
    if (this.slot) this.slot.replaceChildren();
    this.slot = null;
    this.folderBody = null;
    this.navHost = null;
  }

}
