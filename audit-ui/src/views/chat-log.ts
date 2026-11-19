import type { ChatTurn, Persona, Register } from '../adapter/seam.ts';

/**
 * Append-only transcript of chat turns, plus the conversation's picked
 * voice. Survives view remounts (the Router owns one), so leaving the chat
 * and coming back keeps both. The mask is always Frankenstein; the voice is
 * one of its registers.
 */
export class ChatLog {
  private items: ChatTurn[] = [];
  /** The voice that replied to each turn, by index (null = not recorded). */
  private speakers: Array<Register | null> = [];
  private listeners = new Set<() => void>();
  private picked: Register | null = null;

  /** A copy; callers cannot mutate the log. */
  turns(): ChatTurn[] {
    return [...this.items];
  }

  /** The voice that replied to turn `i`, or null when none was recorded. */
  voiceAt(i: number): Register | null {
    return this.speakers[i] ?? null;
  }

  push(t: ChatTurn, voice: Register | null = null): void {
    this.items.push(t);
    this.speakers.push(voice);
    for (const fn of [...this.listeners]) fn();
  }

  /** Called after every push. Returns the unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** The mask, once a voice is picked; null before (no default). */
  persona(): Persona | null {
    return this.picked === null ? null : 'Frankenstein';
  }

  /** The picked voice; null until the user picks one (no default). */
  voice(): Register | null {
    return this.picked;
  }

  setVoice(r: Register): void {
    this.picked = r;
  }
}
