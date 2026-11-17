import type { View } from '../router/router.ts';
import type { SeamAdapter, Entry, KidMap } from '../adapter/seam.ts';
import { compareKStart } from '../util/interval.ts';
import { fillRecordCard } from './record-card.ts';
import { createIntro } from './intro.ts';

export class EntryDetailView implements View {
  private adapter: SeamAdapter;
  private kid: number;
  private subject: string;
  private id: string;
  private container: HTMLElement | null = null;
  private body: HTMLElement | null = null;

  constructor(adapter: SeamAdapter, kid: number, subject: string, id: string) {
    this.adapter = adapter;
    this.kid = kid;
    this.subject = subject;
    this.id = id;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    this.body = document.createElement('div');
    this.body.className = 'view-body';
    container.appendChild(this.body);
    void this.render(container);
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
    this.body = null;
  }

  private async render(container: HTMLElement): Promise<void> {
    const [chainResult, kidMapResult] = await Promise.all([
      this.adapter.fetchChain(this.kid, this.subject),
      this.adapter.fetchKidMap(),
    ]);

    // Guard: container may have been unmounted while awaiting
    if (this.container !== container) return;
    const body = this.body;
    if (!body) return;

    if (!chainResult.ok) {
      const errP = document.createElement('p');
      errP.className = 'error-state';
      errP.textContent = chainResult.error;
      body.replaceChildren(errP);
      return;
    }

    const chain = chainResult.data;

    if (chain.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No chain entries found.';
      body.replaceChildren(p);
      return;
    }

    const kidMap: KidMap | null = kidMapResult.ok ? kidMapResult.data : null;

    const primary = chain.find(e => e.id === this.id);
    if (!primary) {
      // Never show another entry's data for an id that matched nothing.
      const section = document.createElement('section');
      section.className = 'not-found entry-not-found';
      const h1 = document.createElement('h1');
      h1.textContent = 'Entry not found';
      const p = document.createElement('p');
      p.textContent = `No entry with id "${this.id}" exists for KID ${this.kid}, subject "${this.subject}".`;
      section.appendChild(h1);
      section.appendChild(createIntro('entry'));
      section.appendChild(p);
      body.replaceChildren(section);
      return;
    }

    body.replaceChildren(
      this.renderPrimary(primary, kidMap),
      this.renderChain(chain),
    );
  }

  private renderKidField(kid: number, kidMap: KidMap | null): string {
    if (kidMap !== null && kidMap[kid] !== undefined) {
      return `${kid} <span class="kid-label">${escapeHtml(kidMap[kid])}</span>`;
    }
    return String(kid);
  }

  private renderPrimary(entry: Entry, kidMap: KidMap | null): HTMLElement {
    const section = document.createElement('section');
    section.className = 'entry-primary';

    const h1 = document.createElement('h1');
    h1.textContent = 'Entry Detail';
    section.appendChild(h1);
    section.appendChild(createIntro('entry'));

    const dl = document.createElement('dl');

    const fields: Array<[string, string, string]> = [
      ['KID',                'kid',       this.renderKidField(entry.kid, kidMap)],
      ['Subject',            'subject',   escapeHtml(entry.subject)],
      ['State',              'state',     escapeHtml(entry.state)],
      ['Authority',          'authority', escapeHtml(String(entry.authority))],
      ['Pool',               'pool',      escapeHtml(entry.pool)],
      ['K-Start',            'k-start',   escapeHtml(entry.k_start)],
      ['T-Time (wall)',      't-time',    escapeHtml(entry.t_time)],
      ['E-Time (event)',     'e-time',    escapeHtml(entry.e_time)],
      ['K-Time (knowledge)', 'k-time',    escapeHtml(entry.k_time)],
      ['Evidence',           'evidence',  escapeHtml(entry.evidence)],
      ['Reason',             'reason',    escapeHtml(entry.reason)],
      ['Prev Hash',          'prev-hash', escapeHtml(entry.prev_hash)],
    ];

    for (const [label, cls, html] of fields) {
      const dt = document.createElement('dt');
      dt.textContent = label;

      const dd = document.createElement('dd');
      dd.className = cls;
      dd.innerHTML = html;

      dl.appendChild(dt);
      dl.appendChild(dd);
    }

    section.appendChild(dl);
    return section;
  }

  private renderChain(chain: Entry[]): HTMLElement {
    const section = document.createElement('section');
    section.className = 'entry-chain';

    const h2 = document.createElement('h2');
    h2.textContent = 'Chain History';
    section.appendChild(h2);

    const ol = document.createElement('ol');
    ol.className = 'chain-list';

    // Ascending order: oldest first by k_start
    const sorted = [...chain].sort(compareKStart);

    for (const e of sorted) {
      const li = document.createElement('li');
      li.className = 'chain-entry';
      fillRecordCard(li, e, null, {
        fields: ['authority', 'state', 'k-start', 'reason', 'evidence', 'k-time'],
      });
      ol.appendChild(li);
    }

    section.appendChild(ol);
    return section;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
