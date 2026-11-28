import type { Panel } from './panel.ts';

/** The list column beside the Detective screen: what the page does, in three plain lines. */
export class InvestigatePanel implements Panel {
  private slot: HTMLElement | null = null;

  mount(slot: HTMLElement): void {
    this.slot = slot;
    const box = document.createElement('section');
    box.className = 'investigate-panel';
    const h = document.createElement('h2');
    h.textContent = 'Detective';
    box.appendChild(h);
    for (const line of [
      'Sherlock investigates and writes the report.',
      'Watson turns it into a conclusion.',
      'The voice you pick says it, with the files and KIDs behind it.',
    ]) {
      const p = document.createElement('p');
      p.textContent = line;
      box.appendChild(p);
    }
    slot.replaceChildren(box);
  }

  refresh(): void {}

  unmount(): void {
    this.slot?.replaceChildren();
    this.slot = null;
  }
}
