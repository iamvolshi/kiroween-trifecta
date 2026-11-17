# Code Review Sage -- review brief, bug-hunt round 2 fixes

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/bug-hunt-fixes`) against base `f83ea66` (filters merged):
`git diff f83ea66` plus untracked files. Screenshots from the production
build (headless Chrome, 6 chat prompts played first where relevant) are in
`docs/bug-hunt-fixes-proof/`. Open each by its file name.

## The approved scope (Elara's bug hunt, round 2)

Fix exactly these; LOW-2 (end-of-scenario signal) is EXCLUDED pending
Darren's design call. One regression test per fix (`src/bug-hunt-fixes.test.ts`).

- MED-1: chat submit must survive a THROWING adapter: Send re-enabled, an
  error shown (`views/chat.ts`).
- MED-2: card field labels, the chat "You" line and ARCHE replies, and the
  filters no-match caption must carry real text for assistive tech.
  Approach taken: a visually hidden `.sr-only` text node in front of each
  value (`views/record-card.ts` FIELD_LABELS / srOnly, `views/chat-turn.ts`,
  `views/action-list.ts`); the visible CSS captions that repeat that text
  are marked decorative with `content: '...' / ''` so nothing is announced
  twice. Value spans keep pure values (older tests rely on that).
- LOW-1: Entry Detail mounts h1 + intro in `mount()`, so empty / error /
  not-found states keep the heading, the question and the header label;
  the not-found section's heading is now h2 (one h1 per view).
- LOW-3: tab title "Audit UI"; favicon replaced (was the Vite scaffold
  logo) with a plain mark written fresh.
- LOW-4: one switch: `adapter/active.ts` builds the adapter
  (`createActiveAdapter`) from `ACTIVE_ADAPTER_KIND`, which the chrome
  labels already read; `main.ts` uses it. `LIVE_BASE_URL` is empty on
  purpose (no endpoint guessed; the live adapter is still the stub).
- LOW-5: `before()` in `scenario/script.ts` works in milliseconds, so 00:00
  rolls back a day; outputs for every current step are unchanged.
- LOW-6: the header "View: <name>" is set in JS (`setViewLabel` in
  `shell/shell.ts`, called by the router after each mount) from the mounted
  intro's `data-view`; the CSS `:has()` enumeration is gone; no intro ->
  label hidden, never a bare "View:".
- LOW-7: month grid uses thead / tbody and `th scope="col"`.
- LOW-8: skip link, first Tab stop, focuses the center column via JS (no
  hash change, so the router does not re-resolve).

## Check

1. Each fix does what its finding asked, and each has a regression test that
   would fail without the fix.
2. MED-2 in real Chrome (parent's CDP accessibility-tree probe): toggle name
   "KID: 5 parcel-77 (mock) parcel-77.status: revised Authority: 8" (no
   doubled labels); details read "State: REVISED | Subject: ... | Why: ...";
   chat lines "You said: ..." and "ARCHE replied: ..."; no-match "No match:"
   then the sentence. Verify the approach is sound and nothing is read
   twice.
3. No behaviour change beyond the findings: data flow, adapter results,
   scenario values, routes, sort orders, hrefs unchanged. The router change
   is one call (`setViewLabel`). No new dependency (the test reads CSS with
   Node's built-in fs via a dynamic import; no @types/node added).
4. No Stitch material, no invented data, doctrine untouched, README /
   disclosure / live stub untouched, no file over ~500 lines, no BOM.
5. Tests all pass, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
