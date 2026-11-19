# UI restart: keep the machine, start over on the face

The visual direction took cues from a reference mockup: the SyncSpace
three-column chat app (Stitch). Only its SHAPE is used (icon rail, list
panel, chat, detail panel; one accent used sparingly). None of its content
(name, workspace, channels, team, messages) is in the app. The code is
written fresh. Steering for this round was drafted from Darren's rules, not
by Kiro.

Base: `main` at `1f51c1c`. Branch: `feat/ui-restart`. Pairs with bots
`feat/three-frankensteins` (one mask, three voices).

## What changed

| Part | Change |
|---|---|
| Name | Header and tab title: Hackenstein. Tagline and chips unchanged. |
| Shell | Icon rail 56px + list panel 16rem + center + telemetry 20rem; header 56px. Boot (`/`) opens the chat. |
| Rail | Chat, Audit, Research, Lessons (icons, no engine names). Tapping swaps the list panel only; center and right do not move; the route does not change. |
| Chat list | The left column as it was: Directories, Record, Going back. |
| Audit list | Action List, Calendar, Time Travel; the live entry count; one line per account with its count, linking to its record (or a lone subject's latest entry). |
| Research list | A search box over ERIE (`POST /ask`); each hit with its source name and excerpt. |
| Lessons list | ELLE's lessons (`GET /lessons`), learned first. |
| Chat | A centered column, max 768px. Bubbles: user right, replies left. Before the first send: the voice chips and the composer, nothing else. |
| Picker | Chips from `/models` `register_voices`: `[BOOK] 1818`, `[MOVIE] 1931`, `[YOUNG FRANKENSTEIN] 1974`, label-md, bordered; picked chip in the voice's accent. Stays above the composer for switching. |
| Composer | One rounded box, send inside it on the right. Locked until a pick ("INPUT // AWAITING_MASK"), then "Message <voice>". |
| Flavor | One accent slot from the voice: Book violet (#eacfff / #f0dbff), Movie amber (#ffbd58), Young Frankenstein the default cyan. It covers the picked chip, the composer edge, the model band and that voice's replies. |
| Model band | Under the composer only after a pick; the picked voice's model, served_by wins; Young Frankenstein unconfigured shows the connector's own words. |
| Deleted | `views/mask-cards.ts`, `views/persona-picker.ts`, the chat intro (greeting and explainer), the NOT KNOWN transcript box, the "Chat with" strip, the mask-card and view-bar CSS. |
| Seam | Unchanged contract. `Persona` is `'Frankenstein'`; `Register` gains `'young-frankenstein'`. `/models` `registers` is read as a map of voice -> route; `persona_routes` is no longer read. |

Tokens unchanged: the eleven type roles, the palette, spacing, radii and the
corrected font link (Geist 100..900, JetBrains Mono 100..800, Space Grotesk
300..700).

## Decisions

- Elara and ARCHETRON: the picker shows only Frankenstein's voices. Before
  the bots part lands, the live connector reports two voices (Book, Movie),
  so the picker shows those two; Elara and ARCHETRON are never shown.
- Research: the connector has no call that lists ERIE's corpus, so the panel
  searches it (`/ask`) and shows each hit's source. A listing needs a
  connector endpoint first.
- The rail is a toolbar of buttons, not a second `nav`: it swaps a panel, it
  does not change the route. The list column's caption follows the panel.
- If `/models` cannot be read before any pick, the picker slot says why in
  words (the unreachable words) and the composer stays locked. A failed
  re-read after a pick keeps the chips; the band says the connector is
  unreachable.
- Keyboard: the picker has one Tab stop (roving tabindex); a /models
  re-read that rebuilds the chips gives focus back to the chip that had it.
  A picked voice the connector no longer reports locks the composer.
- Research keeps its last search across a rail switch; Audit and Lessons
  say they are reading until the read lands. A read that throws is said in
  words on every panel (and in the Chat list).
- The connector still records the speaker of an HTTP turn as "Audit UI"
  (bots `CONNECTOR_SPEAKER`). That is record data, not the app name; it is
  left as it is.

## Known limits

- The Audit panel's view links carry no aria-current (the Chat panel's nav
  does). The CSS accent cascade and the pinned dock are checked in the proof
  shots, not in jsdom.
- "Elara" still appears in one test comment (bug-hunt-fixes.test.ts): it is
  the verifier's name in a credit line, not the mask.

## Not built

Everything on the standing banned list; the greeting and explainer; mask
cards; the NOT KNOWN panel; Elara and ARCHETRON anywhere; "AUDIT UI" as the
name; SyncSpace content; any model or accent for Young Frankenstein; the
ERIE corpus ingestion; a mobile shell; voice UI.

## Proof

`docs/ui-restart-proof/` (a scratch stub connector, every value labelled
stub; Young Frankenstein stubbed unconfigured): 01 boot pre-pick, 02 Movie
talking, 03 Book with a proof card, 04 Young Frankenstein unconfigured, 05-07
the Lessons, Audit and Research panels, 08 another view on the tokens.

## Tests

388 pass (372 at base). The deleted face's tests (mask cards, persona
picker, register switch, Elara / ARCHETRON routes) were replaced by tests of
the new face: `views/chat.test.ts` (pre-pick screen, chips, unlock, accent,
bubbles), `views/model-banner.test.ts` (band rules per voice, Young
Frankenstein unconfigured), `ui-restart.test.ts` (rename, rail, panels,
banned words). The unreachable words on every view stay covered by
`no-connector.test.ts`. tsc and build clean; no new dependencies.
