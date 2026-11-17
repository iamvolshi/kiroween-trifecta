# Code Review Sage -- review brief, Hour view table

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/hour-view-table`) against base `0bf3246`: `git diff 0bf3246`
plus untracked files. Screenshots from the production build (headless
Chrome, the 6 chat prompts played in-page first) are in
`docs/hour-view-proof/`; open them.

## The order

The calendar hour view only (`/calendar/YYYY-MM-DD/HH`): the two sections
"What the agent did this hour" and "What it believed at this moment" each
become a real `<table>`: column headers on top, one row per entry. Columns
in order: KID | Subject | State | Authority (0-9) | Evidence | Reason. Mono
for ids, times and evidence values. Every row links to its Entry Detail
with the existing href pattern. Keep `.hour-did` / `.hour-believed`, keep
the two sections visually distinct. Empty states stay explicit words,
never a bare empty table. Moment (UTC) header, Back link, MOCK label and
shell stay.

## Check

1. Only the hour view's rendering changed. Day/month views, action list,
   record view, chain, pool and telemetry untouched (the removed
   `.calendar-entries` selectors in `style.css` must have been used only by
   the hour view: verify no other markup uses that class).
2. Data flow untouched: same seam calls, same `entriesInHour` /
   `fetchBeliefPool` (isLiveAt) results, same entries, same order.
3. Table semantics: `thead` / `th scope="col"`, labeled table, one row per
   entry, one link per row (stretched over the row in CSS). Keyboard: one
   tab stop per row, visible focus, Enter opens the entry.
4. One test line changed (`assembly-integration.test.ts`: `.hour-believed
   li` -> `.hour-believed tbody tr`) because a table has no `li`. Confirm
   the assertion keeps its meaning (rows shown == live entries).
5. No sorting/filtering/interaction added. No new dependency, no network,
   no invented data, no Stitch material. Doctrine, README, disclosure, live
   stub untouched. No file over ~500 lines. No BOM.
6. Contrast of header and cell text on their surfaces (tokens in
   `.kiro/specs/face/notes.md`).
7. Tests 262/262, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
