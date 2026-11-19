# Chat face (desktop): notes

The visual direction took cues from a reference mockup: the Nov 18 Stitch
export (`chat_observability_mask_provenance`, `chat_before_a_pick_unconfigured_state`).
Stitch drew the face; the code here is written fresh. Behaviour is unchanged:
same live connector, same seam contract, same routes. Live data only.

Base: `main` at `2a5fbd2`. Branch: `feat/stitch-chat-face`.

## What changed

| Part | Change |
|---|---|
| Palette (`style.css`) | background `#111318`, panels a step lighter, text `#e2e2e9`, accent cyan `#00f0ff` (`--accent-dim` `#00dbe9`) |
| Band (`styles/model-banner.css`) | Movie amber `#ffbd58`, Book violet `#eacfff` / `#f0dbff` |
| Header | "View: Chat / Observability" (the chat intro's view name) |
| Left column | "Calendar" in Going back is "Calendar Index"; each record folder carries its 0-9 value (latest entry's authority) on its head |
| Right column | heading "Telemetry — Machine state"; feed sentences start with the engine ("ERIE found nothing for '...'", "ELLE promoted a lesson: ...", "KATIE recorded 2 entries for this turn."); one KATIE item per turn, each written entry a row inside it (the provenance highlight now marks the row) |
| Chat, before a pick (`views/mask-cards.ts`) | heading "Chat with [nothing yet]"; three mask cards (MASK_01 Frankenstein, MASK_02 Elara, MASK_03 ARCHETRON) with a one-line voice; Frankenstein's card has "[BOOK] 1818" and "[MOVIE] 1931", each picks Frankenstein on that position; composer locked with placeholder "INPUT // AWAITING_MASK"; nothing under the chat box |
| Chat, talking | the compact mask switcher (and Frankenstein's Book/Movie switch) above the chat; band as before |
| Proof-anchor cards (`views/proof-cards.ts`) | under a reply that carries links: one card per linked entry with KID, subject, the entry's reason read live (`GET /chain`), and "Inspect →" to Entry Detail; a missing entry or a failed read is said in words |

## Decisions (asked and answered, Nov 18)

| Mockup item | Decision |
|---|---|
| Feed timings (`+00.012s`) | not built: the connector sends no per-engine time |
| "Checkpoint Diffs" | not built: no such view; Going back holds Calendar Index and Time Travel |
| "SEAM RUNTIME" section | left out |

## Not built (mockup inventions)

Invented numbers (FPS, tokens, session, checkpoint, T-minus, payload hash,
commit, KID-8812 / KID-9041); the belief-graph panel; the observability
runtime strip; the stale Elara "unconfigured" state; the "STATE //
00_UNINITIALIZED" line; voice.

## Known limit

The live connector authors no reply links today, so proof-anchor cards
appear only when a reply carries `links`. The cards are built to the
contract and proven with a stub connector (a test double).

## Proof

`docs/stitch-chat-face-proof/` (stub connector in scratch, values labelled
"stub"): 01 before a pick, 02 talking on ARCHETRON, 03 a reply with a link
and its proof card on Elara, 04 Frankenstein on Book.

## Tests

329 pass (321 at base): 7 new in `views/stitch-face.test.ts`, 1 new in
`shell/telemetry.test.ts`; tests pinned to old wording updated.
