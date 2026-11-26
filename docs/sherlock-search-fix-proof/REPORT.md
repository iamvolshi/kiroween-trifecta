# OCME: Sherlock search fix, app side

Branch `feat/sherlock-search-fix-app`, off `feat/sherlock-search` (c5ea9a8). Not merged. Service fix is `feat/sherlock-search-fix` (bed3bcc, NewSherlock), not edited here.

## Changes and proof

| Change | Proof |
|---|---|
| `Provenance` gains `kind`, `kid_label`, `rerank_score`; `AskResult` gains `status`, `low_confidence`, `ranked_by`, `rerank` (adapter/seam.ts, adapter/sherlock.ts keeps them) | test "the adapter keeps kind, kid_label, rerank_score and the rerank fields" |
| K-entry hit shows `K-0266, authority 8 of 9` in rail search, Research ask turn, Curator ask | `a-k-entry-answer-1920.png`; 3 tests |
| Weak answer says in words "Sherlock is only weakly sure of this answer. These are its best matches, not a confirmed answer." (warning color, role=note) | `b-low-confidence-1920.png`; 2 tests |
| Small line "Reranked by <model>." or "Not reranked (first-stage order): <error>" | both shots; test "says when the reranker was not used" |
| Watson citations carry the K label as KID for K entries | test "Watson gets the K label as the KID" |
| Plain passage answers unchanged: KID n, authority, no notes | test "a plain passage answer ..." |
| Sherlock down: words, no hits, no fallback | `d-sherlock-down-1920.png` ("Sherlock unreachable: Failed to fetch"); test |
| 24-question summary | `c-score-summary-1920.png` (from results.json, numbers as given; correct 3/24 and facts 32/72 are one reader's lenient grading, said on the shot) |

New code: `audit-ui/src/util/sherlock-notes.ts`, edits in rail-panels.ts, views/research.ts, views/curator.ts, watson/conclusion.ts, styles/research.css. New tests: `audit-ui/src/views/sherlock-answers.test.ts` (10).

## Tests
- Full suite, run once alone: 636 passed (was 626). tsc clean, vite build clean.
- With the source changes stashed, 7 of the 10 new tests fail (3 pass by design: unchanged behaviour and down state). The Research-ask test was tightened afterwards to check the KID field itself, so it also fails without the fix.

## Live run
The fixed service ran locally (bed3bcc code, frankenstein.txt + k_record.json: 1088 passages, 334 K entries) with the real reranker (NIM_API_KEY from User env, never printed). The built app was served on one origin that forwards /api to it (`live/fix-shot.mjs`, `live/serve_local.py` in `_proof/sherlock-fix/live`). Shots a and b are real answers: q10 top hit K-0266 (authority 8), q04 top hit K-0315; both WEAK_SUPPORT, reranked by nvidia/nemotron-3.5-rerank-8b.

## Unproven
- Live hosted Sherlock (not hosted yet); CORS was not needed locally because of the same-origin forward.
- Both live answers are weakly sure (all 24 are, per the service report), so a confident answer was only tested with the double, not live.
- Curator ask and chat routes on the real service were not exercised (not in the contract); only tests with doubles.
- The chat pane in the shots shows the old "Connector unreachable (VITE_CONNECTOR_URL)" message; that is the chat route, not part of this change.
- Grading numbers are the service worker's, not re-graded.
