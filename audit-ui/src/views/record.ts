import type { View } from '../router/router.ts';
import type { SeamAdapter, Entry } from '../adapter/seam.ts';
import { createEntryGrid } from './entry-grid.ts';
import { renderCardDetails } from './record-card.ts';
import { createIntro } from './intro.ts';
import { compareKStart } from '../util/interval.ts';
import { compareNatural } from '../util/natural.ts';

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

/** The record for one account: entries per subject, oldest k_start first. */
export class RecordView implements View {
  private adapter: SeamAdapter;
  private accountId: string;
  private container: HTMLElement | null = null;
  private body: HTMLElement | null = null;

  constructor(adapter: SeamAdapter, accountId: string) {
    this.adapter = adapter;
    this.accountId = accountId;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    container.appendChild(el('h1', '', `Record: ${this.accountId}`));
    const intro = createIntro('record');
    if (intro) container.appendChild(intro);
    const body = el('div', 'view-body record-view');
    this.body = body;
    container.appendChild(body);
    void this.load(body);
  }

  private async load(body: HTMLElement): Promise<void> {
    const recordResult = await this.adapter.fetchRecord(this.accountId);
    if (this.body !== body) return;

    if (!recordResult.ok) {
      body.replaceChildren(el('p', 'error-state', recordResult.error));
      return;
    }
    const subjects = Object.keys(recordResult.data.fields)
      .filter((s) => recordResult.data.fields[s]!.length > 0)
      .sort(compareNatural);
    if (subjects.length === 0) {
      body.replaceChildren(el('p', 'empty-state', 'No record entries for this account.'));
      return;
    }

    const nodes: HTMLElement[] = [];
    for (const subject of subjects) {
      const section = el('section', 'record-subject');
      section.appendChild(el('h2', '', subject));
      const entries: Entry[] = [...recordResult.data.fields[subject]!].sort(compareKStart);
      // Explorer columns (Darren, Nov 22); the KID links to Entry Detail.
      const grid = createEntryGrid(entries, {
        label: `Record: ${subject}`,
        list: 'record',
        timeFormat: 'stamp',
        details: renderCardDetails,
        idPrefix: `record-${subjects.indexOf(subject)}`,
      }).element;
      grid.classList.add('record-entries');
      section.appendChild(grid);
      nodes.push(section);
    }
    body.replaceChildren(...nodes);
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.body = null;
  }
}
