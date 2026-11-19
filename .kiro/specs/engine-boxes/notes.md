# Engine boxes: KTIE / ERIE / ELLE down the side of a reply

Base: `feat/ui-restart` at `03303fe`. Branch: `feat/engine-boxes`. App only.
The boxes and colours follow the approved static mock
(`iamvolshi/hackenstein-preview`, `engine-boxes-mock.html`, variants A and
B); the terminal and the drag / window controls are built from the order's
words. Live data only: every line comes from the turns and the record.

## What changed

| Part | Change |
|---|---|
| Engine colours | `--engine-katie` (cyan), `--engine-erie` (amber), `--engine-elle` (green) in `style.css`. The boxes, the feed tags and the feed markers use them; ERIE moves off grey onto amber. Voice accents unchanged. |
| Engine boxes | `views/engine-boxes.ts`: three real buttons KTIE / ERIE / ELLE in a column on the reply row's right (`.bubble-row-reply` is a flex row; the bubble takes the rest). Lit from `turn.engines`: KTIE when `katie` is not empty, ERIE when `erie` is not null (found or not_found), ELLE on any injected / held / recorded / promoted lesson. Dark boxes are still buttons. |
| Focus channel | `shell/engine-focus-channel.ts`: publish / subscribe like `provenance-channel.ts`, carrying `{engine, turnIndex}` or `null`. It also remembers the last focus (`current()`) so boxes drawn later show which one is pressed and a click can tell a toggle-off from a switch. |
| Specific feed | The telemetry panel shows one engine's events on one turn instead of the general feed: heading `KTIE — this turn` (name in its colour), `← All activity` back button, the same `renderItem` lines (`engineItems` in `activity-feed.ts`, the `eventsOf` order). A dark box: `KTIE did nothing on this turn.` The focus sticks across new turns. |
| Terminal | Feed items are plain mono lines (no border / background / padding), the tag plain coloured text, a small coloured marker. Oldest first, newest at the bottom; it follows the bottom only when the reader is within 48px of it. The specific feed never auto-scrolls. |
| Drag grips | `shell/layout.ts`: grips on the list panel's right edge and the terminal's left edge (`role=separator`, focusable, `aria-value*` in rem). Pointer drags run on window `pointermove` / `pointerup`. Ranges: left 12–24rem (16), right 14–36rem (20). Arrows ±1rem, Shift ±4rem. Widths are inline `--left-width` / `--right-width` on the shell; session-only. |
| Window controls | Minimize (−), maximize (☐), restore (❐) in the terminal heading row. Minimized: a 2.5rem strip with a vertical TERMINAL label and restore. Maximized: the terminal fills the row; the list panel and the chat hide but stay mounted. Restore returns to the dragged width. Grips hide when their panel cannot be dragged. |
| Deleted | `views/proof-cards.ts`, ChatView's `loadEntry` / `entryReads`, the proof-card CSS (stitch-chat.css block, stitch-system.css overrides), the card-style feed overrides in stitch-system.css. `fetchChain` stays. |

## Decisions

- The feed's tag still reads `KATIE` and its sentences are unchanged ("do
  not reword"); only the box and the detail heading use the four-letter KTIE.
- The specific feed sits under the terminal's own heading row (so the window
  controls stay reachable), then its own heading and back button.
- Grips are absolutely placed on the shell over the column boundary, not
  inside the panels: the rail swaps the list panel's children, which would
  remove a grip inside it. The columns are placed explicitly so hiding a
  panel never shifts the others.
- At 1100px and under, the default widths stay 11.5 / 15.5rem as before;
  a drag overrides them. Under 800px (stacked shell) there are no grips and
  no window controls.
- A telemetry panel that unmounts (only when the Router is destroyed)
  publishes `null`, so no box stays pressed with no panel to show it.

## Known limits

- `aria-valuenow` starts at the 16 / 20rem defaults even at 1100px and
  under, where the panels draw at 11.5 / 15.5rem until first dragged.
- The window glyphs are text (− ☐ ❐), small at 12px.

## Not built

No proof card, no small-K link, no modal, no navigation on a box click; no
new feed event types; no seam or connector change; no width persistence; no
mobile shell; no new dependencies. README and disclosure untouched.

## Proof

`docs/engine-boxes-proof/` (scratch stub connector, every value labelled
stub; the stub injects lessons on Book turns only, so a Movie turn shows
ELLE dark): 01 boot, 02 three replies (all lit / ELLE dark / all lit), 03-05
the KTIE, ERIE and ELLE detail, 06 a dark ELLE box's "did nothing", 07 the
terminal with several turns, 08 a terminal dragged wide (a real CDP mouse
drag, clamped at 36rem), 09 minimized strip, 10 maximized terminal. Restore
returned to the dragged 36rem.

## Tests

404 pass (388 at base). The proof-card tests in `views/stitch-face.test.ts`
are replaced by box tests (order, lit / dark rules, swap, back, toggle,
switch, did-nothing, focus across turns). `shell/engine-terminal.test.ts`
covers the terminal (follow / no-yank / detail no-scroll, colour tokens) and
the layout (grips, window-level pointer drag, keyboard, controls per state,
hidden grips, mounted panels, restored width, no persistence).
`telemetry.test.ts` now asserts oldest first. tsc and build clean.
