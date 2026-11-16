# Code Review Sage -- review 1 (run 216a9c559c935ee7, 2026-11-16)

Reviewer: independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

I found no blockers. `npx vitest run` passes (26 files, 201 tests), `npx tsc --noEmit` is clean, and `npm run build` succeeds. No new file has a BOM. The largest file is `style.css` at 447 lines. README, `package.json` and `main.ts` are untouched.

**Should-fix**
1. `audit-ui/src/views/chat.ts:105` and `audit-ui/src/views/chat.test.ts:171-182`: a reply that resolves after unmount, or after a later submit, is dropped, so `this.log.push` at line 115 never runs. The mock cursor has already advanced inside `adapter.chat`, so the scenario consumes a step the transcript never shows.
   - Fix: when the view was unmounted, still call `this.log.push(result.data)`. The log belongs to the Router and survives navigation. Skip only the DOM updates.
   - Fix the test to expect the turn to be logged, or the guard will keep hiding this.
   - Mock responses resolve in a microtask, so this is hard to hit today. It will bite once the live seam is wired.

**Nits**
- `audit-ui/src/adapter/mock-assembly.ts:119`: `update()` advances the cursor but never plays that step's reply or lesson, so ELLE's lesson for the step is lost. The UI never calls `update`, so this is mock-only.
- `audit-ui/src/views/chat-turn.ts:36`: the ERIE row always says "found" and ignores `ask.state`. Show `ask.state` so a `not_found` result renders as not found.
- `audit-ui/src/util/calendar.ts:54,73`: `Date.UTC` maps years 0 to 99 onto 1900 to 1999, and `/calendar/0000-01` is accepted. Reject years below 1000 in `parseCalendarPath`.
- `audit-ui/src/views/calendar.ts:83`: the day level fetches the KID map but never uses it. Move the fetch to the hour branch.
- `audit-ui/src/adapter/live.ts`: `NOT_WIRED` is one shared object returned by reference. Return a fresh object or freeze it.

**Constraint check**
- **Tests:** the spot-checked tests assert real behavior. The `chat.test.ts:171` unmount test locks in the dropped-turn behavior from the should-fix above.
- **Engine and mock labeling:** there are no engine imports or copied trifecta code. Mock is labeled in the code, in the nav badge, in the chat note, in scenario hashes (`mock:*`) and in `(mock)` values.
- **Doctrine:** nothing in the UI writes entries. `update()` is not called by any view, and the mock refuses authority outside 0 to 8. Scenario intervals are half-open and chain contiguously: the 14:30 revision closes `[09:12, 14:30)`, and the open entry closes at the window end. Not-knowing is returned as scripted, never filled.
- **Live stub:** every new method returns the typed "not wired" error, with no fetch and no URL.
- **Front end only:** there are no new dependencies. The only `innerHTML` uses are static templates and clearing the container. Data goes through `textContent`, and URL parts are encoded.
- **Calendar:** dots come from entry `k_start` in UTC and are labeled UTC. The displayed moment is the string passed to `parseUtcInput`. The hour view uses `fetchBeliefPool`, which goes through `isLiveAt`.
- **Chat:** exactly one step plays per matched exchange. An unmatched message gets the scripted not-knowing reply. The engine labels are ARCHE, ERIE, ELLE and KATIE, and the KATIE link resolves to Entry Detail (integration test at `assembly-integration.test.ts:96`).

## Remediation (parent session)

- Should-fix 1 (chat turn dropped after unmount): fixed in `views/chat.ts`; the turn is logged before the unmount guard. Test changed to expect the logged turn and its replay on remount.
- Nit ERIE state: fixed in `views/chat-turn.ts`; `not_found` renders 'looked, found nothing'. New test.
- Nit years 0-999: fixed in `util/calendar.ts`; rejected. Test cases added.
- Nit unused KID map fetch on the day level: moved to the hour branch.
- Nit shared NOT_WIRED object: frozen.
- Nit mock `update()` skips the step's lesson: NOT fixed. Mock-only, no view calls `update`. Left as a known limit.

After remediation: 202/202 tests, tsc clean, build clean.
