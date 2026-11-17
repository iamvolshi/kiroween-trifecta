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
| Connector | Lets the app talk to the bot loop over plain JSON, to the contract below. Run with `python -m bot.connector`. | Bots repo (`iamvolshi/bots`, `bot/connector.py`), not this repo |
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
| `GET /entries` | none | `Entry[]`, the whole record in record order |
| `GET /belief-pool?at=<epoch ms>` | none | `Entry[]` live at that moment |
| `GET /chain?kid=<kid>&subject=<subject>` | none | `Entry[]` for that KID and subject, in record order |
| `GET /kidmap` | none | `KidMap` (`{ "<kid number>": "<label>" }`) |

No auth, no pagination. A refusal is an HTTP error with an `{ "error": string }` body; the app shows those words after the status. `POST /update` is not in the contract: the live adapter returns a typed error for it.

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

The live adapter checks the four record reads before it uses them: an entry
without every `Entry` field in its seam type (a string KID, a list evidence,
a null `k_time`, an authority outside 0-9), or a KID map key that is not a
whole number, is refused with a sentence saying which item failed. If the
whole-record read fails, the left column's subject folders come from
`GET /lessons` only, under a "Record entries not available" line.
A `/chat` reply that is not a `ChatTurn` is refused with an error.

## How the connector maps the loop's record

The full table and the reasons are in
`.kiro/specs/live-record-reads/notes.md`. In short:

| Seam | From the loop |
|---|---|
| `id` | `event_id` |
| `kid` | `1`: the connector's number for the one booted kernel. The loop's KID is a 32-character tag; `/kidmap` gives it as the label of `1`. |
| `k_start`, `t_time` | `tek_t` (the second the entry was written), as ISO-8601 UTC. The loop's own `k_start` is a position (0, 1, 2...), kept as record order. |
| `k_time`, `e_time` | `""`: the loop never closes an interval and records no event time |
| `evidence` | the loop's list joined with `", "`; `""` when empty |
| `subject`, `state`, `authority`, `reason`, `prev_hash` | as recorded |
| `pool` | `"0"`, the loop's value |
| Lessons | `event_id` `elle-<n>` (position), `event_type` the loop's `source`, `detail` the lesson sentence, `rule` null, `subject` null, `status` `promoted` (the loop puts every lesson in every prompt) |
| `GET /record/{account_id}` | the account is the booted persona's slug, e.g. `archetron` |

Belief pool: an entry is live at `M` when its start (`tek_t` in ms) is at
or before `M` and `M` is before its end; no end means still live. In the
loop no entry has an end, so the pool at `M` is every entry written by `M`.

## Limits

- One booted persona. The connector serves the persona its `CARTRIDGE`
  booted. `/chat` with another persona name is refused (HTTP 409) and the
  refusal names the booted one.
- Register is pending. The loop has no register machinery; the connector
  accepts `register` and does not act on it. No voice prompt was written.
- `POST /update` is out.
- No `links`: the loop marks no spans in its replies.
- Turn text is not an `Entry` field, so the record views show each turn's
  reason and evidence, not its words. The words are in the chat.
