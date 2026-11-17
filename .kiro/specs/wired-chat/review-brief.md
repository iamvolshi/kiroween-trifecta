# Code Review Sage -- review brief, wired chat round

Review EVERY change in the working tree of `D:\kiroween-trifecta\kiroween-trifecta`
(branch `feat/wired-chat`) against base `e3e1ac0`: `git diff e3e1ac0` plus
untracked files. Decisions: `notes.md` in this folder. New doc:
`docs/assembly-parts.md`. Screenshots from the production build (headless
Chrome, 6 chat prompts played in-page as Frankenstein) are in
`docs/wired-chat-proof/`.

## The order, in short

1. Chat is a normal chat: user bubbles right, persona replies left, composer
   pinned at the bottom with a real (visually hidden) label. The four-engine
   grid and the provenance list are GONE from the chat. Kept: mock note,
   step progress, error slot + MED-1 (a throwing adapter shows an error and
   Send comes back), sr-only speaker labels naming the ACTIVE persona (never
   "ARCHE replied:"), the not-knowing treatment.
2. Persona picker: Frankenstein / Elara / ARCHETRON as real buttons with
   radio semantics, keyboard reachable, visible focus; REQUIRED before the
   first send (composer disabled, words say so); no default; stays visible;
   switching changes later replies' attribution.
3. Book / Movie switch only for Frankenstein, default Movie, radio
   semantics; sends the register NAME on the live path only.
4. Live adapter: real rough HTTP client against one base URL; typed "not
   wired" errors when unset. Contract: POST /chat {message, persona,
   register?} -> ChatTurn with responder-authored link spans; GET
   /record/{id}, GET /lessons, POST /ask. Link spans render as links; activating
   one highlights the matching feed item through a NAMED channel, focus
   stays, route never changes, missing target breaks nothing.
5. Subject folders move to the LEFT column under groups from the record data
   (no hardcoded project name). Right column = one activity feed, one
   sentence + small engine tag per ERIE / ELLE / KATIE event, newest first,
   no ARCHE, heading keeps "(mock)", stable data attributes, empty state.
6. `docs/assembly-parts.md`: parts + where each lives + the contract, no
   invented claims.

## Hard lines -- check each

- NO-MOCK RULE: `audit-ui/src/scenario/` untouched; `adapter/mock.ts` and
  `adapter/mock-assembly.ts` untouched; no scripted replies, voice
  variants or span annotations anywhere. Picker/switch/links proven with
  stub adapters only.
- No router changes. Action List, Time Travel, Entry Detail, Calendar,
  Record views, filters, collapse untouched. README / disclosure untouched.
- No engine code, cartridge prompts or register prompts in the repo.
- Doctrine untouched (ceiling 8, KID is a number, no hash-chain/signature/
  Merkle claims, no revert/snapshot, no "Kiroween Identifier Keys"). No
  Stitch material. No new dependency. No file over ~500 lines. No BOM.
- Tests that asserted the removed engine grid / right-column folders were
  rewritten, not deleted silently: check `views/chat.test.ts`,
  `shell/telemetry.test.ts`, `shell-integration.test.ts` still prove the
  6-prompt held / promoted / injected flow end to end.
- Security: replies, spans and feed text rendered via textContent / text
  nodes only; span offsets validated; the provenance link stops the
  router's click handling without breaking other links.
- Contrast of new text on its surfaces (tokens in
  `.kiro/specs/presentation/notes.md`).
- Tests all pass, tsc clean, build clean (run them).

## Rules

READ-ONLY: edit nothing, no state-changing git. You may run `npx vitest
run`, `npx tsc --noEmit`, `npm run build` from `audit-ui/`.

## Output

First line `VERDICT: SIGN-OFF` or `VERDICT: CHANGES REQUIRED`. Then findings:
severity (blocker / should-fix / nit), file:line, problem, concrete fix.
