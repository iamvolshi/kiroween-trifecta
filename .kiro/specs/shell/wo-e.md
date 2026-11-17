# WO-E -- Scenario: lesson subjects, promotion, injection

Read `tasks.md` in this folder first, then `.kiro/specs/assembly/tasks.md`
and `wo-a.md` there (the scenario you are extending). Contracts already
changed, do NOT edit: `audit-ui/src/adapter/seam.ts` (Lesson.subject,
Lesson.status, EngineActivity.elle_promoted, LessonsInPrompt),
`audit-ui/src/scenario/types.ts` (ScenarioStep.promotes,
Scenario.subject_keywords).

## You own only

`audit-ui/src/scenario/script.ts`, `audit-ui/src/scenario/match.ts`,
`audit-ui/src/scenario/stepper.ts`, `audit-ui/src/adapter/mock-assembly.ts`,
`audit-ui/src/adapter/mock.ts`, and their tests
`audit-ui/src/scenario/*.test.ts`, `audit-ui/src/adapter/mock-assembly.test.ts`.
You may add `audit-ui/src/scenario/lessons.ts` for the lesson logic. Two
other implementers work on views and the shell in the same tree right now.

## Build

1. script.ts: give every existing step `promotes: null`; step 4's lesson
   gets `subject: 'order-1042.delivery_date'`, `status: 'candidate'`. Add
   steps 5 and 6 exactly as in tasks.md (no entries). Add
   `subject_keywords`. Steps 1-4 stay byte-for-byte the same otherwise.
2. match.ts: export `seeksSubjects(message, scenario): string[]` (whole
   word, case-insensitive, punctuation stripped, script order).
3. Lesson state (lessons.ts): from played steps, the lessons recorded and
   the set of promoted event_ids -> current lessons as COPIES with status
   'promoted' when promoted. Never mutate the frozen script.
4. mock-assembly.ts chat(): for every message compute `lessons_in_prompt`
   from the state BEFORE playing (subjects sought; injected = promoted on
   those subjects; held = candidates on those subjects). Matched turn: as
   today, plus `elle` = the step's recorded lesson (candidate) or null,
   `elle_promoted` = the promoted lesson copy or null. Unmatched turn:
   `elle: null`, `elle_promoted: null`, `lessons_in_prompt` still computed.
   No cursor: empty lessons_in_prompt. fetchLessons(): current status.
   update(): keep behavior; a played step's lesson/promotion must count the
   same whichever way the step was played (fixes review-1 nit).
5. Do not change record behavior: steps 5-6 add no entries; every existing
   record read returns what it returned before.

## Regression tests

- Script: 6 steps; step 4 lesson subject + candidate; step 5 promotes
  `mock:lesson-1`; steps 5-6 have no entries; record still 4 entries.
- Update existing tests that assumed 4 steps to read `SCENARIO.steps.length`.
- Lesson is 'candidate' after step 4 and 'promoted' after step 5
  (fetchLessons); the scripted lesson object is unchanged and frozen.
- Injection: step 1 injects nothing; a delivery-date prompt after step 4
  (unmatched, e.g. "what is the delivery date") has the lesson in `held`,
  not `injected`; step 5 turn does not inject it; step 6 injects it; after
  step 6 an unmatched delivery-date prompt still injects it; a prompt
  seeking only parcel-77.status never gets it.
- seeksSubjects cases incl. punctuation and case.

## Rules

Built-in file tools only (UTF-8, no BOM). Run from
`D:\kiroween-trifecta\kiroween-trifecta\audit-ui`: `npx vitest run
src/scenario src/adapter` and `npx tsc --noEmit` (errors in views/shell
files not yours: note only). Do NOT commit, push or change git state.
Report: files + line counts, exports, tests, results, any GRAY.
