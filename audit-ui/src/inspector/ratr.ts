import { DEMO_ACCOUNTS, flatten, type TrifactaClient } from './trifacta.ts';
import { el } from './dom.ts';

const COLUMNS = ['k_start', 'k_end', 'field', 'value', 'state', 'authority', 'KID', 'entry_hash', 'reason'];

/**
 * RATR is the outside witness: the record of what occurred, not the
 * system's story about itself. GET /record/{account} as a flat list of
 * every interval, then GET /insights and GET /lessons as the API sent them.
 */
export class RatrTab {
  readonly section: HTMLElement;
  private readonly pick: HTMLSelectElement;
  private readonly log: HTMLElement;
  private readonly pool: HTMLElement;
  private readonly lessons: HTMLElement;
  private token = 0;
  private readonly api: TrifactaClient;

  constructor(api: TrifactaClient) {
    this.api = api;
    this.section = el('section', 'ratr');
    this.section.dataset.tab = 'ratr';
    const bar = el('label', 'ratr-pick', 'account ');
    this.pick = el('select', 'ratr-account');
    for (const a of DEMO_ACCOUNTS) {
      const o = el('option', '', a);
      o.value = a;
      this.pick.appendChild(o);
    }
    this.pick.addEventListener('change', () => void this.load());
    bar.appendChild(this.pick);
    this.log = el('div', 'ratr-log');
    this.pool = el('div', 'ratr-insights');
    this.lessons = el('div', 'ratr-lessons');
    this.section.append(bar, this.log,
      el('h3', 'insp-head', 'GET /insights'), this.pool,
      el('h3', 'insp-head', 'GET /lessons'), this.lessons);
  }

  get account(): string {
    return this.pick.value;
  }

  async load(): Promise<void> {
    const token = ++this.token;
    const account = this.account;
    this.log.replaceChildren(el('p', 'insp-empty', `GET /record/${account} …`));
    const [rec, ins, les] = await Promise.all([this.api.record(account), this.api.insights(), this.api.lessons()]);
    if (token !== this.token) return;

    if (!rec.ok) {
      this.log.replaceChildren(el('p', 'insp-error', rec.error));
    } else {
      const rows = flatten(rec.data);
      const table = el('table', 'ratr-table');
      const head = el('tr');
      for (const c of COLUMNS) head.appendChild(el('th', '', c));
      table.appendChild(el('thead')).appendChild(head);
      const body = table.appendChild(el('tbody'));
      for (const r of rows) {
        const tr = el('tr');
        tr.dataset.authority = String(r.authority);
        const cells = [String(r.k_start), r.k_end === null ? 'live' : String(r.k_end), r.field,
          typeof r.value === 'string' ? r.value : JSON.stringify(r.value), r.state, String(r.authority),
          r.kid, r.entry_hash, r.reason];
        cells.forEach((v, i) => {
          const td = tr.appendChild(el('td', `ratr-${COLUMNS[i]!.toLowerCase()}`, v));
          td.title = v; // a cut-short KID or hash reads whole on hover
        });
        body.appendChild(tr);
      }
      this.log.replaceChildren(
        el('p', 'insp-meta', `GET /record/${rec.data.account_id} · ${rows.length} intervals`),
        rows.length ? table : el('p', 'insp-empty', 'The record holds no interval for this account.'),
      );
    }

    if (!ins.ok) {
      this.pool.replaceChildren(el('p', 'insp-error', ins.error));
    } else {
      const d = ins.data;
      const dl = el('dl', 'ratr-counts');
      const pairs: Array<[string, unknown]> = [
        ['accounts', d.accounts], ['entries', d.entries], ['kids', d.kids], ['standing', d.standing_values],
        ['superseded', d.superseded_values], ['held', d.held_candidates], ['confirmed', d.confirmed_standing],
        ['k range', `${d.k_min}-${d.k_max}`], ['fields', d.distinct_fields],
        ['authority 0-9', Object.keys(d.authority_distribution).sort().map((k) => d.authority_distribution[k]).join(' ')],
      ];
      for (const [k, v] of pairs) dl.append(el('dt', '', k), el('dd', '', String(v)));
      this.pool.replaceChildren(dl);
    }

    if (!les.ok) {
      this.lessons.replaceChildren(el('p', 'insp-error', les.error));
    } else {
      const d = les.data;
      const ul = el('ul', 'ratr-events');
      for (const e of d.events) ul.appendChild(el('li', '', `${e.event_type} · ${e.gossip_state ?? ''} · ${e.event_id}`));
      this.lessons.replaceChildren(
        el('p', 'insp-meta', `${d.events_recorded} events recorded · ${d.rules_formed.length} rules formed`),
        d.events.length ? ul : el('p', 'insp-empty', 'No lesson event on the record.'),
      );
    }
  }
}
