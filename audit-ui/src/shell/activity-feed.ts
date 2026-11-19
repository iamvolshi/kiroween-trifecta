import type { ChatTurn, Entry, Lesson } from '../adapter/seam.ts';

/**
 * The work column's activity feed, as data: one item per ERIE / ELLE /
 * KATIE event in the played turns, oldest first (a terminal: the newest
 * line is appended at the bottom). Built only from the
 * ChatLog's turns and the record entries the seam returned. ARCHE is not
 * here: the chat itself is the persona talking.
 */

export type Engine = 'ERIE' | 'ELLE' | 'KATIE';

export interface FeedItem {
  /** Stable identity: `t<turn>-<n>` (n counts events inside the turn). */
  id: string;
  engine: Engine;
  /** One plain-words sentence. */
  text: string;
  /** ERIE: source and excerpt lines. */
  sources?: Array<{ source: string; excerpt: string }>;
  /** KATIE: the record entries of the turn, for Entry Detail links and provenance targets. */
  entries?: Array<{ kid: number; subject: string; entry_id: string; evidence: string | null }>;
  /** The user message of the turn the event belongs to, and its step. */
  from: { message: string; step: number | null };
}

const rule = (l: Lesson): string => l.rule ?? l.detail;

/**
 * Events of one turn in the order they happen: lessons read into the prompt,
 * the retrieval, the record write, then the lessons ELLE recorded or promoted
 * from the turn.
 */
function eventsOf(t: ChatTurn, entries: Entry[]): Array<Omit<FeedItem, 'id' | 'from'>> {
  const out: Array<Omit<FeedItem, 'id' | 'from'>> = [];
  if (!t || !t.engines) return out; // a malformed turn from the seam adds no items
  for (const l of t.engines.lessons_in_prompt?.injected ?? []) {
    out.push({ engine: 'ELLE', text: `ELLE used a learned lesson in this reply: ${rule(l)}` });
  }
  for (const l of t.engines.lessons_in_prompt?.held ?? []) {
    out.push({ engine: 'ELLE', text: `ELLE held back a lesson that is not learned yet: ${rule(l)}` });
  }
  const ask = t.engines.erie;
  if (ask) {
    out.push(
      ask.state === 'found'
        ? {
            engine: 'ERIE',
            text: `ERIE found what this needs: ${ask.text}`,
            sources: ask.provenance.map((p) => ({ source: p.source, excerpt: p.excerpt })),
          }
        : { engine: 'ERIE', text: `ERIE found nothing for '${ask.question}'`, sources: [] },
    );
  }
  const written = t.engines.katie ?? [];
  if (written.length > 0) {
    // One KATIE item per turn; each written entry is a row inside it.
    out.push({
      engine: 'KATIE',
      text: `KTIE recorded ${written.length} ${written.length === 1 ? 'entry' : 'entries'} for this turn.`,
      entries: written.map((u) => {
        const e = entries.find((x) => x.id === u.entry_id && x.kid === u.kid && x.subject === u.subject);
        return { kid: u.kid, subject: u.subject, entry_id: u.entry_id, evidence: e ? e.evidence : null };
      }),
    });
  }
  if (t.engines.elle) out.push({ engine: 'ELLE', text: `ELLE recorded a lesson, not learned yet: ${rule(t.engines.elle)}` });
  if (t.engines.elle_promoted) {
    out.push({ engine: 'ELLE', text: `ELLE promoted a lesson: ${rule(t.engines.elle_promoted)}` });
  }
  return out;
}

/** One turn's events as feed items (ids `t<turn>-<n>`, the same in every view). */
function itemsOf(t: ChatTurn, ti: number, entries: Entry[]): FeedItem[] {
  return eventsOf(t, entries).map((ev, n) => ({ ...ev, id: `t${ti}-${n}`, from: { message: t.message, step: t.step } }));
}

/** Every turn's events, oldest first: the general feed. */
export function feedItems(turns: ChatTurn[], entries: Entry[]): FeedItem[] {
  return turns.flatMap((t, ti) => itemsOf(t, ti, entries));
}

/**
 * One engine's events on one turn, in the order they happened (injected,
 * held, retrieval, record write, recorded, promoted): the engine box's
 * detail. The words are the general feed's words. A turn the log does not
 * hold, or an engine that did nothing, gives [].
 */
export function engineItems(turns: ChatTurn[], turnIndex: number, engine: Engine, entries: Entry[]): FeedItem[] {
  const t = turns[turnIndex];
  if (!t) return [];
  return itemsOf(t, turnIndex, entries).filter((i) => i.engine === engine);
}
