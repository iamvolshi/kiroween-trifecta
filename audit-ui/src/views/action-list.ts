import type { View } from '../router/router.ts';
import type { SeamAdapter } from '../adapter/seam.ts';
import { renderCardDetails, srOnly } from './record-card.ts';
import { createEntryGrid } from './entry-grid.ts';
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
    const intro = createIntro('actions');
    if (intro) container.appendChild(intro);
    this.body = document.createElement('div');
    this.body.className = 'view-body';
    // The intro used to carry data-view="Action List"; with no intro the
    // body carries it, so the header strip still reads "View: Action List".
    this.body.dataset.view = 'Action List';
    container.appendChild(this.body);
    void this.load(container);
  }

  async load(container: HTMLElement): Promise<void> {
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

    // Explorer columns (Darren, Nov 22): KID | Subject | State | Authority |
    // Inspect. Each column holds its width, so the state sits straight down
    // the page whatever the subject's length. A row click opens its details.
    const grid = createEntryGrid(sorted, {
      label: 'Action List',
      list: 'actions',
      kidLink: false,
      details: renderCardDetails,
      idPrefix: 'action',
    });
    const ul = grid.element;
    ul.classList.add('action-list');

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
      const shown = grid.setVisible((entry) => matches(entry, f));
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
