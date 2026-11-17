# WO-G -- Right column telemetry + ELLE in the chat turn

Read `tasks.md` in this folder first. Contracts, do NOT edit:
`audit-ui/src/adapter/seam.ts` (Lesson.subject/status, EngineActivity
elle / elle_promoted / lessons_in_prompt), `audit-ui/src/views/chat-log.ts`,
`audit-ui/src/shell/panel.ts`. Read `views/chat-turn.ts`, `views/chat.ts`,
`views/chat.test.ts`, `util/interval.ts` (compareKStart), `util/
kid-display.ts`, `test-helpers.ts`, `style.css`.

## You own only

New: `audit-ui/src/shell/telemetry.ts` (split into
`shell/telemetry-*.ts` if it nears 300 lines), tests
`audit-ui/src/shell/telemetry.test.ts`. Edit: `audit-ui/src/views/
chat-turn.ts` and the ELLE-related tests in `audit-ui/src/views/
chat.test.ts` (update its fake ChatTurns for the new required fields;
do not touch its nav assertions, WO-F edits those). Append a
`/* Telemetry */` section to the end of `style.css`. Do NOT edit router,
shell.ts, left.ts, nav, scenario or adapter files (other owners, in
progress now).

## Build

1. telemetry.ts: `class TelemetryPanel implements Panel { constructor(
   adapter: SeamAdapter, log: ChatLog) }`. One worker, heading "Curator +
   ELLE (mock)". Everything derives from the seam and the log; nothing is
   invented, nothing animates for show.
   - Subject folders: one per subject the conversation has touched =
     subjects of KATIE results in the log's turns, plus subjects of lessons
     from `fetchLessons()`, in first-seen order. Before any turn:
     `.empty-state` "No subjects yet. Folders appear as the conversation
     records them."
   - Each folder `.subject-folder` shows the subject and, ON the folder,
     `.folder-value` = authority (0-9) of the subject's latest entry by
     k_start among `fetchAllEntries()`, plus its history (e.g. `6 -> 7`) in
     `.folder-history`. Label it what it is: "authority of latest entry".
     No entry yet -> `.folder-value` shows `--` with "no entry recorded".
   - Lessons whose `subject` is that folder's subject render inside it:
     candidate -> class `lesson-candidate` (grey) with "not learned yet";
     promoted -> class `lesson-promoted` with "learned". Lessons with
     subject null go in a `.lessons-unfiled` list.
   - KATIE feed `.katie-feed`: newest first, one item per UpdateResult in
     the log, linking to Entry Detail (`/entry/{kid}/{enc subject}/{enc
     id}`), showing the subject, the entry's evidence (from
     fetchAllEntries; unknown -> "entry not visible"), and what it came
     from: `from: "<user message>" (step N)`. Empty -> `.empty-state`.
   - refresh() re-reads with a request token; late results dropped;
     unmount stops everything. textContent only.
2. chat-turn.ts ELLE row: recorded lesson -> "recorded a lesson (not
   learned yet)" + rule, class `lesson-candidate`; `elle_promoted` ->
   "promoted a lesson (learned)" + rule; `lessons_in_prompt.injected`
   non-empty -> "injected into this prompt:" + each rule;
   `lessons_in_prompt.held` non-empty -> "held back (not learned yet):" +
   each rule. If none of these: "did not act this turn". Keep the existing
   labels/classes for ARCHE, ERIE, KATIE.

## Regression tests

Use local fake adapters and ChatLog (do not depend on the WO-E mock, it
is being edited now). Required: empty state before turns; folder per
touched subject in first-seen order; folder value = latest entry's
authority and moves 6 -> 7 when a revision entry becomes visible and
refresh() runs; candidate lesson grey inside its subject folder, promoted
lesson shown learned; unfiled lesson listed; KATIE feed newest first with
correct href, evidence and "from" text; late refresh after unmount drops;
chat-turn ELLE row text for recorded / promoted / injected / held / none.

## Rules

Built-in file tools only (UTF-8, no BOM). Run from
`D:\kiroween-trifecta\kiroween-trifecta\audit-ui`: `npx vitest run
src/shell/telemetry src/views/chat` and `npx tsc --noEmit` (errors only in
other owners' files: note them). Do NOT commit, push or change git state.
Report: files + line counts, exports, tests, results.
