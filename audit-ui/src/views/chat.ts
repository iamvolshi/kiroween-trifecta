import type { View } from '../router/router.ts';
import { isChatTurn, type AdapterResult, type ChatOptions, type SeamAdapter, type ServedBy } from '../adapter/seam.ts';
import { ACTIVE_ADAPTER_KIND, LIVE_BASE_URL } from '../adapter/active.ts';
import { fetchModelStatus, type ModelStatus } from '../adapter/live-models.ts';
import { announce, renderModelBanner, type StatusState } from './model-banner.ts';
import { ChatLog } from './chat-log.ts';
import { renderChatTurn } from './chat-turn.ts';
import { createIntro } from './intro.ts';
import { renderPersonaPicker, renderRegisterSwitch } from './persona-picker.ts';

const PICK_FIRST = 'Choose a persona to start chatting.';

/** Where the model announcement reads from. Tests pass their own. */
export interface ModelSource {
  kind: 'mock' | 'live';
  status: () => Promise<AdapterResult<ModelStatus>>;
}

const ACTIVE_MODELS: ModelSource = {
  kind: ACTIVE_ADAPTER_KIND,
  status: () => fetchModelStatus(LIVE_BASE_URL),
};

export class ChatView implements View {
  private adapter: SeamAdapter;
  private log: ChatLog;
  private container: HTMLElement | null = null;
  private heading: HTMLElement | null = null;
  private controls: HTMLElement | null = null;
  private transcript: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
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

  constructor(adapter: SeamAdapter, log: ChatLog, models: ModelSource = ACTIVE_MODELS) {
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
        <p class="step-progress"></p>
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
    if (ACTIVE_ADAPTER_KIND === 'mock') {
      const note = document.createElement('p');
      note.className = 'mock-note';
      note.textContent = 'Replies are scripted mock. No model is running.';
      container.querySelector('.chat-controls')?.before(note);
    }

    this.heading = container.querySelector<HTMLElement>('.chat-view h1');
    this.controls = container.querySelector<HTMLElement>('.chat-controls');
    this.transcript = container.querySelector<HTMLElement>('.chat-transcript');
    this.progress = container.querySelector<HTMLElement>('.step-progress');
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

  /** Live: read the model map before the first turn. Mock: nothing to read. */
  private loadStatus(reset = true): void {
    if (this.models.kind === 'mock') return;
    const root = this.container;
    // A re-read keeps showing the last answer until the new one lands.
    if (reset) this.status = { state: 'loading' };
    void this.models.status().then(
      (r) => {
        if (this.container !== root) return;
        this.status = r.ok ? { state: 'ok', data: r.data } : { state: 'error', error: r.error };
        this.renderModel();
      },
      (e: unknown) => {
        if (this.container !== root) return;
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
      kind: this.models.kind,
      register: persona === 'Frankenstein' ? this.log.register() : null,
      status: this.status,
      served: this.served.get(key) ?? null,
    });
    this.modelSlot.replaceChildren(renderModelBanner(a, flipped));
  }

  /** Heading, picker, Book/Movie switch and composer state follow the chosen persona. */
  private renderControls(focusGroup: 'persona-picker' | 'register-switch' | null = null): void {
    const controls = this.controls;
    if (!controls) return;
    const persona = this.log.persona();
    if (this.heading) this.heading.textContent = persona ? `Chat with ${persona}` : 'Chat';

    const parts: HTMLElement[] = [
      renderPersonaPicker(persona, (p) => {
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
      hint.className = 'prompt-state persona-required';
      hint.textContent = PICK_FIRST;
      parts.push(hint);
    }
    controls.replaceChildren(...parts);
    // Keep keyboard focus on the option just chosen.
    if (focusGroup) controls.querySelector<HTMLButtonElement>(`.${focusGroup} [aria-checked="true"]`)?.focus();

    const ready = persona !== null;
    if (this.input) {
      this.input.disabled = !ready;
      this.input.placeholder = ready ? `Message ${persona}` : PICK_FIRST;
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
      p.textContent = 'The scenario has not started. Choose a persona, then send a message to begin.';
      box.replaceChildren(p);
    } else {
      box.replaceChildren(
        ...turns.flatMap((t, i) => (isChatTurn(t) ? [renderChatTurn(t, this.log.personaAt(i))] : [])),
      );
    }
    this.renderProgress(turns.length);
  }

  private renderProgress(count: number): void {
    if (!this.progress) return;
    let text = 'Scenario not started';
    if (count > 0) {
      const turns = this.log.turns();
      for (let i = turns.length - 1; i >= 0; i--) {
        const t = turns[i];
        if (t.step !== null) {
          text = `Step ${t.step} of ${t.total_steps}`;
          break;
        }
      }
    }
    this.progress.textContent = text;
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
    // The turn already happened on the agent's side (the scenario advanced),
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
    this.progress = null;
    this.errorSlot = null;
    this.modelSlot = null;
    this.lastPositionKey = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
