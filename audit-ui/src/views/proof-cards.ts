import type { AdapterResult, ChatTurn, Entry, ReplyLink } from '../adapter/seam.ts';
import { validLinks } from './chat-turn.ts';

/**
 * Proof-anchor cards under a reply: one card per record entry the reply's
 * links point at. A card shows only what the live link carries (KID,
 * subject, entry id) plus the entry read live from the connector (its
 * reason), and an Inspect link to Entry Detail. A reply with no links gets
 * no cards.
 */

/** Reads one entry live. ok + null = the record has no such entry. */
export type EntryLoader = (kid: number, subject: string, entryId: string) => Promise<AdapterResult<Entry | null>>;

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function entryHref(l: ReplyLink): string {
  return `/entry/${l.kid}/${encodeURIComponent(l.subject)}/${encodeURIComponent(l.entry_id)}`;
}

/** The distinct entries a reply's valid links point at, in reply order. */
export function linkedEntries(turn: ChatTurn): ReplyLink[] {
  const seen = new Set<string>();
  const out: ReplyLink[] = [];
  for (const l of validLinks(turn.engines.arche.reply, turn.links)) {
    const key = `${l.kid}|${l.subject}|${l.entry_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

export function renderProofCards(turn: ChatTurn, load: EntryLoader): HTMLElement | null {
  const links = linkedEntries(turn);
  if (links.length === 0) return null;
  const box = el('section', 'proof-cards');
  box.setAttribute('aria-label', 'Proof for this reply');
  const list = el('ul', 'proof-list');
  for (const l of links) {
    const card = el('li', 'proof-card');
    card.dataset.kid = String(l.kid);
    card.dataset.subject = l.subject;
    card.dataset.entryId = l.entry_id;
    const head = el('p', 'proof-head');
    head.append(el('span', 'proof-kid', `KID ${l.kid}`), el('span', 'proof-subject', l.subject));
    const reason = el('p', 'proof-reason', 'Reading the entry...');
    reason.dataset.state = 'loading';
    const inspect = document.createElement('a');
    inspect.className = 'proof-inspect';
    inspect.setAttribute('href', entryHref(l));
    inspect.textContent = 'Inspect \u2192';
    card.append(head, reason, inspect);
    list.appendChild(card);
    void load(l.kid, l.subject, l.entry_id).then((r) => {
      if (!r.ok) {
        reason.textContent = r.error;
        reason.dataset.state = 'error';
      } else if (r.data === null) {
        reason.textContent = 'This entry is not in the record.';
        reason.dataset.state = 'missing';
      } else {
        reason.textContent = r.data.reason;
        reason.dataset.state = 'ok';
      }
    });
  }
  box.appendChild(list);
  return box;
}
