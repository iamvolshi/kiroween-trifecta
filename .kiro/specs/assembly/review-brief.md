# Code Review Sage -- review brief, Assembly build

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
against base commit `2445d14` (`git diff 2445d14` plus untracked files from
`git status`). Read `tasks.md`, `wo-a.md`, `wo-b.md`, `wo-c.md` in this
folder for intent. You are independent: judge the code, not the authors'
claims.

## Check against these hard constraints (from the order)

1. Tests green; every new behavior has a regression test that would fail
   without it (spot-check: are any tests vacuous or tautological?).
2. No file over ~500 lines; one concept per file.
3. No engine code, no copied trifecta code, no engine imports. Engine
   behavior is mock behind the seam and labeled mock (in code AND in the UI
   chrome). Mock hashes labeled mock.
4. Doctrine: KID is a number, never a name. Append-only: nothing in the UI
   writes, edits, deletes, reverts or restores record entries. Machine
   ceiling 8; 9 held for the user. Per (KID, subject) chains with
   half-open `[k_start, k_time)` non-overlapping intervals. Not-knowing is
   displayed, never filled with a guess.
5. Live stub stays a stub: every method returns its typed error; no fetch,
   no URL guessed.
6. No chain-break display built. README and disclosure unchanged.
7. Front-end only: no network calls, no keys, no new dependencies.
8. Existing views, routes and tests keep working; `/` -> `/actions` boot
   unchanged.
9. Calendar: dots computed from the record; displayed moment == queried
   moment, labeled UTC; hour view uses isLiveAt via the seam.
10. Chat: one scenario step per matched exchange; unmatched -> scripted
    not-knowing; engine labels ARCHE/ERIE/ELLE/KATIE; KATIE link resolves.
11. Security/robustness: untrusted text rendered via textContent (no
    innerHTML with data), unmount/late-result guards, encoded URL parts.

## Also look for

Real bugs (logic, off-by-one, timezone, race), dead code, inconsistencies
with existing conventions, and files saved with a BOM (check first 3 bytes
of new/changed files; repo files are UTF-8 without BOM).

## Rules

READ-ONLY. Do not edit any file, do not run git commands that change state.
You may run `npx vitest run`, `npx tsc --noEmit`, `npm run build` from
`audit-ui/`.

## Output

A verdict line first: `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`.
Then findings, each with: severity (blocker / should-fix / nit), file:line,
the problem, and the concrete fix. Blockers = any constraint above broken
or a real bug. Keep nits short.
