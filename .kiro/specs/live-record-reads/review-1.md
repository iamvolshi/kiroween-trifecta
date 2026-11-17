# Review 1: live record reads + the connector

Reviewer: Code Review Sage (independent subagent, read-only, no memory or
lessons). Brief: `review-brief.md`. Two repos:

- Kiroween `feat/live-record-reads`, base `55a21bb`.
- Bots `feat/audit-connector`, base `4c6e0b7` (`bot/connector.py`, `tests/test_connector.py`).

## Round 1: PASS WITH FIXES

The Sage judged both the KID decision (handle `1` + the real tag as the
`/kidmap` label) and the belief-pool reasoning honest. It found the mappings
match `notes.md` and `assembly-parts.md` field for field, and the doctrine
and scope rules held.

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | MED | `_run` caught only `ConnectorError`; other errors dropped the connection with no words | Catch-all 500 in words; bad or negative `Content-Length` -> 400 |
| 2 | MED | CORS `*` on a no-auth server that spends credits: any open web page could call it | Origin echoed only for loopback pages or `CONNECTOR_ALLOW_ORIGINS`; other origins 403 on every method |
| 3 | MED | 502 echoed provider text; orphan user turn untested | Fixed 502 sentence, detail to log; HTTP test asserts the user turn stays (as the bot does) |
| 4 | MED | `k_time: ""` blank cells only in prose | Recorded as known blank cells in `notes.md`; warning test pins `isLiveAt` false on an open live entry |
| 5 | LOW | Guards accepted unparseable `k_start` | `k_start` and `t_time` must parse; `e_time`/`k_time` may be `""` |
| 6 | LOW | Evidence join not reversible | Documented as display text |
| 7 | LOW | Dead `k_end` branch compared ms with an ordinal | Removed, with a comment |
| 8 | LOW | Test gaps (bad bodies, 502 record state, bind host, `call()` error bodies) | Tests added for each |
| 9 | LOW | Lock held over the model call | Noted in `notes.md` and `assembly-parts.md` |

## Round 2: PASS

All round-1 fixes confirmed. Three new LOWs, none blocking, all fixed:

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | LOW | Request body read had no size cap | Over 1 MB -> 413 |
| 2 | LOW | A DNS-rebound page sends no `Origin` on GET | `Host` must be `127.0.0.1` or `localhost` (any port), else 403 |
| 3 | LOW | `$` in the origin regex matches before a trailing newline | `re.fullmatch` |

## Remediation evidence

- Bots: `python -m pytest -q` 149 pass (125 before + 24 connector tests).
  Pre-existing flake, not from this change: two ambient tests leave
  `data/ambient-claims/111-*.claim` with a 1 h TTL, so a second run within
  the hour fails them. Those test-made files were deleted before and after
  each run.
- Kiroween: `npx vitest run` 345 pass (327 before), `npx tsc --noEmit`
  clean, `npm run build` clean.
- Live re-check after the fixes, on the scratch record: every read equal to
  the loop's own parse (`KatieRecord.from_line`); a loopback origin served,
  a foreign origin 403.
