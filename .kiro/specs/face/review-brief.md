# Code Review Sage -- review brief, Face pass

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/face`) against base `dc3e17f`: `git diff dc3e17f` plus
untracked files. Intent: the order (below) and `notes.md` in this folder.
Screenshots of the result are in `docs/face-proof/` (taken from the
production build in headless Chrome); open them.

## The order's constraints

1. Presentation only: CSS plus presentational markup hooks (classes,
   data- attributes, aria labels). NO behavior or logic change in adapter,
   scenario, router, seam or the views' logic. Inspect every .ts diff line
   and say whether it is purely presentational.
2. No new dependencies, no network calls, no web fonts, no invented
   numbers: everything shown still derives from the seam or the chat log.
   The 0-9 meter must be drawn only from the folder's own number.
3. NO Stitch material of any kind (exports, CSS, assets, copied values).
   Flag anything that looks imported rather than written fresh.
4. 0-9 badges on subject folders prominent; MOCK DATA label unmissable;
   empty and error states explicit and readable.
5. Contrast holds on every surface (check the token pairs in notes.md and
   in the CSS; flag any text/background pair under 4.5:1, or 3:1 for large
   text/UI parts). Keyboard navigation still works: focus is visible
   everywhere, nothing focusable was hidden or made unreachable.
6. No costume. Doctrine untouched. README, disclosure, live stub untouched.
   No file over ~500 lines. No BOM.
7. Tests 262/262, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
