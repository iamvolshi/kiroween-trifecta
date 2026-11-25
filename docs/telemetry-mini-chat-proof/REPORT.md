# Telemetry only on /chat; mini chat everywhere else (feat/mini-chat)

Base: feat/site-density (98b4aec). Shots built with VITE_CONNECTOR_URL=https://hackenstein-connector.onrender.com, 1920 and 390 wide, script `mini-shot.mjs`, numbers in `shots/report.json`. Shots live in `shots/`.

| Fix | Shot |
|---|---|
| /chat: right column is telemetry, as before; composer stays at the bottom. | chat-telemetry-desktop.png, chat-telemetry-phone.png |
| Calendar: right column is the mini chat (voice picker, turns, composer at the foot); telemetry not mounted. | calendar-mini-chat-desktop.png, calendar-mini-chat-phone.png |
| Research: same. | research-mini-chat-desktop.png, research-mini-chat-phone.png |
| A message sent from the mini chat (live connector, Book voice) shows with its reply in the mini chat. | mini-chat-sent-desktop.png, mini-chat-sent-phone.png |
| The same message and reply are in the /chat transcript afterwards (SPA navigation, same chatLog). | chat-shows-mini-message-desktop.png, chat-shows-mini-message-phone.png |

## What changed
- `src/router/router.ts`: `resolve` now calls `swapRight`. /chat mounts TelemetryPanel; every other path mounts the existing ChatView (same chatLog, same models source) in a `.mini-chat` host inside the right column. No second chat was built. A minimized/maximized terminal is reset to normal when leaving /chat.
- `src/styles/mini-chat.css` (new, imported in main.ts): fits the column; transcript scrolls inside it, dock is static at the foot, engine boxes and the picker caption are hidden, model name ellipsizes. Phone: pane is 26rem tall.
- Left rail, left panel, center views, telemetry panel: unchanged.

## Tests
- Suite 592 passed (582 before), `tsc --noEmit` and `npm run build` clean.
- New `src/mini-chat.test.ts` (10 tests): telemetry on /chat; mini chat and no telemetry on 7 other routes; swapping both ways with one composer only; a message sent from the mini chat lands in `getChatLog()` and shows in /chat. With router.ts reverted, all 10 fail.
- Three existing tests asserted telemetry off /chat (shell.test, ui-restart.test, no-connector.test); updated to the new rule.
- Flaky: two full runs (of ~8) showed hundreds of failures at 6 s with no code change between; the next run passed. Cause not found. no-connector /chat was flaky on site-density too.

## Unproven
- Engine boxes are hidden in the mini chat, so a reply's engine detail needs /chat. Provenance links in mini replies do nothing (no telemetry to highlight).
- Phone: right column is stacked below the page, so the shot scrolls to it.
- Only the Book voice was sent live (one turn per viewport); other voices not shot.
- No merge; branch pushed only.