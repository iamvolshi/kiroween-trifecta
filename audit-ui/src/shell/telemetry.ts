import type { Entry, SeamAdapter } from '../adapter/seam.ts';
import type { ChatLog } from '../views/chat-log.ts';
import type { RepoSession } from '../views/repo-session.ts';
import { progressWords } from '../views/repo-panel.ts';
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
 * Pinned above the feed, the attached repo's file scan: Sherlock reading
 * the repo is machine state, so its progress lives here, in the right
 * column, not in the left column's repo control. Derived only from the
 * ChatLog, the seam, and the shared RepoSession.
 */
export class TelemetryPanel implements Panel {
  private slot: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private token = 0;
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLinks: (() => void) | null = null;
  private unsubscribeFocus: (() => void) | null = null;
  private unsubscribeRepo: (() => void) | null = null;
  private lastTarget: ProvenanceTarget | null = null;
  private adapter: SeamAdapter;
  private log: ChatLog;
  private layout: ShellLayout | null;
  /** The shared attached-repo session, or null: its scan is the pinned line above the feed. */
  private repo: RepoSession | null;
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
  /** The last place read in whichever view shows, kept to give back after a minimize. */
  private lastTop = 0;
  private onScroll = (): void => {
    const slot = this.slot;
    // Nothing is measured while minimized (the content is hidden).
    if (!slot || this.minimized()) return;
    this.lastTop = slot.scrollTop;
    // Only the general feed sets the follow state.
    if (this.focus === null) this.following = slot.scrollHeight - slot.scrollTop - slot.clientHeight <= FOLLOW_SLACK_PX;
  };

  constructor(adapter: SeamAdapter, log: ChatLog, layout: ShellLayout | null = null, repo: RepoSession | null = null) {
    this.adapter = adapter;
    this.log = log;
    this.layout = layout;
    this.repo = repo;
  }

  mount(slot: HTMLElement): void {
    this.slot = slot;
    this.root = el('div', 'telemetry');
    this.head = el('div', 'telemetry-head');
    // The heading is two spans, so a narrow column can drop the "— Machine
    // state" suffix and still show "Telemetry" on one line; the heading's
    // text stays WORK_HEADING either way.
    const [main, rest] = WORK_HEADING.split(' — ');
    const h = el('h2', 'telemetry-heading');
    h.appendChild(el('span', 'telemetry-heading-main', main));
    if (rest !== undefined) h.appendChild(el('span', 'telemetry-heading-rest', ` — ${rest}`));
    this.head.appendChild(h);
    if (this.layout) this.head.appendChild(this.layout.controls);
    this.body = el('div', 'telemetry-body');
    this.body.tabIndex = -1; // the focus target of last resort (back with nothing drawn yet)
    this.root.append(this.head, this.body);
    slot.appendChild(this.root);
    slot.addEventListener('scroll', this.onScroll);
    this.focus = engineFocusChannel.current();
    this.following = true;
    this.unsubscribe = this.log.subscribe(() => this.refresh());
    this.unsubscribeLinks = provenanceChannel.subscribe((t) => this.onLink(t));
    this.unsubscribeFocus = engineFocusChannel.subscribe((f) => this.setFocus(f));
    this.unsubscribeRepo = this.repo?.subscribe(() => this.render()) ?? null;
    // Back from minimized: a following reader goes to the live end, any other back to their place.
    let prev = this.layout?.state() ?? 'normal';
    this.unsubscribeLayout = this.layout?.onChange((s) => {
      const leaving = prev === 'minimized' && s !== 'minimized';
      prev = s;
      if (!leaving || !this.slot) return;
      this.slot.scrollTop = this.focus === null && this.following ? this.slot.scrollHeight : this.lastTop;
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
    const fromBack = document.activeElement?.classList.contains('engine-detail-back') === true && (this.root?.contains(document.activeElement) ?? false);
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
      if (fromBack) (this.body?.querySelector<HTMLElement>('.activity-feed, .empty-state') ?? this.body)?.focus();
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
    if (!hit) return;
    this.lastTarget = t;
    for (const li of root.querySelectorAll('.katie-entry.is-highlighted')) li.classList.remove('is-highlighted');
    hit.classList.add('is-highlighted');
    if (scroll) hit.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * A provenance link was activated. If a detail view is open and does not
   * show the entry, but the general feed holds it, go back there first.
   * Only a link does this: a re-render's highlight never leaves a detail view.
   */
  private onLink(t: ProvenanceTarget): void {
    const shown = Array.from(this.root?.querySelectorAll<HTMLElement>('.katie-entry') ?? []).some(
      (li) => li.dataset.entryId === t.entry_id && li.dataset.subject === t.subject && li.dataset.kid === String(t.kid));
    if (this.focus !== null && !shown) {
      const inFeed = feedItems(this.log.turns(), this.entries).some((i) =>
        (i.entries ?? []).some((e) => e.entry_id === t.entry_id && e.subject === t.subject && e.kid === t.kid));
      if (inFeed) engineFocusChannel.publish(null);
    }
    this.highlight(t);
  }

  unmount(): void {
    this.token++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeLinks?.();
    this.unsubscribeLinks = null;
    this.unsubscribeFocus?.();
    this.unsubscribeFocus = null;
    this.unsubscribeRepo?.();
    this.unsubscribeRepo = null;
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

  /**
   * The attached repo's scan, pinned above the feed: the attaching send,
   * then the /status progress, then the Ready summary (or the Could-not-read
   * outcome when the scan failed). Nothing when no repo is attached.
   * The words are the repo panel's words; the line just lives here.
   */
  private repoLine(): HTMLElement | null {
    const repo = this.repo;
    if (!repo) return null;
    if (repo.attaching) {
      const p = el('p', 'repo-progress', 'Sending the repo to Sherlock.');
      p.setAttribute('role', 'status');
      return p;
    }
    const s = repo.status;
    if (!s || s.state === 'detached' || progressWords(s) === '') return null;
    const p = el('p', 'repo-progress', progressWords(s));
    p.dataset.state = s.state;
    p.setAttribute('role', 'status');
    return p;
  }

  /** The general feed, oldest first. */
  private renderGeneral(root: HTMLElement): void {
    const repo = this.repoLine();
    if (repo) root.appendChild(repo);
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
