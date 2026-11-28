import { isRegister, type Register } from '../adapter/seam.ts';

/**
 * Frankenstein's three voices, as the picker names them: the portrayal and
 * its year (the novel 1818, the Universal film 1931, the Mel Brooks film
 * 1974). Which voices appear is the connector's call (/models
 * register_voices); this table only names them. The accent each voice
 * takes lives in CSS ([data-voice]), keyed by the same register name.
 */
export interface VoiceLabel {
  /** The chip's portrayal name, e.g. "BOOK". */
  tag: string;
  /** The portrayal's year, e.g. "1818". */
  year: string;
  /** How the composer names the voice: "Message Book". */
  name: string;
}

export const VOICE_LABELS: Record<Register, VoiceLabel> = {
  book: { tag: 'BOOK', year: '1818', name: 'Book' },
  movie: { tag: 'MOVIE', year: '1931', name: 'Movie' },
  'young-frankenstein': { tag: 'YOUNG', year: '1974', name: 'Young' },
};

/** The order the chips sit in. */
const ORDER: readonly Register[] = ['book', 'movie', 'young-frankenstein'];

/**
 * The voices to offer: the ones the connector reports, in the picker's
 * order. A voice the app cannot route (a name it does not know) is left out.
 */
export function offeredVoices(reported: readonly string[]): Register[] {
  const known = new Set(reported.filter(isRegister));
  return ORDER.filter((r) => known.has(r));
}
