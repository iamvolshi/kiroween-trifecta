# OCME-012: splash story proof

## What changed

The first-load screen was a bare spinner ("Loading the record…") that
said nothing about the app while the record service woke. It is gone.
The app now opens on a splash story that introduces it, and nothing
in the splash waits on, checks, or mentions the backend. The loading
modal, its CSS and its tests were deleted.

## The three versions (Nov 28)

1. **v1 — bullets.** Opened on a bullet list of what the app does
   (11 apps, three personas, ask or attach a repo, file + record ID).
   Darren: "thats a shitty fucking opening... this is the goddamn
   app annoucement, the first thing the user sees." A catalog is not
   an announcement.
2. **v2 — announcement.** Opens on "Never lies." with three short
   lines, in Darren's own words from the app's tagline. The detail
   moved to the beats. Darren then rejected the 3-second advance:
   "three seconds is too fast... feels rushed."
3. **v3 — timing from the UX notes.** Nielsen Norman Group's rule
   for auto-advancing slides is one second per three words, and
   their study shows a 5-second rotation made a shopper miss the
   offer she was looking for. Smashing Magazine: 5–7 seconds for a
   short heading, longer for text-heavy slides. The screens run 23,
   24, 16 and 29 words, so each screen gets its own duration:
   8, 8, 8 and 10 seconds. The 11-app beat keeps the 8-second floor
   even though its word count says 6, because eleven unfamiliar
   names need absorbing. Click to enter is the stop control
   (WCAG 2.2.2): the loop never traps anyone on a screen.

## v4 — the card, not the copy (Nov 28)

Darren, on the v3 look: "doesnt look good." The copy and the timing
were approved; the card was the problem. What was weak: the card was
wide for its short lines, so the text floated in the middle with dead
space on both sides; the HACKENSTEIN eyebrow was nearly invisible at
9px muted; the enter button was a thin quiet outline; everything
centered made it a generic dark modal instead of an announcement.

What changed, copy and timing untouched: the card is left-aligned
and narrower (30rem), the spacing tighter, the eyebrow up to 11px, a
rose rule across the top of the card, and CLICK TO ENTER is now a
filled button, dark text on light, so the way in is the loudest
thing on the card. The type is the same as v3: Space Grotesk
headline, Geist lines, JetBrains Mono enter, no Arial anywhere.

Local proof shot of the new card (same CSS, same fonts) is
`splash-look-left-aligned.png` in this folder.

## v5 — it opens on what it is (Nov 28)

Darren: "it should start with what it is," then dictated the
opening: HACKENSTEIN / 11 APPS SEWN TOGETHER / 3 FRANKENSTEIN
MONSTER PERSONAS / 1 INCREDIBLY USEFUL APPLICATION. The first
screen is now exactly that, the identity stack shouting in caps.
"Never lies." and its three lines move to the first beat, so the
promise follows the identity instead of leading it. The screens
are now one SPLASH_SCREENS list (identity, promise, three beats),
one duration each: 8, 8, 8, 8 and 10 seconds under the
one-second-per-three-words rule (12, 22, 24, 16 and 29 words).
The card, the type and the timing rule are otherwise untouched.

Local proof shot of the new opening is
`splash-look-identity.png` in this folder.

## The screens (final)

- Announcement (8s): "Never lies." / "Ask Frankenstein's monster
  anything." / "Every answer carries the file and the record behind
  it." / "When it doesn't know, it says so."
- Beat 1 (8s): "Three Frankensteins to talk to: the book (1818), the
  1931 film, Young Frankenstein (1974). Or attach your own GitHub
  repo and ask about that."
- Beat 2 (8s): "Eleven apps work the record: ERIE, KATIE, ELLE,
  ARCHE, SHERLOCK, PEEP, RATR, CURATOR, WATSON, ROSIE, TEMPE."
- Beat 3 (10s): "It learns lessons and develops identity through
  use. Everything it says is written to the record, with the file
  and the moment behind it. That is the whole point."
- The loop closes on the announcement and repeats. CLICK TO ENTER is
  always visible and enters at once.

## Tests

- 676 tests pass, `tsc` clean, build clean.
- The splash tests pin: the announcement first; each screen stays up
  at least one second per three words (the rule itself, computed from
  the copy); the loop opens and closes on the announcement; a longer
  screen stays up longer than a short one; enter removes the splash
  at once and stops the loop; nothing mentions the backend waking or
  loading; the splash shows at boot, stays up while the record read
  is pending, does not go away when the record settles, and stays up
  when the record read fails.

## Live proof (Pages preview)

- v1: live index served `index-DLL1meun.js`, which contains
  "CLICK TO ENTER". Browser check on Darren's Chrome: first screen
  the bullet list word for word, second screen the record beat,
  CLICK TO ENTER on both, clicking it showed the chat.
- v2: live index served `index-BrUpRHWi.js`, which contains
  "Never lies". Browser check: first screen the announcement word
  for word, second screen the 11-apps beat, CLICK TO ENTER on both.
- v3: live index serves `index-C5NX5gOE.js`. Browser check
  (Nov 28, 9:36–9:39 AM EST): at about 5 seconds the announcement
  was still showing word for word; at about 10 seconds it had
  advanced to the first beat; a further wait showed the 11-apps
  beat, confirming the beats advance in sequence. CLICK TO ENTER
  visible throughout.
- No screen recording: the browser tool captures screenshots, not
  video. The loop is proven by the sequential screenshots above plus
  the tests, which advance the loop deterministically.

## Commits

- `fe1c69c` — splash story replaces the loading spinner (v1)
- `2284d83` — splash opening is the announcement, not the catalog (v2)
- `f5739d9` — splash screens stay up as long as their words need (v3)
- `5e50d9e` — splash set in the display face, Arial out of the app
- `ee9f479` — splash card reads like an announcement, not a modal (v4)
- `6c01e8c` — splash opens on what it is, in Darren's words (v5)
- Branch: `feat/preview-all`. Published to `gh-pages` at `0637ae5`
  (v1), `afdea3d` (v2), `10040c2` (v3), `40ab579` (type),
  `cf08a18` (v4), `d4bae4c` (v5). Live at
  https://iamvolshi.github.io/kiroween-trifecta/chat

## Sources for the timing rule

- Nielsen Norman Group, "Auto-Forwarding Carousels, Accordions
  Annoy Users & Reduce Visibility" (1 second per 3 words; the
  5-second carousel study):
  https://www.nngroup.com/articles/auto-forwarding/
- Smashing Magazine, "Designing A Better Carousel UX" (5–7s for a
  short heading, longer for text-heavy slides; 8–12s when a slide
  carries more than five words of text):
  https://www.smashingmagazine.com/2022/04/designing-better-carousel-ux/
- WCAG 2.2.2 Pause, Stop, Hide: moving content lasting more than
  five seconds needs a pause, stop or hide mechanism. CLICK TO ENTER
  is the stop control here.
