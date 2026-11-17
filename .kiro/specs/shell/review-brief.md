# Code Review Sage -- review brief, Shell build

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/shell`) against base commit `e13aa20`: `git diff e13aa20` plus
the untracked files in `git status`. Intent: `tasks.md`, `wo-e.md`,
`wo-f.md`, `wo-g.md` in this folder. The binding doctrine is in
`.kiro/specs/assembly/review-brief.md` (items 1-11): apply all of it again.
You are independent: judge the code, not the authors' claims.

## Shell-specific checks

1. Three columns built once by the Router; views land in the center; the
   nav exists exactly once (left); every existing route still works; `/`
   -> `/actions` unchanged.
2. Right column is derived, never decorative: every folder, value, lesson
   and feed item comes from fetchAllEntries / fetchLessons / the ChatLog.
   No fake telemetry, no animation pretending to be work.
3. The 0-9 value on each folder is the authority of that subject's latest
   entry by k_start and is labeled as such.
4. Darren's lesson rulings: a lesson lives in its subject's folder (subject
   named by the script, marked mock); it is grey (candidate) until
   promoted; it is injected into a prompt that seeks its subject ONLY after
   it is learned; `lessons_in_prompt` is read before the turn plays.
   Promotion never edits the recorded lesson (append-only).
5. Not-knowing still shown: unmatched prompts get the scripted reply, and
   the injection display does not imply the agent knows more than it does.
6. Panels: request tokens, late results dropped, unsubscribe on
   unmount/destroy, no listener leaks across Router instances.
7. CSS split (`style.css` + `styles/*.css`) loses no rule; no file over
   ~500 lines; no BOM.

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
