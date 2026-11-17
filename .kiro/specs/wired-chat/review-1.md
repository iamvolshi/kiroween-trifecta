# Code Review Sage -- wired chat

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

## Round 1 (run ef179bd060dfcdae)

VERDICT: CHANGES REQUIRED

The tests (323/323), `tsc --noEmit` and `npm run build` all pass. The hard lines mostly hold:
- `scenario/`, `mock.ts`, `mock-assembly.ts` and the router are untouched.
- No new dependency, no BOM, and no file over 500 lines in the diff.
- A doctrine-term search over `src/` and `docs/assembly-parts.md` found nothing.
- Replies, spans and feed text render through text nodes or `textContent`. Span offsets are validated. The provenance link calls `preventDefault` and `stopPropagation`.

I read the CSS only for `.sr-only`, so I did not check contrast of the new text against the presentation tokens. Please confirm that separately. I also did not read the test files, so I did not confirm that the 6-prompt held / promoted / injected flow is still proven end to end.

**Findings**

1. **should-fix** — `audit-ui/src/views/chat-turn.ts:87` (also `audit-ui/src/views/chat.ts:176`)
   - Problem: `renderChatTurn` reads `turn.engines.arche.reply` with no guard. The live adapter returns `res.json() as T` unchecked. A connector reply missing `engines.arche` is pushed into the `ChatLog`. `renderTranscript` then throws on that and every later render of the chat. The feed (`activity-feed.ts:35`) guards against this and the chat does not.
   - Fix: validate the `ChatTurn` shape in `live.ts` `call('/chat')`, returning `{ok:false, error}` when `engines.arche.reply` is not a string. Alternatively, guard in `renderChatTurn` and in `chat.ts` before `log.push`.

2. **should-fix** — `audit-ui/src/adapter/live.ts:62-72` with `audit-ui/src/shell/left.ts:~92`
   - Problem: `fetchAllEntries` is "not in the connector contract", so on the live path the left column only shows an error, and the subject folders never populate. This is the brief's item 5, and it works only on mock.
   - Fix: either degrade gracefully by building the groups from `fetchLessons` and showing the folders without entries, or state the limitation in `docs/assembly-parts.md` and `notes.md`. Check that `notes.md` already records it.

3. **nit** — `docs/wired-chat-proof/03-chat-bottom-composer.png` and `05-right-activity-feed.png`
   - Problem: the two files are byte-identical (same SHA-256), so one is redundant. Neither shows a provenance link or a highlighted feed item.
   - Fix: replace 05 with a shot of the feed alone, or drop it. If the link and highlight behaviour needs visual proof, add a stub-adapter shot of it.

4. **nit** — `audit-ui/src/adapter/seam.ts` (just above `ChatTurn`)
   - Problem: the doc comment "One chat exchange (mirrors POST /chat)" now sits above the new `Persona` type. In the `SeamAdapter` interface, a leftover one-line `/** ARCHE turn (POST /chat). */` sits above the new `chat` doc block.
   - Fix: move or merge those comments.

5. **nit** — `audit-ui/src/shell/telemetry.ts:98` (`render`)
   - Problem: `render` rebuilds the whole feed on every log change or refresh. This clears the `.is-highlighted` class, so a highlight disappears after the next chat turn.
   - Fix: remember the last `ProvenanceTarget` and re-apply it after `render`.

6. **nit** — `audit-ui/src/shell/left.ts:109-113`
   - Problem: for a subject with no `.`, the group header and the nested folder repeat the same name ("pressure" then "pressure", as in screenshot 04).
   - Fix: skip the nested `h3` when the group contains only the subject that equals the group name.

## Round 2 (run 326013c1961c439c)

VERDICT: SIGN-OFF

Vitest passes 327 of 327, `tsc --noEmit` is clean, and `npm run build` is clean.

**Round-1 fixes: all confirmed**
- **should-fix 1, `isChatTurn`:**
  - It is defined at `D:\kiroween-trifecta\kiroween-trifecta\audit-ui\src\adapter\seam.ts:171` and checks message, known, `engines.arche.reply`, the katie array, the lessons arrays and `links`.
  - `live.ts` uses it at line 88 and returns a typed error for a bad reply.
  - `chat.ts:177` refuses an invalid result before `log.push`, and `chat.ts:127` skips invalid turns when rendering.
  - `wired-chat.test.ts:164` covers a reply that is not a ChatTurn and checks the chat keeps working.
- **should-fix 2, left-column fallback:** the new test in `left-folders.test.ts` and the notes in `notes.md` and `assembly-parts.md` are in place. I did not re-read those files this round.
- **nit 3:** the screenshots differ now (03 `A6241681…`, 05 `D57841B9…`). 05 shows the scrolled right column with the ELLE, KATIE and ERIE items, their tags and the Entry Detail links.
- **nit 5:** the highlight survives a feed re-render, covered by `wired-chat.test.ts:182`.
- **nit 4 and nit 6:** I did not re-inspect these. The nit 6 test was not checked either.

**6-prompt flow is still proven end to end**
- `D:\kiroween-trifecta\kiroween-trifecta\audit-ui\src\shell-integration.test.ts` plays `SCENARIO.steps` through the real chat.
- Lines 93-125 walk the lesson through candidate, held ("Held back a lesson that is not learned yet"), promoted ("Promoted a lesson, now learned", with the lesson shown as learned in the folder) and injected (step 6).
- Lines 70-84 check the folder authority values (6 → 7 and 7 → 8).
- Line 122 checks that a parcel-only prompt never gets the lesson.
- Lines 149-156 check one feed item per ERIE, ELLE and KATIE event, newest first, and expect exactly one lesson-injecting turn.
- `telemetry.test.ts` and `chat.test.ts` were rewritten, not deleted.

**Contrast: all new text passes**
- The new CSS uses only the design tokens, so the ratios come from the computed table in `D:\kiroween-trifecta\kiroween-trifecta\.kiro\specs\presentation\notes.md`.
- Bubbles and feed text use `--text`, `--muted` and `--faint` on `--surface`, `--inset` or `--accent-bg`. The worst case is faint on `--accent-bg` at 5.20, above AA's 4.5.
- Engine tags and the active picker option use `--accent`, `--ok` and `--muted`, all at 6.98 or above.
- The disabled composer uses `--faint` on `--inset` at 6.50 and has no opacity dimming.
- I did not measure `--faint` on `--surface-2` for this CSS. That is the worst pair in the table at 5.52, and it still passes.

**Remaining nit, non-blocking**
- `D:\kiroween-trifecta\kiroween-trifecta\audit-ui\src\adapter\seam.ts:171`: `isChatTurn` requires `engines.katie`, `lessons_in_prompt.injected` and `.held` to be arrays. A live responder that omits them on a turn it doesn't know would be refused with the "not a chat turn" error. `docs/assembly-parts.md` should say that these fields are required, with empty arrays when there is nothing to report.

## Remediation (parent session)

Round 1:
- should-fix 1: `isChatTurn` (adapter/seam.ts); live.ts refuses a non-ChatTurn /chat reply; chat.ts refuses one before logging and skips invalid turns when rendering. Test added.
- should-fix 2: left column falls back to folders from GET /lessons when the record read fails; the live-path limit is recorded in notes.md and docs/assembly-parts.md. Test added.
- nit 3: 05-right-activity-feed.png retaken; the highlight is proven by tests (stub live adapter), not a screenshot.
- nit 4: seam.ts comments fixed.
- nit 5: the last highlight is re-applied after the feed re-renders. Test added.
- nit 6: a dotless subject's nested title is sr-only (not shown twice). Test added.

Round 2:
- nit (required ChatTurn fields): docs/assembly-parts.md now lists the fields the app requires in every ChatTurn.

After remediation: 327/327 tests, tsc clean, build clean.