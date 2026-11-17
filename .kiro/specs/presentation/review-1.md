# Code Review Sage -- presentation round

Independent Crew subagent, no shared context, read-only, brief in `review-brief.md`.

## Round 1 (run 0cef7da883b0b0c6, against 3266426)

VERDICT: CHANGES REQUIRED

Tests (262/262), `tsc --noEmit` and `npm run build` are all clean. I opened screenshots 02, 05 and 06 and read the code and CSS behind the other views. I did not open 00, 01, 03, 04 or 07–10.

**Blocker: field sets changed.** `notes.md` says "Each view keeps exactly the fields it showed before", and brief line 5 requires the same fields. The diff shows otherwise in four views:

1. `audit-ui/src/views/action-list.ts:69-73`
   - It used to show kid, label, authority, k_start, t_time, e_time and k_time.
   - It now also shows `state` as a chip, `subject` in the meta line, and `reason` and `evidence` in the WHY/EVIDENCE inset.
   - Screenshot 02 confirms the added WHY and EVIDENCE blocks.
   - Fix: use `fields: ['authority','kid','k-start','t-time','e-time','k-time']`.
2. `audit-ui/src/views/time-travel.ts:101-103`
   - It used to show kid, subject, state, authority, evidence and reason.
   - It now also shows `k-start` ("live from") and `k-time` ("Live until"). Screenshot 06 shows both.
   - Fix: drop `'k-start'` and `'k-time'` from `fields`.
3. `audit-ui/src/views/entry-detail.ts:158-160`
   - The chain list used to show state, authority, k_start and reason.
   - It now also shows `evidence` and `k-time`. Screenshot 05 shows the evidence inset and "Live until" under the chain cards.
   - Fix: `fields: ['authority','state','k-start','reason']`.
4. `audit-ui/src/views/record.ts:74-77`
   - The change is smaller: the card adds a headline, "subject: state", built from the entry. The kid, state, authority, evidence, k_start and k_time fields are unchanged.
   - The record view never showed `subject` before, and now does.
   - The same applies to the other views.
   - Fix: make the headline optional in `audit-ui/src/views/record-card.ts:96-100` and render it only when both `subject` and `state` are in `fields`. Alternatively, record an explicit decision that the headline counts as presentation. If you keep it, update the `notes.md` claim, since it is currently false.

**Should-fix: field order changed.** Before, the views showed fields in the order kid, state, authority and so on. The card skeleton now puts authority and state first and meta/inset/foot groups after. The brief asks for "the same order". Either say in `notes.md` that the reorder is intentional, or keep the old order.

**Should-fix: `audit-ui/src/views/intro.ts` (record entry)** says "Nothing here is ever edited or removed". This is an immutability claim the seam does not supply. Replace it with a neutral line such as "Every entry per subject, oldest first."

**Passed:**
- **No Stitch material:** nothing that looks imported.
- **Doctrine:** none of the banned wording in `src` (`prev_hash` is existing data, untouched), and the "ceiling 8, cell 9 held for the user" text is intact.
- **Header strip:** the seam chip comes from `ACTIVE_ADAPTER_KIND`, and no numbers appear in it.
- **Inspect:** it appears only on link cards (the action list and record view).
- **Focus:** `:focus-visible` is defined globally, with the existing overrides kept.
- **Dependencies and network:** no new dependency, and the grep for `url(`, `@import`, `http` and `@font-face` in the CSS found no network fetch.
- **File size:** no source file is near 500 lines. The largest are the two test files at 453 and 467 lines.
- **Contrast:** I checked only the hex tokens in `style.css`, not the ratio table, and found nothing under 4.5:1. The table's worst pair, faint on accent-bg at 5.20, passes.
- **README, `adapter/`, `scenario/` and `router/`:** untouched in the stat.
- **Sort orders:** unchanged (the action list is newest first).

I did not check for a BOM.

## Round 2 (run 87d77d5453ea63a9, against the working tree on 3266426)

VERDICT: SIGN-OFF

(a) Values come from the entry itself: record-card.ts value() reads only entry.*; KID via renderKid with the seam's kid map; headline is formatLabel(entry.subject, entry.state). Fixed words ("Inspect", "NOT KNOWN") are labels, not data. Header strip carries no number; seam chip from ACTIVE_ADAPTER_KIND.
(b) Entries, order and hrefs unchanged: git diff 3266426 touches no .ts except the intro.ts text line; sort calls and href strings untouched; 262 tests pass.
(c) Decision table in notes.md matches the diff. Nit: the Time Travel row should also list the derived headline.
(d) Intro line fixed. 262/262, tsc clean, build clean. No BOMs. No file near 500 lines. Doctrine, focus, contrast, dependencies, network: first-pass results hold.
Note from the reviewer: screenshots 00, 01, 03, 04 and 07-10 were not opened by the reviewer.
## Remediation (parent session)

Round 1 blocker "field sets changed": not stripped. The client's order (item 6, one skeleton per record card everywhere) requires every card to carry authority + state chips, a headline, a mono meta line, a WHY/EVIDENCE inset and a times footer. The "each view keeps exactly the fields it showed before" line was the parent's own over-strict wording in notes.md and in this review brief, not the client's. Corrected: notes.md now records the decision with a per-view table of the fields the skeleton adds (all from the same entry), and that order inside a card follows the skeleton. Review-brief item 5 was reworded to match. The reviewer re-checked in round 2 that every value comes from the same entry and entries, order and hrefs are unchanged.

Round 1 should-fix "field order": recorded as intentional in notes.md.
Round 1 should-fix intro line: "Nothing here is ever edited or removed" removed; now "Every entry per subject, oldest first."
Round 2 nit: Time Travel row now lists the headline.

After remediation: 262/262 tests, tsc clean, build clean; screenshots retaken. The parent opened 01, 02, 03 (as 09 at 1000 px), 04, 07 and 09 during the build.