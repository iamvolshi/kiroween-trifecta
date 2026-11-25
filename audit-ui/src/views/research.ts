import type { AskResult, ChatTurn, Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import type { ChatLog } from './chat-log.ts';
import { renderEntryGrid } from './entry-grid.ts';
import { viewerTimeZone } from '../util/timezone.ts';
import { WatsonCaller } from '../watson/conclusion.ts';
import { createWatsonBridge, type WatsonBridge } from '../watson/bridge.ts';

/**
 * The ERIE page (Research): what ERIE gets and what she injects.
 *
 * (a) the pool she draws from at this moment (the live record),
 * (b) her retrieval on each chat turn (engines.erie, verbatim),
 * (c) the injection on each turn (lessons_in_prompt: injected verbatim,
 *     held grey, as questions for ELLE).
 *
 * The seam carries no assembled prompt text, so the page renders none:
 * the injected objects are the whole of the injection the app can see.
 * Live data only; every empty section says so in words.
 */

export const ERIE_NAME = 'ERIE';
/**
 * ERIE's expansion, in Darren's words — the poster one, chosen Nov 21:
 * she does the investigation and comes back with provenance.
 */
export const ERIE_EXPANSION: string | null = 'Epistemic Retrieval and Investigation Engine';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** One labelled box; its body scrolls inside it, never the page. */
function box(cls: string, label: string): { section: HTMLElement; label: HTMLElement; body: HTMLElement } {
  const section = el('section', `erie-box ${cls}`);
  const head = el('p', 'erie-label', label);
  const body = el('div', 'erie-box-body');
  section.append(head, body);
  return { section, label: head, body };
}

/** A lesson as the seam sent it: every field, verbatim. */
export function renderLesson(l: Lesson, cls: string): HTMLElement {
  const dl = el('dl', `erie-lesson ${cls}`);
  const rows: Array<[string, string]> = [
    ['detail', l.detail],
    ['rule', l.rule ?? 'null'],
    ['subject', l.subject ?? 'null'],
    ['status', l.status],
    ['event_type', l.event_type],
    ['event_id', l.event_id],
  ];
  for (const [k, v] of rows) {
    const row = el('div', 'erie-field');
    row.append(el('dt', '', k), el('dd', `erie-${k}`, v));
    dl.appendChild(row);
  }
  return dl;
}

/** One turn's retrieval: the question, found / not_found, the text, the provenance. */
export function renderRetrieval(erie: AskResult | null, n: number, message: string): HTMLElement {
  const turn = el('article', 'erie-turn');
  turn.appendChild(el('p', 'erie-turn-head', `turn ${n}`));
  if (erie === null) {
    turn.dataset.state = 'none';
    turn.append(field('question', message), el('p', 'erie-cannot', 'No action'));
    return turn;
  }
  turn.dataset.state = erie.state;
  turn.append(field('question', erie.question), field('state', erie.state));
  if (erie.state === 'not_found') {
    turn.appendChild(el('p', 'erie-cannot', 'ERIE could not answer.'));
    return turn;
  }
  turn.appendChild(field('text', erie.text));
  const list = el('ol', 'erie-provenance');
  for (const p of erie.provenance) {
    const li = el('li', 'erie-source-item');
    li.append(field('source', p.source), field('content', p.content), field('excerpt', p.excerpt));
    list.appendChild(li);
  }
  if (erie.provenance.length === 0) turn.appendChild(el('p', 'erie-none', 'No provenance came with this answer.'));
  else turn.appendChild(list);
  return turn;
}

function field(name: string, value: string): HTMLElement {
  const row = el('div', `erie-field erie-${name}`);
  row.append(el('span', 'erie-key', name), el('span', 'erie-value', value));
  return row;
}

/** One turn's injection: injected verbatim, held grey as questions for ELLE. An empty list is one plain line (the boxed empty state is for a whole box). */
export function renderInjection(t: ChatTurn, n: number): HTMLElement {
  const turn = el('article', 'erie-turn');
  turn.appendChild(el('p', 'erie-turn-head', `turn ${n}`));
  const { injected, held } = t.engines.lessons_in_prompt;
  const inj = el('div', 'erie-injected');
  inj.appendChild(el('p', 'erie-sub', `injected · ${plural(injected.length, 'lesson', 'lessons')}`));
  if (injected.length === 0) inj.appendChild(el('p', 'erie-none', 'Nothing was injected on this turn.'));
  for (const l of injected) inj.appendChild(renderLesson(l, 'is-injected'));
  const hold = el('div', 'erie-held');
  hold.appendChild(el('p', 'erie-sub', `held · ${plural(held.length, 'question for ELLE', 'questions for ELLE')}`));
  if (held.length === 0) hold.appendChild(el('p', 'erie-none', 'Nothing was held on this turn.'));
  for (const l of held) hold.appendChild(renderLesson(l, 'is-held'));
  turn.append(inj, hold);
  return turn;
}

export class ResearchView {
  private adapter: SeamAdapter;
  private log: ChatLog;
  private timeZone: string;
  private container: HTMLElement | null = null;
  private pool: HTMLElement | null = null;
  private poolLabel: HTMLElement | null = null;
  private retrieval: HTMLElement | null = null;
  private retrievalLabel: HTMLElement | null = null;
  private injection: HTMLElement | null = null;
  private injectionLabel: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private token = 0;
  /** Watson's conclusion beside each turn's ERIE answer (never in it). */
  private watson: WatsonCaller;

  constructor(adapter: SeamAdapter, log: ChatLog, timeZone?: string, bridge: WatsonBridge = createWatsonBridge()) {
    this.adapter = adapter;
    this.log = log;
    this.timeZone = timeZone ?? viewerTimeZone();
    this.watson = new WatsonCaller(adapter, bridge);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    const page = el('div', 'erie-page');
    const head = el('header', 'erie-head');
    head.appendChild(el('h1', 'erie-name', ERIE_NAME));
    if (ERIE_EXPANSION !== null) head.appendChild(el('p', 'erie-expansion', ERIE_EXPANSION));
    const body = el('div', 'view-body erie-view');
    body.dataset.view = 'Research';
    const a = box('erie-pool', 'pool');
    const b = box('erie-retrieval', 'retrieval');
    const c = box('erie-injection', 'injection');
    [this.pool, this.poolLabel] = [a.body, a.label];
    [this.retrieval, this.retrievalLabel] = [b.body, b.label];
    [this.injection, this.injectionLabel] = [c.body, c.label];
    body.append(a.section, b.section, c.section);
    page.append(head, body);
    container.appendChild(page);
    this.unsubscribe = this.log.subscribe(() => {
      this.renderTurns();
      void this.loadPool();
    });
    this.renderTurns();
    void this.loadPool();
  }

  /** (a) What ERIE can retrieve right now: the record live at this moment. */
  private async loadPool(): Promise<void> {
    const out = this.pool;
    const label = this.poolLabel;
    if (!out || !label) return;
    const token = ++this.token;
    if (out.childElementCount === 0) out.appendChild(el('p', 'prompt-state', 'Reading the record...'));
    const [live, all] = await Promise.all([this.adapter.fetchBeliefPool(Date.now()), this.adapter.fetchAllEntries()]);
    if (token !== this.token || this.pool !== out) return;
    if (!live.ok) return void out.replaceChildren(el('p', 'error-state', live.error));
    if (!all.ok) return void out.replaceChildren(el('p', 'error-state', all.error));
    const entries: Entry[] = live.data;
    const subjects = new Set(entries.map((e) => e.subject)).size;
    label.textContent = `pool · ${entries.length} live of ${plural(all.data.length, 'entry', 'entries')} · ${plural(subjects, 'subject', 'subjects')}`;
    out.replaceChildren(
      entries.length === 0
        ? el('p', 'empty-state', 'Nothing in the record is live at this moment.')
        : renderEntryGrid(entries, 'What ERIE can retrieve at this moment', 'pool', 'utc', this.timeZone),
    );
  }

  /** (b) and (c): every chat turn of this session, in order. */
  private renderTurns(): void {
    const turns = this.log.turns();
    if (!this.retrieval || !this.injection || !this.retrievalLabel || !this.injectionLabel) return;
    const count = plural(turns.length, 'turn', 'turns');
    this.retrievalLabel.textContent = `retrieval · ${count}`;
    this.injectionLabel.textContent = `injection · ${count}`;
    if (turns.length === 0) {
      this.retrieval.replaceChildren(el('p', 'empty-state empty-line', 'No chat turns yet.'));
      this.injection.replaceChildren(el('p', 'empty-state empty-line', 'No chat turns yet.'));
      return;
    }
    const shown = turns.map((t, i) => renderRetrieval(t.engines.erie, i + 1, t.message));
    this.retrieval.replaceChildren(...shown);
    // Watson speaks after the answer is on screen; a failure shows nothing.
    turns.forEach((t, i) => {
      if (t.engines.erie) void this.watson.attach(shown[i]!, t.engines.erie);
    });
    this.injection.replaceChildren(...turns.map((t, i) => renderInjection(t, i + 1)));
  }

  unmount(): void {
    this.token++;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pool = this.poolLabel = this.retrieval = this.retrievalLabel = this.injection = this.injectionLabel = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
