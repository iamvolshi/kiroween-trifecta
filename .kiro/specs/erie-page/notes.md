# The ERIE page (Research), Nov 21

Darren: this is where the engine gets a name. The page shows what ERIE gets and exactly what she injects into the model, not a storyboard.

## What it is

`/research` (`src/views/research.ts`, `src/styles/research.css`). The Research rail icon takes the center there (as Audit takes it to /calendar) and swaps the left panel to the existing ResearchPanel search, unchanged. Tapping it while already on /research swaps nothing and pushes no history. The left nav reads Chat / Action List / Calendar / Research.

Header: ERIE in her amber (`--engine-erie`, #ffbd58). `ERIE_EXPANSION` is `null` until Darren supplies the words; while it is null no expansion element renders. Nothing stands in for it.

Three boxes, in order, each its own scroll box (the page never scrolls):
- **pool**: the record live now (`fetchBeliefPool(Date.now())`), counted against `fetchAllEntries` and by subject, in the folder grid (`entry-grid.ts`, its own `pool` list for sort and widths). KID is the number alone and links to its entry; authority is a column.
- **retrieval**: one block per chat turn of this session (the Router's ChatLog), from `engines.erie`: question, state, text and every provenance item's source / content / excerpt, verbatim. `not_found` shows the question and "ERIE could not answer." A turn whose `erie` is null shows the message and "ERIE did not act on this turn." (the seam's meaning of null).
- **injection**: one block per turn, from `lessons_in_prompt`: `injected[]` with every lesson field verbatim, and `held[]` grey under "held · N questions for ELLE" (Darren's Nov 21 doctrine: the weight is the flag). No queue, routing or status beyond what the seam sends.

Layout: pool across the top, retrieval and injection side by side below (two equal rows). A center narrower than 760px (a container query; 1024 wide) stacks the three. Box labels are one fixed line with ellipsis, so a longer count never moves a box.

## What it does not show

No assembled prompt. The seam sends none, so the injected objects are the whole injection the app can see. Showing the literal prompt would be a connector change (bots), not this build (Q2). No helper, teaching or how lines; no frames, clips, timecodes or script.

## Verified Nov 21

Local headless Chrome, `docs/erie-page-proof/erie-geometry.mjs` (results in `*-geometry.json`):
- **Stub record** (`stub-connector.mjs`, a test double serving stand-in entries and two chat turns, one found and one not_found): 1920x1080 and 1024x768 page scroll 0/0; labels "pool · 5 live of 5 entries · 4 subjects", "retrieval · 2 turns", "injection · 2 turns"; one "ERIE could not answer."; 1 injected, 2 held; no "prompt" anywhere; header color rgb(255,189,88); left panel = research with the search.
- **Live record** (Render connector, no chat sent, so nothing was written to it): page scroll 0/0 at both sizes; "pool · 27 live of 27 entries · 27 subjects", 27 rows, KIDs 1..27; retrieval and injection say "No chat turns in this session yet."

Shots: `docs/erie-page-proof/stub-1920.png`, `stub-1024.png`, `live-1920.png`, `live-1024.png`.

## Tests

`views/research.test.ts`: header with no expansion, box order, pool (KID, authority, links, counts), empty and failed pool, no turns, provenance verbatim, cannot-answer, a null erie, injected vs held (fields verbatim, grey class, held never under injected), empty lists, live turns, no prompt / teaching / storyboard words, unmount; the route, the rail icon (and no remount when already there), the nav order and landing. Nav and shell tests now expect four destinations; the rail test now says Chat and Lessons alone leave the center.

## Open for Darren

- Q1: ERIE's expansion words for the header.
- Q2: the literal prompt text. The connector does not send it; showing it is a bots change.
- Q3: "Research" after Calendar in the nav: confirm.
