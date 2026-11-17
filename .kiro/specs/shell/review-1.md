# Code Review Sage -- review 1 (run 16bb766f9ff4d7e9, 2026-11-16)

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

I found no blockers. `npx vitest run` passes (31 files, 262 tests) and `npx tsc --noEmit` is clean. I did not run `npm run build`. The working tree has no BOMs and no source file over 450 lines.

**Shell checks (brief 1–7):**
1. **Columns and routes:** `createShell` runs once in the Router constructor. Views mount into `slots.center`, and the nav is built once, in the left panel. The view-level `createNav` calls were removed from calendar, time-travel, chat and the other views. The `/` to `/actions` redirect in `boot.ts` is unchanged, and `/record/:account` is the only new route. A malformed percent-encoded path falls through to NotFound.
2. **Derived right column:** `TelemetryPanel` reads only `fetchAllEntries`, `fetchLessons` and `ChatLog`. There is no invented telemetry or animation.
3. **0–9 value:** `telemetry.ts:25-32` sorts a subject's entries by `compareKStart` and takes the last. It is labeled "authority of latest entry:" and shows the chain of values, or `--` when a subject has no entry.
4. **Lesson rulings:**
   - The lesson's subject is set in `script.ts`.
   - A candidate shows grey and "not learned yet", and is held, not injected.
   - Only promoted lessons are injected.
   - `injectionFor` runs before `advance()` (`mock-assembly.ts:75`), so lessons are read before the turn plays.
   - `currentLessons` returns copies, and a test confirms `SCENARIO.steps[3].elle` stays frozen as `candidate`.
5. **Not-knowing:** unmatched prompts still get `not_knowing_reply`. An unmatched prompt that seeks a promoted lesson's subject shows the lesson as injected, which a test covers. It does not claim the agent answered.
6. **Panels:** both panels use request tokens, and both drop late results after unmount. `Router.destroy` unsubscribes the log listener, unmounts both panels and clears the container. `TelemetryPanel` unsubscribes in `unmount`.
7. **CSS:** I compared the trimmed unique lines of the old `style.css` with the new `style.css` plus `styles/*.css`. No lines are missing.

**Doctrine items (assembly brief 1–11):**
- **Mock labeling and append-only:** mock stays labeled and nothing in the UI writes or edits the record.
- **Authority ceiling:** the new entries go up to authority 8 and no higher, so the machine ceiling holds.
- **Untrusted text:** all of it is set with `textContent`. The only `innerHTML` use is `container.innerHTML = ''` and the existing static templates.
- **Link encoding:** link URL parts are encoded with `encodeURIComponent`.
- **Live stub:** it is untouched.
- **Dependencies:** no new dependencies and no network calls.
- **Tests:** the new tests assert specific behavior, with no vacuous ones. They cover the promotion timeline, held versus injected, no cursor, update-played steps, stale and late refreshes, and the nav appearing once.

**Nits:**
- **nit** `audit-ui/src/shell/shell.ts:27-30` and `audit-ui/src/router/router.ts:38`: `createShell` adds a placeholder `<h2 class="telemetry-pending">`, and the Router immediately wipes it with `replaceChildren()`. Remove the placeholder or the wipe. `shell.test.ts` asserts the placeholder, so update that test too.
- **nit** `audit-ui/src/shell/left.ts:146-149`: `getLog()` is dead code. The constructor's `log` parameter is only stored, and the Router does the subscribing. Drop both.
- **nit** `audit-ui/src/router/router.ts:81-89`: `getChatLog()` and `getShellSlots()` look like leftovers if nothing outside tests calls them. Check, and remove them if unused.
- **nit** `audit-ui/src/shell/telemetry.ts:79`: the `(lessons as { error: string })` cast is avoidable. Check `!lessons.ok` first, then read `lessons.error`.

## Remediation (parent session)

- Nit placeholder heading: removed from `shell/shell.ts`; the Router no longer wipes it. `shell.test.ts` updated.
- Nit `LeftPanel.getLog()` and unused `log` param: removed; router and `left.test.ts` updated.
- Nit `getShellSlots()` unused: removed. `getChatLog()` kept (tests use it).
- Nit telemetry error cast: replaced with explicit `ok` checks.

After remediation: 262/262 tests, tsc clean, build clean.
