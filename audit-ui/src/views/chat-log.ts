import type { ChatTurn, Persona, Register } from '../adapter/seam.ts';

/**
 * Append-only transcript of chat turns, plus the conversation's chosen
 * persona and Frankenstein register. Survives view remounts (the Router
 * owns one), so leaving the chat and coming back keeps both.
 */
export class ChatLog {
  private items: ChatTurn[] = [];
  /** Persona that replied to each turn, by index (null = not recorded). */
  private speakers: Array<Persona | null> = [];
  private listeners = new Set<() => void>();
  private chosen: Persona | null = null;
  private voice: Register = 'movie';

  /** A copy; callers cannot mutate the log. */
  turns(): ChatTurn[] {
    return [...this.items];
  }

  /** The persona that replied to turn `i`, or null when none was recorded. */
  personaAt(i: number): Persona | null {
    return this.speakers[i] ?? null;
  }

  push(t: ChatTurn, persona: Persona | null = null): void {
    this.items.push(t);
    this.speakers.push(persona);
    for (const fn of [...this.listeners]) fn();
  }

  /** Called after every push. Returns the unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** The active persona; null until the user picks one (no default). */
  persona(): Persona | null {
    return this.chosen;
  }

  setPersona(p: Persona): void {
    this.chosen = p;
  }

  /** Frankenstein's register; Movie by default (flagged call for Darren). */
  register(): Register {
    return this.voice;
  }

  setRegister(r: Register): void {
    this.voice = r;
  }
}
