# Review 1: remove the mock

Reviewer: Code Review Sage (independent subagent, read-only, no memory or
lessons). Brief: `review-brief.md`. Branch `feat/remove-mock`, base `9bfccc6`.

## Round 1: PASS WITH FIXES

Confirmed: `scenario/`, `mock*.ts`, `active.ts` and `shell-integration.test.ts`
gone; nothing reads `ACTIVE_ADAPTER_KIND`; dead CSS and `--mock` tokens gone;
README, disclosure, `package.json` and the lockfile not in the diff; the seam
contract unchanged; the sweep matches only Vitest's API; no provider or model
names in app code; `assembly-parts.md` describes no mock mode;
`createRecordStub` is a test double imported only by tests.

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | MED | With the connector down, the right column said "Nothing has happened yet" and never named the failure | A failed record read shows the connector's words above the feed; the empty line only when there is no error; `no-connector.test.ts` asserts the right column in both cases; screenshots 05-09 reshot |
| 2 | LOW | The feed still printed "(step n)", the old scripted concept | Label dropped (the contract field stays) |
| 3 | LOW | An overlong comment line in `live.ts` | Re-wrapped |
| 4 | LOW | The deleted scenario test was the only one moving the folder meter | `left-folders.test.ts`: a refresh moves the meter 5 -> 7 and the history to "5 -> 7" |
| 5 | LOW | `isLiveAt` / `assemblyNotUsed` are used only by tests | No action; recorded in the notes |

## Round 2: PASS

Fixes 1-4 confirmed (the Sage ran the shell and no-connector tests: 43 pass).
Two optional LOWs, both fixed:

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | LOW | Before the first read answered, the right column briefly said "Nothing has happened yet" | The empty line waits for the first read to answer |
| 2 | LOW | An empty feed list was appended under the error | No list when there are no items |
| 3 | LOW | `from.step` no longer shown | No action; contract field |

## Remediation evidence

- `npx vitest run`: 315 pass, 35 files (base `main` 361 / 38).
- `npx tsc --noEmit` clean; `npm run build` clean; no new dependencies.
- Grep sweep `mock|scenario|scripted` over `audit-ui/src`: only Vitest's
  `vi.restoreAllMocks()` (2) and `.mock.calls` (1), in tests.
