import type { ChatTurn, Register, ReplyLink } from '../adapter/seam.ts';
import { provenanceChannel } from '../shell/provenance-channel.ts';
import { VOICE_LABELS } from './voices.ts';
import { renderEngineBoxes } from './engine-boxes.ts';

/**
 * One chat turn as two bubbles: the user's message (right) and the voice's
 * reply (left), in that voice's accent, with the engine boxes (KTIE, ERIE,
 * ELLE) down the reply's right side. The engines' work is not shown here; it lives in
 * the activity feed in the right column.
 */

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** The spans the responder authored, in order; any span that is out of range or overlaps is dropped. */
export function validLinks(reply: string, links: ReplyLink[] | undefined): ReplyLink[] {
  if (!links) return [];
  const sorted = [...links].sort((a, b) => a.start - b.start);
  const out: ReplyLink[] = [];
  let cursor = 0;
  for (const l of sorted) {
    const ok =
      Number.isInteger(l.start) && Number.isInteger(l.end) &&
      l.start >= cursor && l.end > l.start && l.end <= reply.length;
    if (!ok) continue;
    out.push(l);
    cursor = l.end;
  }
  return out;
}

function provenanceLink(text: string, l: ReplyLink): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'provenance-link';
  // A real href (keyboard + middle-click work), but activating it here
  // highlights the work column instead of changing the route.
  a.setAttribute('href', `/entry/${l.kid}/${encodeURIComponent(l.subject)}/${encodeURIComponent(l.entry_id)}`);
  a.dataset.kid = String(l.kid);
  a.dataset.subject = l.subject;
  a.dataset.entryId = l.entry_id;
  a.title = `Recorded: ${l.subject} (KID ${l.kid}). Shows the record entry in the work column.`;
  a.textContent = text;
  const go = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    provenanceChannel.publish({ kid: l.kid, subject: l.subject, entry_id: l.entry_id });
  };
  a.addEventListener('click', go);
  a.addEventListener('keydown', (e) => {
    if (e.key === ' ') go(e); // Enter already fires click on a link
  });
  return a;
}

/** Reply text with the responder's link spans turned into links. */
export function renderReplyText(reply: string, links: ReplyLink[] | undefined): Node[] {
  const nodes: Node[] = [];
  let at = 0;
  for (const l of validLinks(reply, links)) {
    if (l.start > at) nodes.push(document.createTextNode(reply.slice(at, l.start)));
    nodes.push(provenanceLink(reply.slice(l.start, l.end), l));
    at = l.end;
  }
  if (at < reply.length) nodes.push(document.createTextNode(reply.slice(at)));
  return nodes;
}

/**
 * Render one turn. `voice` is the voice that replied (null if none was
 * recorded); `turnIndex` is the turn's place in the log (the engine boxes
 * name it when they ask the telemetry column for this turn's detail).
 */
export function renderChatTurn(turn: ChatTurn, voice: Register | null, turnIndex: number): HTMLElement {
  const name = voice ? `Frankenstein (${VOICE_LABELS[voice].name})` : 'Frankenstein';
  const root = el('div', turn.known ? 'chat-turn' : 'chat-turn not-knowing');

  const userRow = el('div', 'bubble-row bubble-row-user');
  const user = el('p', 'bubble chat-user');
  user.append(el('span', 'sr-only', 'You said: '), document.createTextNode(turn.message));
  userRow.appendChild(user);
  root.appendChild(userRow);

  const replyRow = el('div', 'bubble-row bubble-row-reply');
  const bubble = el('div', 'bubble chat-reply');
  if (voice) bubble.dataset.voice = voice;
  const who = el('p', 'bubble-name', name);
  who.setAttribute('aria-hidden', 'true');
  const text = el('p', 'bubble-text');
  text.append(el('span', 'sr-only', `${name} replied: `), ...renderReplyText(turn.engines.arche.reply, turn.links));
  bubble.append(who, text);
  replyRow.append(bubble, renderEngineBoxes(turn, turnIndex));
  root.appendChild(replyRow);

  return root;
}
