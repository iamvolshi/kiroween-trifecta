# WO-A -- Seam mock + scenario (order tasks 1, 2)

Read `tasks.md` in this folder first (doctrine, file map, scenario table).
Contracts, do NOT change: `audit-ui/src/adapter/seam.ts` (SeamAdapter, 9
methods), `audit-ui/src/scenario/types.ts`. `audit-ui/src/adapter/live.ts`
already has the 5 new stubs.

## You own only

`audit-ui/src/scenario/script.ts`, `stepper.ts`, `match.ts`,
`audit-ui/src/adapter/mock.ts`, `audit-ui/src/adapter/mock-assembly.ts`, and
new tests `audit-ui/src/scenario/*.test.ts`,
`audit-ui/src/adapter/mock-assembly.test.ts`,
`audit-ui/src/adapter/live-assembly.test.ts`. Other implementers work on
views in the same tree at the same time.

## Build

1. `script.ts`: `export const SCENARIO: Scenario`, exactly the 4 steps in the
   tasks.md table. Ids `scn-s1`..`scn-s4`; first entry of each chain has
   prev_hash `mock:genesis`, later ones `mock:hash-s1` / `mock:hash-s2`;
   evidence `value=<v> (mock)`; pool `pool-mock-scenario`; plain reasons.
   ERIE provenance sources start with `mock:`. Step 4 ELLE lesson:
   event_id `mock:lesson-1`, event_type `trifecta.chat`, rule about checking
   the carrier feed before promising a date. Deep-freeze all scenario data.
   Header comment says MOCK.
2. `stepper.ts`: `createScenarioCursor(s)` implementing `ScenarioCursor`.
   Pure and deterministic. `advance()` never mutates earlier entries.
3. `match.ts`: `matchesStep(message, step)`: case-insensitive whole-word
   match of any keyword, punctuation stripped. Blank never matches.
4. `mock.ts`: `createMockAdapter(entries?: Entry[], options?: { cursor?:
   ScenarioCursor | null })`. No args = the 4 fixtures + fresh cursor over
   SCENARIO. Explicit `entries` = no scenario unless `options.cursor`.
   fetchAllEntries / fetchBeliefPool / fetchChain read fixtures +
   `cursor.visibleEntries()` at call time (one store). fetchKidMap = existing
   map plus `kid_labels` only when a cursor exists. Keep fixtures and
   `MOCK_CURSORS` exactly as they are. `createErrorMock()` errors on all 9
   methods. Keep mock.ts under ~250 lines; the 5 assembly methods live in
   `mock-assembly.ts`.
5. `mock-assembly.ts`:
   - `ask(q)`: if the NEXT step matches q and has erie, return it with
     `question: q`; else `{state:'not_found', text: not-knowing reply,
     provenance: []}`. Never advances.
   - `chat(m)`: if `matchesStep(m, cursor.next())`, advance and return
     `known:true`, `step:N`, engines `{arche:{reply}, erie (question=m),
     elle, katie: one UpdateResult {kid, subject, entry_id, seated:true} per
     revealed entry}`. Otherwise `known:false`, `step:null`, arche reply =
     not-knowing, erie null, elle null, katie []. No cursor: always
     not-knowing. `total_steps` always set (0 without a cursor).
   - `update(req)`: authority must be an integer 0..8, else ok:false saying
     9 is held for the user / out of range. Succeeds only when req matches
     the next step's first entry exactly (kid, subject, authority, value):
     then it plays that step and returns the UpdateResult. Anything else:
     ok:false `mock record is scripted: writes come only from the scenario
     (mock)`.
   - `fetchLessons()`: elle lessons of played steps.
   - `fetchRecord(id)`: visible entries whose subject starts with `id + '.'`,
     grouped by subject, each group sorted with `compareKStart`.

## Regression tests

Cursor at step N shows exactly entries through N. Advancing never rewrites
an earlier entry (deep-equal before/after; frozen). Full record after all
steps equals the script in order. >=3 entries, 2 KIDs, one revision on (4,
`order-1042.delivery_date`) with state and authority change; chain intervals
contiguous, non-overlapping. Mock answers each of the 5 new methods. Live
stub returns ok:false `Live adapter not wired` on each new method.
createErrorMock errors on all 9. `createMockAdapter()` at position 0 returns
exactly the 4 fixtures. Scenario entry appears in fetchAllEntries only after
its step. Not-knowing for unmatched chat and after the last step. update
with authority 9 refused.

## Rules

Built-in file tools only (UTF-8 no BOM; never PowerShell Set-Content).
Leave existing em-dashes alone. Verify from `audit-ui/`: `npx vitest run`
and `npx tsc --noEmit`; failures clearly in files you don't own: note and
move on. Do NOT commit or push. Report: files + line counts, exported
signatures, tests added, results, any GRAY.
