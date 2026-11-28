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

- 674 tests pass, `tsc` clean, build clean.
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
- Branch: `feat/preview-all`. Published to `gh-pages` at `0637ae5`
  (v1), `afdea3d` (v2), `10040c2` (v3). Live at
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
