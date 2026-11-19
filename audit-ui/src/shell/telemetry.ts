import type { Entry, SeamAdapter } from '../adapter/seam.ts';
import type { ChatLog } from '../views/chat-log.ts';
import type { Panel } from './panel.ts';
import { engineItems, feedItems, type FeedItem } from './activity-feed.ts';
import { provenanceChannel, type ProvenanceTarget } from './provenance-channel.ts';
import { engineFocusChannel, type EngineFocus } from './engine-focus-channel.ts';
import { BOX_LABEL } from '../views/engine-boxes.ts';
import type { ShellLayout } from './layout.ts';

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export const WORK_HEADING = 'Telemetry \u2014 Machine state';
/** How close to the bottom (px) still counts as "following" the terminal. */
export const FOLLOW_SLACK_PX = 48;

function renderItem(item: FeedItem): HTMLElement {
  const li = el('li', 'feed-item');
  li.dataset.feedId = item.id;
  li.dataset.engine = item.engine;
  const tag = el('span', 'engine-tag', item.engine);
  tag.dataset.engine = item.engine;
  li.appendChild(tag);
  li.appendChild(el('span', 'feed-text', item.text));

  for (const s of item.sources ?? []) {
    const line = el('span', 'feed-source');
    line.append(el('span', 'feed-source-name', s.source), document.createTextNode(` ${s.excerpt}`));
    li.appendChild(line);
  }
  if (item.entries && item.entries.length > 0) {
    const rows = el('ul', 'katie-entries');
    for (const entry of item.entries) {
      // Each entry row is a provenance target (data-entry-id).
      const row = el('li', 'katie-entry');
      row.dataset.kid = String(entry.kid);
      row.dataset.subject = entry.subject;
      row.dataset.entryId = entry.entry_id;
      const a = document.createElement('a');
      a.className = 'katie-link';
      a.setAttribute(
        'href',
        `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${encodeURIComponent(entry.entry_id)}`,
      );
      a.textContent = entry.subject;
      row.append(a, el('span', 'katie-evidence', entry.evidence ?? 'entry not visible'));
      rows.appendChild(row);
    }
    li.appendChild(rows);
  }
  li.appendChild(el('span', 'feed-from', `from: "${item.from.message}"`));
  return li;
}

/**
 * Right column: the terminal. The general feed is the machine's activity
 * as mono lines, oldest first, the newest appended at the bottom: what
 * ERIE, ELLE and KATIE did on each turn, each item one sentence with its
 * engine tag in the engine's colour. An engine box beside a reply swaps the
 * general feed for that engine's events on that turn (engineFocusChannel);
 * the focus holds across new turns until the user goes back. A provenance
 * link in the chat highlights its KATIE item through `provenanceChannel`.
 * Derived only from the ChatLog and the seam.
 */
export class TelemetryPanel implements Panel {
  private slot: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private token = 0;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLinks: (() => void) | null = null;
  private unsubscribeFocus: (() => void) | null = null;
  private lastTarget: ProvenanceTarget | null = null;
  private adapter: SeamAdapter;
  private log: ChatLog;
  private layout: ShellLayout | null;
  /** False until the first record read answers: no empty-state claim before then. */
  private loaded = false;
  /** The last record read, kept so a focus change re-renders without a new read. */
  private entries: Entry[] = [];
  private readError: string | null = null;
  /** The engine box whose detail is showing; null = the general feed. */
  private focus: EngineFocus | null = null;
  /** The heading row (heading + window controls), built once so its buttons keep focus. */
  private head: HTMLElement | null = null;
  /** Everything under the heading row; re-rendered. */
  private body: HTMLElement | null = null;
  /** Is the reader at the live end of the general feed? Kept from scrolls, not guessed at render time. */
  private following = true;
  /** The general feed's place while a detail view is open, given back on return. */
  private saved: { top: number; following: boolean } | null = null;
  private unsubscribeLayout: (() => void) | null = null;
  private onScroll = (): void => {
    const slot = this.slot;
    // Only the general feed, and only while it can be seen, sets the follow state.
    if (!slot || this.focus !== null || this.minimized()) return;
    this.following = slot.scrollHeight - slot.scrollTop - slot.clientHeight <= FOLLOW_SLACK_PX;
  };

  constructor(adapter: SeamAdapter, log: ChatLog, layout: ShellLayout | null = null) {
    this.adapter = adapter;
    this.log = log;
    this.layout = layout;
  }

  mount(slot: HTMLElement): void {
    this.slot = slot;
    this.root = el('div', 'telemetry');
    this.head = el('div', 'telemetry-head');
    this.head.appendChild(el('h2', 'telemetry-heading', WORK_HEADING));
    if (this.layout) this.head.appendChild(this.layout.controls);
    this.body = el('div', 'telemetry-body');
    this.root.append(this.head, this.body);
    slot.appendChild(this.root);
    slot.addEventListener('scroll', this.onScroll);
    this.focus = engineFocusChannel.current();
    this.following = true;
    this.unsubscribe = this.log.subscribe(() => this.refresh());
    this.unsubscribeLinks = provenanceChannel.subscribe((t) => this.highlight(t));
    this.unsubscribeFocus = engineFocusChannel.subscribe((f) => this.setFocus(f));
    // Back from minimized: a reader who was following is put back at the live end.
    this.unsubscribeLayout = this.layout?.onChange((s) => {
      if (s !== 'minimized' && this.focus === null && this.following && this.slot) this.slot.scrollTop = this.slot.scrollHeight;
    }) ?? null;
    this.render();
    this.refresh();
  }

  private minimized(): boolean {
    return this.layout?.state() === 'minimized';
  }

  private setFocus(f: EngineFocus | null): void {
    const slot = this.slot;
    const was = this.focus;
    // Leaving the general feed: keep its place to give back on return.
    if (was === null && f !== null && slot) this.saved = { top: slot.scrollTop, following: this.following };
    const fromBack = this.root?.contains(document.activeElement) ?? false;
    this.focus = f;
    this.render();
    if (!slot) return;
    if (f !== null) {
      slot.scrollTop = 0; // a detail view starts at its top
    } else {
      const saved = this.saved;
      this.saved = null;
      this.following = saved?.following ?? true;
      slot.scrollTop = this.following ? slot.scrollHeight : saved?.top ?? 0;
      // The back button that had focus is gone: the feed takes it.
      if (fromBack) this.body?.querySelector<HTMLElement>('.activity-feed, .empty-state')?.focus();
    }
  }

  refresh(): void {
    if (!this.root) return;
    const my = ++this.token;
    void this.adapter.fetchAllEntries().then(
      (entries) => {
        if (my !== this.token || !this.root) return;
        this.loaded = true;
        // The feed comes from the log; entries only add KATIE evidence when visible.
        this.entries = entries.ok ? entries.data : [];
        this.readError = entries.ok ? null : entries.error;
        this.render();
      },
      (e: unknown) => {
        if (my !== this.token || !this.root) return;
        this.loaded = true;
        this.readError = `The record read failed: ${e instanceof Error ? e.message : String(e)}`;
        this.render();
      },
    );
  }

  /** Scroll to and mark the KATIE item for `t`. No item, nothing happens. Focus is not moved. */
  highlight(t: ProvenanceTarget, scroll = true): void {
    const root = this.root;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.katie-entry[data-entry-id]'));
    const hit = items.find(
      (li) => li.dataset.entryId === t.entry_id && li.dataset.subject === t.subject && li.dataset.kid === String(t.kid),
    );
    if (!hit) {
      // A detail view holds only one engine's turn: go back to the general feed and look there.
      if (this.focus !== null) {
        engineFocusChannel.publish(null);
        this.highlight(t, scroll);
      }
      return;
    }
    this.lastTarget = t;
    for (const li of root.querySelectorAll('.katie-entry.is-highlighted')) li.classList.remove('is-highlighted');
    hit.classList.add('is-highlighted');
    if (scroll) hit.scrollIntoView?.({ block: 'nearest' });
  }

  unmount(): void {
    this.token++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeLinks?.();
    this.unsubscribeLinks = null;
    this.unsubscribeFocus?.();
    this.unsubscribeFocus = null;
    this.unsubscribeLayout?.();
    this.unsubscribeLayout = null;
    this.slot?.removeEventListener('scroll', this.onScroll);
    this.layout?.controls.remove();
    this.head = null;
    this.body = null;
    this.saved = null;
    this.root?.remove();
    this.root = null;
    this.slot = null;
    this.loaded = false;
    // The focus belongs to this panel: with it gone, the boxes show none pressed.
    if (engineFocusChannel.current() !== null) engineFocusChannel.publish(null);
  }

  private render(): void {
    const root = this.body;
    const slot = this.slot;
    if (!root || !slot) return;
    const keepTop = slot.scrollTop;
    // A re-render must not drop keyboard focus from the back button.
    const backHadFocus = document.activeElement?.classList.contains('engine-detail-back') === true && root.contains(document.activeElement);
    root.replaceChildren();
    if (this.readError !== null) root.appendChild(el('p', 'error-state', this.readError));
    if (this.focus) {
      this.renderDetail(root, this.focus);
      if (!this.minimized()) slot.scrollTop = keepTop; // one turn's detail: never auto-scrolled
      if (backHadFocus) root.querySelector<HTMLElement>('.engine-detail-back')?.focus();
    } else {
      this.renderGeneral(root);
      // Hidden while minimized: nothing to measure; the place is set again on restore.
      if (!this.minimized()) slot.scrollTop = this.following ? slot.scrollHeight : keepTop;
    }
    // Keep the last highlight across re-renders (a new turn rebuilds the feed).
    if (this.lastTarget) this.highlight(this.lastTarget, false);
  }

  /** The general feed, oldest first. */
  private renderGeneral(root: HTMLElement): void {
    const items = feedItems(this.log.turns(), this.entries);
    if (items.length === 0 && this.readError === null && this.loaded) {
      const empty = el('p', 'empty-state', 'Nothing has happened yet. Each step the engines take shows up here.');
      empty.tabIndex = -1;
      root.appendChild(empty);
    }
    if (items.length === 0) return;
    const feed = el('ul', 'activity-feed');
    feed.setAttribute('aria-label', 'Activity, oldest first');
    feed.tabIndex = -1; // takes focus when the detail view's back button goes away
    for (const item of items) feed.appendChild(renderItem(item));
    root.appendChild(feed);
  }

  /** One engine's events on one turn, in place of the general feed. */
  private renderDetail(root: HTMLElement, f: EngineFocus): void {
    const name = BOX_LABEL[f.engine];
    const head = el('div', 'engine-detail-head');
    head.dataset.engine = f.engine;
    const title = el('h3', 'engine-detail-title');
    title.append(el('span', 'engine-detail-name', name), el('span', 'engine-detail-rest', ' \u2014 this turn'));
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'engine-detail-back';
    back.textContent = '\u2190 All activity';
    back.addEventListener('click', () => engineFocusChannel.publish(null));
    head.append(title, back);
    root.appendChild(head);
    const items = engineItems(this.log.turns(), f.turnIndex, f.engine, this.entries);
    if (items.length === 0) {
      root.appendChild(el('p', 'engine-detail-none', `${name} did nothing on this turn.`));
      return;
    }
    const feed = el('ul', 'activity-feed engine-detail');
    feed.setAttribute('aria-label', `${name} on this turn`);
    for (const item of items) feed.appendChild(renderItem(item));
    root.appendChild(feed);
  }
}
