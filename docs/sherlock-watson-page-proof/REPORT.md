# OCME-014-hack: personas talk in chat; Sherlock & Watson page

Branch `feat/personas-talk`, off `feat/typewriter-sound` (3d7f849). App in `audit-ui`. Not merged, nothing pushed to main.

## What changed

| Step | Change | Where |
|---|---|---|
| 1 | Chat has its own adapter: the connector's `/chat` (`createLiveAdapter(CONNECTOR_URL)`). `main.ts` passes it as `chatAdapter`; `boot` and `Router` hand it to the centre chat and the mini chat (same `ChatView`). Every search, record read and Research view still uses the Sherlock adapter, unchanged. | `main.ts`, `boot.ts`, `router/router.ts` |
| 2 | New view "Sherlock & Watson": rail entry (6th icon), route `/investigate`, a left-column note, plain page text saying it is for deep investigations. | `views/sherlock-watson.ts`, `shell/rail.ts`, `shell/investigate-panel.ts`, `styles/investigate.css` |
| 3 | Handoff: Sherlock `ask` -> Watson bridge `/report` (report plus KIDs) -> connector `/chat` with the picked persona. The page shows the voice's answer, then provenance (file path or source, KID, authority, excerpt), Sherlock's report (folded) and Watson's conclusion. | `investigate/handoff.ts` |
| 4 | Watson bridge wait is a parameter. The page waits 60 s; the rail keeps 15 s. | `watson/bridge.ts` |

No Sherlock button in the chat. No persona or model was changed.

## Mechanism for the persona voice, and why

The Sherlock report, its evidence (path and KID per hit) and Watson's conclusion go as one message to the connector `/chat` with `register` set to the chosen persona. The message tells the voice to use only that material, add no fact, name the source or KID, and say so when unsure.

Why this and not Watson alone: the bridge is deterministic and has no persona. The connector already owns the three voices and their models, so reusing `/chat` keeps the personas and models untouched and needs no new service. Limit: the voice is a language model. The page shows the evidence under the reply so the reader can check it, but the model's wording is not machine-verified.

## Attached repo and Rosie/GitHub behaviour

- Chat: unchanged. With a repo attached and the source switched to the repo, a chat question goes to Sherlock's `/api/github/ask` as before (OCME-009/010). Only a normal book turn changed: it now goes to the connector, not Sherlock.
- Page: if a repo is attached and selected, the page investigates the repo (`RepoSession.askQuiet`, the same ask call, but the turn is not added to the chat's repo list). Otherwise it investigates the book. The page says which in its source line.
- Repo hits carry file path and KID; they reach Watson and the voice the same way.

## Failure paths (each in plain words, no fake answer)

- Sherlock fails: "Sherlock did not answer: ...". Watson and the voice are not asked.
- Sherlock finds nothing: says so; Watson and the voice are not asked.
- Watson gives nothing: "Watson gave no conclusion ...", and the voice speaks from the report alone. The page says this.
- Connector fails: "The voice did not answer: ...". Sherlock's real report and provenance stay on screen.
- Chat with the connector down shows the existing error text; there is no fallback to Sherlock.

## Tests

`src/views/sherlock-watson.test.ts` (13 tests): handoff carries report and KIDs to Watson and the connector; all four failure paths; throwing bridge; repo path (no book call, no chat turn added); chat turn from the centre chat and the mini chat reaches the connector with zero Sherlock calls; rail entry and route; page shows path and KID; page shows Sherlock's failure; bridge wait.

Existing tests updated: five icons became six (`shell`, `assembly-integration`, `rail-nav`, `ui-restart`); `sherlock.test.ts` now says `main.ts` uses the connector adapter only as the chat voice.

Fail-without-fix: with `Router` using the Sherlock adapter for `ChatView`, the "chat turn goes to the connector" test fails (checked, then restored). The page tests need the route and handoff, which do not exist without the change. The Watson wait test fails at a 20 ms wait.

Result: 672 tests pass (659 required), `tsc` clean, `npm run build` clean.

## Live round trips (real services)

Run by `sw-shot.mjs`: the built app in headless Chrome at 1920x1080, with a same-origin forwarder to the hosted services (so no CORS setup). Every forwarded request is logged in `shot-report.json`.

| Path | Requests seen | Result |
|---|---|---|
| Chat, Movie voice | one `POST` to connector `/chat`, 8.6 s; no POST to Sherlock | Reply in character: "Ughhh... Me creature. Want friend. No fire. Alone bad." |
| Page, Book voice | Sherlock `POST .../cases/frankenstein/ask` 200; Watson `POST /report` 200; connector `POST /chat` 200 | Reply in the Book voice citing KID K-0104, K-0220, K-0154, KID 436; five provenance items; Watson confidence 0.90 |

Note: in the first run Watson's bridge took 17.9 s to wake and the old 15 s limit cut it off. The page then said "Watson gave no conclusion" in words, and the voice still answered from the report. That led to the 60 s page wait. The second run is the one in the shots.

## Shots (1920)

- `a-chat-persona-1920.png`: Movie voice chatting in the chat; Telemetry on the right.
- `b-page-empty-1920.png`: the new page, with its purpose text and source line.
- `c-page-answer-provenance-1920.png`: the Book voice's answer, provenance with file/source and KID, Sherlock's report, Watson's conclusion.

## Unproven / not checked

- A real person has not yet tried it.
- The mini chat's new route was tested with a double, not shot live.
- A repo investigation on the page was tested with doubles only, not live.
- Failure paths were shown with doubles and, once, live (Watson timeout). Sherlock-down and connector-down were not provoked live.
- Provenance source for K entries reads `k_record` (Sherlock's own label); the K label and authority sit beside it.
- The voice's wording is model output and can drift from the evidence; the evidence shown is real.
- Proof used a local forwarder, not the deployed gh-pages build. The hosted site's CORS for the Watson bridge was not checked.
