# Calendar face (desktop): notes

The visual direction took cues from a reference mockup: the Nov 18 Stitch
export (`calendar_tiered_scrubber_rail_knowledge_state`, inventory #3; and
`calendar_refined_scrubber_rail_interaction_states`, #2, for the hover,
wheel and lock states only). Stitch drew the face; the code is written
fresh. The rail is the founder's own design. Behaviour is unchanged: month
-> day -> hour, same routes, same endpoints. Live data only.

Base: `main` at `2a5fbd2`. Branch: `feat/stitch-calendar`.

## What changed

| Part | Change |
|---|---|
| Palette (`style.css`) | bg `#111318`, canvas `#0c0e13`, panels `#1a1b21` / `#1e1f25` / `#282a2f`, text `#f3f4f6` / `#9ca3af`, accent `#00f0ff` (`--accent-dim` `#00dbe9`), amber `#ffbd58`, borders `rgba(255,255,255,0.08)`; radii 0.25 / 0.5 / 0.75rem |
| Fonts | Space Grotesk / Geist / JetBrains Mono lead the stacks; used when installed, nothing downloaded (no new dependency) |
| Month grid | the day dot is now a heatmap cell: `data-heat` 1-4 = the day's live count over the month's busiest day (`daysWithEntries`); the count shows in the cell; empty days unmarked |
| Day view | the 24 hours as rows; `(n)` only where n > 0 |
| Hour view | NEW knowledge-state panel above the two tables: "Knowledge state at HH:00 UTC (hour #HH record closure)", the order's line, and three live counts: recorded this hour (= the "did" table), live at this moment (= the "believed" table), masks named in the hour's entry reasons |
| The rail (`views/calendar-rail.ts`, `util/rail.ts`) | beside the calendar: Tier 1 quarters, Tier 2 ISO weeks of the quarter, Tier 3 days of the week, Tier 4 the 24-hour strip (built once). Only periods present in the loaded entries; a tier with nothing says NOT KNOWN. Tick height follows the live count. Hover darkens and lifts a tick; the hovered tier gets the cyan focus border; the wheel moves the hovered tier only; clicking an hour tick opens the same `/calendar/YYYY-MM-DD/HH` as the day list |
| Left column | Going back: Calendar Index and Time Travel |
| Intro | "Shaded days have record entries; the darker, the more. Open a day, then an hour, or use the rail." |

## Decisions

- `--faint` is `#878d99`, not the mockup's `#6b7280`: that grey is under
  4.5:1 on `#111318`.
- The type scale keeps the app's 11px minimum for labels, except the rail's
  tick labels (9px, as in the mockup), which repeat the tick's aria-label.
- Tier heads use the mockup's shape with live words: "entries", not
  "commits"; "Active" only when an hour is locked; no "current epoch".
- The rail stacks under the calendar when the center column is under 48rem
  (container query on `.shell-center`).

## Known limit

The masks stat reads the hour's entry REASONS, as ordered. Live loop
reasons are "user turn (connector)" / "assistant turn (reply)": the mask's
name is in `evidence`, not `reason`. So on live data it reads "None named"
until reasons carry names, or the rule reads evidence instead.

## Not built (mockup inventions)

Merkle / SHA-256 chips, hash seals, quorum votes, signatures, proof export,
rollback, wss handshakes, vector drift; every invented number (FPS, actions,
tokens, session, checkpoint, T-minus, payload, commit, KID-88xx/90xx); feed
timings; belief graph; runtime strip; SEAM RUNTIME; Checkpoint Diffs; the
stale Elara unconfigured state; voice.

## Proof

`docs/stitch-calendar-proof/` (stub connector in scratch, values labelled
"stub"): 01 month heatmap with the rail, 02 day rows with Tier 3 hovered,
03 hour view with the knowledge state and the locked hour.

## Tests

332 pass (321 at base): 11 new in `views/calendar-face.test.ts`; the month
test in `views/calendar.test.ts` now checks the heatmap.
