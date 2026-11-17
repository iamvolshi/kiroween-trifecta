# Code Review Sage -- review 1 (run 2d0310e8cbae8f56, 2026-11-17)

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

I found no blockers and no should-fix items. I ran the checks myself: `npx vitest run` passes (33 files, 290 tests), `npx tsc --noEmit` is clean, and `npm run build` is clean. I opened all six screenshots; the text below describes the ones I examined in detail (03, 05 and 06).

**Scope**
- The diff against `24eebc3` touches only `audit-ui/src/views/action-list.ts` and `audit-ui/src/styles/record-card.css`.
- The untracked files are `audit-ui/src/views/action-filters.ts`, `audit-ui/src/views/action-filters.test.ts`, `.kiro/specs/action-filters/` and `docs/filter-proof/`.
- No adapter, scenario, router, seam, README, disclosure, live stub or doctrine file changed, and there is no new dependency.
- The sort order, hrefs and card skeleton are untouched, and rows are still built by `fillCollapsibleCard`.
- All files are under 500 lines (`record-card.css` is about 399). None starts with a BOM.

**Behaviour**
- **Row state:** rows are built once and only toggled with `li.hidden`, so each row keeps its expanded state across filtering. A test covers this.
- **Count and empty text:** both come only from `sorted.length` and the match count in `action-list.ts`. The `.action-list > li[hidden]` CSS rule keeps the hidden rows from showing.
- **Chips:** state chips come from `statesIn(sorted)`, so no state list is hardcoded. `RETRACTION_STATES = {rejected, contradicted}` is the only fixed set. Tests cover data that includes `contradicted`.
- **Bands:** these are 1-3, 4-6 and 7-9, and the filters combine with AND.
- **Empty state:** the message names the active filters (screenshot 05 reads "No entries match event type Rejected, confidence 7-9 high. Clear the filters to see all 8."). Clear resets all three filters to All.

**Accessibility**
- There are three `role=group` elements with `aria-label`. Every chip is a `<button type="button">` with `aria-pressed`.
- Clear is always enabled, and focus returns to the pressed chip after the bar re-renders (tested).
- The count has `aria-live=polite`.
- Focus is visible through the global `:focus-visible` rule at `audit-ui/src/style.css:115`. Screenshot 06 shows the outline on the focused chip.
- A pressed chip shows a ✓ prefix as well as the colour change, so state does not rely on colour alone.

**Contrast, using the tokens in `.kiro/specs/presentation/notes.md`**
- Chip text is muted on surface (8.15), and hover is text on surface-2 (13.62).
- Pressed chips use text on accent-bg (12.83).
- The group labels use faint on panel (6.45).
- All of these pass AA (4.5).

**Findings**
1. **nit** — `audit-ui/src/views/action-list.ts:~92`: the no-match paragraph reuses `.empty-state`, which renders the eyebrow "NOT KNOWN" (visible in screenshot 05). The entries are known and only filtered out, so the label reads slightly wrong. Fix: give `.filter-empty` its own label such as "NO MATCH", or hide the eyebrow for that element.
2. **nit** — `audit-ui/src/views/action-filters.ts:40`: authority 0 matches no band, so it shows only under All. The tests state this explicitly. I don't think it needs flagging to Darren beyond a one-line mention, because the 0-9 scale makes 0 effectively "no authority".
3. **nit** — `audit-ui/src/views/action-filters.ts:14`: the retraction reading (`rejected` or `contradicted`) is still the judgment call for Darren. It is isolated in one constant and documented.

## Remediation (parent session)

- Nit 1, no-match box captioned "NOT KNOWN": `.filter-empty` now has its own caption, "NO MATCH" (CSS only). The sentence is unchanged.
- Nit 2, authority 0 is in no band: kept; the bands start at 1 per Darren's triadic split. A 0 entry shows under All. Mentioned in the report.
- Nit 3, retraction reading: kept as the flagged reading (`rejected` or `contradicted`), isolated in `RETRACTION_STATES` in `views/action-filters.ts`.

After remediation: 290/290 tests, tsc clean, build clean; screenshots retaken.