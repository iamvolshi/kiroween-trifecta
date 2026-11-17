# Code Review Sage -- review 1 (run a3c4d702a2beb03b, 2026-11-17)

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

Everything the brief lists as a check passes, and I found no blockers or should-fix items. Vitest ran 32 files with 274 tests passing, `npx tsc --noEmit` exited 0, and `npm run build` succeeded. The new files have no BOM, the largest changed file is 318 lines, and `package.json` is unchanged.

**Brief checks**
- **Scope (1, 5):** The diff touches only `record-card.css`, `action-list.ts` and `record-card.ts`. `fillRecordCard` is unchanged, and `action-list.ts` only swaps which card builder it calls. The sort order and the href string are the same as before. The adapter, scenario and router are untouched. All state lives in a click handler inside `fillCollapsibleCard`. The three other views' tests confirm they keep the full skeleton.
- **Collapsed row (2):** The toggle holds exactly `.kid`, `.label` and `.authority`, all taken from the entry. The chevron comes from `.kid::before`, switched by `aria-expanded`. Inspect is a sibling `<a>` in `.card-row`.
- **Expanded details (3):** They hold the state chip, subject plus live-from meta, WHY/EVIDENCE and the three times. No field is invented. KID leaves the meta line because it is already in the title row, which matches the brief.
- **Semantics (4):** The toggle is `<button type="button">` with `aria-expanded` and `aria-controls` pointing at the details `id`. The details region has `role="region"`, an `aria-label` and the `hidden` attribute. `.card-details[hidden]{display:none}` stops the `display:flex` rule from overriding `hidden`. Nothing interactive is nested.
- **Tests (6):** The 12 tests assert real behaviour, including collapsed-by-default, independent toggles, no nesting, and the three other views keeping the full skeleton. The Enter/Space test only simulates keydown then click. That is acceptable because jsdom cannot do native activation, and the parent confirmed both keys in real Chrome.
- **Screenshots (7):** I opened 01, 03 and 04. 02 is the same two-expanded state that 03 shows, so I did not open it separately. The 1440 px view shows 8 compact rows. The 1000 px view wraps the headline onto two lines without clipping. The 03 view shows a visible cyan focus ring on a toggle, with two cards expanded.
- **Hygiene (8):** I saw no Stitch material, new dependency or network call in the diff. README, disclosure and the live stub are not in `git status`.

**Nits**
1. **nit** `record-card.css` (`.card-toggle .kid::before`, in the new block near line 235): the closed chevron uses `var(--faint)` at meta size, and in screenshot 01 it is very small and low contrast. I did not compute contrast ratios. Fix: use `var(--muted)` for the closed state, or raise the glyph size.
2. **nit** `record-card.ts`, in `fillCollapsibleCard` (the `role="region"` line): every row gets a region landmark, so the Action List can expose 20 or more of them to screen-reader landmark navigation. Fix: keep `role="region"` since the brief asks for it, or drop it if landmark noise matters, because `aria-controls` already ties the toggle to the details.
3. **nit** `record-card.css` (`.card-toggle` `grid-template-columns`): the KID column is capped at `minmax(0, 11rem)` with `text-overflow: ellipsis`. A long `kidMap` name would be truncated, which clips a highlight. The mock data fits. Fix: let the KID column wrap, or add a `title` attribute with the full KID.
4. **nit** `docs/collapse-proof/`: the files are named `01-actions-collapsed.png`, `02-actions-two-expanded.png`, `03-actions-toggle-focus.png` and `04-actions-collapsed-1000px.png`, not the names in the brief. This is cosmetic.

## Remediation (parent session)

- Nit 1, closed chevron small and faint: now `--muted` at 13px (was `--faint` at 12px).
- Nit 2, one region landmark per row: kept. The order asks for the details region tied to the toggle; `aria-controls` plus `role=region` with a label does that.
- Nit 3, KID column ellipsis could clip a long KID label: removed the ellipsis; a long KID label now wraps, so no highlight is ever cut.
- Nit 4, screenshot file names: kept (01 collapsed, 02 two expanded, 03 toggle focus, 04 collapsed at 1000 px).

After remediation: 274/274 tests, tsc clean, build clean; screenshots retaken. Chrome re-check: row 29.5 px, pitch 31.5 px, Enter opens, Space closes, Inspect from a collapsed row opens Entry Detail; at 1000 px nothing clipped.