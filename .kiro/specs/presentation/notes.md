# Presentation round -- visual identity notes (decided 2026-11-17)

Direction: Darren's brief "build the face the way the reference presents
it", carried over IN WORDS only. No Stitch file was opened by the builder;
nothing from it is in the repo. Every rule below is written fresh against
our components.

Scope held: CSS plus presentational markup hooks. No adapter, scenario,
router, seam or data-flow change. No new dependency, no web font, no icon
font, no network fetch.

## Palette (deep blue-black instrument)

Depth comes from planes and 1px lines, never shadows or blur. Corners are
near-sharp (`--radius: 2px`) on panels, cards, chips and buttons.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#060a11` | canvas |
| `--panel` | `#0a111b` | side columns, header strip |
| `--surface` | `#0f1825` | cards |
| `--surface-2` | `#152132` | raised / hover / table heads |
| `--inset` | `#08101a` | WHY/EVIDENCE inset, empty states, inputs |
| `--line` / `--line-strong` | `#1b2738` / `#2c3c55` | hairlines |
| `--text` | `#e4ecf7` | primary text |
| `--muted` | `#9fb1c8` | secondary text, metadata |
| `--faint` | `#8698b2` | captions, labels |
| `--accent` | `#38d1f5` | signal: active, live, links, focus |
| `--warn` | `#ffb648` | warning: revised / contradicted / rejected, "did" rule |
| `--ok` | `#3ddc97` | good: confirmed, learned, injected |
| `--error` | `#ff7d7d` on `--error-bg #2a1013` | errors |
| `--mock` | `#ffd23f` fill, `#14110a` text | MOCK DATA only: the only yellow |

Engine chips are no longer coloured per engine: four extra hues broke the
"colour means something" rule. Engines are told apart by their name chip.

## Contrast (WCAG 2.x, computed)

Every text colour on every plane, worst first. AA needs 4.5:1. All pass.

| Text | bg | panel | surface | surface-2 | inset |
|---|---|---|---|---|---|
| text | 16.65 | 15.91 | 14.98 | 13.62 | 16.05 |
| muted | 9.06 | 8.65 | 8.15 | 7.41 | 8.73 |
| faint | 6.75 | 6.45 | 6.07 | **5.52** | 6.50 |
| accent | 10.96 | 10.47 | 9.86 | 8.96 | 10.56 |
| warn | 11.36 | 10.85 | 10.22 | 9.29 | 10.95 |
| ok | 11.22 | 10.72 | 10.09 | 9.17 | 10.81 |
| error | 8.01 | 7.65 | 7.20 | 6.55 | 7.72 |

Tinted chips: accent on accent-bg 8.44, text on accent-bg 12.83, warn on
warn-bg 9.40, ok on ok-bg 8.74, text on ok-bg 12.98, error on error-bg 7.18,
MOCK text on yellow 13.05. Muted on accent-bg 6.98, faint on accent-bg 5.20,
muted on accent-bg-hover 5.50, text on accent-bg-hover 10.11. Worst pair
overall: faint on accent-bg, 5.20.

## Type roles (system stacks only)

- **Display** `system-ui, 'Segoe UI', Roboto, ...`: the view question
  (26px, 800, uppercase, tight), card headlines (16px, 700).
- **Body** `ui-sans-serif, system-ui, ...`: sentences (13-14px).
- **Mono** `ui-monospace, 'Cascadia Mono', Consolas, ...`: every machine
  value (KIDs, times, authority, evidence, ids) and every label, chip and
  caption: 11px, 700, uppercase, +0.1em ("mono caps").

## Density

4px rhythm (`--s1`..`--s5` = 4, 8, 12, 16, 24). Card padding 12/16, card gap
8. Below 1100px the side columns narrow (11.5rem / 15.5rem) and padding
drops to 12. Below 1300px the hour tables wrap headers and shrink cells.

## Treatments

- **Header strip**: product name, the product question, a seam chip stating
  the adapter in words (from `ACTIVE_ADAPTER_KIND`; the square is its
  active marker), and "View: <name>" read in CSS from the mounted view's
  intro `data-view`. No numbers appear in the strip.
- **View intro**: every view's h1 becomes a mono-caps eyebrow, followed by
  the question in display type and one plain "how to read this" line
  (`views/intro.ts`). Existing h1 text is unchanged.
- **Record card** (`views/record-card.ts`, `styles/record-card.css`), one
  skeleton everywhere it shows entries (action list, belief pool, chain,
  record view): chips (authority + state, state coloured by meaning), the
  headline (subject: state), one mono meta line (KID . subject . live
  from), an inset with WHY and EVIDENCE, a foot with times and, on linked
  cards, "Inspect". The hour view keeps its tables from the last round.
- **Decision: the skeleton fills each card from its own entry.** The order
  (item 6) asks every card to carry the same parts: authority + state chips,
  a headline, the meta line, WHY and EVIDENCE, times. So cards now show
  fields of the SAME entry that some views did not print before. Nothing is
  added from outside the entry, no entry is added or dropped, and list order
  (newest first / oldest first / k_start) is unchanged. Per view:

  | View | Fields before | Added by the skeleton |
  |---|---|---|
  | Action List | kid, subject: state, authority, k_start, t_time, e_time, k_time | state chip, subject in meta, reason (WHY), evidence |
  | Time Travel pool | kid, subject, state, authority, evidence, reason | headline (subject: state), k_start (live from), k_time (live until) |
  | Entry Detail chain | state, authority, k_start, reason | headline, evidence, k_time |
  | Record view | kid, state, authority, evidence, k_start, k_time | headline (subject: state) |

  Field ORDER inside a card follows the skeleton (chips, headline, meta,
  inset, foot) rather than the old flat order; that is the point of one
  skeleton. Every class hook the views and tests use is kept.
- **Not-knowing**: empty states are dashed inset boxes captioned "NOT
  KNOWN"; prompts are captioned "WAITING FOR INPUT"; errors "ERROR". The
  sentences are unchanged.
- **Kept**: three-column shell, folder number tiles with 9-cell meters
  (cell 9 hatched), MOCK block top-left, lesson grey / green / outlined.
