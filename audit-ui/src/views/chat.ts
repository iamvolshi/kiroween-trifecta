import type { View } from '../router/router.ts';
import { isChatTurn, type AdapterResult, type ChatOptions, type Register, type SeamAdapter, type ServedBy } from '../adapter/seam.ts';
import { CONNECTOR_URL } from '../adapter/connector-url.ts';
import { fetchModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import { announce, type StatusState } from './model-announce.ts';
import { ChatLog } from './chat-log.ts';
import { renderChatTurn } from './chat-turn.ts';
import { syncEngineBoxes } from './engine-boxes.ts';
import { engineFocusChannel } from '../shell/engine-focus-channel.ts';
import { renderVoicePicker, renderBigVoicePicker } from './voice-picker.ts';
import { offeredVoices, VOICE_LABELS } from './voices.ts';
import { attachTypewriter } from '../shell/typewriter.ts';
import { renderRepoTurn } from './repo-panel.ts';
import type { RepoSession } from './repo-session.ts';

/** The locked composer's placeholder before a voice is picked. */
export const AWAITING_MASK = 'INPUT // AWAITING_MASK';
/** The locked placeholder in a compact (mini chat) column, where the full mask does not fit. */
export const AWAITING_MASK_COMPACT = 'INPUT';
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
 * picker and the composer pinned at the bottom; the picked voice's model
 * rides under the icons. Before the first send the column
 * holds the picker and the composer and nothing else. The picked voice sets
 * the accent (data-voice on the view): picked icon, model name, replies.
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
  /** The message sent and waiting on a reply: shown at once, with a thinking row, until the turn lands. */
  private pendingMessage: string | null = null;
  /** Incremented per submit and on unmount; stale replies are dropped. */
  private requestToken = 0;
  private models: ModelSource;
  private status: StatusState = { state: 'loading' };
  /** Compact (mini chat) columns get the short locked placeholder. */
  private compact: boolean;
  /** served_by of the last reply per voice. */
  private served = new Map<Register, ServedBy>();
  /** Keeps the pressed engine box in step with the telemetry column's focus. */
  private unsubscribeFocus: (() => void) | null = null;
  /** Counts /models reads; only the latest answer is kept. */
  private statusRead = 0;
  /** The voices from the last good /models answer: a failed re-read keeps them pickable. */
  private voices: Register[] = [];

  constructor(adapter: SeamAdapter, log: ChatLog, models: ModelSource = CONNECTOR_MODELS, repo: RepoSession | null = null, compact = false) {
    this.adapter = adapter;
    this.log = log;
    this.models = models;
    this.repo = repo;
    this.compact = compact;
  }

  /** The attached GitHub repo, shared with the other chat view; null = no repo control. */
  private repo: RepoSession | null;
  private unsubscribeRepo: (() => void) | null = null;

  /** True while the chat asks the attached repo and not the book. */
  private repoMode(): boolean {
    return this.repo !== null && this.repo.source === 'repo' && this.repo.ready;
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
    this.form.append(label, this.input, attachTypewriter(this.input), this.sendBtn);
    dock.append(this.pickerSlot, this.form);
    if (this.repo) {
      this.unsubscribeRepo = this.repo.subscribe(() => {
        this.renderControls();
        this.renderTranscript();
      });
    }
    column.append(this.transcript, this.errorSlot, dock);
    root.appendChild(column);
    this.root = root;
    container.replaceChildren(root);

    this.submitHandler = (e: Event) => {
      e.preventDefault();
      void this.onSubmit();
    };
    this.form.addEventListener('submit', this.submitHandler);
    this.unsubscribeFocus = engineFocusChannel.subscribe(() => {
      if (this.transcript) syncEngineBoxes(this.transcript);
    });

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
    // A failed re-read keeps the chips; the model at the row's end says the connector is unreachable.
    // A rebuild must not drop keyboard focus: a chip that had it gets it back.
    const hadFocus = slot.contains(document.activeElement);
    // The picked voice's live model rides at the row's right end; before a
    // voice is picked the announcement is null and the row is chips only.
    const announcement = announce({ register: voice, status: this.status, served: voice ? this.served.get(voice) ?? null : null });
    slot.replaceChildren(
      renderVoicePicker(voices, voice, (v) => this.chooseVoice(v), announcement),
    );
    if (focus || hadFocus) slot.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
  }

  /** One pick, from either the big tiles or the small chips. */
  private chooseVoice(v: Register): void {
    const switched = this.log.voice() !== null && this.log.voice() !== v;
    this.log.setVoice(v);
    this.renderControls(true);
    // A switch re-reads the live map, so a config change shows up.
    if (switched) this.loadStatus(false);
  }

  /** Accent, picker, composer and the model in the picker row follow the picked voice. */
  private renderControls(focus = false): void {
    const voice = this.log.voice();
    if (this.root) {
      if (voice) this.root.dataset.voice = voice;
      else delete this.root.dataset.voice;
    }
    this.renderPicker(focus);
    // Ready while the picked voice is one the connector offers (a chip shows it), or,
    // on a remount, while no voice list has been read yet: the pick from the log stands.
    const ready = this.repoMode() || (voice !== null && (this.voices.includes(voice) || (this.voices.length === 0 && this.status.state !== 'ok')));
    if (this.input) {
      this.input.disabled = !ready;
      this.input.placeholder = this.repoMode() ? `Ask ${this.repo?.status?.repo ?? 'your repo'}` : ready && voice ? `Message ${VOICE_LABELS[voice].name}` : (this.compact ? AWAITING_MASK_COMPACT : AWAITING_MASK);
    }
    if (this.sendBtn) this.sendBtn.disabled = !ready || this.pending;
    // The big picker lives in the transcript: re-render it while the
    // transcript holds it (or nothing yet), so it appears once the voices
    // load and follows a pick.
    const box = this.transcript;
    if (box && (box.querySelector('.frankenstein-picker') !== null || box.childNodes.length === 0)) {
      this.renderTranscript();
    }
  }

  private renderTranscript(): void {
    const box = this.transcript;
    if (!box) return;
    // No turns: nothing at all (no greeting, no placeholder words).
    // Asking the repo shows the repo's own turns; the book's log is kept for when the user switches back.
    const nodes = this.repoMode() && this.repo
      ? this.repo.turns.map((t) => renderRepoTurn(t))
      : this.log.turns().flatMap((t, i) => {
      if (!isChatTurn(t)) return [];
      // The engine boxes sit beside the reply (renderChatTurn), keyed by the turn's index.
      return [renderChatTurn(t, this.log.voiceAt(i), i)];
    });
    // A sent message shows at once, with a thinking row, until its turn lands.
    if (this.pendingMessage !== null) nodes.push(...this.renderPending(this.pendingMessage));
    // Nothing to show yet: the big Frankenstein picker fills the middle of
    // the page (full chat only; the mini chat keeps its icons). It appears
    // once the voices are known and no voice is picked; a pick flies the
    // chosen tile into the chat box and the picker leaves.
    if (nodes.length === 0 && !this.compact && this.voices.length > 0 && this.log.voice() === null) {
      box.replaceChildren(renderBigVoicePicker(this.voices, this.log.voice(), (v) => this.chooseVoice(v)));
      return;
    }
    box.replaceChildren(...nodes);
  }

  /** The pending message as its own user bubble, plus the thinking row. */
  private renderPending(message: string): HTMLElement[] {
    const userRow = el('div', 'bubble-row bubble-row-user');
    const user = el('p', 'bubble chat-user');
    user.append(el('span', 'sr-only', 'You said: '), document.createTextNode(message));
    userRow.appendChild(user);
    const thinkingRow = el('div', 'bubble-row bubble-row-reply');
    thinkingRow.appendChild(el('p', 'chat-thinking', 'Thinking…'));
    return [userRow, thinkingRow];
  }

  private async onSubmit(): Promise<void> {
    const input = this.input;
    const btn = this.sendBtn;
    if (!input || !btn) return;
    const voice = this.log.voice();
    const repoAsk = this.repoMode() ? this.repo : null;
    if (!voice && !repoAsk) return; // composer is disabled until a voice is picked
    const message = input.value.trim();
    if (message === '') return;

    if (repoAsk) {
      // The attached repo answers first, through Sherlock's /api/github/ask.
      // When it has nothing on the question, the persona talks instead: the
      // repo is an added ability, not the whole chat. A chat that dead-ends
      // on "Cool this is nice." is not a chat.
      const token = ++this.requestToken;
      const root = this.container;
      this.pending = true;
      btn.disabled = true;
      this.errorSlot?.replaceChildren();
      this.pendingMessage = message;
      input.value = '';
      this.renderTranscript();
      const r = await repoAsk.askQuiet(message);
      this.pending = false;
      if (token !== this.requestToken || this.container !== root) return;
      this.pendingMessage = null;
      if (!r.ok) {
        input.value = message;
        this.renderControls();
        this.renderTranscript();
        this.errorSlot?.replaceChildren(el('p', 'error-state', r.error));
        return;
      }
      if (r.data.state === 'found') {
        repoAsk.keepTurn(message, r.data);
        this.renderControls();
        this.renderTranscript();
        return;
      }
      if (!voice) {
        // No persona picked to fall back to: the repo's own not-knowing stands.
        repoAsk.keepTurn(message, r.data);
        this.renderControls();
        this.renderTranscript();
        return;
      }
      // The repo had nothing: the persona answers, so the chat is in book
      // mode now, which is what makes the reply visible (the transcript in
      // repo mode shows only repo turns). The repo stays attached; one tap
      // on its button asks it again.
      repoAsk.setSource('book');
      // Fall through: the persona answers below.
    }
    if (!voice) return;

    const options: ChatOptions = { persona: 'Frankenstein', register: voice };

    const token = ++this.requestToken;
    const root = this.container;
    this.pending = true;
    btn.disabled = true;
    this.errorSlot?.replaceChildren();
    // The message shows at once, with a thinking row, instead of waiting on the reply.
    this.pendingMessage = message;
    input.value = '';
    this.renderTranscript();
    this.transcript?.lastElementChild?.scrollIntoView?.({ block: 'end' });

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

    // The wait is over: the thinking row goes with the reply (or the error).
    this.pendingMessage = null;
    btn.disabled = input.disabled; // locked with the composer
    if (!result.ok) {
      // The thinking row goes; the message goes back in the composer to retry.
      input.value = message;
      this.renderControls();
      this.renderTranscript();
      this.errorSlot?.replaceChildren(el('p', 'error-state', result.error));
      return;
    }
    input.value = '';
    this.renderControls();
    this.renderTranscript();
    this.transcript?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  unmount(): void {
    this.requestToken++;
    this.statusRead++;
    this.pending = false;
    this.pendingMessage = null;
    if (this.form && this.submitHandler) {
      this.form.removeEventListener('submit', this.submitHandler);
    }
    this.submitHandler = null;
    this.unsubscribeFocus?.();
    this.unsubscribeFocus = null;
    this.unsubscribeRepo?.();
    this.unsubscribeRepo = null;
    this.form = null;
    this.input = null;
    this.sendBtn = null;
    this.root = null;
    this.pickerSlot = null;
    this.transcript = null;
    this.errorSlot = null;
    if (this.container) {
      this.container.replaceChildren();
      this.container = null;
    }
  }
}
