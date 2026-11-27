# OCME-011-hack: typewriter sound while typing

Branch `feat/typewriter-sound` off `feat/repo-panel-left` (187364f). Not merged.

## What changed
- `audit-ui/src/shell/typewriter.ts` (new): synthesised strike in Web Audio, same style as `click.ts`. A band-passed noise burst (40 ms) plus a falling sine thump (50 ms). Pitch and level vary by about 15% per key. No file, no network, one shared context, all failures swallowed. Silent without AudioContext.
- Keys that play: one printable character, Enter, Backspace. Silent: modifiers alone, arrows, Tab, Esc, Home, Ctrl/Meta/Alt shortcuts, IME composition. The strike is queued as a microtask after keydown, so typing is never held up.
- Sound on/off button `.chat-sound` ("Sound on" / "Sound off", `aria-pressed`) sits between the input and Send. Default on. Saved in `localStorage` key `typewriter-sound`. Storage errors are guarded (the choice then holds for the page only).
- Wired in `ChatView.mount` (`views/chat.ts`). The mini chat is the same `ChatView`, so it gets the sound and its own toggle with no extra code.
- `chat.css`: small `.chat-sound` style using the type-role tokens. `chat.test.ts`: the visible-text list now includes "Sound on".

## Tests
`src/shell/typewriter.test.ts`, 4 tests: no throw without AudioContext; strike on a character, Enter and Backspace; silent for modifiers, navigation and Ctrl+C; silent when muted, and the mute persists.
With the keydown wiring removed, 2 of the 4 fail (the strike tests). Restored, all pass.
Full suite: 659 of 659 pass (58 files; 655 required). `tsc --noEmit` clean. `npm run build` clean.
(An earlier run caught `stitch-system.test.ts` rejecting a raw `font-size`; the toggle now uses the type-role tokens.)

## Proof (real Chrome, 1920x1080, stub connector as a test double)
Keys are real browser key events (`Input.dispatchKeyEvent`). Script: `shots.mjs`; raw output: `shot-report.json`.
- `a-composer-sound-on-1920.png`: toggle on, "Help" typed.
- `b-composer-sound-off-1920.png`: toggle off.
- `c-after-reload-still-muted-1920.png`: after a page reload it still reads "Sound off" (localStorage = off).
- Hook log: H, e, l, l, o and Backspace each fired one strike. Shift and ArrowLeft fired none. After mute, 4 more keys fired 0 strikes and the text still landed.
- Layout: the toggle is inside the composer, no overflow.

## Audio: what was and was not captured
A real recording with audio was NOT made. Headless Chrome here has no audio capture. Instead the page's AudioContext was swapped for an OfflineAudioContext, so the real `playStrike` graph ran and was rendered: `typewriter-strikes-offline.wav` (1.1 s, six strikes, peak 0.129). This is the strike rendered offline, not a recording of speakers. Nobody has listened to it here.
The Sherlock error boxes in the shots only mean no VITE_SHERLOCK_URL was set in the proof build.

## Not checked
Real speaker output; the webkit-prefixed AudioContext path; the mini-chat toggle in a live browser (same component, shared code only).
