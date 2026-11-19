import type { View } from '../router/router.ts';
import { isChatTurn, type AdapterResult, type ChatOptions, type SeamAdapter, type ServedBy } from '../adapter/seam.ts';
import { CONNECTOR_URL } from '../adapter/connector-url.ts';
import { fetchModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import { announce, renderModelBanner, type StatusState } from './model-banner.ts';
import { ChatLog } from './chat-log.ts';
import { renderChatTurn } from './chat-turn.ts';
import { createIntro } from './intro.ts';
import { renderPersonaPicker, renderRegisterSwitch } from './persona-picker.ts';
import { renderMaskCards } from './mask-cards.ts';
import { renderProofCards, type EntryLoader } from './proof-cards.ts';

const PICK_FIRST = 'Choose a persona to start chatting.';
/** The locked composer's placeholder before a mask is picked. */
const AWAITING_MASK = 'INPUT // AWAITING_MASK';

/** Where the model announcement reads from. Tests pass their own. */
export interface ModelSource {
  status: () => Promise<AdapterResult<ModelStatus>>;
}

const CONNECTOR_MODELS: ModelSource = {
  status: () => fetchModelStatus(CONNECTOR_URL),
};

export class ChatView implements View {
  private adapter: SeamAdapter;
  private log: ChatLog;
  private container: HTMLElement | null = null;
  private heading: HTMLElement | null = null;
  private controls: HTMLElement | null = null;
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
  /** served_by of the last reply per switch position ("persona|register"). */
  private served = new Map<string, ServedBy>();
  private lastPositionKey: string | null = null;
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

  constructor(adapter: SeamAdapter, log: ChatLog, models: ModelSource = CONNECTOR_MODELS) {
    this.adapter = adapter;
    this.log = log;
    this.models = models;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = `
      <div class="chat-view">
        <h1></h1>
        <div class="chat-controls"></div>
        <div class="chat-transcript"></div>
        <div class="chat-error"></div>
        <form class="chat-form">
          <label for="chat-message" class="sr-only">Your message</label>
          <input type="text" id="chat-message" autocomplete="off">
          <button type="submit">Send</button>
          <div class="model-slot"></div>
        </form>
      </div>
    `;
    container.querySelector('.chat-view h1')?.after(createIntro('chat'));

    this.heading = container.querySelector<HTMLElement>('.chat-view h1');
    this.controls = container.querySelector<HTMLElement>('.chat-controls');
    this.transcript = container.querySelector<HTMLElement>('.chat-transcript');
    this.errorSlot = container.querySelector<HTMLElement>('.chat-error');
    this.input = container.querySelector<HTMLInputElement>('#chat-message');
    this.sendBtn = container.querySelector<HTMLButtonElement>('.chat-form button');
    this.form = container.querySelector<HTMLFormElement>('.chat-form');
    this.modelSlot = container.querySelector<HTMLElement>('.model-slot');

    this.submitHandler = (e: Event) => {
      e.preventDefault();
      void this.onSubmit();
    };
    this.form?.addEventListener('submit', this.submitHandler);

    this.renderControls();
    this.renderTranscript();
    this.loadStatus();
  }

  /** Read the model map from the connector (before the first turn, on flips, after failures). */
  private loadStatus(reset = true): void {
    const root = this.container;
    // A re-read keeps showing the last answer until the new one lands.
    if (reset) this.status = { state: 'loading' };
    const read = ++this.statusRead;
    void this.models.status().then(
      (r) => {
        if (this.container !== root || read !== this.statusRead) return;
        this.status = r.ok ? { state: 'ok', data: r.data } : { state: 'error', error: r.error };
        this.renderModel();
      },
      (e: unknown) => {
        if (this.container !== root || read !== this.statusRead) return;
        this.status = { state: 'error', error: `Connector unreachable: ${e instanceof Error ? e.message : String(e)}` };
        this.renderModel();
      },
    );
  }

  private positionKey(): string {
    const persona = this.log.persona();
    return persona === 'Frankenstein' ? `${persona}|${this.log.register()}` : `${persona ?? ''}|`;
  }

  /** The announcement under the chat box, for the current switch position. */
  private renderModel(): void {
    if (!this.modelSlot) return;
    const persona = this.log.persona();
    const key = this.positionKey();
    const flipped = this.lastPositionKey !== null && this.lastPositionKey !== key;
    this.lastPositionKey = key;
    const a = announce({
      persona,
      register: persona === 'Frankenstein' ? this.log.register() : null,
      status: this.status,
      served: this.served.get(key) ?? null,
    });
    // Before a mask is picked the slot stays empty: no band, no words.
    this.modelSlot.replaceChildren(...(a ? [renderModelBanner(a, flipped)] : []));
  }

  /** Heading, picker, Book/Movie switch and composer state follow the chosen persona. */
  private renderControls(focusGroup: 'persona-picker' | 'register-switch' | null = null): void {
    const controls = this.controls;
    if (!controls) return;
    const persona = this.log.persona();
    if (this.heading) this.heading.textContent = persona ? `Chat with ${persona}` : 'Chat with [nothing yet]';

    const parts: HTMLElement[] = [
      persona === null
        ? // Before a pick: the three masks as cards.
          renderMaskCards(
            (p) => {
              this.log.setPersona(p);
              this.renderControls('persona-picker');
            },
            (r) => {
              this.log.setPersona('Frankenstein');
              this.log.setRegister(r);
              this.renderControls('register-switch');
            },
          )
        : renderPersonaPicker(persona, (p) => {
            this.log.setPersona(p);
            this.renderControls('persona-picker');
          }),
    ];
    if (persona === 'Frankenstein') {
      parts.push(
        renderRegisterSwitch(this.log.register(), (r) => {
          this.log.setRegister(r);
          this.renderControls('register-switch');
          // A flip re-reads the live map, so a config change shows up.
          this.loadStatus(false);
        }),
      );
    }
    if (!persona) {
      const hint = document.createElement('p');
      // The mask cards and the NOT KNOWN box say it on screen; this line is for screen readers.
      hint.className = 'prompt-state persona-required sr-only';
      hint.textContent = PICK_FIRST;
      parts.push(hint);
    }
    controls.replaceChildren(...parts);
    // Keep keyboard focus on the option just chosen.
    if (focusGroup) controls.querySelector<HTMLButtonElement>(`.${focusGroup} [aria-checked="true"]`)?.focus();

    const ready = persona !== null;
    if (this.input) {
      this.input.disabled = !ready;
      this.input.placeholder = ready ? `Message ${persona}` : AWAITING_MASK;
    }
    if (this.sendBtn) this.sendBtn.disabled = !ready || this.pending;
    this.renderModel();
  }

  private renderTranscript(): void {
    const box = this.transcript;
    if (!box) return;
    const turns = this.log.turns();
    if (turns.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'No messages yet. Choose a persona, then send a message.';
      box.replaceChildren(p);
    } else {
      box.replaceChildren(
        ...turns.flatMap((t, i) => {
          if (!isChatTurn(t)) return [];
          const node = renderChatTurn(t, this.log.personaAt(i));
          // Proof-anchor cards, only for a reply that carries links.
          const cards = renderProofCards(t, this.loadEntry);
          if (cards) node.appendChild(cards);
          return [node];
        }),
      );
    }
  }

  private async onSubmit(): Promise<void> {
    const input = this.input;
    const btn = this.sendBtn;
    if (!input || !btn) return;
    const persona = this.log.persona();
    if (!persona) return; // composer is disabled until a persona is chosen
    const message = input.value.trim();
    if (message === '') return;

    const options: ChatOptions =
      persona === 'Frankenstein' ? { persona, register: this.log.register() } : { persona };
    const positionKey = this.positionKey();

    const token = ++this.requestToken;
    const root = this.container;
    this.pending = true;
    btn.disabled = true;
    this.errorSlot?.replaceChildren();

    let result: Awaited<ReturnType<SeamAdapter['chat']>>;
    try {
      result = await this.adapter.chat(message, options);
    } catch (e) {
      // An adapter that throws (a live fetch path, say) must not leave Send
      // disabled forever: show the error in words and give the button back.
      result = { ok: false, error: `The chat request failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    this.pending = false;
    // A reply that is not a ChatTurn would break every later render: refuse it in words.
    if (result.ok && !isChatTurn(result.data)) {
      result = { ok: false, error: 'The reply is not a chat turn the app can show.' };
    }
    // The turn already happened on the agent's side (it is recorded there),
    // so it is logged even when this view is gone; only the DOM work is skipped.
    if (result.ok) this.log.push(result.data, persona);
    // Truth wins over config: the turn says who served it.
    if (result.ok && result.data.served_by) this.served.set(positionKey, result.data.served_by);
    // A failed turn on this position: its old served_by is no longer the
    // last reply, so drop it and re-read the live map.
    if (!result.ok) {
      this.served.delete(positionKey);
      this.loadStatus(false);
    }
    if (token !== this.requestToken || this.container !== root) return;

    btn.disabled = this.log.persona() === null;
    if (!result.ok) {
      this.renderModel();
      const p = document.createElement('p');
      p.className = 'error-state';
      p.textContent = result.error;
      this.errorSlot?.replaceChildren(p);
      return;
    }
    input.value = '';
    this.renderModel();
    this.renderTranscript();
    this.transcript?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  unmount(): void {
    this.requestToken++;
    this.pending = false;
    if (this.form && this.submitHandler) {
      this.form.removeEventListener('submit', this.submitHandler);
    }
    this.submitHandler = null;
    this.form = null;
    this.input = null;
    this.sendBtn = null;
    this.heading = null;
    this.controls = null;
    this.transcript = null;
    this.errorSlot = null;
    this.modelSlot = null;
    this.lastPositionKey = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
