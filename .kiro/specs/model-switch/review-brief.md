# Review brief: the model switch

READ-ONLY. Do not edit, commit, push, start servers or call any model.
First line: `VERDICT: PASS`, `VERDICT: PASS WITH FIXES` or `VERDICT: FAIL`,
then numbered findings (HIGH / MED / LOW, file:line, fix).

## Diffs

- Kiroween `D:\kiroween-trifecta\kiroween-trifecta`, branch
  `feat/model-switch`: `git diff 55a21bb..HEAD`.
- Bots `D:\Discord\bots`, branch `feat/model-switch`:
  `git diff 2686c04..HEAD` (stacked on the unmerged connector branch
  `feat/audit-connector`).
- Decisions: `.kiro/specs/model-switch/notes.md`. Docs:
  `docs/assembly-parts.md`. Screenshots: `docs/model-switch-proof/`.

## The order (must be true)

1. Movie -> Meta Spark; Book -> Mercury or SubQ by CONFIG, NO default. An
   unconfigured Book answers a typed error naming the missing config; never
   a silent fallback, never a guessed default. Flipping Book is config only.
2. Two new sockets in `bot/model.py` + `bot/config.py` following the existing
   pattern: `subq` (Bearer `SUBQ_API_KEY`, model from env, never Meta's
   `reasoning_effort`), `mercury` (Inception endpoint, Bearer
   `INCEPTION_API_KEY`, `mercury-3` unless env says otherwise; shape from
   `D:\Trifecta\service\mercury_client.py`). Keys from env only. Unknown
   providers refused; missing keys fail closed. SubQ chat model id never
   guessed; Snap (`subq-snap-preview`) can never be a voice.
3. Voice words are Darren's. The user, mid-round, asked the builder to "make
   a new Frankenstein cartridge for the two Frankensteins (Book and Movie)";
   the builder drafted both voices and labelled them DRAFT awaiting approval.
   Judge whether that labelling is honest and sufficient.
4. Connector: `/chat` honours `register`, serves through the loop's own reply
   path, and every reply carries `served_by` = what ACTUALLY served it. A
   status call returns the live map from the loop's config, never hardcoded.
   Persona rule unchanged.
5. App: the announcement under the chat box from LIVE data (status +
   `served_by`; `served_by` wins). The change must be OBVIOUS visually, not
   a word swap. Mock shows the honest mock label via the one switch in
   `adapter/active.ts`. No provider/model names hardcoded in the app.
   Unreachable connector said in words. The switch untouched except
   wiring. `scenario/`, mock adapter, router, README untouched. No new deps.
   No file over ~500 lines. No engine code or prompts in the Kiroween repo.
6. Docs as listed in the order; Mercury Dec 28, 2026 limit recorded.
7. Tests: sockets via stub HTTP (shapes, auth, errors, unknown provider,
   missing key, missing Movie config), connector (selection, `served_by`,
   status, missing config), app (status + served_by via stub fetch, the
   disagreement rule, unreachable words, mock label).

## Look hardest at

- Any path where a turn could be served by one route but `served_by`
  reports another (truth over config).
- Key leakage: repr, logs, `/models`, error bodies, tests.
- The 503 path: nothing recorded, no fallback.
- The app's `served` memory keyed by persona|register: can a stale
  `served_by` show for the wrong position?
- Whether the visual treatment meets "obvious at a glance" (see the PNGs).

## Evidence claimed (verify what you can by reading)

- Bots `python -m pytest -q`: 172 pass. Known pre-existing flake: delete
  `D:\Discord\bots\data\ambient-claims\111-*.claim` before and after a run.
- Kiroween `npx vitest run`: 340 pass (327 at base); `npx tsc --noEmit` and
  `npm run build` clean.
- Live E2E on a scratch data dir: Movie turn served_by meta Spark, Book turn
  served_by mercury-3, both through the real model APIs, screenshots 01-03.
  SubQ leg only against a local stub (no id/key on the machine).
