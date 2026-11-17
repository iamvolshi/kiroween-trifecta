# Shell build -- work orders

Source: "Design sheet -- the shell" (Darren, 2026-11-16) plus Darren's
rulings the same day:
- ELLE lessons are assigned to subjects. The script names the lesson's
  subject, marked mock, and the lesson lives in that subject's folder.
- Lessons stay grey until promoted.
- A lesson is injected into any prompt that seeks its subject, but only after
  it is learned (promoted).

Base: `main` at `e13aa20` (assembly build). Branch `feat/shell`. This round
EXTENDS; every existing route keeps working. All doctrine from
`.kiro/specs/assembly/tasks.md` still binds (append-only, KID is a number,
ceiling 8, mock labeled, not-knowing shown, no engine code, no network, no
file over ~500 lines, live stub stays a stub, README untouched). Design
sheet: no decoration pretending to be function, no fake telemetry: every
thing the right column shows is derived from the record, the lessons or the
chat log through the seam. Colors and branding are NOT decided: use the
existing CSS variables, plain and readable.

## Layout

One layout for the whole app, three columns, built once by the Router:
- left `.shell-left`: directories (destinations nav + MOCK label, record
  folders per account, Calendar).
- center `.shell-center`: the routed View (chat, action list, time travel,
  calendar, entry detail, record, not found).
- right `.shell-right`: telemetry (Curator + ELLE as one worker: subject
  folders with the 0-9 value, lessons inside, KATIE feed).

## Contracts (written by Spec Builder, do NOT change)

- `audit-ui/src/adapter/seam.ts`: `Lesson` gains `subject: string | null`
  and `status: 'candidate' | 'promoted'` (GRAY-2). `EngineActivity` gains
  `elle_promoted: Lesson | null` and `lessons_in_prompt: LessonsInPrompt`
  (`{ subjects, injected, held }`, read BEFORE the turn plays).
- `audit-ui/src/scenario/types.ts`: `ScenarioStep.promotes: string | null`;
  `Scenario.subject_keywords: Record<subject, string[]>`.
- `audit-ui/src/views/chat-log.ts`: `ChatLog.subscribe(fn): () => void`.
- `audit-ui/src/shell/panel.ts`: `Panel { mount(slot); refresh(); unmount() }`.

## Scenario additions (WO-E writes exactly this, all mock)

Step 4's lesson gains `subject: 'order-1042.delivery_date'`, `status:
'candidate'`. Two new steps, no record entries:

| Step | Prompt | Keywords | Reply gist | ERIE | ELLE |
|---|---|---|---|---|---|
| 5 | Good. Remember that lesson. | remember, keep | will use it from now on | -- | promotes `mock:lesson-1` |
| 6 | When is the new delivery date? | when, date, delivery, new | 2026-11-19; checked the carrier feed first, as learned | found: `mock:katie-record` scn-s3 (2026-11-19, revised, auth 7) + `mock:carrier-feed` parcel-77 held at depot | -- (lesson injected) |

`subject_keywords`: `order-1042.delivery_date`: delivery, date, arrive,
arriving, when; `parcel-77.status`: parcel, where, tracking, status, depot.

Rules: `lessons_in_prompt` is computed for EVERY chat message (matched or
not) from lessons as they stood BEFORE the turn: promoted on a sought
subject -> injected; candidate -> held. So step 1 injects nothing, step 5
promotes (not injected on that same turn), step 6 injects the lesson. An
unmatched message that seeks the subject after promotion still shows the
injection, with the not-knowing reply. `fetchLessons()` returns each
recorded lesson with its current status (copies; the scripted lesson stays
frozen as recorded).

## File map and owners

| Files | Owner |
|---|---|
| seam.ts, scenario/types.ts, chat-log.ts, shell/panel.ts | Spec Builder (done) |
| scenario/script.ts, scenario/match.ts, adapter/mock-assembly.ts, adapter/mock.ts, scenario + mock tests | WO-E |
| shell/shell.ts, shell/left.ts, views/record.ts, router/router.ts, nav.ts, removing createNav from every view, nav-related tests | WO-F |
| shell/telemetry.ts (+ shell/telemetry-*.ts), views/chat-turn.ts, chat-turn tests | WO-G |
| wiring telemetry into the router, integration tests, final review loop | parent (WO-H) |

## Work orders

- [x] WO-E scenario: lesson subjects, promotion, injection -- `wo-e.md`, Crew run 43e8b9076a6d1b6d
- [x] WO-F shell: three columns, left directories, record view -- `wo-f.md`, Crew run 5cefe25c04ee3eb9
- [x] WO-G right column telemetry + ELLE in the chat turn -- `wo-g.md`, Crew run 48fd2609ba53b9dc
- [x] WO-H wiring + integration (parent): telemetry in the right slot, CSS split, `shell-integration.test.ts`
- [x] Review: Code Review Sage, independent -- run 16bb766f9ff4d7e9, SIGN-OFF, see `review-1.md`
- [ ] Verify: npm test (262/262), npm run build, tsc --noEmit done; dev-server manual pass NOT done (server cannot be started from the agent harness)

## GRAY

- GRAY-2: the trifecta `/lessons` items carry no subject and no promotion
  status. This round adds both as a mock extension per Darren's ruling.
  Open: the live field names, and what promotes a lesson in the real ELLE
  (here a scripted step promotes it).
- GRAY-3: "a prompt that seeks a subject" is matched by scripted keywords in
  the mock. The real rule (ERIE retrieval? subject resolution?) is open.
