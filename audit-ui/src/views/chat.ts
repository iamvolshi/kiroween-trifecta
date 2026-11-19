import type { View } from '../router/router.ts';
import { isChatTurn, type AdapterResult, type ChatOptions, type Register, type SeamAdapter, type ServedBy } from '../adapter/seam.ts';
import { CONNECTOR_URL } from '../adapter/connector-url.ts';
import { fetchModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import { announce, renderModelBanner, type StatusState } from './model-banner.ts';
import { ChatLog } from './chat-log.ts';
import { renderChatTurn } from './chat-turn.ts';
import { renderVoicePicker } from './voice-picker.ts';
import { offeredVoices, VOICE_LABELS } from './voices.ts';
import { renderProofCards, type EntryLoader } from './proof-cards.ts';

/** The locked composer's placeholder before a voice is picked. */
export const AWAITING_MASK = 'INPUT // AWAITING_MASK';
/** What the header's view chip reads on this view. */
export const CHAT_VIEW_NAME = 'Chat / Observability';

/** Where the voices and the model announcement read from. Tests pass their own. */
export interface ModelSource {
  status: () => Promise<AdapterResult<ModelStatus>>;
}

const CONNECTOR_MODELS: ModelSource = {
  status: () => fetchModelStatus(CONNECTOR_URL),
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * The chat: a centered chat-app column. Messages as bubbles; the voice
 * picker and the composer pinned at the bottom; the model band under the
 * composer once a voice is picked. Before the first send the column holds
 * the picker and the composer and nothing else. The picked voice sets the
 * accent (data-voice on the view): picked chip, model band, replies.
 */
export class ChatView implements View {
  private adapter: SeamAdapter;
  private log: ChatLog;
  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private pickerSlot: HTMLElement | null = null;
  private transcript: HTMLElement | null = null;
  private errorSlot: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private form: HTMLFormElement | null = null;
  private submitHandler: ((e: Event) => void) | null = null;
  /** True while a chat call is in flight (Send stays disabled). */
  private pending = false;
  /** Incremented per submit and on unmount; stale replies are dropped. */
  private requestToken = 0;
  private models: ModelSource;
  private modelSlot: HTMLElement | null = null;
  private status: StatusState = { state: 'loading' };
  /** served_by of the last reply per voice. */
  private served = new Map<Register, ServedBy>();
  private lastVoice: Register | null = null;
  /** Live entry reads for proof cards, one per entry, kept for this view. */
  private entryReads = new Map<string, ReturnType<EntryLoader>>();
  private loadEntry: EntryLoader = (kid, subject, entryId) => {
    const key = `${kid}|${subject}|${entryId}`;
    const cached = this.entryReads.get(key);
    if (cached) return cached;
    const read = this.adapter.fetchChain(kid, subject).then((r) =>
      r.ok ? { ok: true as const, data: r.data.find((e) => e.id === entryId) ?? null } : r,
    );
    // Keep only a found entry: a failure or a not-yet-written entry is read again next render.
    void read.then(
      (r) => { if (!r.ok || r.data === null) this.entryReads.delete(key); },
      () => this.entryReads.delete(key),
    );
    this.entryReads.set(key, read);
    return read;
  };
  /** Counts /models reads; only the latest answer is kept. */
  private statusRead = 0;
  /** The voices from the last good /models answer: a failed re-read keeps them pickable. */
  private voices: Register[] = [];

  constructor(adapter: SeamAdapter, log: ChatLog, models: ModelSource = CONNECTOR_MODELS) {
    this.adapter = adapter;
    this.log = log;
    this.models = models;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    const root = el('div', 'chat-view');
    root.dataset.view = CHAT_VIEW_NAME;
    const column = el('div', 'chat-column');
    // For screen readers only: nothing on screen names the view.
    column.appendChild(el('h1', 'sr-only', 'Chat'));
    this.transcript = el('div', 'chat-transcript');
    this.errorSlot = el('div', 'chat-error');
    const dock = el('div', 'chat-dock');
    this.pickerSlot = el('div', 'voice-slot');
    this.form = el('form', 'chat-composer');
    const label = el('label', 'sr-only', 'Your message');
    label.setAttribute('for', 'chat-message');
    this.input = el('input', '');
    this.input.type = 'text';
    this.input.id = 'chat-message';
    this.input.autocomplete = 'off';
    this.sendBtn = el('button', 'chat-send', 'Send');
    this.sendBtn.type = 'submit';
    this.form.append(label, this.input, this.sendBtn);
    this.modelSlot = el('div', 'model-slot');
    dock.append(this.pickerSlot, this.form, this.modelSlot);
    column.append(this.transcript, this.errorSlot, dock);
    root.appendChild(column);
    this.root = root;
    container.replaceChildren(root);

    this.submitHandler = (e: Event) => {
      e.preventDefault();
      void this.onSubmit();
    };
    this.form.addEventListener('submit', this.submitHandler);

    this.renderControls();
    this.renderTranscript();
    this.loadStatus();
  }

  /** Read the voices and the model map from the connector (on mount, on a switch, after failures). */
  private loadStatus(reset = true): void {
    const root = this.container;
    // A re-read keeps showing the last answer until the new one lands.
    if (reset) this.status = { state: 'loading' };
    const read = ++this.statusRead;
    void this.models.status().then(
      (r) => {
        if (this.container !== root || read !== this.statusRead) return;
        this.status = r.ok ? { state: 'ok', data: r.data } : { state: 'error', error: r.error };
        this.renderControls();
      },
      (e: unknown) => {
        if (this.container !== root || read !== this.statusRead) return;
        this.status = { state: 'error', error: `Connector unreachable: ${e instanceof Error ? e.message : String(e)}` };
        this.renderControls();
      },
    );
  }

  /** The announcement under the composer, for the picked voice. */
  private renderModel(): void {
    if (!this.modelSlot) return;
    const voice = this.log.voice();
    const flipped = this.lastVoice !== null && this.lastVoice !== voice;
    this.lastVoice = voice;
    const a = announce({ register: voice, status: this.status, served: voice ? this.served.get(voice) ?? null : null });
    // Before a voice is picked the slot stays empty: no band, no words.
    this.modelSlot.replaceChildren(...(a ? [renderModelBanner(a, flipped)] : []));
  }

  /** The voices the connector reports, or the words saying why there are none. */
  private renderPicker(focus: boolean): void {
    const slot = this.pickerSlot;
    if (!slot) return;
    const voice = this.log.voice();
    if (this.status.state === 'ok') this.voices = offeredVoices(this.status.data.register_voices);
    const voices = this.voices;
    if (voices.length === 0) {
      // Nothing to pick yet: the reason in words (loading says nothing).
      if (this.status.state === 'error') slot.replaceChildren(el('p', 'error-state', this.status.error));
      else if (this.status.state === 'ok') slot.replaceChildren(el('p', 'error-state', 'The connector reports no voices.'));
      else slot.replaceChildren();
      return;
    }
    // A failed re-read keeps the chips; the band under the composer says the connector is unreachable.
    // A rebuild must not drop keyboard focus: a chip that had it gets it back.
    const hadFocus = slot.contains(document.activeElement);
    slot.replaceChildren(
      renderVoicePicker(voices, voice, (v) => {
        const switched = this.log.voice() !== null && this.log.voice() !== v;
        this.log.setVoice(v);
        this.renderControls(true);
        // A switch re-reads the live map, so a config change shows up.
        if (switched) this.loadStatus(false);
      }),
    );
    if (focus || hadFocus) slot.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }

  /** Accent, picker, composer and band follow the picked voice. */
  private renderControls(focus = false): void {
    const voice = this.log.voice();
    if (this.root) {
      if (voice) this.root.dataset.voice = voice;
      else delete this.root.dataset.voice;
    }
    this.renderPicker(focus);
    // Ready while the picked voice is one the connector offers (a chip shows it), or,
    // on a remount, while no voice list has been read yet: the pick from the log stands.
    const ready = voice !== null && (this.voices.includes(voice) || (this.voices.length === 0 && this.status.state !== 'ok'));
    if (this.input) {
      this.input.disabled = !ready;
      this.input.placeholder = ready && voice ? `Message ${VOICE_LABELS[voice].name}` : AWAITING_MASK;
    }
    if (this.sendBtn) this.sendBtn.disabled = !ready || this.pending;
    this.renderModel();
  }

  private renderTranscript(): void {
    const box = this.transcript;
    if (!box) return;
    // No turns: nothing at all (no greeting, no placeholder words).
    box.replaceChildren(
      ...this.log.turns().flatMap((t, i) => {
        if (!isChatTurn(t)) return [];
        const node = renderChatTurn(t, this.log.voiceAt(i));
        // Proof-anchor cards, only for a reply that carries links.
        const cards = renderProofCards(t, this.loadEntry);
        if (cards) node.appendChild(cards);
        return [node];
      }),
    );
  }

  private async onSubmit(): Promise<void> {
    const input = this.input;
    const btn = this.sendBtn;
    if (!input || !btn) return;
    const voice = this.log.voice();
    if (!voice) return; // composer is disabled until a voice is picked
    const message = input.value.trim();
    if (message === '') return;

    const options: ChatOptions = { persona: 'Frankenstein', register: voice };

    const token = ++this.requestToken;
    const root = this.container;
    this.pending = true;
    btn.disabled = true;
    this.errorSlot?.replaceChildren();

    let result: Awaited<ReturnType<SeamAdapter['chat']>>;
    try {
      result = await this.adapter.chat(message, options);
    } catch (e) {
      // An adapter that throws must not leave Send disabled forever: show
      // the error in words and give the button back.
      result = { ok: false, error: `The chat request failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    this.pending = false;
    // A reply that is not a ChatTurn would break every later render: refuse it in words.
    if (result.ok && !isChatTurn(result.data)) {
      result = { ok: false, error: 'The reply is not a chat turn the app can show.' };
    }
    // The turn already happened on the agent's side (it is recorded there),
    // so it is logged even when this view is gone; only the DOM work is skipped.
    if (result.ok) this.log.push(result.data, voice);
    // Truth wins over config: the turn says who served it.
    if (result.ok && result.data.served_by) this.served.set(voice, result.data.served_by);
    // A failed turn on this voice: its old served_by is no longer the last
    // reply, so drop it and re-read the live map.
    if (!result.ok) {
      this.served.delete(voice);
      if (this.container !== null) this.loadStatus(false); // a gone view reads nothing
    }
    if (token !== this.requestToken || this.container !== root) return;

    btn.disabled = input.disabled; // locked with the composer
    if (!result.ok) {
      this.renderModel();
      this.errorSlot?.replaceChildren(el('p', 'error-state', result.error));
      return;
    }
    input.value = '';
    this.renderModel();
    this.renderTranscript();
    this.transcript?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  unmount(): void {
    this.requestToken++;
    this.statusRead++;
    this.pending = false;
    if (this.form && this.submitHandler) {
      this.form.removeEventListener('submit', this.submitHandler);
    }
    this.submitHandler = null;
    this.form = null;
    this.input = null;
    this.sendBtn = null;
    this.root = null;
    this.pickerSlot = null;
    this.transcript = null;
    this.errorSlot = null;
    this.modelSlot = null;
    this.lastVoice = null;
    if (this.container) {
      this.container.replaceChildren();
      this.container = null;
    }
  }
}
