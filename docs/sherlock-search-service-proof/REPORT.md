# OCME-007-hack: every search goes through Sherlock (app side)

Branch `feat/sherlock-search`, cut from `origin/feat/mini-chat` (597c174). It stacks on feat/site-density and feat/rail-nav. All three are unmerged on purpose. Not merged to main.

## Fixes and the proof for each

| Fix | Proof |
|---|---|
| One Sherlock client (`adapter/sherlock-client.ts`), address from `VITE_SHERLOCK_URL` (case: `VITE_SHERLOCK_CASE`, else first ready case). `main.ts` builds only the Sherlock adapter. | `sherlock.test.ts` "main.ts builds the Sherlock adapter" (fails on the old main.ts) |
| ask (rail search, chat ask), curatorAsk, chat, fetchAllEntries, fetchBeliefPool, fetchChain, fetchKidMap, fetchLessons, fetchQuestions, fetchRecord each hit one Sherlock route and no other address | `sherlock.test.ts` 10 route tests; `sherlock-answer-1920.png` |
| Sherlock down: each path fails in words ("Sherlock unreachable: ...") and sends no request anywhere else | `sherlock.test.ts` 10 down tests; `corpus.test.ts` rail + 3 views; `sherlock-down-1920.png` (real service stopped) |
| Corpus overview, noun list, graph as views in Research (`/research/overview`, `/nouns`, `/graph`; tabs; no new rail icon). Graph is fresh SVG, no dependency, deterministic layout, top 40 nouns. | `sherlock-overview-1920.png`, `sherlock-nouns-1920.png`, `sherlock-graph-1920.png`; `corpus.test.ts` |
| Answered question shows KID, authority and excerpt | `sherlock-answer-1920.png` (rail search: "Who created the creature and where did he study?") |
| No Sherlock button or call site for the user | `corpus.test.ts` "has no Sherlock button" |

Tests: 626 pass (592 before). `tsc` clean, build clean. With main.ts, router.ts, rail-panels.ts and research.ts reverted, 3 of the new tests fail (wiring, rail search, router); the rest test new files. Two existing tests were updated to name Sherlock.

## Shots
Real Sherlock service (NewSherlock `feat/sherlock-search-service`, started by me on 127.0.0.1:8091), app built with `VITE_SHERLOCK_URL=http://127.0.0.1:8091`. Not stub-backed. The corpus is the **Project Gutenberg #84 stand-in**, not the 1818 file. Unit tests use a named test double. Script: `sherlock-shot.mjs`.

## Unproven / left
- The 24 sealed questions: NOT RUN. No questions invented, no scores.
- Not moved to Sherlock because they are not searches: chat voice/model status (`/models`, still `VITE_CONNECTOR_URL`; the chat box shows "Connector unreachable" in the shots), the Watson bridge, the PEEP/RATR inspector.
- Chat through Sherlock is retrieval only (no persona model turn), as the contract says.
- `X-API-Key`: the app sends none (a VITE_ key would be public). Works against an open Sherlock only.
- A Render-hosted Sherlock was not tried.
- Sherlock `questions` is a bare list; the app maps each to a blank question folder.
- Graph limit: top 40 nouns drawn.