import type { SeamAdapter } from '../adapter/seam.ts';
import type { Panel } from './panel.ts';
import { LeftPanel } from './left.ts';
import type { RepoSession } from '../views/repo-session.ts';
import { AuditPanel, LessonsPanel, ResearchPanel } from './rail-panels.ts';
import { stripBase } from '../util/base.ts';

/**
 * The icon rail on the far left and the list panel beside it. The rail's
 * icons are the navigation, each in its engine's color: Chat, Audit (the record
 * views), Research (the knowledge), Lessons, Curator (the folders).
 * Tapping an icon swaps the list panel and takes the center to its page. Audit takes the center to
 * the KTIE page (/calendar), Research to the ERIE page (/research) and
 * Lessons to the ELLE page (/lessons), Curator to /curator and Chat
 * to /chat, through the Router, unless the center is already there.
 */

/** Is `path` the KTIE page (the calendar, at any level)? */
export function onKtiePage(path: string): boolean {
  return path === '/calendar' || path.startsWith('/calendar/');
}
export type RailKey = 'chat' | 'audit' | 'research' | 'lessons' | 'curator';

/** Where an icon takes the center, and how to tell it is already there. */
const PAGE: Record<RailKey, { path: string; here: (path: string) => boolean }> = {
  chat: { path: '/chat', here: (p) => p === '/chat' },
  audit: { path: '/calendar', here: onKtiePage },
  research: { path: '/research', here: (p) => p === '/research' },
  lessons: { path: '/lessons', here: (p) => p === '/lessons' },
  curator: { path: '/curator', here: (p) => p === '/curator' },
};

/** The list column's caption per panel (Chat keeps the column's own name). */
const CAPTION: Record<RailKey, string> = { chat: 'Chat', audit: 'Audit', research: 'Research', lessons: 'Lessons', curator: 'Curator' };

export const RAIL: ReadonlyArray<{ key: RailKey; label: string; icon: string }> = [
  // Speech bubble.
  { key: 'chat', label: 'Chat', icon: 'M4 5h16v11H9l-5 4z' },
  // Ledger: a page with lines.
  { key: 'audit', label: 'Audit', icon: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4' },
  // Magnifier.
  { key: 'research', label: 'Research', icon: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20' },
  // Bulb.
  { key: 'lessons', label: 'Lessons', icon: 'M9 17h6M10 20h4M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3z' },
  // Open book.
  { key: 'curator', label: 'Curator', icon: 'M12 6v14M12 6C10 4.5 6.5 4 3 4.5v14c3.5-.5 7 0 9 1.5 2-1.5 5.5-2 9-1.5v-14C17.5 4 14 4.5 12 6z' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  return svg;
}

export class RailPanel implements Panel {
  private active: RailKey = 'chat';
  private panels: Record<RailKey, Panel>;
  private rail: HTMLElement;
  private list: HTMLElement;

  /** The Router's navigate: Audit's way to the KTIE page, Research's to the ERIE page. None: panel only. */
  private navigate: ((path: string) => void) | null;

  constructor(adapter: SeamAdapter, rail: HTMLElement, list: HTMLElement, navigate: ((path: string) => void) | null = null, repo: RepoSession | null = null) {
    this.rail = rail;
    this.list = list;
    this.navigate = navigate;
    this.panels = {
      chat: new LeftPanel(adapter, true, repo),
      audit: new AuditPanel(adapter),
      research: new ResearchPanel(adapter),
      lessons: new LessonsPanel(adapter),
      curator: new LeftPanel(adapter, false),
    };
  }

  /** `slot` is ignored: the rail owns its two columns (rail and list). */
  mount(_slot?: HTMLElement): void {
    // A toolbar, not a nav: it swaps the list panel. Audit, Research and
    // Lessons also change the route (to their engine's page), through the Router.
    const nav = document.createElement('div');
    nav.className = 'rail-nav';
    nav.setAttribute('role', 'toolbar');
    nav.setAttribute('aria-orientation', 'vertical');
    nav.setAttribute('aria-label', 'Switch panel');
    for (const item of RAIL) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail-button';
      b.dataset.rail = item.key;
      b.setAttribute('aria-label', item.label);
      b.title = item.label;
      b.setAttribute('aria-pressed', String(item.key === this.active));
      b.appendChild(icon(item.icon));
      b.addEventListener('click', () => {
        this.show(item.key);
        const page = PAGE[item.key];
        if (this.navigate && !page.here(stripBase(window.location.pathname))) this.navigate(page.path);
      });
      nav.appendChild(b);
    }
    this.rail.replaceChildren(nav);
    this.panels[this.active].mount(this.list);
    this.list.dataset.panel = this.active;
    this.list.setAttribute('aria-label', CAPTION[this.active]);
  }

  /** Swap the list panel. */
  show(key: RailKey): void {
    if (key === this.active) return;
    this.panels[this.active].unmount();
    this.active = key;
    for (const b of this.rail.querySelectorAll<HTMLButtonElement>('.rail-button')) {
      b.setAttribute('aria-pressed', String(b.dataset.rail === key));
    }
    this.list.replaceChildren();
    this.list.dataset.panel = key;
    this.list.setAttribute('aria-label', CAPTION[key]);
    this.panels[key].mount(this.list);
  }

  current(): RailKey {
    return this.active;
  }

  refresh(): void {
    this.panels[this.active].refresh();
  }

  unmount(): void {
    this.panels[this.active].unmount();
    this.rail.replaceChildren();
    this.list.replaceChildren();
  }
}
