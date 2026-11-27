# REPORT: OCME-010-hack, GitHub panel moved to the left column

Branch `feat/repo-panel-left`, off `feat/github-adapter-app` (bb80795). Not merged, not on main.

## Steps
| # | Step | Where |
|---|---|---|
| 1 | Whole panel mounted by the left column. `LeftPanel` takes the shared `RepoSession` and mounts `mountRepoPanel` in a `.repo-slot` at its top. `RailPanel` and `Router` pass the session. `chat.ts` no longer mounts any of it. | `shell/left.ts`, `shell/rail.ts`, `router/router.ts`, `views/chat.ts` |
| 2 | Stacked for the narrow column: switch buttons, form fields and buttons one above the next, full width; Ready and error lines wrap. | `styles/repo.css` |
| 3 | Same RepoSession (one per Router). The panel subscribes on mount and unsubscribes on unmount, as before. The chat view mounting and unmounting does not touch it. | same files |
| 4 | Chat column = transcript, voice picker, composer. Dock children are `voice-slot`, `chat-composer`. Placeholder stays "Ask <repo>". Citations show path and KID. | `views/chat.ts` |
| 5 | No change to attach, polling, scoping, answers, Sherlock or the mini chat. No new controls. | |

Note: the panel is part of the Chat rail panel, so it also shows beside the mini chat on other pages (the mini chat still asks the repo through the same session). Curator, Audit, Research, Lessons rail panels have none.

## Tests
Full suite: 655 passed (653 before, +2 new). tsc clean, build clean.
- New `router/repo-panel-left.test.ts`: panel in `.shell-left`, not in `.chat-column` or the dock; dock children exactly `voice-slot`, `chat-composer`; unmount and remount of the chat view keeps the same status, one panel, one bar, one subscription (one redraw).
- `views/github-repo.test.ts` now mounts the left column beside the chat (it asserted the dock before).
- Both new tests fail without the change (checked by stashing the source edits: 2 failed).

## Live round trip (real Sherlock, https://sherlock-search-nwx7.onrender.com)
Built app served on 127.0.0.1:4178, `/api` forwarded to the Render service, headless Chrome at 1920 (`shots.mjs`). Repo `octocat/Spoon-Knife`.
| Step | Result |
|---|---|
| Panel placement | in `.shell-left`: true; in chat column: false |
| Attach | "Ready: octocat/Spoon-Knife (main). 3 files read, 0 skipped, 14 passages." |
| Layout, form open | slot 188px wide in a 220px column, bottom at y=529 of 1080, no scroll, nothing overflowing (`metrics` in `shot-report.json`) |
| Ask | "How is the page styled?" -> citation `index.html`, `KID 7`; composer placeholder "Ask octocat/Spoon-Knife" |
| Detach | switch gone, button back to "Attach GitHub repo" |

Shots: `a-left-panel-form-open-1920.png` (left column, repo attached, form open), `b-chat-repo-answer-1920.png` (chat column with the repo answer). Raw values: `shot-report.json`.

## Unproven
- The proof build has no VITE_CONNECTOR_URL, so the red "Connector unreachable" line shows in the chat column. It is unrelated.
- Narrower widths than 1920 not shot. Switch back to the book not run live.