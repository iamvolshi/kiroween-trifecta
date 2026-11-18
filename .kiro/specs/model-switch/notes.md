# Model switch: notes

Order: the Book/Movie switch selects the MODEL, and the change is obvious
under the chat box. Movie -> Spark (Meta). Book -> Mercury or SubQ, by config,
no default.

## Where the work is

| Repo | Branch | Base |
|---|---|---|
| Kiroween | `feat/model-switch` | `main` at `55a21bb` (as ordered; `main` has since moved to `e6753a6`, a Netlify SPA fallback, which this work does not touch) |
| Bots | `feat/model-switch` | `feat/audit-connector` at `2686c04` |

Connector state read first: the connector exists, on the bots branch
`feat/audit-connector` (pushed, not merged). This round EXTENDS it; there is
one connector. Because it is not merged, the bots branch stacks on it. The
Kiroween base `55a21bb` does not carry the live-record reads
(`feat/live-record-reads`), so the left column in the live screenshots still
says the whole-record read is not in the contract. That is the base, not
this round.

The order names `audit-ui/src/chat/`; that folder does not exist. The switch
lives in `views/persona-picker.ts` (`renderRegisterSwitch`) and
`views/chat.ts`. The switch is untouched; only the announcement is wired.

## Config shape (bots repo, env only)

Read by `bot/config.py` (`route_for`, `register_route`). Keys never appear in
code, tests, docs or git. `Route` keeps its key `repr=False`;
`Route.public()` gives provider + model only.

| Env | Meaning | Default |
|---|---|---|
| `MOVIE_PROVIDER` | Movie's provider | `meta` (does NOT follow the bot's `MODEL_PROVIDER`; changed after review) |
| `MOVIE_MODEL` | Movie's model | the provider's default (`muse-spark-1.3-contributor` for meta) |
| `BOOK_PROVIDER` | `mercury` or `subq` | NONE. Unset: `/chat` with Book answers HTTP 503 naming it; no fallback to Movie |
| `BOOK_MODEL` | Book's model | the provider's own setting (`MERCURY_MODEL` / `SUBQ_MODEL`) |
| `INCEPTION_API_KEY` | Mercury key | required for mercury |
| `MERCURY_MODEL` | Mercury model | `mercury-3` |
| `INCEPTION_BASE_URL` | Mercury API root | `https://api.inceptionlabs.ai/v1` |
| `SUBQ_API_KEY` | SubQ key | required for subq |
| `SUBQ_MODEL` | SubQ chat model id | NONE: never guessed. `subq-snap-preview` is refused (a decision model, no text) |
| `SUBQ_BASE_URL` | SubQ API root | `https://api.subq.ai/v1` |

Flipping Book: edit `.env` (`BOOK_PROVIDER=mercury` or `subq`), restart the
connector. No rebuild of either repo. The env is read when the process
starts, so a restart is needed.

Known limit: Mercury's API is available through December 28, 2026 (Mercury
2/2.5 retired Nov 15; accounts moved to Mercury 3, same API and key). After
that date `BOOK_PROVIDER` must be `subq`.

## Endpoint shapes (bots `bot/model.py`)

| Provider | POST | Auth | Body notes |
|---|---|---|---|
| meta | `https://api.meta.ai/v1/chat/completions` | Bearer | `reasoning_effort: "minimal"`, `max_tokens 4000` (unchanged) |
| mercury | `<INCEPTION_BASE_URL>/chat/completions` | Bearer `INCEPTION_API_KEY` | `max_tokens 4000`, no `reasoning_effort` |
| subq | `<SUBQ_BASE_URL>/chat/completions` | Bearer `SUBQ_API_KEY` | `max_tokens 300`, no `reasoning_effort` |
| openrouter | unchanged | unchanged | unchanged |

Unknown providers are refused (`ConfigError`, and `ModelError` in
`generate_reply`). Missing keys fail closed with the key's name.

Mercury: reused from `volshi-ai/trifecta` `service/mercury_client.py` = the
endpoint, the Bearer header, the env names (`INCEPTION_API_KEY`,
`MERCURY_MODEL`, `INCEPTION_BASE_URL`) and the `mercury-3` default. Written
fresh = the branch in the bots' aiohttp `generate_reply`. NOT reused = the
trifecta client's 429 back-off ladder (the bots' client has no retries for any
provider). Found live: Mercury 3 is a reasoning model and bills 150-420
reasoning tokens inside `max_tokens` on one short reply, so the 300 cap gave
an empty answer. It gets the same 4000 budget as Spark.

## Connector (bots `bot/connector.py`)

- `POST /chat` honours `register` (`book` / `movie`; anything else 400). The
  route is resolved BEFORE the loop runs: an unconfigured position records
  nothing and answers 503 `{error, register, missing_config}`.
- The turn runs the loop's own path: `EngineLoop.run` -> `generate_reply` on
  that route -> `record_reply`.
- Every `/chat` reply carries `served_by: {provider, model}`: the route that
  served it.
- Status call: `GET /models` -> `{persona, default, registers: {movie, book},
  register_voices}`. Each position is `{provider, model}` or `{error}`, read
  from the loop's config on each call. No key is in it.
- Persona rule unchanged: one booted persona; others get 409 naming it.

## Voices

The connector booted the new `cartridges/frankenstein.json` (persona
`Frankenstein`, the name the app sends). The user asked for it in this round:
"Make a new Frankenstein cartridge for the two Frankensteins (Book and
Movie)." No Frankenstein cartridge existed in bots, Trifecta or Kiroween.

- The cartridge carries `register_prompts: {movie, book}`. `Persona.voice_for`
  picks one by register, else `system_prompt`. A cartridge without them is
  unchanged.
- **Voice-words status: DRAFT, awaiting Darren's approval.** The builder
  wrote both drafts at the user's request; the file says so in
  `voice_status`. Movie follows the caveman grunt style; Book follows
  Shelley's self-taught, eloquent creature. Darren replaces the words freely,
  with no code change.

## The announcement (Kiroween app)

- Files: `views/model-banner.ts` (the pure `announce()` + the band),
  `styles/model-banner.css`, `adapter/live-models.ts` (`GET /models` + its
  shape guard), `views/chat.ts` (wiring), `adapter/seam.ts` (optional
  `ChatTurn.served_by`, guarded), `main.ts` (one CSS import).
- Data: before a turn, `GET /models`, read at mount, on every flip and
  after a failed turn (only the latest read is kept). After a turn, that
  turn's `served_by` for that switch position. A failed turn drops that
  position's old `served_by`. When they disagree, `served_by` wins and the
  band says what the status had claimed.
- One switch: `ChatView` reads `ACTIVE_ADAPTER_KIND` and `LIVE_BASE_URL` from
  `adapter/active.ts`. Mock mode never calls `/models`.
- No provider or model name is written in the app; a test scans `src` for
  them.
- Unreachable connector: "Model unknown. Cannot say which model is live.
  Connector unreachable: ...". Unconfigured: "Not configured" plus the
  config error.

### Visual treatment

A full-width band directly under the composer (inside the sticky composer,
so it is always on screen):

| Part | Movie | Book |
|---|---|---|
| Band colour | amber, `#ffb648` edge on `#2b1d06` | violet, `#b49cff` edge on `#1c1236` |
| Position block | solid amber block, `MOVIE` | solid violet block, `BOOK` |
| Model name | 22 px bold mono, from the connector | same |
| Provider chip | outlined, from the connector | same |
| Source line | "From the connector's status" or "Served the last reply" | same |

A flip changes the band colour, the block word and the model name at once,
and pulses a 700 ms outline (off under `prefers-reduced-motion`). Mock: a
dashed yellow band, "No live model". Unreachable / unconfigured: red band.

## Proof (`docs/model-switch-proof/`)

| Shot | What it shows | Live? |
|---|---|---|
| `01-movie-spark.png` | Movie turn; band amber, served by Meta Spark (`served_by`) | live, real model |
| `02-book-flip-moment.png` | the moment after flipping to Book: violet band, pulse, Mercury from `/models` | live |
| `03-book-mercury.png` | Book turn; violet band, served by Mercury (`served_by`), the Book voice | live, real model |
| `04-mock-label.png` | mock build: dashed band, "No live model" | mock, labelled |

SubQ was not called live: no SubQ chat model id came with the order, and no
SubQ key is set on this machine. The SubQ leg was verified against a local
stub speaking SubQ's OpenAI-compatible shape (POST path, Bearer header,
model from env, no `reasoning_effort`, Book voice sent, `served_by` subq),
using the real connector, loop, config and model client. That is a stub,
not a live call.
