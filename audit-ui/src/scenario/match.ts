// Keyword matching for the scripted (MOCK) chat. Whole words, case-insensitive.

import type { Scenario, ScenarioStep } from './types.ts';

function wordsOf(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

export function matchesStep(message: string, step: ScenarioStep): boolean {
  const words = wordsOf(message);
  if (words.length === 0) return false;
  const wanted = new Set(step.keywords.map(k => k.toLowerCase()));
  return words.some(w => wanted.has(w));
}

/** Subjects a message seeks (whole word, case-insensitive), in script order. */
export function seeksSubjects(message: string, scenario: Scenario): string[] {
  const words = new Set(wordsOf(message));
  if (words.size === 0) return [];
  return Object.keys(scenario.subject_keywords).filter(subject =>
    scenario.subject_keywords[subject].some(k => words.has(k.toLowerCase())),
  );
}
