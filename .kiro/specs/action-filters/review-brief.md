# Code Review Sage -- review brief, Action List filters round

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/action-filters`) against base `24eebc3` (the collapse-round
merge on main): `git diff 24eebc3` plus untracked files. Screenshots from
the production build (headless Chrome, 6 chat prompts played in-page first)
are in `docs/filter-proof/`: 01 unfiltered, 02 state Revised, 03
retractions only, 04 confidence 4-6 middle, 05 no-match (Rejected + 7-9
high), 06 keyboard focus on a chip. Open each by its file name.

## The order

Action List ONLY. Filters operate on the entries the view already fetched;
collapsed rows stay collapsed, expanded state per row as before.
- Event type: one chip per state PRESENT in the loaded entries, plus All;
  derived from the data, never hardcoded.
- Retractions: one chip, entries whose state is `rejected` or
  `contradicted` (judgment call flagged for Darren). Composes with others.
- Confidence: All / 1-3 low / 4-6 middle / 7-9 high on authority.
- Filters combine with AND. Count "Showing X of Y entries" from the loaded
  data only.
- No matches: explicit empty state naming the active filters; a Clear
  control resets all three to All.
- Real buttons with aria-pressed, Tab-reachable, visible focus. View-local
  state, no URL params, no persistence.

## Check

1. Only the Action List changed; no adapter, scenario, router, seam or
   data-flow change; sort order and hrefs unchanged; collapsed-row
   behaviour, card skeleton, palette and header strip untouched.
2. Filtering hides/shows rows built once (`hidden`), so expanded rows keep
   their state. Count and empty text come only from the loaded entries.
3. Chips: no hardcoded state list (the scenario data has no `contradicted`,
   so screenshots show no Contradicted chip; tests cover a data set that has
   one). `RETRACTION_STATES` is the only fixed set and it is the flagged
   reading.
4. Edge: authority 0 falls in no band (the bands start at 1). Say if that
   needs flagging.
5. Accessibility: three `role=group` with aria-label; every chip is a
   `<button type="button">` with aria-pressed; Clear is always enabled so
   focus is never dropped; focus is restored to the pressed chip after the
   bar re-renders; count has aria-live=polite. Parent verified in Chrome:
   Tab moves along chips, Space presses one.
6. The new tests in `views/action-filters.test.ts` assert real behaviour
   (each filter alone, AND combos incl. a property test against
   `applyFilters`, Clear, no-match naming, count, derived chips, row state
   kept across filtering).
7. No Stitch material, no new dependency, no network, doctrine untouched,
   README / disclosure / live stub untouched, no file over ~500 lines, no
   BOM; contrast of chip text on its surfaces (tokens in
   `.kiro/specs/presentation/notes.md`).
8. Tests all pass, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
