# Live record reads + the connector: mapping notes

Written BEFORE the connector was built (step 0 of the order). Sources read:
`bot/engines/katie.py`, `bot/engines/kid.py`, `bot/engines/__init__.py`
(`EngineLoop.run`, `record_reply`), `bot/engines/elle.py`, `bot/engines/erie.py`,
`bot/bot.py` (`_generate`, `_record_exchange`), `bot/model.py` (`generate_reply`),
`bot/persona.py`, `bot/config.py`, `bot/arche.py` (`boot_arche`), `bot/__main__.py`
in the bots repo (`D:\Discord\bots`, `origin/main` at `4c6e0b7`), and
`audit-ui/src/adapter/seam.ts`, `audit-ui/src/util/interval.ts` here.

## Mapping table: loop `KatieRecord` -> seam `Entry`

| Seam field | Seam type | Loop source | Rule | Why |
|---|---|---|---|---|
| `id` | string | `event_id` (UUIDv7) | verbatim | The order's mapping. |
| `kid` | number | `kid` (32-char base64url `kid_tag`) | the number `1`, a connector handle for the ONE booted kernel; `/kidmap` returns `{ "1": "<kid_tag>" }` | See "KID decision" below. |
| `subject` | string | `subject` (`turn` / `session` / `regrade`) | verbatim | |
| `state` | string | `state` (`WILD` / `CANDIDATE` / `MATURE` / `REVOKED`) | verbatim | No renaming into the mock's words. |
| `authority` | number | `authority` (0-9) | verbatim | Read-only. The connector writes nothing but `/chat` turns, which the loop records at 5. |
| `pool` | string | `pool` is not stored; the loop hashes `pool=0` | `"0"` | The loop's own value, as a string. |
| `k_start` | string (time) | `tek_t` (unix seconds at append) | ISO-8601 UTC, `tek_t * 1000` ms | The loop's `k_start` is an ORDINAL (0, 1, 2...), not a time. `tek_t` is the moment the entry entered the record, which is when its interval starts. The ordinal is kept as record order (`/entries`, `/chain`). |
| `t_time` | string (time) | `tek_t` | ISO-8601 UTC | Wall time. Same source as `k_start`: the loop records one clock. |
| `e_time` | string (time) | `tek_e` is always `0` | `""` | The loop records no event time. An empty string says "not recorded"; epoch 0 would be a false date. |
| `k_time` | string (time) | `k_end` is always `null` | `""` | The loop never closes an interval. Empty string = open. See the belief-pool check. |
| `evidence` | string | `evidence` (list; `[author_name]` on turns, `[event_id]` on regrades, `[]` on sessions) | JOINED with `", "`; an empty list gives `""` | The seam type is `string`, not nullable, so null-when-empty would change the seam. Turns carry one item, so joined equals first in practice. |
| `reason` | string | `reason` | verbatim | |
| `prev_hash` | string | `prev_hash` | verbatim | Served as the field it is. No claim about it in this repo. |
| (none) | | `content`, `day`, `tick`, `channel_id`, `role`, `author_*`, `supersedes`, `trust`, `entry_hash` | not served | The seam `Entry` has no field for them and app types stay as they are. Turn text does not reach the record views; it reaches the chat as the reply. |

Reads go through the loop's own parsing: the connector boots `EngineLoop`
(`KatieKernel._load_chain` runs `KatieRecord.from_line` on every line and
verifies it) and maps `loop.katie.entries()`. It never reads the JSONL itself.

## KID decision (recorded before building)

- Mismatch: the loop's KID is a STRING tag, one per persona kernel. Every
  entry in one record carries the same tag; `_load_chain` refuses a line with
  any other tag. The seam's `kid` is a NUMBER.
- Rejected: decoding the tag. `kid_split` gives `(birth_tick, born_at_unix,
  seq)`; `seq` is random 63-bit and does not survive a JavaScript number
  (2^53), and neither other part is unique. Hashing the tag to a number is a
  coercion.
- Chosen: the connector serves one booted kernel, so it names it `1` and
  publishes the real tag as the label in `/kidmap` (`KidMap` is
  `Record<number, string>`, a number with a label). This is a one-to-one
  lookup, served, not silent: the number is a connector handle, the KID
  itself is the label, verbatim. `/chain?kid=<n>` with any number but `1`
  answers HTTP 404 with an error that names the served handle.
- Limit: a connector serving two kernels would need a second handle. It
  does not exist; one booted persona is a limit of this connector.

## Belief-pool rule check

| Side | Rule | Open end |
|---|---|---|
| The order | live iff `k_start <= M < k_end` | `k_end` null = still live |
| App `isLiveAt` (`util/interval.ts`) | `parseMs(k_start) <= M < parseMs(k_time)` | no null case: `k_time` is a string; the app's own scenario writes `WINDOW_END` for an open interval |
| Loop | no belief-pool read exists; `k_end` is never closed ("an entry's interval stays open") | always open |

Result: the bounds agree (start inclusive, end exclusive) on all three sides.
No disagreement in the rule, so the build was not stopped. Two things are
recorded instead:

1. Units. `M` is epoch ms and the loop's `k_start` is an ordinal, so the
   connector compares `M` with the start time `tek_t * 1000`. Every loop
   entry is open, so `/belief-pool?at=M` returns every entry with
   `tek_t * 1000 <= M`, in record order.
2. Where the rule runs. On the live path the connector applies it, with
   null = live. `isLiveAt` runs only in the mock adapter. An open live entry
   carries `k_time: ""`, and `isLiveAt` on it would answer false. No live
   code path calls `isLiveAt`; if one ever does, it must treat `""` as open.
3. `supersedes` is NOT used to close intervals. The loop does not do it: on a
   turn, `supersedes` names the previous turn in the channel, not a replaced
   belief.

Known blank cells: Entry Detail's K-Time and E-Time and the cards' "Live
until" show empty for every live entry, because both are `""`. That is the
honest value (open; not recorded). The views were not changed this round.
A test in `live-record-reads.test.ts` pins `isLiveAt` to false on an open
live entry, as a warning to the next caller.

`evidence` is display text: joined with `", "`, not reversible when an item
holds a comma.

## Lessons: loop ELLE -> seam `Lesson`

ELLE lessons are strings (`ElleEngine.lessons()`), logged as
`{text, day, tick, source, kind}` lines in `elle-lessons.jsonl`.

| Seam field | Rule |
|---|---|
| `event_id` | `elle-<n>`, the lesson's 1-based position in `ElleEngine.lessons()` (the loop gives lessons no id) |
| `event_type` | the log line's `source` (`derived:preference`, `derived:correction`, `derived:repetition`), `"derived"` when absent |
| `detail` | the lesson text, verbatim |
| `rule` | null. The loop's lesson is one sentence (in `detail`); the name of the rule that derived it is already in `event_type`. The app shows `rule ?? detail`, so the sentence is what shows. (First draft put the rule name here; the left column then showed "preference" instead of the lesson. Changed before the connector was pushed.) |
| `subject` | null: the loop files no lesson under a subject. The app shows these under "Lessons without a subject". |
| `status` | `promoted`: the loop injects EVERY lesson into every prompt's engine context (`EngineContext.lessons = elle.lessons()`), which is what `promoted` means in the seam. The loop has no candidate stage. |

The lesson list itself comes from `ElleEngine.lessons()`. The connector reads
the log lines only for `source`, matched by text.

## The other calls

| Call | Rule |
|---|---|
| `POST /chat` | `EngineLoop.run(...)` -> `model.generate_reply(system_prompt=<booted cartridge system_prompt>, engine_context=ctx.to_text(), history=loop.resume_turns(channel))` -> `EngineLoop.record_reply(...)`. Channel id `1` (the connector channel); speaker name `Audit UI`; reply cut to the cartridge's `max_reply_chars`. No Discord tag fixing, no ambient, no rate limit. |
| `/chat` persona | Served: the ONE persona booted from `CARTRIDGE` (its `Persona.name`). Missing `persona` = the booted one. Any other name: HTTP 409, `{ "error": "...", "booted_persona": "<name>" }`. |
| `/chat` register | Pending. The loop has no register machinery; the field is accepted and not acted on. No voice prompt is written. |
| `/chat` reply shape | `known: true`, `step: null`, `total_steps: 0`; `engines.erie` from `ctx.erie`; `engines.katie` = the two entries written (user turn, reply turn) as `{kid: 1, subject: "turn", entry_id, seated: true}`; `engines.elle` null and `engines.elle_promoted` = the first lesson newly derived on this turn, else null (the loop has no candidate stage: a derived lesson is in every later prompt at once. First draft put it in `elle`, and the work column then said "not learned yet" while the left column said learned. Changed after the first live screenshots); `lessons_in_prompt.injected` = the lessons in the engine context, `held` = []. |
| `/chat` links | None. The loop authors no spans; ERIE matches the user's words, not the reply's. Marking reply words would mean matching text after the fact, which the seam forbids. |
| `GET /record/{account_id}` | The loop has no accounts. The account is the booted persona's slug (`Persona.slug`, e.g. `archetron`); entries grouped by subject. Any other id: HTTP 404 naming the slug. |
| `GET /lessons` | The lesson mapping above. |
| `POST /ask` | `ErieRetriever.retrieve` over the loop's own pool (`EngineLoop._pool()`); `state` found / not_found; `text` = the top hit's text, `""` when not found; provenance per hit `{source: "K-record day D tick T, <author>", content: <event_id>, excerpt: <text, 200 chars>}`. |
| `GET /entries` | `loop.katie.entries()` mapped, record order. |
| `GET /belief-pool?at=<ms>` | Rule above. Missing or non-numeric `at`: HTTP 400. |
| `GET /chain?kid=&subject=` | Entries with that subject, record order. Unknown kid: 404. Unknown subject: `[]`. |
| `GET /kidmap` | `{ "1": "<kid_tag>" }`. |
| `POST /update` | Not served (404). The app's live adapter keeps its typed error. |
| Model failure | HTTP 502 with a fixed sentence; the provider's detail goes to the connector log only. The user turn stays recorded with no reply turn, as the bot does on a `ModelError`. Intended. |
| Any other failure | HTTP 500 `{ "error": "connector failed (see the connector log)" }`; bad JSON, a non-object body or a bad `Content-Length`: 400. |

## Connector home

- Bots repo, `bot/connector.py`, run as `python -m bot.connector`. Branch
  `feat/audit-connector`, pushed, not merged.
- Stdlib `http.server`, no new dependency. Binds `127.0.0.1` only. One lock
  around every call (the loop is not thread-safe), so reads wait while a
  `/chat` model call runs. No auth, as the contract says. Browser origins:
  loopback pages (`http://127.0.0.1:<port>`, `http://localhost:<port>`) and
  `CONNECTOR_ALLOW_ORIGINS` get CORS; any other `Origin` gets HTTP 403, so a
  web page open in the browser cannot spend model credits or read the
  record. (First draft sent CORS `*`; changed after review.)
- Boot like the bot: `.env` via `config.load_dotenv`, `load_cartridge(CARTRIDGE)`,
  `boot_arche(persona, DATA_DIR / persona.slug)`. A tampered record raises
  `KatieError` and the connector exits 3 without serving. The connector does
  not need `DISCORD_TOKEN`, so it reads the model settings with the same env
  names and defaults as `config.load_config`.

## Verification data

Scratch `DATA_DIR` only, seeded by real `POST /chat` calls. No record file is
written by hand. The live clones (`bots-elara`, `bots-caveman`,
`archetron-bot`) and `D:\Discord\bots\data` are not touched.
