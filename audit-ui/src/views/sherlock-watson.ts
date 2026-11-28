import type { View } from '../router/router.ts';
import type { AdapterResult, Register, SeamAdapter } from '../adapter/seam.ts';
import { CONNECTOR_URL } from '../adapter/connector-url.ts';
import { fetchModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import type { ChatLog } from './chat-log.ts';
import type { RepoSession } from './repo-session.ts';
import { renderVoicePicker } from './voice-picker.ts';
import { offeredVoices, VOICE_LABELS } from './voices.ts';
import { createWatsonBridge, type WatsonBridge } from '../watson/bridge.ts';
import { renderConclusion } from '../watson/conclusion.ts';
import { answerNotes, kidWords } from '../util/sherlock-notes.ts';
import { investigate, type Investigation } from '../investigate/handoff.ts';
import type { ModelSource } from './chat.ts';

/** What the header's view chip reads on this view. */
export const SW_VIEW_NAME = 'Sherlock & Watson';
/** The page's own words about what it is for. */
export const SW_PURPOSE =
  'For deep investigations. Ask a question: Sherlock investigates the attached source and writes a clinical report, Watson turns it into a conclusion, and the voice you pick says it in its own words. Every answer shows the files and KIDs behind it. For a quick talk, use Chat.';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

const CONNECTOR_MODELS: ModelSource = { status: () => fetchModelStatus(CONNECTOR_URL) };

/** The investigations of one Router, kept so they survive leaving the page. */
export class InvestigationLog {
  readonly items: Investigation[] = [];
}

export function renderInvestigation(inv: Investigation): HTMLElement {
  const root = el('article', 'sw-turn');
  root.dataset.voice = inv.voice;
  const userRow = el('div', 'bubble-row bubble-row-user');
  const user = el('p', 'bubble chat-user');
  user.append(el('span', 'sr-only', 'You asked: '), document.createTextNode(inv.question));
  userRow.appendChild(user);
  root.appendChild(userRow);

  const replyRow = el('div', 'bubble-row bubble-row-reply');
  const bubble = el('div', 'bubble chat-reply sw-reply');
  const voiceName = VOICE_LABELS[inv.voice].name;
  if (inv.reply) {
    bubble.appendChild(el('p', 'sw-voice-name', voiceName));
    bubble.appendChild(el('p', 'bubble-text', inv.reply.engines.arche.reply));
  }
  for (const p of inv.problems) {
    const note = el('p', 'error-state sw-problem', p);
    note.setAttribute('role', 'alert');
    bubble.appendChild(note);
  }
  replyRow.appendChild(bubble);
  root.appendChild(replyRow);

  if (inv.report) {
    const prov = el('section', 'sw-provenance');
    prov.setAttribute('aria-label', 'Provenance');
    prov.appendChild(el('h3', 'sw-heading', `Provenance, from ${inv.source}`));
    if (inv.report.provenance.length === 0) {
      prov.appendChild(el('p', 'sw-none', 'Sherlock named no file or KID.'));
    } else {
      const list = el('ol', 'sw-citations');
      for (const p of inv.report.provenance) {
        const li = el('li', 'sw-citation');
        li.append(el('code', 'sw-path', p.source));
        const kid = kidWords(p);
        if (kid !== '') li.append(document.createTextNode(' '), el('span', 'sw-kid', kid));
        if (p.excerpt !== '') li.appendChild(el('blockquote', 'sw-excerpt', p.excerpt));
        list.appendChild(li);
      }
      prov.appendChild(list);
    }
    root.appendChild(prov);

    const report = el('details', 'sw-report');
    report.appendChild(el('summary', '', "Sherlock's report"));
    report.appendChild(el('p', 'sw-report-text', inv.report.text));
    const notes = answerNotes(inv.report);
    if (notes) report.appendChild(notes);
    root.appendChild(report);
  }
  if (inv.conclusion) root.appendChild(renderConclusion(inv.conclusion));
  return root;
}

/**
 * The deep-investigation page. It keeps its own transcript (not the chat log): a
 * chat turn and an investigation are different things. The voice is the shared
 * pick (ChatLog), so the pick follows the person between the two pages.
 */
export class SherlockWatsonView implements View {
  private readonly sherlock: SeamAdapter;
  private readonly voiceAdapter: SeamAdapter;
  private readonly log: ChatLog;
  private readonly store: InvestigationLog;
  private readonly repo: RepoSession | null;
  private readonly models: ModelSource;
  private readonly bridge: WatsonBridge;
  private container: HTMLElement | null = null;
  private pickerSlot: HTMLElement | null = null;
  private transcript: HTMLElement | null = null;
  private sourceLine: HTMLElement | null = null;
  private errorSlot: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private form: HTMLFormElement | null = null;
  private pendingQuestion: string | null = null;
  private token = 0;
  private voices: Register[] = [];
  private voicesError = '';
  private unsubscribeRepo: (() => void) | null = null;

  constructor(
    sherlock: SeamAdapter, voiceAdapter: SeamAdapter, log: ChatLog, store: InvestigationLog,
    repo: RepoSession | null = null, models: ModelSource = CONNECTOR_MODELS, bridge: WatsonBridge = createWatsonBridge(),
  ) {
    this.sherlock = sherlock;
    this.voiceAdapter = voiceAdapter;
    this.log = log;
    this.store = store;
    this.repo = repo;
    this.models = models;
    this.bridge = bridge;
  }

  private sourceWords(): string {
    const r = this.repo;
    if (r && r.source === 'repo' && r.ready) return `Sherlock will investigate the attached repo ${r.status?.repo ?? ''}.`.replace(' .', '.');
    return 'Sherlock will investigate the book (the Frankenstein case).';
  }

  mount(container: HTMLElement): void {
    this.container = container;
    const root = el('div', 'chat-view sw-view');
    root.dataset.view = SW_VIEW_NAME;
    const column = el('div', 'chat-column');
    column.appendChild(el('h1', 'sw-title', SW_VIEW_NAME));
    column.appendChild(el('p', 'sw-purpose', SW_PURPOSE));
    this.sourceLine = el('p', 'sw-source');
    column.appendChild(this.sourceLine);
    this.transcript = el('div', 'chat-transcript sw-transcript');
    this.errorSlot = el('div', 'chat-error');
    const dock = el('div', 'chat-dock');
    this.pickerSlot = el('div', 'voice-slot');
    this.form = el('form', 'chat-composer');
    const label = el('label', 'sr-only', 'Your question');
    label.setAttribute('for', 'sw-question');
    this.input = el('input', '');
    this.input.type = 'text';
    this.input.id = 'sw-question';
    this.input.autocomplete = 'off';
    this.sendBtn = el('button', 'chat-send', 'Investigate');
    this.sendBtn.type = 'submit';
    this.form.append(label, this.input, this.sendBtn);
    dock.append(this.pickerSlot, this.form);
    column.append(this.transcript, this.errorSlot, dock);
    root.appendChild(column);
    container.replaceChildren(root);

    this.form.addEventListener('submit', this.onSubmit);
    if (this.repo) this.unsubscribeRepo = this.repo.subscribe(() => this.renderControls());
    this.renderControls();
    this.renderTranscript();
    const root0 = this.container;
    void this.models.status().then(
      (r: AdapterResult<ModelStatus>) => {
        if (this.container !== root0) return;
        if (r.ok) this.voices = offeredVoices(r.data.register_voices);
        else this.voicesError = r.error;
        this.renderControls();
      },
      (e: unknown) => {
        if (this.container !== root0) return;
        this.voicesError = `Connector unreachable: ${e instanceof Error ? e.message : String(e)}`;
        this.renderControls();
      },
    );
  }

  private renderControls(): void {
    const voice = this.log.voice();
    if (this.container) {
      const root = this.container.firstElementChild as HTMLElement | null;
      if (root) { if (voice) root.dataset.voice = voice; else delete root.dataset.voice; }
    }
    this.sourceLine?.replaceChildren(document.createTextNode(this.sourceWords()));
    if (this.pickerSlot) {
      if (this.voices.length === 0) {
        this.pickerSlot.replaceChildren(...(this.voicesError ? [el('p', 'error-state', this.voicesError)] : []));
      } else {
        this.pickerSlot.replaceChildren(renderVoicePicker(this.voices, voice, (v) => { this.log.setVoice(v); this.renderControls(); }, null));
      }
    }
    const ready = voice !== null && this.voices.includes(voice) && this.pendingQuestion === null;
    if (this.input) {
      this.input.disabled = voice === null || !this.voices.includes(voice);
      this.input.placeholder = voice && this.voices.includes(voice) ? `Ask ${VOICE_LABELS[voice].name} to investigate` : 'INPUT // AWAITING_MASK';
    }
    if (this.sendBtn) this.sendBtn.disabled = !ready;
  }

  private renderTranscript(): void {
    if (!this.transcript) return;
    const nodes: HTMLElement[] = this.store.items.map((i) => renderInvestigation(i));
    if (this.pendingQuestion !== null) {
      const row = el('div', 'bubble-row bubble-row-user');
      row.appendChild(el('p', 'bubble chat-user', this.pendingQuestion));
      const think = el('div', 'bubble-row bubble-row-reply');
      think.appendChild(el('p', 'chat-thinking', 'Sherlock is investigating…'));
      nodes.push(row, think);
    }
    this.transcript.replaceChildren(...nodes);
  }

  private onSubmit = (e: Event): void => {
    e.preventDefault();
    void this.run();
  };

  private async run(): Promise<void> {
    const input = this.input;
    const voice = this.log.voice();
    if (!input || !voice || this.pendingQuestion !== null) return;
    const question = input.value.trim();
    if (question === '') return;
    const root = this.container;
    const mine = ++this.token;
    this.pendingQuestion = question;
    input.value = '';
    this.errorSlot?.replaceChildren();
    this.renderControls();
    this.renderTranscript();
    const inv = await investigate(
      { sherlock: this.sherlock, voiceAdapter: this.voiceAdapter, bridge: this.bridge, repo: this.repo }, question, voice,
    );
    // The result is kept even if the person left the page meanwhile.
    this.store.items.push(inv);
    if (this.container !== root || mine !== this.token) return;
    this.pendingQuestion = null;
    this.renderControls();
    this.renderTranscript();
    this.transcript?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  unmount(): void {
    this.token++;
    this.pendingQuestion = null;
    this.form?.removeEventListener('submit', this.onSubmit);
    this.unsubscribeRepo?.();
    this.unsubscribeRepo = null;
    this.form = this.input = this.sendBtn = null;
    this.pickerSlot = this.transcript = this.errorSlot = this.sourceLine = null;
    if (this.container) {
      this.container.replaceChildren();
      this.container = null;
    }
  }
}
