# The KATIE page: KTIE header + the time tree as drums

Base: `main` at `ecdf1f6`. Branch: `feat/katie-page`. App only. Live data
only: every value on the drums and in the folder comes from the loaded
record; counts ride in labels and titles.

## What changed

| Part | Change |
|---|---|
| Header | The Calendar view's top is `KTIE` (h1, KTIE rose, headline-xl) over `Knowledge Time Indexing Engine` (label-md, muted). No helper line at all: the page teaches nothing, the drums are the navigation. A different title comes later. The shell's "View: Calendar" label and the left lists' "Calendar" labels are unchanged. |
| Drums | `views/calendar-rail.ts` is now a row of five vertical wheels: Years, Quarters, Weeks, Days, Hours (UTC). The centered value is solid and rose; the three either side fade (1, 0.55, 0.3, 0.14) and tip back like a drum (`rotateX`); further ones hide. A rose selection band runs through every window. |
| Years | New root wheel (`yearsPresent`, and `quartersOfYearPresent` for the Quarters wheel). A year pick takes its last quarter, week, day and hour. |
| Behaviour | Hover a wheel and the scroll wheel spins it; the wheels to its right re-derive (last of each; the hour is the day's last hour holding an entry). The wheel claims the scroll only when it moved. Small trackpad deltas gather into one step (50px); a mouse notch is one step. Arrows spin the focused wheel (Up/Down and Left/Right), Home/End jump to its ends. Clicking a value centers it; an hour value is a link to the hour view. One Tab stop per wheel (the centered value). |
| Settle | Every move reports the moment it passes; 420ms after the last move the drums count as settled. While they spin, the old folder stays put and a rose line names the real moment passing (`2026-03-03 · 11:00 UTC · 0 entries`). Once settled, the folder becomes the hour view for that moment (snapshot + did + believed, the existing `renderHour`). A newer spin drops an older folder load. |
| Layout | One column: header, drums, the passing line, the folder. The folder starts as the route's own content (month grid / day hours / hour view). The page fits one screen at 1024×768, no scrolling: no question sentence, no helper line, the title drops a size at 1100px and under, the drums go narrow through the 48rem container rule, the month grid cells are 2.75rem, gaps and the center's bottom padding tighten. The day's 24 hours sit as a 6-column grid, not a list, so the day fits one screen too. The page never scrolls at any size: head and body share one full-height column (`.ktie-page`), the folder row takes what is left, and the folder is its own scrolling box (`overflow-y: auto`) when its content is taller than the screen. |
| Audit | Tapping Audit swaps the list panel and, unless the center is already on the KTIE page (`/calendar` at any level), navigates to `/calendar` through the Router. Chat, Research, Lessons: panel only. |

## Decisions

- The spun wheel is patched in place (its reel slides by a CSS transition,
  so it turns); a wheel whose values change (a right-hand wheel after a
  cascade, or the hour wheel on a new day: same 24 keys, new links) is
  rebuilt. Found by the proof run: the hour wheel had kept the old day's
  links; fixed and tested.
- "Folder" on the month and day routes is the route's own content until
  the first spin settles; the order also names the hour view as the folder,
  so a settled spin shows the hour view. A caption above the folder always
  says what it holds ("Folder: November 2026 (UTC)", then "Folder:
  2026-03-03 ? 11:00 UTC ? 0 entries"). On settle the address follows the
  folder with replaceState (no new history entry, no remount), so a reload
  or a shared link shows the same moment. Clicking the hour already open
  does nothing (no duplicate history entry). A settle whose read fails says
  "could not load" in the caption and leaves the address alone. When the
  address moves in place, the Router refreshes the left panel.
- The passing line keeps its space when idle (hidden, not removed), so the
  folder never jumps between spinning and settled. Screen readers hear one
  short status ("Folder: ...") on settle; the folder is aria-busy while the
  drums spin.
- Wheel: Ctrl + wheel (zoom, a pinch) is never claimed; a gathered partial
  step goes stale after 160ms; a line delta counts 20px (a 3-line notch is
  one step); one step per event at most.
- Every value's aria-label starts with what it shows (label in name). The
  drums are role=group (no extra landmarks). --drum-reach is set from
  DRUM_REACH. Faded values: 1 / 0.55 / 0.3 / 0.14; empty hours are muted,
  not faint. A narrow center column shrinks the values.
- The drums are KTIE's rose. The month heatmap, the day list and the
  knowledge-state panel keep their colours (the order keeps that content
  unchanged).
- The "scrolling folders" are a single line naming the moment passing, from
  the record; no folder content is drawn while spinning.

## Known limits

- The hour view's folder is a log, not tables (Darren, Nov 20: the boxes
  were too big). One line for the hour's state ("14:00 UTC · recorded 3 ·
  live 2 · masks: Frankenstein"), then `did` and `believed` log lines, one
  entry per line, clock time first. It is taller than the screen by design
  (the believed log holds every entry live at the hour — 44 lines in the
  stub record). It scrolls inside the folder box, never the page: at
  1920×1080 the hour folder reads 3381px tall in a 599px box. That is the
  settled shape (Darren's box rule, Nov 20), not a limit to fix.
- Because the settle replaces the history entry, Back then Forward lands on
- Because the settle replaces the history entry, Back then Forward lands on
  the settled hour, not the month or day first opened.
- The idle passing line keeps one line of space under the drums.
- `color-mix` (the rose band and glow) needs Chrome 111 / Safari 16.2 /
  Firefox 113.
- Left/Right spin the focused wheel (as the old rail did), not move focus
  between wheels; Tab moves between wheels.
- jsdom draws no CSS: the fade and the curve are checked as the values the
  drums set (`--fade`, `--d`, `--sel`) and in the proof shots.

## Not built

No chat, ERIE or ELLE page change; no seam or connector change; no new
dependency or event type; no KATIE display string; README and disclosure
untouched.

## Proof

`docs/katie-page-proof/` (a scratch stub connector with a seeded two-year
stub record; real CDP mouse moves and wheel notches): 01 Audit lands on the
drums, 02 the header, 03-06 each wheel hovered and spun (years, quarters,
weeks, days), 07 hours spinning with the folder holding, 08 the deep
selection settled, 09 the folder under the settled drums, 10 an hour clicked:
the hour view with the drums above.

## Tests

434 pass (419 at base). `views/calendar-face.test.ts`: header; five wheels
in order; centered solid / neighbours faded / far hidden; counts in labels;
year cascade; hovered wheel only, right wheels follow; claim only on a move;
trackpad gathering; patch vs rebuild; the hour wheel follows a day change;
keyboard; empty wheels in words; the locked hour; hour link = day list link
and the hour view under the drums; folder holds while spinning and lands
after; passing lines are real moments; a stale folder load is dropped; the
unreachable connector. `ui-restart.test.ts`: Audit navigates to `/calendar`
and swaps the panel; on `/calendar` it does not remount. `calendar-rail.css`
joins the type-role check. tsc and build clean.

## KID is a number; UTC / Local switch (Nov 20, Elara)

The log printed the full kidmap tag after every KID (a long opaque string,
identical on every line). A KID is a number: the log, the record cards and
the entry detail now show the number alone. The tag stays the machine key
behind the number; the /kidmap adapter surface is untouched, the views just
stop fetching it for display. `renderKid(kid)` takes no map.

UTC is for the records, local is for people. The hour view (the folder) has
a UTC / Local switch beside the moment line (UTC default, solid rose when
active). Local translates the moment line, the snapshot hour, the log clock
times and the folder caption through `src/util/timezone.ts` (Intl, the
viewer's zone; a UTC moment past midnight reads the day before locally).
The record, the routes, the address and the record reads stay UTC, and the
month grid and the day hour list are the record's own structure, so they
stay UTC. (The drums used to stay UTC too; that changed Nov 20 — see the
next section.) The switch re-reads the folder in place (same moment, same
entries, new clock); a flip drops an in-flight settle.

## The drums follow the switch (Nov 20, Elara)

Darren: the barrel clock needs to match local; the interface for the user is local time, converting to the record in UTC. The drums now follow the zone switch: in local mode they show the viewer's calendar (local years, quarters, weeks, days, hours) and a local pick converts back to UTC for the record read (`localToUtc` in `src/util/timezone.ts`; the offset is read twice so a reading either side of a DST change lands on the right UTC hour; the fall-back hour returns its first occurrence, a spring-gap reading lands just before the gap). The moment the drums report stays UTC, so the settle, the folder read and the address are unchanged. The hour wheel links name the UTC hour each local hour reads as. A bare day focus translates as the local day of its noon. The zone holds for the session (sessionStorage `hackenstein-ktie-zone`, UTC default), so opening another hour keeps local. The month grid and the day hour list stay UTC. Known edges: on the fall-back day the repeated local hour holds both occurrences but the folder shows the first; the switch lives on the hour view, so flipping from a month or day route waits for an hour view. Verified Nov 20 in local Chrome (America/New_York, stub connector, `~/workspace/katie-shots/check-drumlocal.cjs`): UTC default 16:00, flip to Local centers 11:00 with the head "Hours (Local)", a wheel spin to 12:00 local settles on the UTC hour /calendar/2026-11-18/17, reload keeps Local pressed and the drums local. All four steps pass.

## The header has defined placements (Nov 20, Elara)

Darren: the folder header moves with the time selection; give it defined placements. Measured in local Chrome (`~/workspace/katie-shots/check-header-geometry.cjs`, three states: UTC 16:00 with 2 recorded, Local 11:00, UTC 17:00 with 0 recorded): the caption, back link, switch, snapshot and did label are pixel-identical in every state — the ONLY thing that moved was the moment box, 249px wide in UTC and 264px in Local, because it hugged its text and "Moment (Local)" is two chars longer. Fix: `.cursor-display` is now a fixed `width: 38ch` with `white-space: nowrap` (longest moment string is 32 chars), `flex-shrink: 0` in the row, so the box and the switch beside it never move. Re-measured: 274px in all three states. The time-travel view's moment box gets the same fixed width. Layout widths can't be asserted in jsdom, so the pin is verified by the geometry script, not the suite.

## Tests

463 pass (452 before). `util/timezone.test.ts`: the translator, New York
cases incl. the date shift and DST, plus `localToUtc` (round-trips,
spring-forward and fall-back). `views/calendar-face.test.ts`: the switch end
to end (UTC default, flip to local and back, past-midnight moment) and the
snapshot's local hour; the drums follow the switch (local heads and labels,
hour links naming the UTC hour, a local spin settling on its UTC hour, the
past-midnight day on the drums, the zone holding across mounts).

## The folder log is a grid (Nov 20, Darren)

Darren: the rows and columns distort because some words are longer than others; make it cells, like Excel / Explorer. Both lists (DID, BELIEVED) are now one `<table>` each (`src/views/entry-grid.ts`, called through `renderEntryLog` in `calendar-entries.ts`). Columns, in order: Time | KID | Subject | State | Authority | Evidence | Reason. `table-layout: fixed`; a value longer than its column scrolls sideways inside its cell (`.cell`: `overflow-x: auto`, `white-space: nowrap`, fixed height), so no cell, row or column moves. Headers are `<button>`s in `<th scope="col">` with `aria-sort`; click sorts, click again reverses, the sorted header shows ▲ / ▼. KID and Authority sort as numbers, Time by the start instant (an unreadable time sorts last), the rest alphabetically; ties keep record order. Each list sorts on its own. The grip on a header's right edge resizes: the column takes width from its right neighbour, the total never changes, nothing goes under 4ch; the drag listens on `window` (pointer capture is tried, and ignored if it throws). Sort only, no filter.

Final widths (ch, in column order): **10, 6, 25, 10, 4, 37, 45**. These are the order's widths with Subject, Evidence and Reason each +1ch: the cell's padding is 8px (about 1.1ch at 12px mono, ch = 7.2px), and without it the longest live values (subject 23, evidence 35, reason 43 chars) clipped by under 1px. Time 10 holds HH:MM:SS, State 10 holds CANDIDATE (9), KID 6 holds a 4-digit number. The Authority header reads "AUTH" at 4ch (the label clips; the digit fits).

The folder is wider than the columns at 1920: 1348px, about 187ch. The table is `width: max(100%, 137ch)`, so at 1920 it is exactly the folder's width and each column draws at 1.367× its ch width (the proportions hold; the resize converts pixels to ch at that scale). Where the folder is narrower than 137ch (1024: 569px, 79ch), the table keeps its ch widths and its wrap scrolls sideways inside the folder; the page never scrolls.

Sort and widths are held in module memory per list: they last for every hour opened in the page, and a fresh load (or reload) starts over at record order and default widths. The order said sessionStorage "like the zone switch", but sessionStorage survives a reload, and A5 asks a fresh load to reset, so memory is the one that meets both. Darren can switch it to sessionStorage if a reload should keep the sort.

Page-scroll fix found on the way: the left column's 27 subject folders each carry an absolutely positioned `.sr-only` heading whose containing block was `.shell`, so they pushed the document to 4504px tall at 1920. `.left-folders` is now `position: relative`, which keeps them inside the left column's scroll box (page scroll 0).

Verified Nov 20 in local headless Chrome against the live connector (27 seed entries, hour 2026-11-20 23:00, believed list at 2026-11-21 00:00), `docs/folder-grid-proof/grid-geometry.mjs`, results in `geometry.json`:
- 1920x1080: columns 98.4 / 59 / 246 / 98.4 / 39.3 / 364 / 442.8 px, table 1348 = folder 1348, no cell overflowing, rows 27px (the last row 26.5, no bottom border), page scroll 0.
- A value made 101 chars long: it scrolls in its cell (scrollWidth 735 in 443), every column and row unchanged.
- KID header: ascending 1..27, again descending 27..1, aria-sort follows.
- Subject|State edge dragged 43px right: Subject 25 → 29.4ch, State 10 → 5.6ch, table 1348; dragged 800px left: Subject stops at 4ch, State 31.
- Back to the day, open 23 again: sort and widths held. At 00:00 the believed list is still record order. Fresh load: record order, default widths.
- 1024x768: table 986px in a 569px wrap that scrolls sideways; page scroll 0.

Proof shots: `docs/folder-grid-proof/01`–`06`.

Review (Sage, ready to merge): a drag now stops if its table leaves the page mid-drag; a clipped header label shows an ellipsis and its full name on hover. Keyboard resize was not asked for and is not built.

Tests: 485 pass (463 before). `views/entry-grid.test.ts`: every column sorted both ways, KID 2 before 10, ties and unreadable times, the header row and its labels, widths in ch, cells, click sort and reverse with aria-sort and arrows, the KID link through a sort, the two lists apart and held across a new hour, a fresh load, the resize (pair sum, 4ch floor, window-level move/up, a capture that throws, a table removed mid-drag).

## The left-column folders are compact, one line each (Nov 20, Darren)

Darren: the subject folder cards are comically big, and the loose wrapping makes every one look different. Measured Nov 20 (live, 27 seed entries, 1920x1080): the left column is 208px wide; every card was 144px tall (head 56px with the name breaking mid-word to 2 lines, authority box 84px with the label on 2 lines); the list ran 4096px with 5 cards visible. The name broke at a different place in each card (`overflow-wrap: break-word` on the head link), and the count and badge landed wherever the text ended.

Fix (Elara, direct, on the branch): the head is one line — the name ends in … with the full name on hover (`title`, set in `shell/left.ts`), the count and badge sit in fixed slots. The authority box shrinks: value 2.25rem to 1.5rem, label and history one line each with … and the full text on hover (`title`, set in `shell/subject-folders.ts`), tighter padding and gaps. Nothing removed: name, count, badge, value, label, history and the 9-cell meter are all still there. Measured after, same setup: every card 84px (head 24px, box 56px), the list 2476px, 9 cards visible, no page scroll. Suite 486 (one new test: the head link and the history carry their full text as `title`).

Note: with the names ellipsised, all 27 read "frankens…" at a glance — the shared prefix fills the line and the number that tells them apart is the part that clips. The full name is on hover. Darren's call whether that stands.
