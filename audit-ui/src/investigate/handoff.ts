// The deep-investigation handoff: Sherlock investigates, Watson concludes, and the
// picked persona says it in its own voice. Three calls in a row, each failing in
// words and never replaced by a made-up answer:
//   1. Sherlock  (the book's ask, or the attached repo's ask) -> the clinical report + provenance
//   2. Watson    (the bridge's POST /report, deterministic)   -> a conclusion with claims and KIDs
//   3. Connector (POST /chat, the picked persona)             -> the same facts, in the voice
// The voice step only gets what steps 1 and 2 returned; its message tells it to add nothing.
import type { AdapterResult, AskResult, ChatTurn, Provenance, Register, SeamAdapter } from '../adapter/seam.ts';
import type { RepoAnswer } from '../adapter/github-client.ts';
import type { RepoSession } from '../views/repo-session.ts';
import type { WatsonBridge, WatsonConclusion, WatsonInput } from '../watson/bridge.ts';
import { kidText } from '../util/sherlock-notes.ts';

/** What one investigation produced. Every part is real output of the call that made it. */
export interface Investigation {
  question: string;
  /** Where Sherlock looked: the book's case or the attached repo. */
  source: string;
  voice: Register;
  /** Sherlock's report; null when Sherlock failed (then `error` says why). */
  report: AskResult | null;
  /** Watson's conclusion; null when Watson gave none. */
  conclusion: WatsonConclusion | null;
  /** The persona's reply; null when the voice step did not happen or failed. */
  reply: ChatTurn | null;
  /** Plain words for each step that failed or was skipped. Empty = all three answered. */
  problems: string[];
}

export interface InvestigateDeps {
  /** The Sherlock adapter: its ask() investigates the book's case. */
  sherlock: SeamAdapter;
  /** The connector adapter: its chat() speaks in the persona's voice. */
  voiceAdapter: SeamAdapter;
  bridge: WatsonBridge;
  repo: RepoSession | null;
}

/** A repo answer in the shape of a book answer, so one page shows both. */
export function repoAnswerAsAsk(a: RepoAnswer, question: string): AskResult {
  const provenance: Provenance[] = a.citations.map((c) => {
    const p: Provenance = { source: c.path, content: c.path, excerpt: c.excerpt };
    if (c.kid !== undefined) p.kid = c.kid;
    if (c.kid_label !== undefined) p.kid_label = c.kid_label;
    return p;
  });
  const r: AskResult = { question, state: a.state, text: a.text, provenance };
  if (a.status !== undefined) r.status = a.status;
  if (a.low_confidence !== undefined) r.low_confidence = a.low_confidence;
  if (a.rerank) r.rerank = a.rerank;
  return r;
}

/** The bridge's input: Sherlock's report with every citation carrying the KID Sherlock gave it. */
export function watsonInputFor(report: AskResult): WatsonInput {
  return {
    question: report.question,
    answer: report.text,
    citations: report.provenance.map((p) => {
      const kid = kidText(p);
      return kid === undefined ? { source: p.source, content: p.excerpt } : { source: p.source, content: p.excerpt, kid };
    }),
  };
}

/** The one message the persona gets: the question, the clinical report, the evidence with KIDs, Watson's conclusion. */
export function voiceMessage(question: string, report: AskResult, conclusion: WatsonConclusion | null): string {
  const evidence = report.provenance.map((p, i) => {
    const kid = kidText(p);
    return `${i + 1}. ${p.source}${kid === undefined ? '' : ` (KID ${kid})`}: ${p.excerpt}`;
  });
  const lines = [
    'Answer the question below in your own voice, in a few sentences.',
    'Use only the investigation that follows. Add no fact that is not in it. Name the source file or KID you rely on. If the investigation is unsure, say you are unsure.',
    '',
    `Question: ${question}`,
    '',
    `Sherlock's report: ${report.text}`,
    '',
    'Evidence:',
    ...evidence,
  ];
  if (conclusion) {
    lines.push('', `Watson's conclusion (confidence ${conclusion.confidence.toFixed(2)}): ${conclusion.summary}`);
    for (const c of conclusion.claims) lines.push(`- ${c.text} [${c.status}]`);
  }
  return lines.join('\n');
}

function sherlockFailure(error: string): string {
  return `Sherlock did not answer: ${error}`;
}

export async function investigate(deps: InvestigateDeps, question: string, voice: Register): Promise<Investigation> {
  const useRepo = deps.repo !== null && deps.repo.mode !== 'book';
  const out: Investigation = {
    question, voice, report: null, conclusion: null, reply: null, problems: [],
    source: useRepo ? (deps.repo?.mode === 'folder' ? `the attached local folder ${deps.repo.activeName}` : `the attached repo ${deps.repo?.status?.repo ?? ''}`.trim()) : 'the book (the Frankenstein case)',
  };

  // 1. Sherlock.
  let report: AdapterResult<AskResult>;
  try {
    if (useRepo && deps.repo) {
      const r = await deps.repo.askQuietActive(question);
      report = r.ok ? { ok: true, data: repoAnswerAsAsk(r.data, question) } : r;
    } else {
      report = await deps.sherlock.ask(question);
    }
  } catch (e) {
    report = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!report.ok) {
    out.problems.push(sherlockFailure(report.error));
    return out;
  }
  out.report = report.data;
  if (report.data.state !== 'found' || report.data.provenance.length === 0) {
    out.problems.push('Sherlock found nothing to back an answer. Watson and the voice were not asked.');
    return out;
  }

  // 2. Watson. null covers no address, no reply and a refusal: the page says Watson gave nothing.
  out.conclusion = await deps.bridge.report(watsonInputFor(report.data)).catch(() => null);
  if (out.conclusion === null) {
    out.problems.push('Watson gave no conclusion (the bridge is not set, did not answer, or refused). The voice speaks from Sherlock\'s report alone.');
  }

  // 3. The persona, through the connector.
  let turn: AdapterResult<ChatTurn>;
  try {
    turn = await deps.voiceAdapter.chat(voiceMessage(question, report.data, out.conclusion), { persona: 'Frankenstein', register: voice });
  } catch (e) {
    turn = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (turn.ok) out.reply = turn.data;
  else out.problems.push(`The voice did not answer: ${turn.error}. The report above is Sherlock's own.`);
  return out;
}
