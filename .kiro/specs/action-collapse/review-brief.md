# Code Review Sage -- review brief, Action List collapse round

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/action-collapse`) against base `ac18572`: `git diff ac18572`
plus untracked files. Screenshots from the production build (headless
Chrome, 6 chat prompts played in-page first) are in `docs/collapse-proof/`:
01 all collapsed 1440, 02 two expanded 1440, 03 keyboard focus on a toggle,
04 all collapsed 1000 px. Open each by its file name.

## The order

Action List ONLY. Each card collapses to one title row carrying the major
highlights: KID (mono), headline (subject: state), authority chip. Nothing
else collapsed: no meta line, no inset, no times. Clicking the title row
expands the full skeleton underneath (meta, WHY/EVIDENCE, times); click
again collapses. Independent toggles, not accordion; default collapsed on
every load. "Inspect" stays a real link to Entry Detail, visible on the
collapsed row, and the toggle and the link are SEPARATE controls -- never
one interactive element inside another. Title row = button semantics.
Keyboard: Tab-reachable, Enter and Space, visible focus; aria-expanded on
the toggle and the details region tied to it. Time Travel pool, Entry
Detail chain and Record view keep the full skeleton exactly as they are.

## Check

1. Only the Action List changed behaviour; the other three card views'
   markup and CSS are unchanged (`fillRecordCard` untouched).
2. Collapsed row content is exactly KID, headline, authority (+ the
   separate Inspect link). Every value comes from the entry. The chevron
   is CSS from aria-expanded, not data.
3. Expanded details hold the rest of the skeleton (state chip, subject +
   live-from meta, WHY/EVIDENCE, times). No field invented; same entry.
4. No nested interactive elements; `<button type="button">` toggle with
   aria-expanded + aria-controls -> details `id` (role=region, labelled);
   details use the `hidden` attribute and CSS honours it.
5. Toggle state lives in the view; no adapter, scenario, router, seam or
   data-flow change; sort order (newest first) and hrefs unchanged.
6. The 12 new tests in `views/action-collapse.test.ts` assert real
   behaviour (note: jsdom cannot synthesise native Enter/Space activation;
   the parent verified Enter and Space in real Chrome via CDP key events:
   Enter opened, Space closed).
7. Density (parent's measurement in Chrome at 1440x900): collapsed row
   29.4 px, pitch 31.4 px (2 px gap); 695 px of list area under the intro
   -> 22 rows in the first screen. At 1000 px the headline wraps on two
   rows instead of being cut (46 px), so no highlight is clipped.
8. No Stitch material, no new dependency, no network, doctrine untouched,
   README / disclosure / live stub untouched, no file over ~500 lines, no
   BOM. Contrast of the new row text on its surfaces.
9. Tests all pass, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
