# Review brief: remove the mock (live-only app)

READ-ONLY. Do not edit, commit, push, or start servers. First line:
`VERDICT: PASS`, `VERDICT: PASS WITH FIXES` or `VERDICT: FAIL`, then
numbered findings (HIGH / MED / LOW, file:line, fix).

Repo `D:\kiroween-trifecta\kiroween-trifecta`, branch `feat/remove-mock`.
Diff: `git diff 9bfccc6..HEAD` (base = main after the model-switch merge).
Decisions: `.kiro/specs/remove-mock/notes.md`. Proof: `docs/remove-mock-proof/`.

## The order (must be true)

1. DELETED, not left dead: `scenario/` (fixtures, scripted replies, the
   chat prompt hints), the mock adapter and mock assembly, the mock/live
   switch (`adapter/active.ts` and every read of `ACTIVE_ADAPTER_KIND`),
   every mock label and mock branch in views ("(mock)", "Replies are
   scripted mock", the banner's mock state, the "Scenario not started"
   chip, anything describing scripted behaviour), mock-mode tests.
2. KEPT: test doubles (named in the notes), `docs/` screenshots, README and
   disclosure (must be absent from the diff), the seam contract unchanged,
   the bots repo untouched, the picker, switch, banner, record views, folders.
3. Live-only behaviour: connector up = as before; connector down or URL
   unset = every view says it is unreachable in words; no crash, no empty
   shell pretending to be data, no invented fallback. No backend address
   invented. No provider or model names in the app.
4. Grep sweep: no `mock` / `Mock` / `scenario` in `audit-ui/src` outside
   test doubles, each remaining occurrence explained.
5. No new dependencies. No file over ~500 lines.
6. `docs/assembly-parts.md` has no description of mock mode, mock labels or
   scripted behaviour.

## Look hardest at

- Any view that, with the connector down, shows an empty state that reads
  like "the record is empty" instead of "unreachable".
- Anything that still depends on deleted code (dead CSS classes, comments,
  unused exports such as `isLiveAt` usage, `assemblyNotUsed`).
- Whether any test that was deleted covered LIVE behaviour that now has no
  test (the deleted `shell-integration.test.ts` played the scenario
  through the left folders, the feed and the hour view; check whether
  `left-folders.test.ts`, `telemetry.test.ts`, `calendar.test.ts` and the
  live-record tests still cover those views).
- Whether the record stub in `test-helpers.ts` is a test double or mock
  data under another name.

## Evidence claimed

- `npx vitest run` (from `audit-ui`): 314 pass, 35 files (base 361, 38).
- `npx tsc --noEmit` clean; `npm run build` clean.
- Browser pass against a scratch stub connector and with no connector:
  `docs/remove-mock-proof/01..09`.
