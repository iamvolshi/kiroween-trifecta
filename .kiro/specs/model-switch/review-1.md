# Review 1: the model switch

Reviewer: Code Review Sage (independent subagent, read-only, no memory or
lessons). Brief: `review-brief.md`.

- Kiroween `feat/model-switch`, base `55a21bb`.
- Bots `feat/model-switch`, base `2686c04` (the unmerged connector branch).

## Round 1: PASS WITH FIXES

Confirmed by reading: `served_by` comes from the same route object that
served the turn; the 503 path resolves before anything is recorded and never
falls back; no key reaches `repr`, `public()`, `/models` or error text;
unknown providers are refused; SubQ's id is never guessed; `reasoning_effort`
goes to Meta only; the DRAFT voice labelling is "honest and sufficient"; the
untouched areas are untouched; the band is "obvious at a glance".

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | MED | A failed turn left the old `served_by` on its position; `/models` was read once at mount | A failed turn drops that position's `served_by` and re-reads `/models`; every flip re-reads it; 2 tests |
| 2 | LOW | Movie followed `MODEL_PROVIDER`, not Spark | Movie defaults to meta Spark, independent of `MODEL_PROVIDER`; test; docs |
| 3 | LOW | Snap guard was case-sensitive | `model.lower()`; test with `" SUBQ-Snap-Preview "` |
| 4 | LOW | A registers persona booted silently with a register unconfigured | One stderr warning per unconfigured register at boot |
| 5 | LOW | `assembly-parts.md` had no trailing newline | Added |

## Round 2: PASS

All five fixes confirmed. Three new LOWs, none blocking, all fixed:

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | LOW | Connector docstring still said Movie uses the loop's own route | Reworded: default meta Spark |
| 2 | LOW | Overlapping `/models` reads could land out of order | A read counter keeps only the latest answer; test |
| 3 | LOW | One overlong line in `notes.md` | Rewrapped |

## Remediation evidence

- Bots `python -m pytest -q`: 172 pass (125 at the original base, 149 after
  the connector round). The two ambient tests' `111-*.claim` files were
  deleted before and after each run (pre-existing flake).
- Kiroween `npx vitest run`: 343 pass (327 at base), `npx tsc --noEmit`
  clean, `npm run build` clean.
- Live end-to-end on a scratch data dir before the review fixes: Movie served
  by `meta` / `muse-spark-1.3-contributor`, Book by `mercury` / `mercury-3`,
  both real API calls, `served_by` read on each reply. The review fixes touch
  status refresh, the Movie default (same value on this machine) and guards,
  not the serving path.
