// SCENARIO TYPES -- the shape of the scripted (MOCK) scenario.
// The scenario is plain data plus a stepper: no model, no randomness.

import type { AskResult, Entry, Lesson } from '../adapter/seam.ts';

/** One scripted exchange. Playing it reveals `entries`, in order. */
export interface ScenarioStep {
  /** 1-based position in the script. */
  step: number;
  /** The suggested user message for this step (shown as a hint in the chat). */
  prompt: string;
  /**
   * Lower-case words. A user message plays this step when it contains any
   * of them (case-insensitive, whole word). Only the NEXT step can match.
   */
  keywords: string[];
  /** ARCHE's scripted reply. */
  reply: string;
  /** ERIE's scripted retrieval for this turn, or null. */
  erie: AskResult | null;
  /** ELLE's scripted lesson recorded on this turn (status 'candidate'), or null. */
  elle: Lesson | null;
  /** event_id of a lesson ELLE promotes on this turn (scripted, mock), or null. */
  promotes: string | null;
  /** Record entries KATIE writes on this turn (revealed by playing the step). */
  entries: Entry[];
}

export interface Scenario {
  /** Account id; every scenario subject starts with `${account_id}.`. */
  account_id: string;
  steps: ScenarioStep[];
  /** KIDMAP labels for the scenario's KIDs (labels are mock). */
  kid_labels: Record<number, string>;
  /**
   * subject -> lower-case words. A prompt "seeks" a subject when it contains
   * any of them (whole word, case-insensitive). Mock: no language model.
   */
  subject_keywords: Record<string, string[]>;
  /** The reply for any message the script has no answer for. */
  not_knowing_reply: string;
}

/**
 * Read-only cursor over a Scenario. Position 0 = nothing revealed.
 * Entries are never edited or removed: advancing only reveals more.
 */
export interface ScenarioCursor {
  readonly scenario: Scenario;
  /** Number of steps played so far (0..steps.length). */
  position(): number;
  total(): number;
  /** The next unplayed step, or null when the script is finished. */
  next(): ScenarioStep | null;
  /** Plays the next step; returns it, or null when finished. */
  advance(): ScenarioStep | null;
  /** Entries of every played step, in script order. */
  visibleEntries(): Entry[];
  /** Steps played so far, in order. */
  playedSteps(): ScenarioStep[];
}
