import type { ChatTurn } from '../adapter/seam.ts';

const NOT_ACTED = 'did not act this turn';

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function engineRow(cls: string, label: string): { row: HTMLElement; body: HTMLElement } {
  const row = el('div', `engine ${cls}`);
  row.appendChild(el('span', 'engine-label', label));
  const body = el('span', 'engine-body');
  row.appendChild(body);
  return { row, body };
}

/** Render one chat turn: user message, ARCHE reply, and the four-engine panel. */
export function renderChatTurn(turn: ChatTurn): HTMLElement {
  const root = el('div', turn.known ? 'chat-turn' : 'chat-turn not-knowing');

  root.appendChild(el('p', 'chat-user', turn.message));
  root.appendChild(el('p', 'chat-arche', turn.engines.arche.reply));

  const engines = el('div', 'engines');

  const arche = engineRow('engine-arche', 'ARCHE');
  arche.body.textContent = 'talked';
  engines.appendChild(arche.row);

  const erie = engineRow('engine-erie', 'ERIE');
  const ask = turn.engines.erie;
  if (ask) {
    erie.body.appendChild(
      el('span', 'engine-action', ask.state === 'found' ? 'found' : 'looked, found nothing'),
    );
    erie.body.appendChild(el('span', 'engine-text', ask.text));
    const ul = el('ul', 'provenance');
    for (const p of ask.provenance) {
      const li = el('li', '');
      li.appendChild(el('span', 'prov-source', p.source));
      li.appendChild(el('span', 'prov-content', p.content));
      li.appendChild(el('span', 'prov-excerpt', p.excerpt));
      ul.appendChild(li);
    }
    erie.body.appendChild(ul);
  } else {
    erie.body.textContent = NOT_ACTED;
  }
  engines.appendChild(erie.row);

  const elle = engineRow('engine-elle', 'ELLE');
  const lesson = turn.engines.elle;
  if (lesson) {
    elle.body.appendChild(el('span', 'engine-action', 'learned'));
    elle.body.appendChild(el('span', 'engine-text', lesson.rule ?? lesson.detail));
  } else {
    elle.body.textContent = NOT_ACTED;
  }
  engines.appendChild(elle.row);

  const katie = engineRow('engine-katie', 'KATIE');
  const updates = turn.engines.katie;
  if (updates.length > 0) {
    katie.body.appendChild(el('span', 'engine-action', 'recorded'));
    for (const u of updates) {
      const a = document.createElement('a');
      a.className = 'katie-link';
      a.setAttribute(
        'href',
        `/entry/${u.kid}/${encodeURIComponent(u.subject)}/${encodeURIComponent(u.entry_id)}`,
      );
      a.textContent = u.entry_id;
      katie.body.appendChild(a);
    }
  } else {
    katie.body.textContent = NOT_ACTED;
  }
  engines.appendChild(katie.row);

  root.appendChild(engines);
  return root;
}
