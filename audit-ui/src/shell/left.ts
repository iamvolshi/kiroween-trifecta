import type { SeamAdapter, Entry } from '../adapter/seam.ts';
import type { Panel } from './panel.ts';
import { compareKStart } from '../util/interval.ts';
import { compareNatural } from '../util/natural.ts';
import { groupOf } from './subject-folders.ts';
import { catalog, type CuratorFolder } from '../util/curator.ts';
import { mountRepoPanel } from '../views/repo-panel.ts';
import type { RepoSession } from '../views/repo-session.ts';

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
export function groupHref(name: string, entries: Entry[]): string | null {
  const mine = entries.filter((e) => groupOf(e.subject) === name);
  if (mine.length === 0) return null;
  if (mine.some((e) => e.subject.includes('.'))) return `/record/${encodeURIComponent(name)}`;
  return entryHref([...mine].sort((a, b) => compareKStart(b, a))[0]!);
}

/**
 * Where a Curator folder row goes. The folder name's destination: its
 * subject's record, or the lone subject's latest entry (groupHref). A
 * folder whose case file is turns the Curator read it from goes to the
 * newest of them; a folder with nothing in the record goes to its own entry.
 */
export function folderHref(f: CuratorFolder): string {
  const named = groupHref(f.subject, f.caseFile);
  if (named) return named;
  // The newest: latest k_start, and on a tie the later in record order.
  const latest = f.caseFile.reduce<Entry | undefined>((best, e) => (!best || compareKStart(e, best) >= 0 ? e : best), undefined);
  return entryHref(latest ?? f.folder);
}

/** A folder's 0-9 value: the authority of the latest entry in its case file, else the folder's own. */
function folderAuthority(f: CuratorFolder): number {
  const latest = [...f.caseFile].sort(compareKStart).at(-1);
  return (latest ?? f.folder).authority;
}

/**
 * Chat's list column (the Curator panel is the same without Going back): the Curator's folders, one compact row
 * each (subject, entry count, latest authority), the whole row a link; and
 * the Calendar "going back" link. Only subjects the Curator filed show: a
 * subject is in because a curator-folder-<subject> marker is in the record
 * (Darren, Nov 25), so the seed corpus never shows here. The full folder
 * cards live on the Curator page. Stays mounted across navigation; the
 * Router refreshes it after every navigation and chat turn.
 */
export class LeftPanel implements Panel {
  private adapter: SeamAdapter;
  private slot: HTMLElement | null = null;
  private folderBody: HTMLElement | null = null;
  private requestToken = 0;

  /** withBack false: the Curator icon's panel, the folder rows alone. */
  private withBack: boolean;

  /** The shared GitHub repo session: the Attach panel sits at the top of the column. null = no panel. */
  private repo: RepoSession | null;
  private stopRepoPanel: (() => void) | null = null;

  constructor(adapter: SeamAdapter, withBack = true, repo: RepoSession | null = null) {
    this.adapter = adapter;
    this.withBack = withBack;
    this.repo = repo;
  }

  mount(slot: HTMLElement): void {
    this.slot = slot;
    slot.replaceChildren();

    if (this.repo) {
      const repoSlot = el('section', 'repo-slot');
      repoSlot.setAttribute('aria-label', 'GitHub repo');
      slot.appendChild(repoSlot);
      this.stopRepoPanel = mountRepoPanel(repoSlot, this.repo);
    }

    const record = el('section', 'left-record');
    // The folders are Curator's work: it files the record into them (Darren, Nov 22).
    record.appendChild(el('h2', '', 'Curator'));
    this.folderBody = el('div', 'left-folders');
    record.appendChild(this.folderBody);
    slot.appendChild(record);

    const back = el('section', 'left-back');
    back.appendChild(el('h2', '', 'Going back'));
    const ul = el('ul', 'left-links');
    for (const [href, text] of [
      ['/calendar', 'Calendar Index'],
    ] as const) {
      const li = el('li', '');
      li.appendChild(link(href, text));
      ul.appendChild(li);
    }
    back.appendChild(ul);
    if (this.withBack) slot.appendChild(back);

    this.refresh();
  }

  refresh(): void {
    const slot = this.slot;
    const folderBody = this.folderBody;
    if (!slot || !folderBody) return;

    const token = ++this.requestToken;
    void this.adapter.fetchAllEntries().then(
      (entries) => {
        if (token !== this.requestToken || this.folderBody !== folderBody) return;
        if (!entries.ok) {
          folderBody.replaceChildren(el('p', 'error-state', entries.error));
          return;
        }
        this.render(folderBody, entries.data);
      },
      (e: unknown) => {
        // A read that throws (rather than answering an error) is still said in words.
        if (token !== this.requestToken || this.folderBody !== folderBody) return;
        folderBody.replaceChildren(el('p', 'error-state', `The record read failed: ${e instanceof Error ? e.message : String(e)}`));
      },
    );
  }

  private render(body: HTMLElement, entries: Entry[]): void {
    const folders = catalog(entries).sort((x, y) => compareNatural(x.subject, y.subject));
    if (folders.length === 0) {
      // The truth, in words: no folder is filed, and the seed is not a folder.
      body.replaceChildren(el('p', 'empty-state', 'No folders yet. Folders appear as the Curator files them.'));
      return;
    }
    const ul = el('ul', 'curator-rows');
    for (const f of folders) {
      const li = el('li', 'curator-row-item');
      const row = link(folderHref(f), '');
      row.className = 'curator-row';
      row.dataset.subject = f.subject;
      const authority = folderAuthority(f);
      row.dataset.authority = String(authority);
      const count = f.caseFile.length;
      row.setAttribute('aria-label', `${f.subject}, ${count} ${count === 1 ? 'entry' : 'entries'}, authority ${authority} of 9`);
      row.title = f.subject;
      row.append(
        el('span', 'curator-row-name', f.subject),
        el('span', 'curator-row-count', String(count)),
        el('span', 'curator-row-value', String(authority)),
      );
      li.appendChild(row);
      ul.appendChild(li);
    }
    body.replaceChildren(ul);
  }

  unmount(): void {
    this.requestToken++;
    this.stopRepoPanel?.();
    this.stopRepoPanel = null;
    if (this.slot) this.slot.replaceChildren();
    this.slot = null;
    this.folderBody = null;
  }
}
