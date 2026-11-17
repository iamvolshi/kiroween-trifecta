# Code Review Sage -- review 1 (run 720195170e2859c1, 2026-11-16)

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

VERDICT: SIGN-OFF

Tests, tsc and build all pass, and I found no blocker or should-fix issue. I confirmed the 262/262 test count, a clean `npx tsc --noEmit` and a clean `npm run build` (css 20.6 kB, js 40 kB).

**Constraint check**
1. **Presentation only.** Every `.ts` diff line is presentational.
   - `main.ts` adds a CSS import.
   - `shell.ts` adds a `<header class="shell-brand">` with static strings, plus `aria-label="View"` on `main`.
   - `telemetry.ts` sets `folder.dataset.authority` from the same `latest` value that is already rendered. It reuses the existing number and adds no new data path.
   - `chat-turn.ts` adds the `engine-idle` class when the `.engine-body` text equals the existing `NOT_ACTED` constant. It reads rendered text only and changes no logic.
   - Adapter, scenario, router and seam files are untouched.
2. **No new dependencies, network calls or web fonts.** There is no `url(`, `@import` or `@font-face` anywhere in the CSS. Fonts are system stacks. The meter is drawn from `data-authority` only, and the new strings are static captions.
3. **No Stitch material.** The CSS and notes read as written fresh, with a coherent token system and nothing that looks imported.
4. **Badges and states.**
   - Folder number: a 34px tile, prominent in screenshot 03.
   - MOCK DATA: a full-width yellow block at the top of the left column.
   - Empty and error states: explicit, per `notes.md`.
5. **Contrast and focus.**
   - Contrast: I computed the ratios from the token values. The lowest is `--faint` on `--accent-bg` at 4.66, then 4.95 on `--surface-2`; everything else is 5.4 or higher. The tightest pair that actually appears is the "candidate" lesson text (`--faint`) on `--surface-2` at 4.95. The MOCK label is 13.05, and error text on the error background is 6.87. All text pairs pass 4.5:1.
   - Focus: `:focus-visible` has a 2px accent ring globally, with inset variants for list links. Screenshot 10 shows a visible ring. Nothing uses `display:none`, `visibility`, `outline:none` or `tabindex`, so no focusable element was hidden.
6. **No costume, doctrine untouched.** README, disclosure and the live stub are untouched. No BOM in the ts, css or spec files. The longest file is `audit-ui/src/style.css` at 492 lines, under the ~500 limit.
7. **Tests, tsc, build.** Clean, as above.

**Nits**
- **nit**, `audit-ui/src/styles/telemetry.css:120` and its header comment. The on-screen caption says "Meter cells 1-9", and the meter has 9 cells, but `.kiro/specs/face/notes.md` describes a "10-cell meter (cells 0-9)". Fix: change `notes.md` to say 9 cells (1-9), matching the code and screenshot.
- **nit**, `audit-ui/src/styles/telemetry.css:~113`. The hatched cell-9 lines use `--line-strong`, about 1.9:1 against the surface, below the 3:1 UI-part guidance. The cell is decorative and captioned, and the number itself is in text, so it passes in practice. Fix, if you want strictness: use `--faint` for the hatch lines.
- **nit**, `audit-ui/src/style.css:144`. `button:hover` uses a raw `#14394f` instead of a token. Contrast is fine at 10:1 with the primary text. Fix: add a `--accent-bg-hover` token.
- **nit**, `audit-ui/src/styles/chat.css`, near `.engines .engine-idle`. The `.engine-idle .engine-label` and `.engine-idle .engine-body` rules appear twice in the output. This may be a read artifact, so check for a duplicated block in the file. If it is duplicated, remove one copy. It is harmless either way.

## Remediation (parent session)

- Nit meter cell count: `notes.md` now says 9 cells (1-9), matching code and screenshots.
- Nit hatch contrast: cell-9 hatch uses `--faint`.
- Nit raw hover colour: new token `--accent-bg-hover`.
- Nit duplicated engine-idle block: checked, not duplicated (read artifact). No change.

After remediation: 262/262 tests, tsc clean, build clean; screenshots re-taken.
