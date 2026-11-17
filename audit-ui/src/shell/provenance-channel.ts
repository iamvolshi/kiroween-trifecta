/**
 * The named channel between a provenance link in the chat and the activity
 * feed in the right column. The chat publishes the record entry a link
 * points at; the feed (the only subscriber) scrolls to and highlights its
 * matching item. Neither side queries the other's DOM. No subscriber, or no
 * matching item, means nothing happens.
 */
export interface ProvenanceTarget {
  kid: number;
  subject: string;
  entry_id: string;
}

type Listener = (t: ProvenanceTarget) => void;

const listeners = new Set<Listener>();

export const provenanceChannel = {
  publish(t: ProvenanceTarget): void {
    for (const fn of [...listeners]) fn(t);
  },
  /** Returns the unsubscribe function. */
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
