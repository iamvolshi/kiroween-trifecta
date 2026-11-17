import type { View } from '../router/router.ts';
import type { SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from './chat-log.ts';
import { renderChatTurn } from './chat-turn.ts';
import { createIntro } from './intro.ts';

export class ChatView implements View {
  private adapter: SeamAdapter;
  private log: ChatLog;
  private container: HTMLElement | null = null;
  private transcript: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
  private errorSlot: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private form: HTMLFormElement | null = null;
  private submitHandler: ((e: Event) => void) | null = null;
  /** Incremented per submit and on unmount; stale replies are dropped. */
  private requestToken = 0;

  constructor(adapter: SeamAdapter, log: ChatLog) {
    this.adapter = adapter;
    this.log = log;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = `
      <div class="chat-view">
        <h1>Chat with the agent (ARCHE)</h1>
        <p class="mock-note">Replies are scripted mock. No model is running.</p>
        <p class="step-progress"></p>
        <div class="chat-transcript"></div>
        <div class="chat-error"></div>
        <form class="chat-form">
          <label for="chat-message">Your message</label>
          <input type="text" id="chat-message" autocomplete="off">
          <button type="submit">Send</button>
        </form>
      </div>
    `;
    container.querySelector('.chat-view h1')?.after(createIntro('chat'));

    this.transcript = container.querySelector<HTMLElement>('.chat-transcript');
    this.progress = container.querySelector<HTMLElement>('.step-progress');
    this.errorSlot = container.querySelector<HTMLElement>('.chat-error');
    this.input = container.querySelector<HTMLInputElement>('#chat-message');
    this.sendBtn = container.querySelector<HTMLButtonElement>('.chat-form button');
    this.form = container.querySelector<HTMLFormElement>('.chat-form');

    this.submitHandler = (e: Event) => {
      e.preventDefault();
      void this.onSubmit();
    };
    this.form?.addEventListener('submit', this.submitHandler);

    this.renderTranscript();
  }

  private renderTranscript(): void {
    const box = this.transcript;
    if (!box) return;
    const turns = this.log.turns();
    if (turns.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-state';
      p.textContent = 'The scenario has not started. Send a message to begin.';
      box.replaceChildren(p);
    } else {
      box.replaceChildren(...turns.map(renderChatTurn));
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
    const message = input.value.trim();
    if (message === '') return;

    const token = ++this.requestToken;
    const root = this.container;
    btn.disabled = true;
    this.errorSlot?.replaceChildren();

    let result: Awaited<ReturnType<SeamAdapter['chat']>>;
    try {
      result = await this.adapter.chat(message);
    } catch (e) {
      // An adapter that throws (a live fetch path, say) must not leave Send
      // disabled forever: show the error in words and give the button back.
      result = { ok: false, error: `The chat request failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    // The turn already happened on the agent's side (the scenario advanced),
    // so it is logged even when this view is gone; only the DOM work is skipped.
    if (result.ok) this.log.push(result.data);
    if (token !== this.requestToken || this.container !== root) return;

    btn.disabled = false;
    if (!result.ok) {
      const p = document.createElement('p');
      p.className = 'error-state';
      p.textContent = result.error;
      this.errorSlot?.replaceChildren(p);
      return;
    }
    input.value = '';
    this.renderTranscript();
  }

  unmount(): void {
    this.requestToken++;
    if (this.form && this.submitHandler) {
      this.form.removeEventListener('submit', this.submitHandler);
    }
    this.submitHandler = null;
    this.form = null;
    this.input = null;
    this.sendBtn = null;
    this.transcript = null;
    this.progress = null;
    this.errorSlot = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
