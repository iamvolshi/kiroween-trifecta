import { parseContent, type AccountRecord, type Interval, type Result, type TrifactaClient } from './trifacta.ts';
import { el } from './dom.ts';

/** The question PEEP opens with: it shows the bad import and its correction. */
export const PEEP_QUESTION = 'What city does Darren live in?';

/**
 * PEEP sees, it never interprets: the trace of one query. The question,
 * the POST /ask call, and what came back: each K-record entry the
 * retrieval touched, the authority on it (read from GET /record), and the
 * provenance behind the answer, as the API sent it.
 */
export class PeepTab {
  readonly section: HTMLElement;
  private readonly out: HTMLElement;
  private readonly input: HTMLInputElement;
  private token = 0;
  private readonly api: TrifactaClient;

  constructor(api: TrifactaClient) {
    this.api = api;
    this.section = el('section', 'peep');
    this.section.dataset.tab = 'peep';
    const form = el('form', 'peep-form');
    this.input = el('input', 'peep-q') as HTMLInputElement;
    this.input.type = 'text';
    this.input.value = PEEP_QUESTION;
    this.input.setAttribute('aria-label', 'Question');
    const go = el('button', 'peep-ask', 'Ask') as HTMLButtonElement;
    go.type = 'submit';
    form.append(this.input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.run(this.input.value);
    });
    this.out = el('div', 'peep-out');
    this.out.appendChild(el('p', 'insp-empty', 'No query run yet.'));
    this.section.append(form, this.out);
  }

  async run(question: string): Promise<void> {
    const q = question.trim();
    if (q === '') return;
    const token = ++this.token;
    this.out.replaceChildren(el('p', 'insp-empty', `POST /ask … ${q}`));
    const r = await this.api.ask(q);
    if (token !== this.token) return;
    if (!r.ok) {
      this.out.replaceChildren(el('p', 'insp-error', r.error));
      return;
    }
    // The authority on each entry is the record's own, read from GET /record.
    const accounts = [...new Set(r.data.provenance.map((p) => parseContent(p.content)?.account).filter((a): a is string => !!a))];
    const records = new Map<string, Result<AccountRecord>>();
    await Promise.all(accounts.map(async (a) => records.set(a, await this.api.record(a))));
    if (token !== this.token) return;

    const head = el('dl', 'peep-call');
    const pair = (k: string, v: string) => head.append(el('dt', '', k), el('dd', '', v));
    pair('call', 'POST /ask');
    pair('question', r.data.question ?? q);
    pair('state', r.data.state);
    pair('text', r.data.text);
    if (r.data.docket_id) pair('docket', r.data.docket_id);
    pair('touched', String(r.data.provenance.length));

    const list = el('ol', 'peep-hits');
    for (const p of r.data.provenance) {
      const li = el('li', 'peep-hit');
      const parts = parseContent(p.content);
      const rec = parts ? records.get(parts.account) : undefined;
      const hit: Interval | undefined = parts && rec?.ok
        ? rec.data.fields[parts.field]?.find((i) => i.k_start === parts.kStart && i.k_end === parts.kEnd)
        : undefined;
      const top = el('p', 'peep-hit-top');
      top.append(el('span', 'peep-content', p.content));
      if (hit) {
        top.append(el('span', 'insp-auth', `authority ${hit.authority}`), el('span', 'insp-state', hit.state));
      } else if (rec && !rec.ok) {
        top.append(el('span', 'insp-error', rec.error));
      } else {
        top.append(el('span', 'insp-auth', 'authority: not in the record read'));
      }
      li.append(top, el('p', 'peep-source', p.source));
      if (p.excerpt) li.append(el('p', 'peep-excerpt', p.excerpt));
      if (hit) li.append(el('p', 'insp-hash', `KID ${hit.kid} · ${hit.entry_hash}`));
      list.appendChild(li);
    }
    this.out.replaceChildren(head, r.data.provenance.length ? list : el('p', 'insp-empty', 'The retrieval touched nothing.'));
  }
}
