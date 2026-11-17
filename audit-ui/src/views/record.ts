import type { View } from '../router/router.ts';
import type { SeamAdapter, KidMap, Entry } from '../adapter/seam.ts';
import { fillRecordCard } from './record-card.ts';
import { createIntro } from './intro.ts';
import { compareKStart } from '../util/interval.ts';

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
    container.appendChild(createIntro('record'));
    const body = el('div', 'view-body record-view');
    this.body = body;
    container.appendChild(body);
    void this.load(body);
  }

  private async load(body: HTMLElement): Promise<void> {
    const [recordResult, kidMapResult] = await Promise.all([
      this.adapter.fetchRecord(this.accountId),
      this.adapter.fetchKidMap(),
    ]);
    if (this.body !== body) return;

    if (!recordResult.ok) {
      body.replaceChildren(el('p', 'error-state', recordResult.error));
      return;
    }
    const kidMap: KidMap | null = kidMapResult.ok ? kidMapResult.data : null;
    const subjects = Object.keys(recordResult.data.fields)
      .filter((s) => recordResult.data.fields[s]!.length > 0)
      .sort();
    if (subjects.length === 0) {
      body.replaceChildren(el('p', 'empty-state', 'No record entries for this account.'));
      return;
    }

    const nodes: HTMLElement[] = [];
    for (const subject of subjects) {
      const section = el('section', 'record-subject');
      section.appendChild(el('h2', '', subject));
      const ul = el('ul', 'record-entries');
      const entries: Entry[] = [...recordResult.data.fields[subject]!].sort(compareKStart);
      for (const e of entries) {
        const li = el('li', '');
        const a = el('a', '');
        a.setAttribute(
          'href',
          `/entry/${e.kid}/${encodeURIComponent(e.subject)}/${encodeURIComponent(e.id)}`,
        );
        fillRecordCard(a, e, kidMap, {
          fields: ['authority', 'state', 'kid', 'k-start', 'evidence', 'k-time'],
          link: true,
        });
        li.appendChild(a);
        ul.appendChild(li);
      }
      section.appendChild(ul);
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
