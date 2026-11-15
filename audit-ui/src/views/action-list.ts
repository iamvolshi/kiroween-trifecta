import type { View } from '../router/router.ts';
import type { SeamAdapter, KidMap } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';
import { formatLabel } from '../util/format.ts';

export class ActionListView implements View {
  private container: HTMLElement | null = null;
  private adapter: SeamAdapter;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '<h1>Action List</h1>';
    void this.load(container);
  }

  async load(container: HTMLElement): Promise<void> {
    const kidMapResult = await this.adapter.fetchKidMap();
    const kidMap: KidMap | null = kidMapResult.ok ? kidMapResult.data : null;

    const entriesResult = await this.adapter.fetchAllEntries();

    if (!entriesResult.ok) {
      container.innerHTML = '';
      const errP = document.createElement('p');
      errP.className = 'error-state';
      errP.textContent = entriesResult.error;
      container.appendChild(errP);
      return;
    }

    const entries = entriesResult.data;

    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-state">No entries in the record.</p>';
      return;
    }

    const sorted = [...entries].sort((a, b) => {
      if (a.k_start < b.k_start) return 1;
      if (a.k_start > b.k_start) return -1;
      return 0;
    });

    const ul = document.createElement('ul');
    ul.className = 'action-list';

    for (const entry of sorted) {
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.href = `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${entry.id}`;

      const kidSpan = document.createElement('span');
      kidSpan.className = 'kid';
      kidSpan.textContent = renderKid(entry.kid, kidMap);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = formatLabel(entry.subject, entry.state);

      const authoritySpan = document.createElement('span');
      authoritySpan.className = 'authority';
      authoritySpan.textContent = String(entry.authority);

      const kStartSpan = document.createElement('span');
      kStartSpan.className = 'k-start';
      kStartSpan.textContent = entry.k_start;

      const tTimeSpan = document.createElement('span');
      tTimeSpan.className = 't-time';
      tTimeSpan.textContent = entry.t_time;

      const eTimeSpan = document.createElement('span');
      eTimeSpan.className = 'e-time';
      eTimeSpan.textContent = entry.e_time;

      const kTimeSpan = document.createElement('span');
      kTimeSpan.className = 'k-time';
      kTimeSpan.textContent = entry.k_time;

      a.appendChild(kidSpan);
      a.appendChild(labelSpan);
      a.appendChild(authoritySpan);
      a.appendChild(kStartSpan);
      a.appendChild(tTimeSpan);
      a.appendChild(eTimeSpan);
      a.appendChild(kTimeSpan);

      li.appendChild(a);
      ul.appendChild(li);
    }

    container.appendChild(ul);
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
