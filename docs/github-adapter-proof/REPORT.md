# REPORT: OCME-009-hack, attach a GitHub repo from the chat (app side)

Branch `feat/github-adapter-app`, off `feat/sherlock-live-url` (e4c68f0). Not merged, not on main. Service: `feat/sherlock-github-adapter` (NewSherlock), contract `docs/github-adapter-contract.md` (re-read after its REPORT; only a 409 `not_ready` body note was added, no break).

## What was built
| Piece | File |
|---|---|
| Client for /api/github (session, attach, status, ask, detach). Token: 256-bit random, kept in localStorage (`sherlock-github-session`), sent as `X-Sherlock-Session` on every call. Base URL is the existing VITE_SHERLOCK_URL. Errors in words; Sherlock down says no other search is used | `audit-ui/src/adapter/github-client.ts` |
| Shared state (status polling, source book/repo, repo turns, detach) | `views/repo-session.ts` |
| "Attach GitHub repo" control: repo, optional branch and folder, progress with file counts, error words, source switch, Change repo, Detach. Repo answers list file path + KID per citation, same low-confidence and rerank notes as book answers | `views/repo-panel.ts`, `styles/repo.css` |
| Wiring: chat and mini chat (same ChatView) get the control; in repo mode questions go to /ask only | `views/chat.ts`, `router/router.ts`, `main.ts` |

No engine added to the rail. No secrets in code. A reload finds the repo again (status read if a token exists).

## Tests
Full suite once: 653 passed (636 before; 17 new in `views/github-repo.test.ts`). tsc clean, build clean.
New tests cover: token minted, kept, sent on every call; two browsers never share a token; short stored token replaced; Sherlock down and no address; 404 no_repo_attached; busy and invalid_repo words; attach flow to ready with counts; branch/folder sent; repo_not_found, rate limit, no_text_files words; ask routed to /api/github/ask (book chat not called); path + KID rendering; weak wording; switch back to book; failed ask keeps the question; detach. They fail without the change (the modules and the chat wiring do not exist).

## Live round trip
Service run locally from the service branch (805eb3c, `uvicorn sherlock.render_app:app` on 127.0.0.1:8090, real reranker). Built app (VITE_SHERLOCK_URL=same origin, /api forwarded) driven in headless Chrome at 1920 with `gh-shot.mjs` against the real public repo `octocat/Spoon-Knife` on real GitHub.
| Step | Result | Shot |
|---|---|---|
| Attach | control reads "Attach GitHub repo"; request sent | `a-attach-in-progress-1920.png` (caught at "Sending the repo to Sherlock."; the next poll read "Fetching octocat/Spoon-Knife") |
| Ready | "Ready: octocat/Spoon-Knife (main). 3 files read, 0 skipped, 14 passages." Source switch shows the repo pressed | `b-ready-1920.png` |
| Answer | "How is the page styled?" -> citation `index.html` `KID 7`, weak-sure line, "Reranked by nvidia/nemotron-3.5-rerank-8b." | `c-answer-path-kid-1920.png` |
| Error | missing repo: "GitHub could not find that repo. It may be private, or the name may be wrong. Only public repos can be attached." | `d-error-repo-not-found-1920.png` |
| Down | "Sherlock unreachable: Failed to fetch. The app does not use any other search." | `e-sherlock-down-1920.png` |
Raw values: `shot-report.json`.

## Unproven
- The proof build had no VITE_CONNECTOR_URL, so every shot also shows the unrelated red "Connector unreachable" line (voices). It is not from this change.
- Switch back to the book and detach were tested with doubles only, not live (the book chat needs the connector).
- Mini chat shares the same view and is covered by the shared code, but no live shot was taken.
- Rate-limit words tested with a double only. Not run on Render. No redeploy.