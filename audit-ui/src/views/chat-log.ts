import type { ChatTurn } from '../adapter/seam.ts';

/** Append-only transcript of chat turns. Survives view remounts. */
export class ChatLog {
  private items: ChatTurn[] = [];
  private listeners = new Set<() => void>();

  /** A copy; callers cannot mutate the log. */
  turns(): ChatTurn[] {
    return [...this.items];
  }

  push(t: ChatTurn): void {
    this.items.push(t);
    for (const fn of [...this.listeners]) fn();
  }

  /** Called after every push. Returns the unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
