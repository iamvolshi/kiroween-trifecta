import type { View } from '../router/router.ts';
import type { SeamAdapter, KidMap } from '../adapter/seam.ts';
import { fillCollapsibleCard, srOnly } from './record-card.ts';
import { createIntro } from './intro.ts';
import { compareKStart } from '../util/interval.ts';
import {
  type FilterState,
  NO_FILTER,
  describeFilters,
  matches,
  renderFilterBar,
  statesIn,
} from './action-filters.ts';

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
    const rows: HTMLLIElement[] = [];

    for (const [i, entry] of sorted.entries()) {
      const li = document.createElement('li');
      fillCollapsibleCard(li, entry, kidMap, {
        href: `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${encodeURIComponent(entry.id)}`,
        detailsId: `action-details-${i}`,
      });
      ul.appendChild(li);
      rows.push(li);
    }

    // Filters: rows are built once and only shown or hidden, so each row
    // keeps its own expanded/collapsed state while filters change.
    const states = statesIn(sorted);
    const barSlot = document.createElement('div');
    const count = document.createElement('p');
    count.className = 'filter-count';
    count.setAttribute('aria-live', 'polite');
    const noMatch = document.createElement('p');
    noMatch.className = 'empty-state filter-empty';

    const apply = (f: FilterState): void => {
      let shown = 0;
      sorted.forEach((entry, i) => {
        const show = matches(entry, f);
        rows[i]!.hidden = !show;
        if (show) shown++;
      });
      count.textContent = `Showing ${shown} of ${sorted.length} entries`;
      noMatch.hidden = shown > 0;
      noMatch.replaceChildren(
        ...(shown > 0
          ? []
          : [
              srOnly('No match: '),
              document.createTextNode(
                `No entries match ${describeFilters(f)}. Clear the filters to see all ${sorted.length}.`,
              ),
            ]),
      );
      ul.hidden = shown === 0;
      const prev = document.activeElement as HTMLElement | null;
      const keep = prev && barSlot.contains(prev) ? { filter: prev.dataset.filter, value: prev.dataset.value } : null;
      barSlot.replaceChildren(renderFilterBar(states, f, apply));
      // Keep keyboard focus on the control that was just pressed.
      if (keep?.filter) {
        Array.from(barSlot.querySelectorAll<HTMLButtonElement>('button'))
          .find((b) => b.dataset.filter === keep.filter && b.dataset.value === keep.value)
          ?.focus();
      }
    };

    body.replaceChildren(barSlot, count, noMatch, ul);
    apply({ ...NO_FILTER });
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.body = null;
  }
}
