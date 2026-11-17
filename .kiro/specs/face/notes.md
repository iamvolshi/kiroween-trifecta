# Face pass -- visual identity notes (decided 2026-11-16)

Direction (Darren, in words): a dark, dense telemetry cockpit. Dense with
information, every number real derived data, clear hierarchy. Written fresh
from that direction. NO Stitch material of any kind: no exports, CSS,
assets, screenshots or copied values.

Scope held: CSS plus presentational markup hooks only (classes, `data-`
attributes, aria labels). No behavior, adapter, scenario, router or seam
change. No new dependency, no web font, no network.

## Palette (dark)

All text/surface pairs hold WCAG AA (4.5:1) or better; measured ratios are
against the column surface `--panel`.

| Token | Value | Use | Contrast on --panel |
|---|---|---|---|
| `--bg` | `#0a0d11` | page behind the shell | -- |
| `--panel` | `#10151b` | the three columns | -- |
| `--surface` | `#151b23` | cards, folders, rows | -- |
| `--surface-2` | `#1b2330` | hover / raised / table heads | -- |
| `--line` | `#253042` | hairlines | -- |
| `--line-strong` | `#3a4860` | card edges, focus-free borders | -- |
| `--text` | `#e7ecf3` | primary text | ~15:1 |
| `--muted` | `#a7b2c2` | secondary text | ~8.8:1 |
| `--faint` | `#8591a3` | tertiary text, captions | ~5.8:1 |
| `--accent` | `#5cc8ff` | links, current place, focus ring | ~9.6:1 |
| `--ok` | `#63d795` | learned / promoted | ~10:1 |
| `--error` | `#ff7a7a` | error text (on `--error-bg #2a1416`) | ~6.9:1 |
| `--mock` | `#ffd23f` fill, `#14110a` text | MOCK DATA label | ~13:1 |

Engine identity (label chips only, so a glance tells which engine acted):
ARCHE `--eng-arche #5cc8ff`, ERIE `--eng-erie #c9a2ff`, ELLE `--eng-elle
#63d795`, KATIE `--eng-katie #ff9e6b`. Each used as text on a dark chip,
contrast >= 7:1.

## Type

System stacks only (no download): sans `ui-sans-serif, system-ui, "Segoe
UI", Roboto, sans-serif`; mono `ui-monospace, "Cascadia Mono", Consolas,
monospace` for ids, KIDs, timestamps, hashes, evidence values.

Scale (px): 11 caption (uppercase, +0.08em, weight 600) / 12 meta / 13 dense
body / 14 body / 16 card title / 20 view title / 34 the folder number. All
numerals tabular.

## Spacing and density

4 px grid: 4, 8, 12, 16, 24. Cards pad 12. Columns pad 16. Row gaps 8.
Columns are full viewport height and scroll on their own (cockpit: the
three panes stay in place). Below 1100 px the right column narrows; below
800 px the shell stacks into one column and scrolls as a page.

## Treatments

- **Shell header**: one strip across the top, wordmark "Audit UI" and the
  product question. No logo artwork.
- **Columns**: each starts with a caption (from its `aria-label`):
  Directories / the view's own h1 / Telemetry. Columns separated by
  hairlines, not gaps, so it reads as one instrument.
- **MOCK DATA**: solid yellow block at the top of the left column, dark
  text, full column width. It is the only yellow in the app.
- **Folders (right column)**: card with the subject in mono, and the 0-9
  number as a 34 px tile on the folder's left. Under it a 9-cell meter
  (cells 1-9; 0 = no cell filled) filled up to the value; cell 9 is
  hatched and captioned as held for the user (machine ceiling 8). The
  meter is drawn from the same number (`data-authority`), never from
  anything else. History (`6 -> 7`) in mono beside it.
- **Lessons**: candidate = grey, dashed left rule, "not learned yet";
  promoted = green left rule, "learned"; injected (chat) = green outline.
- **Chat turns**: the user's line as a header, ARCHE's reply as body, then
  an engine grid: chip + what it did. An engine that did not act is dimmed
  (`engine-idle`), still listed, so not-acting stays visible.
- **Record rows** (action list, belief pool, chain, calendar, record view):
  dense grid cards with uppercase captions per field; mono for ids/times.
- **Badges**: authority inside record rows as a small mono chip.
- **States**: empty = dashed border, muted; prompt = dotted; error = red
  left rule on a dark red ground, prefixed "Error:".
- **Focus**: 2 px accent ring on every focusable element (`:focus-visible`).
- No motion, no glow, no decoration pretending to be function.
