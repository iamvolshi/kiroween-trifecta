import type { AdapterResult, CuratorAnswer, Entry, SeamAdapter } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';
import { catalog, type CuratorFolder } from '../util/curator.ts';

/**
 * The Curator page: the tool that files the record into subject folders.
 * Not an engine and not a persona. It lists Curator's folders as the record
 * holds them (each folder's KID, its case file by KID, its versions), and
 * points to the data: every KID links to its entry. The chat at the foot
 * asks POST /curator/ask, ERIE over the folders only: no model, no voice.
 */

export const CURATOR_NAME = 'Curator';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function entryLink(e: Entry, cls: string): HTMLAnchorElement {
  const a = el('a', cls, renderKid(e.kid));
  a.setAttribute('href', `/entry/${e.kid}/${encodeURIComponent(e.subject)}/${encodeURIComponent(e.id)}`);
  return a;
}

/** One folder: subject, its KID, the count, the case file by KID, its versions. */
export function renderFolder(f: CuratorFolder): HTMLElement {
  const box = el('section', 'curator-folder');
  box.dataset.subject = f.subject;
  const head = el('p', 'curator-folder-head');
  head.append(
    el('span', 'curator-subject', f.subject),
    el('span', 'curator-key', 'KID'),
    entryLink(f.folder, 'kid curator-folder-kid'),
    el('span', 'curator-count', plural(f.caseFile.length, 'entry', 'entries')),
  );
  if (f.versions.length > 1) head.appendChild(el('span', 'curator-versions', `filed ${f.versions.length} times`));
  box.appendChild(head);
  const files = el('p', 'curator-case-file');
  files.appendChild(el('span', 'curator-key', 'case file'));
  if (f.caseFile.length === 0) files.appendChild(el('span', 'curator-none', 'No entries under this subject.'));
  for (const e of f.caseFile) files.appendChild(entryLink(e, 'kid'));
  box.appendChild(files);
  return box;
}

/** One question and its answer, verbatim from the catalog, or cannot-answer. */
export function renderAnswer(question: string, r: AdapterResult<CuratorAnswer>): HTMLElement {
  const turn = el('article', 'curator-turn');
  turn.appendChild(el('p', 'curator-question', question));
  if (!r.ok) {
    turn.appendChild(el('p', 'error-state', r.error));
    return turn;
  }
  if (!r.data.found) {
    turn.dataset.state = 'not_found';
    turn.appendChild(el('p', 'curator-cannot', 'The catalog does not say.'));
    return turn;
  }
  turn.dataset.state = 'found';
  turn.appendChild(el('pre', 'curator-answer', r.data.text));
  const list = el('ol', 'curator-provenance');
  for (const p of r.data.provenance) {
    const li = el('li', '');
    li.append(el('span', 'curator-source', p.source), el('span', 'curator-content', p.content));
    list.appendChild(li);
  }
  turn.appendChild(list);
  return turn;
}

export class CuratorView {
  private adapter: SeamAdapter;
  private container: HTMLElement | null = null;
  private folders: HTMLElement | null = null;
  private label: HTMLElement | null = null;
  private transcript: HTMLElement | null = null;
  private token = 0;
  private askToken = 0;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    const page = el('div', 'curator-page');
    const head = el('header', 'curator-head');
    head.appendChild(el('h1', 'curator-name', CURATOR_NAME));
    const body = el('div', 'view-body curator-view');
    body.dataset.view = 'Curator';

    const box = el('section', 'curator-box curator-catalog');
    this.label = el('p', 'curator-label', 'folders');
    this.folders = el('div', 'curator-box-body');
    this.folders.appendChild(el('p', 'prompt-state', 'Reading the record...'));
    box.append(this.label, this.folders);

    const chat = el('section', 'curator-box curator-chat');
    chat.appendChild(el('p', 'curator-label', 'ask the catalog'));
    this.transcript = el('div', 'curator-box-body curator-transcript');
    this.transcript.setAttribute('aria-live', 'polite');
    const form = el('form', 'curator-composer');
    const label = el('label', 'sr-only', 'Ask the catalog');
    label.setAttribute('for', 'curator-q');
    const input = el('input', '');
    input.type = 'text';
    input.id = 'curator-q';
    input.autocomplete = 'off';
    input.placeholder = 'Ask the catalog';
    const send = el('button', 'curator-send', 'Ask');
    send.type = 'submit';
    form.append(label, input, send);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (q === '') return;
      input.value = '';
      void this.ask(q);
    });
    chat.append(this.transcript, form);

    body.append(box, chat);
    page.append(head, body);
    container.appendChild(page);
    void this.load();
  }

  private async load(): Promise<void> {
    const out = this.folders;
    const label = this.label;
    if (!out || !label) return;
    const token = ++this.token;
    let r: AdapterResult<Entry[]>;
    try {
      r = await this.adapter.fetchAllEntries();
    } catch (e) {
      r = { ok: false, error: `The record read failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (token !== this.token || this.folders !== out) return;
    if (!r.ok) return void out.replaceChildren(el('p', 'error-state', r.error));
    const folders = catalog(r.data);
    label.textContent = `folders · ${plural(folders.length, 'subject', 'subjects')}`;
    out.replaceChildren(
      ...(folders.length === 0
        ? [el('p', 'empty-state', 'Curator has filed no folders yet.')]
        : folders.map(renderFolder)),
    );
  }

  private async ask(question: string): Promise<void> {
    const out = this.transcript;
    if (!out) return;
    const token = ++this.askToken;
    const pending = el('p', 'prompt-state', 'Asking the catalog...');
    out.appendChild(pending);
    let r: AdapterResult<CuratorAnswer>;
    try {
      r = await this.adapter.curatorAsk(question);
    } catch (e) {
      r = { ok: false, error: `The catalog query failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (this.transcript !== out) return;
    pending.replaceWith(renderAnswer(question, r));
    if (token === this.askToken) out.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  unmount(): void {
    this.token++;
    this.askToken++;
    this.folders = this.label = this.transcript = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
