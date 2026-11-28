# Rosie, app side (OCME-013-hack)

Branch `feat/rosie-app`, cut from `feat/personas-talk` 11181e6. Not merged. Contract: `docs/rosie-contract.md` on NewSherlock `feat/sherlock-rosie` a598996.

## What was built
- Left column, under the GitHub control: **Download Rosie bridge** (link to the `rosie-v0.1.0` release asset `Rosie.exe` in iamvolshi/scribe) and **Attach local drive**.
- Pairing: the app shows a short code (`XXXX-XXXX`), then "Rosie is connected. Choose a folder.", then Choose folder. Rosie quiet for 45 s: "Rosie is asleep, start her again on your computer." and Choose folder is disabled.
- Ready line like GitHub: "Ready. 3 files read, 2 skipped, 4 passages." If she sleeps after that: "...Rosie is asleep, but your folder is still here."
- Chat and Sherlock & Watson page ask the folder when it is attached. Each citation shows machine, file path and KID. Detach and Unpair work; Ask the book switch works.
- Errors are in plain words (asleep, not paired, still reading, no folder, Sherlock unreachable, old Sherlock without Rosie routes).
- Read-only words are on the panel: "Rosie only reads. She never changes, deletes or runs anything on your computer, and she reads only the one folder you choose."
- Per person: the same browser key as GitHub (`sherlock-github-session`, 43 random chars) goes in `X-Sherlock-Session`. Sherlock keeps `ro-` and `gh-` cases apart.
- Files: `adapter/rosie-client.ts`, `views/rosie-session.ts`, `views/rosie-panel.ts`; small wiring in `repo-session.ts` (new `mode`, `activeTurns`, `askActive`), `chat.ts`, `handoff.ts`, `sherlock-watson.ts`, `left.ts`, `router.ts`, `repo-panel.ts` (machine name), `github-client.ts` (shared key helper, same behaviour). GitHub, personas, mini chat behave as before.

## Tests
`src/views/rosie.test.ts`: 17 tests (attach flow, read-only wording, per-user key, asleep state, errors, ask with machine/path/KID, detach, unpair, no polling for a person who never pairs, GitHub still wins when it is the chosen source). With the folder branch of `mode` removed, 3 of them fail.
Full suite: 689 passed (672 required). `tsc --noEmit` clean. `vite build` clean.

## Live proof (1920 shots in this folder, `shot-report.json`)
Local Sherlock from `feat/sherlock-rosie` on :8090, the built app on :4178 (one origin). The REAL `Rosie.exe` from the draft release (sha256 8989fefe...1d56, matches the release digest) paired using the code from its file name, went connected, was killed (app said asleep), restarted (connected again) and took the unpair. The real agent code from `feat/rosie-agent` c329444, with a fixed folder in place of the native picker, then read a folder with a README, two .py files, a png and node_modules: "Ready. 3 files read, 2 skipped, 4 passages." Asked "Where is the passphrase kept?": `LAPALIEN src/vault.py KID 4`. Detach: the folder is gone, ask after returns 404 no_folder_attached. Unpair stopped the agent.
Shots: a panel, b code, c connected, d asleep, e choosing folder, f ready, g answer, h detached.
Scripts: `rosie-shot.mjs`, `rosie_agent_run.py`.

## Unproven
- A real third-party person on a real machine.
- Render: the live service does not have the Rosie routes yet. Nothing was redeployed.
- The native folder picker (a script cannot click it).
- The release is a draft, so the download link gives "not found" until Darren publishes it. The panel says so in words.
- The first live shot of the Chrome connector error is unrelated (no connector set in the proof build).

## Finding for Sherlock (not changed here)
`unpair` queues an `unpair` command even when Rosie is asleep. The queue is per case and is not cleared when a new machine pairs. The next machine to pair gets that stale `unpair` and unpairs itself at once. Seen live: unpair while the exe was dead, then pair the agent: "Rosie was unpaired". Fix on Sherlock: clear the case queue in `/agent/redeem`. The proof avoids it by waking Rosie before unpairing.
