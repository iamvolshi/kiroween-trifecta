// The local-folder state shared by the left column, the chat and the mini chat: is Rosie paired,
// is she awake, which folder is attached, how far Sherlock is with it, and the folder's own
// question/answer turns. Polls /api/rosie/status (2 s while something is moving, 5 s otherwise,
// not at all for a person who never paired). One instance per RepoSession.
import type { RosieClient, RosieStatus, PairingCode } from '../adapter/rosie-client.ts';
import type { RepoTurn } from './repo-session.ts';

const MOVING = new Set(['choosing_folder', 'reading', 'indexing']);

export class RosieSession {
  private client: RosieClient;
  private fastMs: number;
  private slowMs: number;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private run = 0;
  /** The last status read, or null before the first one. */
  status: RosieStatus | null = null;
  /** The open pairing code, or null. */
  pairing: PairingCode | null = null;
  private actionError = '';
  private readError = '';
  /** The words for the last failed call, or ''. A failed action stays until the next action; a failed read goes when a read works. */
  get error(): string { return this.actionError || this.readError; }
  /** True while a pair, choose-folder, detach or unpair request is in flight. */
  busy = false;
  readonly turns: RepoTurn[] = [];

  constructor(client: RosieClient, fastMs = 2000, slowMs = 5000) {
    this.client = client;
    this.fastMs = fastMs;
    this.slowMs = slowMs;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn();
  }

  get ready(): boolean { return this.status?.state === 'ready'; }
  get paired(): boolean { return this.status !== null && this.status.connection !== 'not_paired'; }
  get working(): boolean { return this.busy || (this.status !== null && MOVING.has(this.status.state)); }

  /** Read the status once and keep polling while there is something to watch. */
  async refresh(): Promise<void> {
    const run = this.run;
    const r = await this.client.status();
    if (run !== this.run) return; // reset meanwhile
    if (!r.ok) {
      this.readError = r.error;
    } else {
      this.readError = '';
      this.status = r.data;
      if (this.paired) this.pairing = null; // the code did its job
    }
    if (this.pairing && this.pairing.expiresMs > 0 && Date.now() > this.pairing.expiresMs) {
      this.pairing = null;
      this.actionError = 'That pairing code ran out. Get a new one.';
    }
    this.emit();
    this.schedule();
  }

  private schedule(): void {
    this.stop();
    const s = this.status;
    if (!s) return;
    if (this.pairing !== null || MOVING.has(s.state)) this.timer = setTimeout(() => void this.refresh(), this.fastMs);
    else if (s.connection !== 'not_paired') this.timer = setTimeout(() => void this.refresh(), this.slowMs);
  }

  /** Run one action, then read the status again right away. */
  private async act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void): Promise<void> {
    this.stop();
    ++this.run;
    this.busy = true;
    this.actionError = '';
    this.emit();
    const r = await fn();
    this.busy = false;
    if (!r.ok) this.actionError = r.error;
    else after?.();
    this.emit();
    await this.refresh();
  }

  /** Ask Sherlock for a pairing code. The app shows it; the person types it into Rosie. */
  pair(): Promise<void> {
    return this.act(async () => {
      const r = await this.client.pair();
      if (r.ok) this.pairing = r.data;
      return r;
    });
  }

  chooseFolder(): Promise<void> {
    return this.act(() => this.client.chooseFolder());
  }

  detach(): Promise<void> {
    return this.act(() => this.client.detach(), () => { this.turns.length = 0; });
  }

  unpair(): Promise<void> {
    return this.act(() => this.client.unpair(), () => { this.turns.length = 0; this.pairing = null; });
  }

  /** Ask the attached folder. The turn is kept on success; a failure comes back as words. */
  async ask(message: string): Promise<string> {
    const r = await this.client.ask(message);
    if (!r.ok) return r.error;
    this.turns.push({ message, answer: r.data });
    this.emit();
    return '';
  }

  /** Ask without keeping the turn: the Sherlock & Watson page keeps its own. */
  askQuiet(message: string): ReturnType<RosieClient['ask']> {
    return this.client.ask(message);
  }

  /** Stop polling (the page is going away). */
  destroy(): void {
    ++this.run;
    this.stop();
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
