// The words and small notes the views show for a Sherlock answer: which
// hit is a K entry (its K label and authority), how sure Sherlock is, and
// whether the reranker ordered the hits. Every field is optional: an answer
// without them (a plain passage, an older Sherlock) reads exactly as before.
import type { AskResult, Provenance } from '../adapter/seam.ts';
import { renderKid } from './kid-display.ts';

/** "K-0266, authority 8 of 9" for a K entry; "KID 12, authority 2 of 9" for a passage; '' when no KID rode along. */
export function kidWords(p: Provenance): string {
  const auth = p.authority === undefined ? '' : `, authority ${p.authority} of 9`;
  if (p.kind === 'k_entry' && p.kid_label) return `${p.kid_label}${auth}`;
  return p.kid === undefined ? '' : `KID ${renderKid(p.kid)}${auth}`;
}

/** The KID text a Watson citation carries: the K label for a K entry. */
export function kidText(p: Provenance): string | undefined {
  if (p.kind === 'k_entry' && p.kid_label) return p.kid_label;
  return p.kid === undefined ? undefined : renderKid(p.kid);
}

/** A sentence when Sherlock is weakly sure; '' for a confident or plain answer. */
export function weakWords(a: AskResult): string {
  if (a.low_confidence !== true && a.status !== 'WEAK_SUPPORT') return '';
  return 'Sherlock is only weakly sure of this answer. These are its best matches, not a confirmed answer.';
}

/** A small line saying whether the reranker ordered the hits; '' when Sherlock said nothing. */
export function rerankWords(a: AskResult): string {
  const r = a.rerank;
  if (!r) return '';
  if (r.used) return `Reranked by ${r.model ?? 'the reranker'}.`;
  return r.error ? `Not reranked (first-stage order): ${r.error}` : 'Not reranked (first-stage order).';
}

/** The notes block under an answer: the weak-sure sentence and the rerank line. Null when there is nothing to say. */
export function answerNotes(a: AskResult): HTMLElement | null {
  const weak = weakWords(a);
  const rerank = rerankWords(a);
  if (!weak && !rerank) return null;
  const box = document.createElement('div');
  box.className = 'sherlock-notes';
  if (weak) {
    const p = document.createElement('p');
    p.className = 'sherlock-weak';
    p.setAttribute('role', 'note');
    p.textContent = weak;
    box.appendChild(p);
  }
  if (rerank) {
    const p = document.createElement('p');
    p.className = 'sherlock-rerank';
    p.textContent = rerank;
    box.appendChild(p);
  }
  return box;
}
