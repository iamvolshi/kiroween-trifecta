# Stitch exact face: type, spacing, shell

The visual direction took cues from a reference mockup (Stitch, Nov 18). The
values were measured from its export; the code is written fresh. Behaviour is
unchanged and every view still reads live data only.

## What changed

- `audit-ui/index.html`: preconnect links plus one Google Fonts link for Geist,
  JetBrains Mono and Space Grotesk.
- `src/style.css`: surface ramp, outlines, colours, radii (4/8/12px) and the
  eleven type roles as `--t-<role>-size/-lh/-ls/-wt` tokens. The old `--fs-*`
  size roles are gone; every `font-size` in the CSS reads a role.
- `src/styles/shell.css`: grid 16rem / 1fr / 20rem, 56px header, column
  headings label-sm in the outline colour with a bottom border, nav label-md,
  active item surface-2 / primary / 2px cyan left border.
- `src/styles/stitch-system.css` (new, loaded last): sticky chat view bar with
  a pinging dot, mask cards (MASK code chip, name in headline-lg), grounding
  box, composer in telemetry-data, user bubble surface-2 with a shadow, KID
  chip #ea9f00 / #5b3b00, model band p-4 with a large shadow, telemetry heading
  with a cyan square, feed cards p-2 on panel, feed text telemetry-data.
- `src/views/mask-cards.ts`: a "Grounding position" label on Frankenstein's
  book/movie positions.
- Other views inherit the tokens only.

## Font link: one deviation from the order

The ordered link asked for `wght@100..900` on all three families. Google Fonts
answers 400 Bad Request for that URL, so no family loads at all. Space Grotesk
only has 300–700 and JetBrains Mono only 100–800. The link uses each family's
real range:

`family=Geist:wght@100..900&family=JetBrains+Mono:wght@100..800&family=Space+Grotesk:wght@300..700&display=swap`

Checked: that URL returns 200 and headless Chrome reports all three families
loaded.

## Role mapping (old size scale onto the roles)

| Old use | Role |
|---|---|
| mono caption | label-md |
| mono meta, caps | label-lg |
| mono meta, dense, body | telemetry-data |
| mono title | label-lg |
| display title | headline-sm |
| sans caption, meta | body-sm |
| sans dense, body | body-md |
| sans title | body-lg |
| view heading | headline-xl |
| 22px literal | headline-lg |
| 34px literal | headline-xl |
| 24px literal | headline-xl-mobile |
| `h2`, `.caps` | label-sm |
| `.shell-center h1` | headline-sm, primary |

## Band placement

The model band stays inside the sticky composer instead of a fixed bar from
left 16rem to right 20rem. It occupies the same place on screen and keeps
scrolling and focus behaviour unchanged.

## Not built (per the order)

Invented numbers (FPS, tokens, session, checkpoint, T-minus, SHA-256, commit,
KID-88xx); Merkle, signatures, rollback, wss, vector drift; feed timings,
belief graph, runtime strip, SEAM RUNTIME, Checkpoint Diffs; KATIE_CORE chip,
nav ordinals, "READY // ARCHE CORE", avatar, "AUDIT OPERATOR", message
timestamps, "DELIVERED VIA RUNTIME BUS", checkpoint banner, feed footer; the
stale Elara unconfigured state; voice.

## Known limits

- 9px label-sm text is small at 1440 wide; it stays legible in the proof
  shots.
- "Lessons without a subject" in the left column is a sub-heading inside
  RECORD, not a column heading, so it keeps its own size.

## Tests

`src/stitch-system.test.ts`: font link with three families, the eleven roles
exact, ramp and outlines, shell 16/1fr/20 with a 56px header, mask name
headline-lg, feed text telemetry-data, headings label-sm, rendered classes.
The unreachable state on every view stays covered by `no-connector.test.ts`.
353 tests pass (baseline 334). tsc and build clean. No new dependencies.

Proof shots: `docs/stitch-exact-face-proof/` (stub connector, port 8799).
