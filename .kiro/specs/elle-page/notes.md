# The ELLE page (Lessons), Nov 21

Darren: a list of things she is working on: her case files, her grey box, questions partially answered, and questions answered.

## What it is

`/lessons` (`src/views/lessons.ts`, `src/styles/lessons.css`). The Lessons rail icon takes the center there (as Research takes it to /research) and swaps the left panel to the existing LessonsPanel, unchanged. Tapping it while already on /lessons pushes nothing. The left nav reads Chat / Action List / Calendar / Research / Lessons.

Header: ELLE in her green (`--engine-elle`, #3ddc97). `ELLE_EXPANSION` is `null` until Darren supplies the words; while null, no expansion element renders.

Four boxes, 2x2 (stacked under a 760px center), each its own scroll box:
- **case files**: every lesson grouped by `subject`; a null subject goes in "unfiled", last. Each lesson shows every seam field verbatim; a candidate reads grey.
- **grey box**: lessons with status `candidate` (from GET /lessons, plus any `held[]` / `elle` the chat log carries), grey: "N open questions". These are the under-threshold records flagged for ELLE (Darren's Nov 21 doctrine: the weight is the flag). This is the grey box as the data shows it, not the unbuilt greybox judgment system.
- **answered**: lessons with status `promoted`, with "promoted on turn N" when a turn's `elle_promoted` carries it.
- **per turn**: each chat turn's `engines.elle` (recorded) and `engines.elle_promoted` (promoted); a turn with neither reads "No action".

A lesson seen twice (the connector's read and the chat log) is one lesson; a promoted copy replaces a candidate one (promotion is a later event).

## What it does not show

No partially-answered state, no case-file object, no greybox stages, no judgment ladder: the seam sends none (Q2). No helper, teaching or how lines; no storyboard.

## The live record today

GET /lessons on the Render connector answered `[]` (Nov 21), so the live page reads "No lessons yet." in every lesson box. When the connector sends lessons it sends `subject` null and `status` promoted (seam comment, GRAY-2), so they would group as unfiled and the grey box would stay empty (Q4).

## Fixed on the way

The first-load modal ("Loading the record...") waited for the Chat panel's folder list to settle. A rail tap before that (Lessons, Research or Audit on a cold connector) swapped the list away, so the modal stayed up until Hide. The Router now hides it when that list leaves the page; the new panel shows its own loading state. Found taking the live shot.

## Verified Nov 21

Local headless Chrome, `docs/elle-page-proof/elle-geometry.mjs`:
- **Stub record** (`docs/elle-page-proof/stub-connector.mjs`, a test double with stand-in lessons: two subjects, one unfiled, two candidates, two promoted; two chat turns, one promoting and one recording): page scroll 0/0 at 1920x1080 and 1024x768; "case files · 2 subjects · 4 lessons", "grey box · 2 open questions", "answered · 2 lessons learned", "per turn · 2 turns"; folders stub-subject-a, stub-subject-b, unfiled; "promoted on turn 1"; header rgb(61,220,151); left panel = lessons.
- **Live record** (no chat sent): page scroll 0/0 at both sizes; every box empty in words.

Shots: `docs/elle-page-proof/stub-1920.png`, `stub-1024.png`, `live-1920.png`, `live-1024.png`.

## Open for Darren

- Q1: ELLE's expansion words for the header.
- Q2: what counts as a question partially answered? The seam has no such state; the grey box shows the held items as her open questions.
- Q3: "Lessons" after Research in the nav: confirm.
- Q4: subjects and a held stage from the connector are a bots change; the page shows the record as it stands.
