/**
 * The named channel between the engine boxes beside a reply and the
 * telemetry column. A box publishes the engine and the turn it belongs to;
 * the telemetry panel shows that engine's events for that turn instead of
 * the general feed. `null` means "back to the general feed". Neither side
 * queries the other's DOM. No subscriber means nothing happens.
 *
 * Like provenanceChannel, plus one thing: it remembers the last published
 * focus (`current`), so boxes drawn later (a new turn, a remount) can show
 * which one is pressed, and a box can tell a toggle-off from a switch.
 */
import type { Engine } from './activity-feed.ts';

export interface EngineFocus {
  engine: Engine;
  turnIndex: number;
}

type Listener = (f: EngineFocus | null) => void;

const listeners = new Set<Listener>();
let last: EngineFocus | null = null;

export const engineFocusChannel = {
  publish(f: EngineFocus | null): void {
    last = f;
    for (const fn of [...listeners]) fn(f);
  },
  /** The focus last published (null: the general feed). */
  current(): EngineFocus | null {
    return last;
  },
  /** Returns the unsubscribe function. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
