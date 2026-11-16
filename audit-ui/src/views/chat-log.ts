import type { ChatTurn } from '../adapter/seam.ts';

/** Append-only transcript of chat turns. Survives view remounts. */
export class ChatLog {
  private items: ChatTurn[] = [];

  /** A copy; callers cannot mutate the log. */
  turns(): ChatTurn[] {
    return [...this.items];
  }

  push(t: ChatTurn): void {
    this.items.push(t);
  }
}
