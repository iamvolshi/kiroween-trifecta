import type { View } from '../router/router.ts';
import type { SeamAdapter } from '../adapter/seam.ts';
import { fillRecordCard } from './record-card.ts';
import { createIntro } from './intro.ts';
import { parseUtcInput } from '../util/moment.ts';

export class TimeTravelView implements View {
  private adapter: SeamAdapter;
  private container: HTMLElement | null = null;
  private cursorInput: HTMLInputElement | null = null;
  private beliefPool: HTMLElement | null = null;
  private changeHandler: (() => void) | null = null;
  /** Incremented on every cursor change and on unmount; stale results are dropped. */
  private requestToken = 0;

  constructor(adapter: SeamAdapter) {
    this.adapter = adapter;
  }

  mount(container: HTMLElement): void {
    this.container = container;

    container.innerHTML = `
      <div class="time-travel-view">
        <h1>Time Travel</h1>
        <label for="moment-cursor">Select moment (UTC):</label>
        <input type="datetime-local" id="moment-cursor">
        <div id="belief-pool"></div>
      </div>
    `;
    container.querySelector('.time-travel-view h1')?.after(createIntro('timeTravel'));

    this.cursorInput = container.querySelector<HTMLInputElement>('#moment-cursor');
    this.beliefPool = container.querySelector<HTMLElement>('#belief-pool');

    this.changeHandler = () => this.onCursorChange();
    this.cursorInput?.addEventListener('change', this.changeHandler);
  }

  private async onCursorChange(): Promise<void> {
    const input = this.cursorInput;
    const pool = this.beliefPool;
    if (!input || !pool) return;

    const token = ++this.requestToken;
    const isCurrent = (): boolean =>
      token === this.requestToken && this.beliefPool === pool;

    // The input is read as UTC, the same moment that is displayed and queried.
    const momentMs = parseUtcInput(input.value);

    if (momentMs === null) {
      pool.replaceChildren(
        Object.assign(document.createElement('p'), {
          className: 'prompt-state',
          textContent: 'Select a moment',
        }),
      );
      return;
    }

    const result = await this.adapter.fetchBeliefPool(momentMs);
    if (!isCurrent()) return;

    const cursorP = Object.assign(document.createElement('p'), {
      className: 'cursor-display',
      textContent: `Moment (UTC): ${input.value}`,
    });

    if (!result.ok) {
      pool.replaceChildren(
        cursorP,
        Object.assign(document.createElement('p'), {
          className: 'error-state',
          textContent: result.error,
        }),
      );
      return;
    }

    if (result.data.length === 0) {
      pool.replaceChildren(
        cursorP,
        Object.assign(document.createElement('p'), {
          className: 'empty-state',
          textContent: 'No entries were live at this moment.',
        }),
      );
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'belief-pool';

    for (const entry of result.data) {
      const li = document.createElement('li');
      fillRecordCard(li, entry, {
        fields: ['authority', 'state', 'kid', 'subject', 'k-start', 'reason', 'evidence', 'k-time'],
      });
      ul.appendChild(li);
    }

    pool.replaceChildren(cursorP, ul);
  }

  unmount(): void {
    this.requestToken++;
    if (this.cursorInput && this.changeHandler) {
      this.cursorInput.removeEventListener('change', this.changeHandler);
    }
    this.changeHandler = null;
    this.cursorInput = null;
    this.beliefPool = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
