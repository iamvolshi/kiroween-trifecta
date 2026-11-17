# Code Review Sage -- review brief, Presentation round

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/presentation`) against base `cb94246`: `git diff cb94246` plus
untracked files. Intent and decisions: `notes.md` in this folder.
Screenshots from the production build (headless Chrome, 6 chat prompts
played in-page first; 1440 px, plus 1000 px for four views) are in
`docs/presentation-proof/`; open them.

## The order's hard lines

1. No Stitch material: no file, CSS, HTML, asset or copied value from a
   Stitch export. Flag anything that looks imported, not written fresh.
2. No invented data: every value on screen comes from the seam or the
   scenario. No fake status, counts, hashes, sequence numbers, or
   decorative controls that do nothing. The header strip must show no
   number the seam did not supply. "Inspect" appears only on cards that
   are real links to Entry Detail.
3. Doctrine: ceiling 8, 9 held for the user and never on a machine action;
   KID is a number; no hash-chain / signature / Merkle claim; no revert /
   snapshot / restore language; no "Kiroween Identifier Keys".
4. Kept: three-column shell, folder tiles + 9-cell meter (cell 9 hatched),
   MOCK yellow block top of left column and the only yellow, lessons grey /
   green / green outline, hour-view tables, system fonts only, no new
   dependency, no network fetch.
5. Presentation only: CSS plus presentational markup hooks. Inspect each
   `.ts` diff: `views/record-card.ts` (shared card markup), `views/intro.ts`
   (question + how-to line per view), `shell/shell.ts` (seam chip, view
   slot), and the views' calls into them. The card skeleton fills each card
   from its own entry (see the "Decision" table in `notes.md`): check that
   every value shown comes from that same entry, that no entry is added or
   dropped, that list order and hrefs are unchanged, and that adapter /
   scenario / router / seam / data flow are untouched.
6. The brief's language: deep blue-black planes, 1px lines, near-sharp
   corners; three type roles (display / body / mono, mono caps labels);
   colour by meaning (cyan signal, amber warning, emerald good); header
   strip stating the situation; every view leads with its question; one
   card skeleton everywhere; explicit not-knowing; dense 4px rhythm.
7. Contrast: verify the ratio table in `notes.md` against the CSS tokens and
   flag any rendered text/background pair under 4.5:1.
8. Keyboard: focus visible everywhere; nothing focusable lost.
9. No file over ~500 lines. No BOM. README, disclosure, live stub,
   chain-break display untouched.
10. Tests 262/262, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
