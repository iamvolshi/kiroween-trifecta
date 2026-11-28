// The attached-repo state shared by the chat and the mini chat: which repo (if any),
// how far Sherlock is with it, which source the chat asks (the book or the repo),
// and the repo's own question/answer turns. One instance per Router.
import type { GithubClient, AttachRequest, RepoAnswer, RepoStatus } from '../adapter/github-client.ts';
import type { RosieSession } from './rosie-session.ts';

/** What the chat asks: the book, the attached GitHub repo, or the folder Rosie reads. */
export type Source = 'book' | 'repo' | 'folder';

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
  /** The local folder Rosie reads for this person, or null when this build has no Rosie. */
  readonly rosie: RosieSession | null;
  private rosieWasReady = false;

  constructor(client: GithubClient, pollMs = 1500, rosie: RosieSession | null = null) {
    this.client = client;
    this.pollMs = pollMs;
    this.rosie = rosie;
    rosie?.subscribe(() => {
      const ready = rosie.ready;
      // A folder that just became ready is asked first, like a repo; a folder that went away stops being asked.
      if (ready && !this.rosieWasReady && this.source === 'book' && rosie.turns.length === 0) this.source = 'folder';
      if (!ready && this.source === 'folder') this.source = 'book';
      this.rosieWasReady = ready;
      this.emit();
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of [...this.listeners]) fn();
  }

  get ready(): boolean { return this.status?.state === 'ready'; }

  /** Who answers now: the source the person picked, if it is ready; otherwise the book. */
  get mode(): Source {
    if (this.source === 'repo' && this.ready) return 'repo';
    if (this.source === 'folder' && this.rosie?.ready) return 'folder';
    return 'book';
  }

  /** The turns of the source that answers now (the book keeps its own log in the chat). */
  get activeTurns(): RepoTurn[] { return this.mode === 'folder' && this.rosie ? this.rosie.turns : this.turns; }

  /** The name the composer shows for the source that answers now. */
  get activeName(): string {
    if (this.mode === 'folder') return this.rosie?.status?.folder ?? 'your folder';
    return this.status?.repo ?? 'your repo';
  }

  /** Ask the source that answers now (repo or folder). */
  askActive(message: string): Promise<string> {
    return this.mode === 'folder' && this.rosie ? this.rosie.ask(message) : this.ask(message);
  }

  /** Ask the source that answers now, without keeping the turn. */
  askQuietActive(message: string): ReturnType<GithubClient['ask']> {
    return this.mode === 'folder' && this.rosie ? this.rosie.askQuiet(message) : this.askQuiet(message);
  }
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
      if (this.source === 'repo') this.source = 'book';
    }
    this.emit();
  }

  /** Ask the attached repo. The turn is kept on success; a failure comes back as words. */
  async ask(message: string): Promise<string> {
    const r = await this.client.ask(message);
    if (!r.ok) return r.error;
    this.turns.push({ message, answer: r.data });
    this.emit();
    return '';
  }

  /** Ask the attached repo without keeping the turn: the Sherlock & Watson page keeps its own. */
  askQuiet(message: string): ReturnType<GithubClient['ask']> {
    return this.client.ask(message);
  }

  setSource(s: Source): void {
    if (s === 'repo' && !this.ready) return;
    if (s === 'folder' && !this.rosie?.ready) return;
    this.source = s;
    this.emit();
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
