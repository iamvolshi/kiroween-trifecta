import { el } from './dom.ts';
import { PeepTab } from './peep.ts';
import { RatrTab } from './ratr.ts';
import type { TrifactaClient } from './trifacta.ts';

export type Tab = 'peep' | 'ratr';
const LABELS: Record<Tab, string> = { peep: 'PEEP', ratr: 'RATR' };

/**
 * The inspector: two small buttons in the header, side by side, and the
 * drawer they open with two tabs, PEEP and RATR. View only. Nothing is
 * read until the drawer first opens; RATR reads on its first showing.
 */
export class Inspector {
  readonly buttons: HTMLElement;
  readonly drawer: HTMLElement;
  readonly peep: PeepTab;
  readonly ratr: RatrTab;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private ratrLoaded = false;
  private current: Tab = 'peep';
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !this.drawer.hidden) this.close();
  };

  constructor(api: TrifactaClient) {
    this.peep = new PeepTab(api);
    this.ratr = new RatrTab(api);

    this.buttons = el('span', 'insp-pair');
    for (const tab of ['peep', 'ratr'] as const) {
      const b = el('button', 'insp-btn', LABELS[tab]);
      b.type = 'button';
      b.dataset.open = tab;
      b.title = tab === 'peep' ? 'PEEP: the trace of a query' : 'RATR: the witness log';
      b.addEventListener('click', () => this.open(tab));
      this.buttons.appendChild(b);
    }

    this.drawer = el('aside', 'insp-drawer');
    this.drawer.setAttribute('role', 'dialog');
    this.drawer.setAttribute('aria-label', 'Inspector');
    this.drawer.hidden = true;
    const top = el('div', 'insp-top');
    const strip = el('div', 'insp-tabs');
    strip.setAttribute('role', 'tablist');
    for (const tab of ['peep', 'ratr'] as const) {
      const t = el('button', 'insp-tab', LABELS[tab]);
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.dataset.tab = tab;
      t.addEventListener('click', () => this.show(tab));
      this.tabs.set(tab, t);
      strip.appendChild(t);
    }
    const shut = el('button', 'insp-close', '×');
    shut.type = 'button';
    shut.setAttribute('aria-label', 'Close the inspector');
    shut.addEventListener('click', () => this.close());
    top.append(strip, el('span', 'insp-source', api.base), shut);
    this.drawer.append(top, this.peep.section, this.ratr.section);
  }

  /** Puts the pair in the header and the drawer on the page. */
  mount(header: HTMLElement, page: HTMLElement): void {
    header.appendChild(this.buttons);
    page.appendChild(this.drawer);
    document.addEventListener('keydown', this.onKey);
  }

  unmount(): void {
    document.removeEventListener('keydown', this.onKey);
    this.buttons.remove();
    this.drawer.remove();
  }

  get tab(): Tab {
    return this.current;
  }

  open(tab: Tab): void {
    this.drawer.hidden = false;
    this.show(tab);
  }

  close(): void {
    this.drawer.hidden = true;
  }

  show(tab: Tab): void {
    this.current = tab;
    for (const [t, b] of this.tabs) b.setAttribute('aria-selected', String(t === tab));
    this.peep.section.hidden = tab !== 'peep';
    this.ratr.section.hidden = tab !== 'ratr';
    if (tab === 'ratr' && !this.ratrLoaded) {
      this.ratrLoaded = true;
      void this.ratr.load();
    }
  }
}
