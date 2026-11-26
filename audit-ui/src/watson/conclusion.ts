import type { AskResult, Entry, SeamAdapter } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';
import { kidText } from '../util/sherlock-notes.ts';
import type { WatsonBridge, WatsonConclusion, WatsonInput } from './bridge.ts';

/**
 * Watson's conclusion beside an ERIE answer. It never rewrites the
 * answer: it is appended next to it, in its own box, or not at all.
 *
 * The KIDs: the connector's provenance names each hit by its entry id
 * (`content`), not its KID, so the caller resolves the KID from the
 * record (GET /entries, the same read every view uses). A citation whose
 * entry is not in the record goes without a KID; it is never invented.
 */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

/** The bridge's input for one answer, each citation carrying its KID. */
export function watsonInput(answer: AskResult, entries: Entry[]): WatsonInput {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return {
    question: answer.question,
    answer: answer.text,
    citations: answer.provenance.map((p) => {
      const e = byId.get(p.content);
      const k = kidText(p);
      if (k !== undefined && p.kind === 'k_entry') return { source: p.source, content: p.excerpt, kid: k };
      return e ? { source: p.source, content: p.excerpt, kid: renderKid(e.kid) } : { source: p.source, content: p.excerpt };
    }),
  };
}

export function renderConclusion(c: WatsonConclusion): HTMLElement {
  const box = el('aside', 'watson-conclusion');
  box.setAttribute('aria-label', 'Watson');
  const head = el('p', 'watson-head');
  head.append(el('span', 'watson-name', 'WATSON'), el('span', 'watson-confidence', `confidence ${c.confidence.toFixed(2)}`));
  box.append(head, el('p', 'watson-summary', c.summary));
  if (c.claims.length) {
    const ul = el('ul', 'watson-claims');
    for (const claim of c.claims) {
      const li = el('li', 'watson-claim');
      li.dataset.status = claim.status;
      li.append(el('span', 'watson-claim-text', claim.text),
        el('span', 'watson-claim-status', `${claim.status} · ${claim.confidence.toFixed(2)}`));
      const kids = [...new Set(c.citations.filter((x) => x.claimId === claim.id).map((x) => x.kid ?? 'no KID'))];
      if (kids.length) li.appendChild(el('span', 'watson-claim-kids', kids.map((k) => (k === 'no KID' ? k : `KID ${k}`)).join(', ')));
      ul.appendChild(li);
    }
    box.appendChild(ul);
  }
  return box;
}

/** Entries read once per Watson pass (a page's worth of answers share it). */
export class WatsonCaller {
  private entries: Promise<Entry[] | null> | null = null;
  private memo = new Map<string, Promise<WatsonConclusion | null>>();
  private readonly adapter: SeamAdapter;
  private readonly bridge: WatsonBridge;

  constructor(adapter: SeamAdapter, bridge: WatsonBridge) {
    this.adapter = adapter;
    this.bridge = bridge;
  }

  private readEntries(): Promise<Entry[] | null> {
    this.entries ??= this.adapter.fetchAllEntries().then((r) => (r.ok ? r.data : null), () => null);
    return this.entries;
  }

  /** Watson's conclusion for one answer, or null (no conclusion shows). Never throws. */
  conclude(answer: AskResult): Promise<WatsonConclusion | null> {
    if (answer.state !== 'found' || answer.provenance.length === 0) return Promise.resolve(null);
    const key = JSON.stringify([answer.question, answer.text, answer.provenance.map((p) => p.content)]);
    let p = this.memo.get(key);
    if (!p) {
      p = (async () => {
        const entries = (await this.readEntries()) ?? [];
        // A KID the record does not know is never sent; an answer with no
        // resolvable KID still goes, its citations marked as having none.
        return this.bridge.report(watsonInput(answer, entries)).catch(() => null);
      })();
      this.memo.set(key, p);
      // A failed call is not kept: the next showing tries again.
      void p.then((c) => { if (c === null) this.memo.delete(key); });
    }
    return p;
  }

  /** Append Watson's conclusion beside `host` when it comes; nothing on a failure. */
  attach(host: HTMLElement, answer: AskResult): Promise<void> {
    return this.conclude(answer).then((c) => {
      if (c && host.isConnected !== false) host.appendChild(renderConclusion(c));
    });
  }
}
