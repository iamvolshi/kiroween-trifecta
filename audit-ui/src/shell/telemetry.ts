import type { Entry, SeamAdapter } from '../adapter/seam.ts';
import type { ChatLog } from '../views/chat-log.ts';
import type { Panel } from './panel.ts';
import { feedItems, type FeedItem } from './activity-feed.ts';
import { provenanceChannel, type ProvenanceTarget } from './provenance-channel.ts';

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export const WORK_HEADING = 'What the machine is doing';

function renderItem(item: FeedItem): HTMLElement {
  const li = el('li', 'feed-item');
  li.dataset.feedId = item.id;
  li.dataset.engine = item.engine;
  if (item.entry) {
    li.dataset.kid = String(item.entry.kid);
    li.dataset.subject = item.entry.subject;
    li.dataset.entryId = item.entry.entry_id;
  }
  const tag = el('span', 'engine-tag', item.engine);
  tag.dataset.engine = item.engine;
  li.appendChild(tag);
  li.appendChild(el('span', 'feed-text', item.text));

  for (const s of item.sources ?? []) {
    const line = el('span', 'feed-source');
    line.append(el('span', 'feed-source-name', s.source), document.createTextNode(` ${s.excerpt}`));
    li.appendChild(line);
  }
  if (item.entry) {
    const a = document.createElement('a');
    a.className = 'katie-link';
    a.setAttribute(
      'href',
      `/entry/${item.entry.kid}/${encodeURIComponent(item.entry.subject)}/${encodeURIComponent(item.entry.entry_id)}`,
    );
    a.textContent = item.entry.subject;
    li.appendChild(a);
    li.appendChild(el('span', 'katie-evidence', item.entry.evidence ?? 'entry not visible'));
  }
  const step = item.from.step !== null ? ` (step ${item.from.step})` : '';
  li.appendChild(el('span', 'feed-from', `from: "${item.from.message}"${step}`));
  return li;
}

/**
 * Right column: the work column. One activity feed, newest first: what
 * ERIE, ELLE and KATIE did on each turn, each item one sentence with a small
 * engine tag. Derived only from the ChatLog and the seam. A provenance link
 * in the chat highlights its KATIE item through `provenanceChannel`.
 */
export class TelemetryPanel implements Panel {
  private root: HTMLElement | null = null;
  private token = 0;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLinks: (() => void) | null = null;
  private lastTarget: ProvenanceTarget | null = null;
  private adapter: SeamAdapter;
  private log: ChatLog;

  constructor(adapter: SeamAdapter, log: ChatLog) {
    this.adapter = adapter;
    this.log = log;
  }

  mount(slot: HTMLElement): void {
    this.root = el('div', 'telemetry');
    slot.appendChild(this.root);
    this.unsubscribe = this.log.subscribe(() => this.refresh());
    this.unsubscribeLinks = provenanceChannel.subscribe((t) => this.highlight(t));
    this.render([]);
    this.refresh();
  }

  refresh(): void {
    if (!this.root) return;
    const my = ++this.token;
    void this.adapter.fetchAllEntries().then((entries) => {
      if (my !== this.token || !this.root) return;
      // The feed comes from the log; entries only add KATIE evidence when visible.
      this.render(entries.ok ? entries.data : []);
    });
  }

  /** Scroll to and mark the KATIE item for `t`. No item, nothing happens. Focus is not moved. */
  highlight(t: ProvenanceTarget, scroll = true): void {
    const root = this.root;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.feed-item[data-entry-id]'));
    const hit = items.find(
      (li) => li.dataset.entryId === t.entry_id && li.dataset.subject === t.subject && li.dataset.kid === String(t.kid),
    );
    if (!hit) return;
    this.lastTarget = t;
    for (const li of root.querySelectorAll('.feed-item.is-highlighted')) li.classList.remove('is-highlighted');
    hit.classList.add('is-highlighted');
    if (scroll) hit.scrollIntoView?.({ block: 'nearest' });
  }

  unmount(): void {
    this.token++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeLinks?.();
    this.unsubscribeLinks = null;
    this.root?.remove();
    this.root = null;
  }

  private render(entries: Entry[]): void {
    const root = this.root;
    if (!root) return;
    root.replaceChildren(el('h2', 'telemetry-heading', WORK_HEADING));
    const items = feedItems(this.log.turns(), entries);
    if (items.length === 0) {
      root.appendChild(el('p', 'empty-state', 'Nothing has happened yet. Each step the engines take shows up here.'));
    }
    const feed = el('ul', 'activity-feed');
    feed.setAttribute('aria-label', 'Activity, newest first');
    for (const item of items) feed.appendChild(renderItem(item));
    root.appendChild(feed);
    // Keep the last highlight across re-renders (a new turn rebuilds the feed).
    if (this.lastTarget) this.highlight(this.lastTarget, false);
  }
}
