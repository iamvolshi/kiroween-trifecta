import type { View } from '../router/router.ts';
import type { SeamAdapter, KidMap } from '../adapter/seam.ts';
import { fillRecordCard } from './record-card.ts';
import { createIntro } from './intro.ts';
import { compareKStart } from '../util/interval.ts';

export class ActionListView implements View {
  private container: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private adapter: SeamAdapter;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    const h1 = document.createElement('h1');
    h1.textContent = 'Action List';
    container.appendChild(h1);
    container.appendChild(createIntro('actions'));
    this.body = document.createElement('div');
    this.body.className = 'view-body';
    container.appendChild(this.body);
    void this.load(container);
  }

  async load(container: HTMLElement): Promise<void> {
    const kidMapResult = await this.adapter.fetchKidMap();
    if (this.container !== container) return;
    const kidMap: KidMap | null = kidMapResult.ok ? kidMapResult.data : null;

    const entriesResult = await this.adapter.fetchAllEntries();
    if (this.container !== container) return;

    const body = this.body;
    if (!body) return;

    if (!entriesResult.ok) {
      const errP = document.createElement('p');
      errP.className = 'error-state';
      errP.textContent = entriesResult.error;
      body.replaceChildren(errP);
      return;
    }

    const entries = entriesResult.data;

    if (entries.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No entries in the record.';
      body.replaceChildren(p);
      return;
    }

    // Newest first, by parsed k_start
    const sorted = [...entries].sort((a, b) => compareKStart(b, a));

    const ul = document.createElement('ul');
    ul.className = 'action-list';

    for (const entry of sorted) {
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.href = `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${encodeURIComponent(entry.id)}`;
      fillRecordCard(a, entry, kidMap, {
        fields: ['authority', 'state', 'kid', 'subject', 'k-start', 'reason', 'evidence', 't-time', 'e-time', 'k-time'],
        headlineClass: 'label',
        link: true,
      });

      li.appendChild(a);
      ul.appendChild(li);
    }

    body.replaceChildren(ul);
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.body = null;
  }
}
