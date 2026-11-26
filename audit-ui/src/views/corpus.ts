import type { AdapterResult, SeamAdapter } from '../adapter/seam.ts';
import type { CorpusNouns, CorpusOverview } from '../adapter/sherlock-types.ts';
import { renderKid } from '../util/kid-display.ts';
import { MAX_NODES, pick, renderGraphSvg } from './corpus-graph.ts';

/**
 * The corpus views inside Research: the overview, the noun list and the graph
 * of the corpus Sherlock holds. Three tabs, three routes under /research.
 * Live data only: every figure is what Sherlock sent; a failed read says so.
 */

export const CORPUS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'nouns', label: 'Nouns' },
  { id: 'graph', label: 'Graph' },
] as const;
export type CorpusTab = (typeof CORPUS_TABS)[number]['id'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function table(head: string[], rows: string[][]): HTMLTableElement {
  const t = el('table', 'corpus-table');
  const tr = el('tr');
  for (const h of head) tr.appendChild(el('th', '', h));
  t.appendChild(el('thead')).appendChild(tr);
  const body = el('tbody');
  for (const r of rows) {
    const row = el('tr');
    for (const c of r) row.appendChild(el('td', '', c));
    body.appendChild(row);
  }
  t.appendChild(body);
  return t;
}

function stat(label: string, value: string): HTMLElement {
  const d = el('div', 'corpus-stat');
  d.append(el('span', 'corpus-stat-value', value), el('span', 'corpus-stat-label', label));
  return d;
}

export function renderOverview(o: CorpusOverview): HTMLElement {
  const page = el('div', 'corpus-overview');
  const stats = el('div', 'corpus-stats');
  stats.append(
    stat('words', o.word_count.toLocaleString('en-US')),
    stat('passages', o.entry_count.toLocaleString('en-US')),
    stat('sections', String(o.sections.length)),
    stat('source', o.source),
  );
  const terms = el('p', 'corpus-terms');
  terms.append(el('span', 'corpus-key', 'top terms'));
  for (const t of o.top_terms.slice(0, 25)) terms.appendChild(el('span', 'corpus-term', `${t.term} ${t.count}`));
  const sections = table(
    ['section', 'kind', 'KIDs', 'words'],
    o.sections.map((s) => [s.name, s.kind, `${renderKid(s.start_kid)} to ${renderKid(s.end_kid)}`, s.word_count.toLocaleString('en-US')]),
  );
  const ends = el('div', 'corpus-ends');
  for (const [k, v] of [['opening', o.opening_excerpt], ['closing', o.closing_excerpt]] as const) {
    const q = el('blockquote', 'corpus-excerpt');
    q.append(el('span', 'corpus-key', k), el('span', '', v));
    ends.appendChild(q);
  }
  page.append(stats, terms, sections, ends, el('p', 'corpus-built', `built by ${o.built_by}`));
  return page;
}

export function renderNouns(n: CorpusNouns): HTMLElement {
  const page = el('div', 'corpus-nouns');
  const kinds = [...new Set(n.nouns.map((x) => x.kind))].sort();
  const bar = el('div', 'corpus-filter');
  const count = el('p', 'list-meta', plural(n.nouns.length, 'noun', 'nouns'));
  const body = el('div', 'corpus-nouns-body');
  const show = (kind: string): void => {
    const rows = n.nouns.filter((x) => kind === '' || x.kind === kind);
    count.textContent = `${plural(rows.length, 'noun', 'nouns')}${kind ? ` (${kind})` : ''}`;
    body.replaceChildren(
      rows.length === 0
        ? el('p', 'empty-state empty-line', 'No nouns of this kind.')
        : table(
            ['noun', 'kind', 'passages', 'first KID', 'KIDs'],
            rows.map((x) => [x.noun, x.kind, String(x.count), renderKid(x.first_kid), x.kids.map(renderKid).join(', ')]),
          ),
    );
  };
  for (const k of ['', ...kinds]) {
    const b = el('button', 'corpus-kind', k === '' ? 'all' : k);
    b.type = 'button';
    b.addEventListener('click', () => show(k));
    bar.appendChild(b);
  }
  page.append(bar, count, body);
  show('');
  return page;
}

export class CorpusView {
  private container: HTMLElement | null = null;
  private token = 0;
  private adapter: SeamAdapter;
  private tab: CorpusTab;

  constructor(adapter: SeamAdapter, tab: CorpusTab) {
    this.adapter = adapter;
    this.tab = tab;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    const page = el('div', 'erie-page corpus-page');
    const head = el('header', 'erie-head');
    head.appendChild(el('h1', 'erie-name', 'Corpus'));
    const nav = el('div', 'corpus-tabs');
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'Corpus views');
    for (const [href, text] of [['/research', 'ERIE'], ...CORPUS_TABS.map((t) => [`/research/${t.id}`, t.label] as const)]) {
      const a = el('a', href === `/research/${this.tab}` ? 'is-current' : '', text);
      a.setAttribute('href', href);
      nav.appendChild(a);
    }
    head.appendChild(nav);
    const body = el('div', 'view-body corpus-body');
    body.dataset.view = 'Research';
    body.dataset.corpus = this.tab;
    body.appendChild(el('p', 'prompt-state', 'Reading the corpus...'));
    page.append(head, body);
    container.replaceChildren(page);
    void this.load(body);
  }

  private async load(body: HTMLElement): Promise<void> {
    const token = ++this.token;
    const reads = this.adapter.corpus;
    const done = (r: AdapterResult<unknown>, draw: () => Node): void => {
      if (token !== this.token) return;
      body.replaceChildren(r.ok ? draw() : el('p', 'error-state', r.error));
    };
    if (!reads) return done({ ok: false, error: 'This adapter has no corpus reads (Sherlock is not wired)' }, () => body);
    try {
      if (this.tab === 'overview') {
        const r = await reads.overview();
        done(r, () => renderOverview((r as { data: CorpusOverview }).data));
      } else if (this.tab === 'nouns') {
        const r = await reads.nouns();
        done(r, () => renderNouns((r as { data: CorpusNouns }).data));
      } else {
        const r = await reads.graph();
        done(r, () => {
          const g = (r as { ok: true; data: Parameters<typeof renderGraphSvg>[0] }).data;
          const shown = pick(g);
          const wrap = el('div', 'corpus-graph');
          const note = `${shown.nodes.length} of ${plural(g.nodes.length, 'noun', 'nouns')} drawn (the ${MAX_NODES} most common), ${plural(shown.edges.length, 'link', 'links')}. Size is how many passages a noun is in; a line is two nouns in one passage.`;
          wrap.append(el('p', 'list-meta', note), shown.nodes.length === 0 ? el('p', 'empty-state empty-line', 'The graph has no nouns.') : renderGraphSvg(g));
          return wrap;
        });
      }
    } catch (e) {
      done({ ok: false, error: `The corpus read failed: ${e instanceof Error ? e.message : String(e)}` }, () => body);
    }
  }

  unmount(): void {
    this.token++;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
