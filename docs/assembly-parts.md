# The assembly: parts and where they live

Darren's words for this build: "we're building a Frankenstein here, it
doesn't have to be elegant." This page names the parts. It holds no engine
code and no prompts. Every engine lives in one place, the Discord bot loop,
wired once. This repo (the Audit UI) holds none of them: it talks to the
loop through a connector.

## Parts

| Part | What it does | Where it lives |
|---|---|---|
| ARCHE | Directs the turn and runs the persona you chose. ARCHE does not talk as itself. | Bot loop |
| Persona cartridges | The faces ARCHE can run: Frankenstein, Elara, ARCHETRON. | Bot loop |
| Mansplainer register engine | Frankenstein's two voices: Book (the novel's eloquent creature) and Movie (the film monster). | Bot loop |
| ERIE | Finds what a turn needs and says where it came from (provenance). | Bot loop |
| ELLE | Records lessons, holds them back until learned, promotes them, and reads learned ones into later prompts. One ELLE serves every persona. | Bot loop |
| KATIE | Records each fact as an append-only entry in the record. | Bot loop |
| KID | The number that names each thing in the record. | Bot loop (the record) |
| TEMPE | Temporal data store. | Bot loop |
| Connector | Lets the app talk to the bot loop over plain JSON. Built separately, to the contract below. | Outside this repo |
| Audit UI | Shows the conversation, the engines' work and the record. Sends names, never voices or prompts. | This repo |

## Connector contract (as built in the app)

Plain JSON over HTTP, no auth. The app points at one base URL, set at build
time as `VITE_CONNECTOR_URL`. The shapes are the types in
`audit-ui/src/adapter/seam.ts`; those types are the contract.

| Call | Request | Response |
|---|---|---|
| `POST /chat` | `{ "message": string, "persona": "Frankenstein" \| "Elara" \| "ARCHETRON", "register"?: "book" \| "movie" }` (`register` only for Frankenstein) | `ChatTurn` |
| `GET /record/{account_id}` | none | `RecordResult` |
| `GET /lessons` | none | `Lesson[]` |
| `POST /ask` | `{ "question": string }` | `AskResult` |

A `ChatTurn` carries the reply in `engines.arche.reply`, `known`, `step` /
`total_steps`, and what the engines did: `engines.erie` (an `AskResult`
with provenance), `engines.elle`, `engines.elle_promoted`,
`engines.lessons_in_prompt`, and `engines.katie` (one `UpdateResult` per
record entry written).

**Required in every `ChatTurn`** (the app refuses a reply without them):
`message` (string), `known` (boolean), `engines.arche.reply` (string),
`engines.katie` (array, may be empty), `engines.lessons_in_prompt.injected`
and `.held` (arrays, may be empty). `links` is optional; when present it is
an array.

**Link spans.** The responding side marks which words of the reply carry
provenance, in `links`:

```json
{ "start": 21, "end": 31, "kid": 4, "subject": "order-1042.delivery_date", "entry_id": "scn-s3" }
```

`start` and `end` are offsets into the reply text in UTF-16 code units
(JavaScript string indices), end exclusive. Spans must not overlap. The app
never finds these words itself; a bad span is shown as plain text.

Anything else the app reads (the whole record, a moment's belief pool, a
chain, the KID map) is not in the contract yet, and the live adapter says so
in words instead of guessing an endpoint. On the live path that means the
record views show that message and the left column's subject folders come
from `GET /lessons` only. A whole-record read in the contract would fix it.
A `/chat` reply that is not a `ChatTurn` is refused with an error.

## The model switch (Book / Movie)

Frankenstein's Book/Movie switch picks the model, not only the voice.

| Position | Model | Set by |
|---|---|---|
| Movie | Meta Spark (`meta`) | `MOVIE_PROVIDER` / `MOVIE_MODEL`, default the loop's own route |
| Book | Mercury or SubQ | `BOOK_PROVIDER` (`mercury` or `subq`). No default: unset, a Book turn is refused with the missing setting named |

The map is config in the bots repo's environment. Flipping Book between
Mercury and SubQ is a `.env` edit and a connector restart, with no rebuild.
The exact names are in `.kiro/specs/model-switch/notes.md`.

Provider sockets in the bot loop (`bot/model.py`): `meta`, `openrouter`,
`subq` (SubQ, OpenAI-compatible, `SUBQ_API_KEY`) and `mercury` (Inception
Labs, OpenAI-compatible, `INCEPTION_API_KEY`). Any other provider is refused.
SubQ's Snap model is a decision model and is refused as a voice.

Connector additions:

| Call | Change |
|---|---|
| `POST /chat` | honours `register`; every reply carries `served_by: { provider, model }`, the model that actually served the turn |
| `GET /models` | the live map: `{ persona, default, registers: { movie, book }, register_voices }`, each position `{ provider, model }` or `{ error }` |

The announcement: under the chat box, a band names the live model from the
connector (`GET /models` before a turn, `served_by` after; `served_by` wins).
Movie is amber, Book is violet, and flipping the switch changes the band,
the position word and the model name. Mock mode shows "No live model". The
app holds no provider or model names.

Limits:

- Mercury's API is available through December 28, 2026. After that, Book
  must point at SubQ.
- SubQ is socketed but not configured: its chat model id and key are still
  to come from the SubQ console.
- Voice words: the Frankenstein cartridge carries a Book and a Movie voice,
  drafted at the user's request and awaiting Darren's approval.