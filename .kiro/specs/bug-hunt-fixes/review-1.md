# Code Review Sage -- review 1 (run 18b4c59084e2252a, 2026-11-17)

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

I found no blockers or should-fixes. Checks I ran:
- `npx vitest run`: 34 files and 310 tests pass.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: clean.
- Line counts: no source file I touched is over 500 lines. Only `entry-detail.test.ts` (453) and `time-travel.test.ts` (467) are large, and both predate this change.
- BOM: none in any `src` `.ts` or `.css` file.

All six screenshots match their findings:
- **Chat:** the "You" and ARCHE lines look unchanged.
- **Skip link:** it is visible on focus.
- **Entry Detail:** the h1 and question stay in the empty state and in the not-found state.
- **Calendar:** the weekday headers render from `thead`.
- **Filters:** the no-match box shows its caption.
- **Header:** each page shows the right "View: <name>".

**Per fix**
- **MED-1** (`views/chat.ts:103-109`): the try/catch turns a throw into the same `{ok:false}` path as a normal error, so Send comes back. The test throws from `chat`, so it fails without the fix.
- **MED-2** (`views/record-card.ts`, `views/chat-turn.ts`, `views/action-list.ts`, plus the CSS): the `.sr-only` text and the `content: '…' / ''` captions are sound.
  - `.sr-only` is absolutely positioned, so it adds no grid or flex item. The toggle grid keeps 3 items, and the `.card-meta` flex row and its `:not(:last-child)::after` dot separators are unchanged.
  - `.sr-only::before` and `::after` are forced to `content: none`, so the `.card-inset > *::before` caption rules cannot re-add text there.
  - The `/ ''` alt-text syntax is paired with a plain fallback declaration, so older browsers keep the visible caption. Newer ones announce nothing from it.
  - By code reading, nothing is read twice. Value spans stay pure, so older tests are unaffected.
  - I could not run your CDP accessibility-tree probe from here. This verdict rests on the DOM and CSS, not on the tree.
- **LOW-1** (`views/entry-detail.ts:25-29, 81-84`): the h1 and intro now mount in `mount()`, so the empty, error and not-found states keep them. There is exactly one h1 per view and the not-found heading is h2.
- **LOW-3:** the title is "Audit UI" and the favicon is a plain mark. The test asserts the Vite colour `#863bff` is gone.
- **LOW-4:** `main.ts` uses `createActiveAdapter()`, and `LIVE_BASE_URL` is empty. The test asserts that `main.ts` no longer references `createMockAdapter`.
- **LOW-5:** `before()` is millisecond arithmetic and rolls back to 23:59 on the previous day at 00:00. The scenario value at 09:11 is unchanged.
- **LOW-6:** `setViewLabel` is the only router change. It hides the label when there is no intro. The CSS `:has()` list is gone, and the test covers all 8 routes including Not Found.
- **LOW-7:** the grid has `thead`, `tbody` and `th scope="col"`.
- **LOW-8:** the skip link is the first child of the shell. `preventDefault()` plus `center.focus()` means no hash change, so the router does not re-resolve. The test confirms the pathname and hash stay the same.

**Scope**
- No new dependencies. The test reads CSS through a dynamic `node:fs` import.
- The README, disclosure, live stub and doctrine files are untouched.
- LOW-2 is not touched.
- I found no Stitch material or invented data.

**Nits (optional)**
- nit, `audit-ui/src/styles/*.css`: `content: 'X'; content: 'X' / '';` repeats every caption on one line. Add a one-line comment above the first one saying the first declaration is the fallback for browsers without the alt-text syntax.
- nit, `audit-ui/src/bug-hunt-fixes.test.ts:~97`: the test "visible CSS captions … decorative" checks string presence only. It would not catch a new caption added without `/ ''`. Fine for this round.
- nit, `audit-ui/src/shell/shell.ts` (skip link): when focused, it covers the left end of the header tagline (visible in `02-skip-link-focused.png`). It is harmless because it shows only on focus.

## Remediation (parent session)

- Nit 1, repeated `content` declarations: a comment at the top of `styles/record-card.css` and `styles/chat.css` now says the first is the fallback for browsers without CSS alt text and the second marks the caption decorative.
- Nit 2, the CSS test checks string presence only: kept for this round, as the reviewer allows.
- Nit 3, the focused skip link covers the start of the header tagline: kept; it shows only while focused.

After remediation: 310/310 tests, tsc clean, build clean. CSS-only comment change; screenshots unchanged.