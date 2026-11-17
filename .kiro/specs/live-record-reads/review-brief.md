# Review brief: live record reads + the connector

READ-ONLY review. Do not edit, commit, or push anything. First line of your
reply: `VERDICT: PASS`, `VERDICT: PASS WITH FIXES`, or `VERDICT: FAIL`. Then
numbered findings, each with severity (HIGH / MED / LOW), file:line, and the fix.

## Two repos

1. Kiroween: `D:\kiroween-trifecta\kiroween-trifecta`, branch
   `feat/live-record-reads`, base `main` at `55a21bb`. Diff: `git diff 55a21bb..HEAD`.
2. Bots: `D:\Discord\bots`, branch `feat/audit-connector`, base `4c6e0b7`.
   Diff: `git diff 4c6e0b7..HEAD`. New: `bot/connector.py`, `tests/test_connector.py`.

## The order (what must be true)

- Connector contract: existing 4 calls unchanged (`POST /chat`,
  `GET /record/{account_id}`, `GET /lessons`, `POST /ask`), plus
  `GET /entries`, `GET /belief-pool?at=<epoch ms>`,
  `GET /chain?kid=&subject=` (record order), `GET /kidmap`. No auth, no
  pagination. `POST /update` stays out; the app keeps a typed error for it.
- Belief pool: live iff `k_start <= M < k_end`, null `k_end` = live. Checked
  against the loop and the app's `isLiveAt` (`audit-ui/src/util/interval.ts`);
  any disagreement should have stopped the build.
- KID: loop KID is a string tag, seam KID a number. Decision recorded before
  building; never silently coerced.
- Evidence list -> string: a rule picked, recorded, tested. `event_id` -> id.
- Connector boots like the bot (`boot_arche`, CARTRIDGE + DATA_DIR), fails
  closed on a tampered record, reads through the loop's own parsing, `/chat`
  reuses `EngineLoop.run` -> `generate_reply` with the cartridge
  `system_prompt` -> `record_reply`. HTTP only, no Discord behaviours.
- One booted persona; another persona gets a typed error naming the booted
  one; booted persona from boot config, never hardcoded.
- Register: no invented voice prompts; recorded as pending.
- Links only if grounded honestly, else none.
- App: live adapter implements the 4 reads with shape guards that refuse
  malformed data in words; left-column lessons-only fallback kept; no other
  app changes (`scenario/`, mock adapter, router, README untouched); no new
  deps; no file over ~500 lines; one switch in `adapter/active.ts`.
- Doctrine: ceiling 8, KID a number in the seam, no hash-chain / signature /
  Merkle claims in this repo, no revert/snapshot, no "Kiroween Identifier
  Keys", no Stitch.
- Docs: `docs/assembly-parts.md` (8 calls, mappings, limits);
  `.kiro/specs/live-record-reads/notes.md` with the mapping table first.

## What to check hardest

1. Is the KID decision (handle `1` + `/kidmap` label) honest, or a coercion
   the order said to stop on? Is the belief-pool reasoning (no rule
   disagreement; `tek_t` as start time; `k_time: ""` for open) sound?
2. Do the connector's mappings match `notes.md` exactly (code vs. notes vs.
   `assembly-parts.md`)?
3. Thread safety, error paths (model failure, bad JSON, bad query), CORS,
   binding to 127.0.0.1, secrets never logged or returned.
4. Shape guards in `audit-ui/src/adapter/live-guards.ts`: anything they let
   through that the views would mis-render, or refuse that they should accept?
5. The change to `call()` in `live.ts` (HTTP error now appends the
   connector's `error` words): any existing behaviour broken?
6. Tests: do they prove the 8 shapes, persona refusal, mappings, tamper,
   fallback, update's typed error, `/chat` options unchanged?

## Evidence already gathered (verify what you can)

- Kiroween: `npx vitest run` 343 pass (was 327), `npx tsc --noEmit` clean,
  `npm run build` clean (run from `audit-ui`).
- Bots: `python -m pytest -q` 144 pass (125 + 19). Known pre-existing flake,
  not from this change: `test_hang_fix` / `test_reply_delay` ambient tests
  write claims into the repo's `data/ambient-claims/111-*.claim` with a 1 h
  TTL, so a second run within an hour fails two tests. Delete those
  `111-*.claim` files before running, and again after.
- E2E on a scratch DATA_DIR: 4 real `/chat` turns against the real model;
  every read checked against `KatieRecord.from_line` of the record file: all
  pass. Screenshots in `docs/live-record-proof/` (live build, seam chip says
  live).

Do not start the connector or call the model. Do not touch `D:\Discord\bots\data`
except the `111-*.claim` test files named above.
