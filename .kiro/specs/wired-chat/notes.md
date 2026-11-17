# Wired chat -- decisions (2026-11-17)

Order: "OCME -- Wired chat" (Darren's direction, Elara's brief). Branch
`feat/wired-chat` from `e3e1ac0`. App side only; the connector to the
Discord bot loop is a separate piece built to the contract in
`docs/assembly-parts.md`. No engine code, no cartridge prompts and no
register prompts are in this repo: the app sends NAMES.

## Decisions

| Item | Decision |
|---|---|
| Link span shape | `ChatTurn.links?: ReplyLink[]`, each `{ start, end, kid, subject, entry_id }`. `start`/`end` are offsets into `engines.arche.reply` in UTF-16 code units (JavaScript string indices), end exclusive. Authored by the RESPONDING side; the renderer never matches words. Spans are applied in `start` order; a span out of range, empty, or overlapping an earlier one renders as plain text. |
| What a span points at | A record entry (kid + subject + entry_id). The work column's KATIE item with the same triple is its target. |
| Highlight channel | `shell/provenance-channel.ts`: a tiny named publish/subscribe channel. The chat publishes the target; the work column (the only subscriber) scrolls its item into view and marks it `.is-highlighted`. Focus stays on the link; the route never changes (the link has a real `href`, but activation is handled and stopped). No item, nothing happens. A module channel was chosen over a Router-passed callback because the order forbids router changes. |
| Highlight lifetime | A highlight persists across feed re-renders and stays in place until the next link is clicked. |
| Base-URL mechanism | Build-time env: `VITE_CONNECTOR_URL` (e.g. in `audit-ui/.env.local`). `adapter/active.ts` reads it once; empty = mock adapter, set = live adapter. `ACTIVE_ADAPTER_KIND` follows it, so the MOCK labels, the seam chip and the chat's mock note switch with the data (LOW-4 stays one switch). |
| Live reads outside the contract | `fetchAllEntries`, `fetchBeliefPool`, `fetchChain`, `fetchKidMap`, `update` return a typed "not in the connector contract yet" error when a base URL is set (still "Live adapter not wired" without one). No endpoint is guessed. Known limit on the live path: the Action List, Time Travel, Calendar and Entry Detail show that error, and the left column builds its subject folders from `GET /lessons` only (no 0-9 value, "--") with a line saying record entries are not available. Adding a whole-record read to the contract would fix all of them. |
| Reply validation | A `/chat` reply that is not a `ChatTurn` (`isChatTurn` in `adapter/seam.ts`) is refused with a typed error; the chat shows it and stays usable. |
| Persona state | Held on the Router's one `ChatLog` (persona, register, and the persona that replied to each turn), so it survives leaving and returning to the chat. No default persona. |
| Book / Movie default | **Movie** (flagged for Darren). |
| Work column heading | "What the machine is doing (mock)"; the "(mock)" drops when the adapter is live. |
| Feed sentence per event | ERIE: "Found what this needs: <text>" (+ source and excerpt lines) / "Looked, and found nothing for "<question>"." ELLE: "Used a learned lesson in this reply: ...", "Held back a lesson that is not learned yet: ...", "Recorded a lesson, not learned yet: ...", "Promoted a lesson, now learned: ...". KATIE: "Recorded <subject>." + Entry Detail link + evidence. Order inside a turn: prompt lessons, retrieval, record write, lessons recorded/promoted; shown newest first. |
| Feed identity | `data-feed-id="t<turn>-<n>"`, `data-engine`, and for KATIE `data-kid`, `data-subject`, `data-entry-id`. |
| Left folders | Groups = subject prefix before the first `.`, from the record entries and lesson subjects. No project name is invented (flagged for Darren). Fixture subjects with no dot (`temperature`, `pressure`) are their own group. |
| ARCHE in the feed | Not in the feed (flagged for Darren). The chat is the persona talking. |
| Split | App side only (flagged for Darren). |

## ELLE's bridge (doctrine, for the write-up)

One ELLE serves every persona. A lesson learned while talking to one
persona applies when talking to another. The app does not implement this:
the bot loop owns ELLE. The app only shows what ELLE reports.

## No-mock rule, as held

`scenario/` is untouched. The mock adapter and `mock-assembly.ts` are
untouched: the new `chat(message, options?)` parameter is simply ignored by
the mock (its replies stay scripted; it returns no link spans). The
picker, switch and link mechanism are proven against the live adapter with
a stub `fetch` in tests (`src/wired-chat.test.ts`,
`src/adapter/live-assembly.test.ts`).
