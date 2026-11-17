# Code Review Sage -- review 1 (run f73e6d95999855cd, 2026-11-17)

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

I found no blockers and no should-fix items. I ran the tests (262/262 passed), `npx tsc --noEmit` (clean) and `npm run build` (clean).

Checks against the brief:
1. **Scope:** The changes touch only the hour view's renderer, `calendar.ts` (two call sites) and CSS. `git grep calendar-entries` returns nothing, so no other markup used the removed `.calendar-entries` selectors. The `.belief-pool`, `.record-entries`, `.action-list` and `.chain-entry` rules are intact. `.hour-did` and `.hour-believed` are kept.
2. **Data flow:** `did` and `pool` are passed through unchanged, in the same order. Only the renderer changed. Empty states are still the explicit sentences "Nothing was recorded in this hour." and "No entries were live at this moment.". The screenshots show them.
3. **Table semantics:**
   - `audit-ui/src/views/calendar-entries.ts` builds a table with `aria-label`, a `thead` and `th scope="col"`, in the order KID, Subject, State, Authority (0-9), Evidence, Reason.
   - Each row has one link (in the KID cell) with the same href pattern as before.
   - `a::after` with `inset:0` is stretched over the `tr.entry-row`, which is `position:relative`.
   - Focus is `:focus-visible` on the `::after` (2px accent ring). `06-hour14-row-focus.png` shows the ring around the whole row.
   - Enter opens the entry, because it is a native anchor.
4. **Test line:** `.hour-believed li` became `.hour-believed tbody tr`. The assertion still means rows shown equals live entries (2 = 2). The `live` computation beside it is untouched.
5. **Other constraints:** There is no sorting or filtering, no new dependency or network use, and no invented data. Doctrine, README and the live stub are untouched. No file is over about 500 lines and none has a BOM. The only CR-related noise is git's LF/CRLF warning, which does not matter here.
6. **Contrast:** Header text is `--muted` (#a7b2c2, about 8.8:1 on the panel) on `--surface-2` (#1b2330), which I estimate at about 7:1 or better. Cell text and the accent KID link are on `--surface`. All of these clear AA 4.5:1.
7. **Screenshots:** The two sections stay visually distinct (orange rule on "did", blue rule on "believed"). Mono is applied to the KID, authority and evidence cells. The Back link, Moment header, MOCK label and shell are intact.

Nits (optional):
- **nit:** `audit-ui/src/styles/calendar.css` (the `.entry-table th` rule, `white-space: nowrap`). With `table-layout: fixed` above 1100px, a long header such as "AUTHORITY (0-9)" cannot wrap, and `overflow:hidden` on the table would clip it if the column got too narrow. It fits at 1440px. Fix if desired: drop `nowrap` on `th`, or give `.col-authority` a `min-width`.
- **nit:** `docs/hour-view-proof/` file names may not match their content as I viewed them. `01-hour14-before-chat.png` shows populated tables, while `02-hour14-played.png` shows both empty states. The order of the images I was shown may have differed from the file names, so check them. If they are swapped, rename them so the proof reads correctly.
- **nit:** The `.entry-table td.authority` rule uses `--fs-title`. This is fine and matches the other lists.

## Remediation (parent session)

- Nit header clip: the fixed column widths now apply only above 1300 px; below that the table sizes columns to content, so `AUTHORITY (0-9)` cannot be clipped.
- Nit screenshot names: checked each file; names match content (01 = before chat, both empty states; 02 = played, 1 did row + 2 believed rows). The reviewer's image order differed from the file names. No change.

After remediation: 262/262 tests, tsc clean, build clean; screenshots re-taken.
