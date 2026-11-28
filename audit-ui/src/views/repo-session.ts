// The attached-repo state shared by the chat and the mini chat: which repo (if any),
// how far Sherlock is with it, which source the chat asks (the book or the repo),
// and the repo's own question/answer turns. One instance per Router.
import type { GithubClient, AttachRequest, RepoAnswer, RepoStatus } from '../adapter/github-client.ts';

export type Source = 'book' | 'repo';

export interface RepoTurn { message: string; answer: RepoAnswer }

const WORKING = new Set(['queued', 'fetching', 'indexing']);

export class RepoSession {
  private client: GithubClient;
  private pollMs: number;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private run = 0;
  /** The last status read, or null when no repo is attached. */
  status: RepoStatus | null = null;
  /** The words for the last failed call (attach, status, detach), or ''. */
  error = '';
  /** True while an attach request is in flight. */
  attaching = false;
  source: Source = 'book';
  readonly turns: RepoTurn[] = [];

  constructor(client: GithubClient, pollMs = 1500) {
    this.client = client;
    this.pollMs = pollMs;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn();
  }

  get ready(): boolean { return this.status?.state === 'ready'; }
  get working(): boolean { return this.attaching || (this.status !== null && WORKING.has(this.status.state)); }

  /** Read the status once (on boot, so a reload finds the repo again) and keep polling while it works. */
  async refresh(): Promise<void> {
    const run = this.run;
    const r = await this.client.status();
    if (run !== this.run) return; // detached or re-attached meanwhile
    if (!r.ok) {
      this.error = r.error;
    } else {
      this.error = '';
      this.status = r.data;
      if (r.data?.state === 'ready' && this.turns.length === 0 && this.source === 'book') this.source = 'repo';
    }
    this.emit();
    if (r.ok && r.data && WORKING.has(r.data.state)) {
      this.timer = setTimeout(() => void this.refresh(), this.pollMs);
    }
  }

  async attach(req: AttachRequest): Promise<void> {
    this.stop();
    const run = ++this.run;
    this.attaching = true;
    this.error = '';
    this.emit();
    const r = await this.client.attach(req);
    if (run !== this.run) return;
    this.attaching = false;
    if (!r.ok) {
      this.error = r.error;
      this.emit();
      return;
    }
    this.status = r.data;
    this.turns.length = 0;
    this.emit();
    if (WORKING.has(r.data.state)) this.timer = setTimeout(() => void this.refresh(), this.pollMs);
  }

  async detach(): Promise<void> {
    this.stop();
    ++this.run;
    const r = await this.client.detach();
    this.error = r.ok ? '' : r.error;
    if (r.ok) {
      this.status = null;
      this.turns.length = 0;
      this.source = 'book';
    }
    this.emit();
  }

  /** Keep a turn that was asked quietly: the chat asked Sherlock first, then decided the answer is worth showing. */
  keepTurn(message: string, answer: RepoAnswer): void {
    this.turns.push({ message, answer });
    this.emit();
  }

  /** Ask the attached repo without keeping the turn: the Detective screen keeps its own. */
  askQuiet(message: string): ReturnType<GithubClient['ask']> {
    return this.client.ask(message);
  }

  setSource(s: Source): void {
    if (s === 'repo' && !this.ready) return;
    this.source = s;
    this.emit();
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
