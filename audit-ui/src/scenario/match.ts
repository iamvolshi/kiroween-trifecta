// Keyword matching for the scripted (MOCK) chat. Whole words, case-insensitive.

import type { ScenarioStep } from './types.ts';

export function matchesStep(message: string, step: ScenarioStep): boolean {
  const words = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  if (words.length === 0) return false;
  const wanted = new Set(step.keywords.map(k => k.toLowerCase()));
  return words.some(w => wanted.has(w));
}
