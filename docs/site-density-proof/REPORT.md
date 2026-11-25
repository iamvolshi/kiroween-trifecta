# Site density proof (feat/site-density)

Base: origin/feat/rail-nav (9910d25). Layout and density only. Shots: `after/` (new), `before/` (base), both at 1920 and 390 wide, built with VITE_CONNECTOR_URL=https://hackenstein-connector.onrender.com. No chat turns sent. Script: `shot.mjs`.

| Fix | Shot |
|---|---|
| Calendar: month named once. The "Folder: November 2026 (UTC)" caption is empty at month and day level; the title stays. | after/calendar-desktop.png, calendar-phone.png |
| Calendar: day cells 3.5rem -> 2.25rem minimum (2rem at 1024, 2.75rem on phone), and the month grid stretches to fill the pane, so no blank half page. | after/calendar-desktop.png |
| Audit RECORDS: count line, the 5 most recent, rest behind one "Show all N" button (collapsed). Expanded list scrolls inside the panel. | after/audit-desktop.png (collapsed) |
| Entry detail: fields with no value are not drawn (E-Time and K-Time rows gone when blank). Chain table evidence column widened. | after/entry-desktop.png, entry-phone.png |
| Research: pool drops the Time column (same value on every row); Authority gets a full header; Reason fits. Retrieval and injection are one line each. | after/research-desktop.png, research-phone.png |
| Lessons: case files, grey box, answered, per turn are one line each, boxes shrink to their content. | after/lessons-desktop.png, lessons-phone.png |
| Chat: with no messages, the picker and composer sit mid-pane (no tall empty area above them). | after/chat-desktop.png, chat-phone.png |
| Curator: boxes size to content; empty chat transcript is a short strip. | after/curator-desktop.png, curator-phone.png |

Text changes: "No chat turns in this session yet." is now "No chat turns yet."; "Nothing is held. No lesson is waiting to be promoted." is now "Nothing is held." Existing tests updated to match.

## Tests
- Suite: 582 passed (576 before), `tsc --noEmit` and `npm run build` clean.
- New: `src/site-density.test.ts` (6 tests): blank-field hiding, record list collapse and expand, short list has no control, calendar month once, empty-state one-liners, pool columns. With the source changes stashed, 5 of 6 fail (the 6th guards a short list).
- `no-connector.test.ts` "/chat: no voices can load" failed in 2 of 5 full runs and passed alone 3 of 3 times. I did not touch that code; it looks timing-sensitive under parallel load. Not run on the base to compare.

## Unproven
- Data-dependent states were not seen live: the live record has no lessons, no chat turns and one Curator folder, so populated Lessons/Research turn lists and a multi-folder Curator page were not shot.
- Chat "fills the view" is read as the composer centered; a long transcript was not shot (no turns sent).
- Entry detail with blank E-Time/K-Time is proven by test; the live entry shot (KID 33) has no blank fields.
- Calendar rows stretch tall on a 1080 screen by design.