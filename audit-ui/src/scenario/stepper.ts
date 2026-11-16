// SCENARIO STEPPER -- a pure, deterministic cursor over the (MOCK) scenario.
// Advancing only reveals more; earlier entries are never touched.

import type { Entry } from '../adapter/seam.ts';
import type { Scenario, ScenarioCursor, ScenarioStep } from './types.ts';

export function createScenarioCursor(s: Scenario): ScenarioCursor {
  let pos = 0;
  return {
    scenario: s,
    position: () => pos,
    total: () => s.steps.length,
    next: () => (pos < s.steps.length ? s.steps[pos] : null),
    advance(): ScenarioStep | null {
      if (pos >= s.steps.length) return null;
      const played = s.steps[pos];
      pos += 1;
      return played;
    },
    visibleEntries(): Entry[] {
      return s.steps.slice(0, pos).flatMap(step => step.entries);
    },
    playedSteps: () => s.steps.slice(0, pos),
  };
}
