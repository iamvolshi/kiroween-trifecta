// LESSON STATE (MOCK) -- current lessons derived from the played steps.
// The scripted lesson stays frozen as recorded; promotion is a new event, so
// the current lessons are COPIES with their present status.

import type { Lesson, LessonsInPrompt } from '../adapter/seam.ts';
import type { ScenarioStep } from './types.ts';

/** Lessons recorded by the played steps, as copies with their current status. */
export function currentLessons(played: ScenarioStep[]): Lesson[] {
  const promoted = new Set(
    played.flatMap(s => (s.promotes !== null ? [s.promotes] : [])),
  );
  return played.flatMap(s =>
    s.elle
      ? [{ ...s.elle, status: promoted.has(s.elle.event_id) ? ('promoted' as const) : s.elle.status }]
      : [],
  );
}

/** The current copy of one lesson, or null when it has not been recorded. */
export function currentLesson(played: ScenarioStep[], eventId: string): Lesson | null {
  return currentLessons(played).find(l => l.event_id === eventId) ?? null;
}

/** Lessons on the sought subjects: promoted are injected, candidates held. */
export function lessonsInPrompt(played: ScenarioStep[], subjects: string[]): LessonsInPrompt {
  const onSubject = currentLessons(played).filter(
    l => l.subject !== null && subjects.includes(l.subject),
  );
  return {
    subjects,
    injected: onSubject.filter(l => l.status === 'promoted'),
    held: onSubject.filter(l => l.status === 'candidate'),
  };
}