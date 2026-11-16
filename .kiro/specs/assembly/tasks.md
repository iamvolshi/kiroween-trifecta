# Assembly build -- work orders

Source: OCME "Assembly build" order (Elara via Darren, 2026-11-16).
Starting HEAD `2445d14`. This round EXTENDS the viewer; every existing view,
route and test keeps working. Front-end only, vanilla TS + Vite, no network.

## Doctrine (binding on every work order)

- KID is a number, never a name. Record is append-only: no edit, no delete,
  no revert. Machine ceiling is authority 8; 9 is the user's alone.
- Entries chain per (KID, subject); intervals half-open `[k_start, k_time)`,
  non-overlapping, so at most one is live at any moment.
- Everything engine-like is MOCK behind the seam and labeled mock. Mock
  hashes are labeled mock (`mock:` prefix). Not-knowing is displayed, never
  filled. No engine code, no trifecta code copied.
- No file over ~500 lines. One concept per file.
- Do NOT touch the live seam beyond its typed-error stubs. Do NOT build the
  chain-break display. Do NOT change README or disclosure.

## File map

| File | Owner | Status |
|---|---|---|
| `audit-ui/src/adapter/seam.ts` | Spec Builder | CONTRACT, done |
| `audit-ui/src/scenario/types.ts` | Spec Builder | CONTRACT, done |
| `audit-ui/src/adapter/live.ts` | Spec Builder | stubs, done |
| `audit-ui/src/scenario/script.ts` | WO-A | data |
| `audit-ui/src/scenario/stepper.ts` | WO-A | `createScenarioCursor(scenario)` |
| `audit-ui/src/scenario/match.ts` | WO-A | `matchesStep(message, step)` |
| `audit-ui/src/adapter/mock.ts` | WO-A | wires cursor into record reads |
| `audit-ui/src/adapter/mock-assembly.ts` | WO-A | ask/chat/update/lessons/record |
| `audit-ui/src/views/chat-log.ts` | WO-B | `ChatLog` transcript store |
| `audit-ui/src/views/chat-turn.ts` | WO-B | renders one turn + engine panel |
| `audit-ui/src/views/chat.ts` | WO-B | `ChatView` |
| `audit-ui/src/util/calendar.ts` | WO-C | pure date helpers |
| `audit-ui/src/views/calendar.ts` | WO-C | `CalendarView` |
| `audit-ui/src/views/nav.ts`, `router/router.ts`, integration | WO-D | wiring |

## Interfaces each work order declares

- WO-A exports: `SCENARIO: Scenario` (script.ts); `createScenarioCursor(s:
  Scenario): ScenarioCursor` (stepper.ts); `matchesStep(message: string, step:
  ScenarioStep): boolean` (match.ts); `createMockAdapter(entries?: Entry[],
  options?: { cursor?: ScenarioCursor | null }): SeamAdapter` (mock.ts).
  Default call `createMockAdapter()` = 4 fixtures + a fresh cursor over
  SCENARIO. Passing `entries` explicitly means NO scenario unless
  `options.cursor` is given (keeps every existing test byte-identical).
  `createErrorMock()` errors on all 9 methods.
- WO-B exports: `class ChatLog { turns(): ChatTurn[]; push(t: ChatTurn): void }`;
  `class ChatView implements View { constructor(adapter: SeamAdapter, log: ChatLog) }`.
- WO-C exports: `class CalendarView implements View { constructor(adapter:
  SeamAdapter, target: CalendarTarget) }` with `CalendarTarget` =
  `{ level: 'month', year, month } | { level: 'day', year, month, day } |
  { level: 'hour', year, month, day, hour }` (month 1-12, UTC), plus
  `parseCalendarPath(path: string): CalendarTarget | 'default' | null` for routes
  `/calendar`, `/calendar/YYYY-MM`, `/calendar/YYYY-MM-DD`,
  `/calendar/YYYY-MM-DD/HH`. `/calendar` alone = month of the newest
  visible entry's k_start, else the current UTC month.
- WO-D: nav links Action List, Time Travel, Chat (`/chat`), Calendar
  (`/calendar`) + a visible "MOCK DATA" label; router routes `/chat` and the
  calendar paths; one `ChatLog` per Router. `/` -> `/actions` unchanged.

## The scenario (WO-A writes exactly this; content is ordinary, labeled mock)

Account `order-1042`, a parcel delivery. Day 2026-11-16 (UTC). KIDs 4 and 5
(fixtures use 1 and 3). KIDMAP labels: 4 -> `order-1042 (mock)`, 5 ->
`parcel-77 (mock)`. The mock window ends `2026-11-17T00:00:00.000Z`; entries
that are still current close there (see GRAY-1).

| Step | Prompt | Keywords | ERIE | ELLE | KATIE entry |
|---|---|---|---|---|---|
| 1 | When will my order arrive? | arrive, arriving, delivery | found: order system | -- | S1: KID 4 `order-1042.delivery_date` confirmed, auth 6, value=2026-11-18, `[09:12, 14:30)` |
| 2 | Where is the parcel now? | where, parcel, tracking | found: carrier feed | -- | S2: KID 5 `parcel-77.status` confirmed, auth 7, value=in transit, `[10:05, 15:10)` |
| 3 | The carrier emailed me about a delay. | delay, delayed, late | found: carrier notice | -- | S3: KID 4 `order-1042.delivery_date` **revised**, auth 7, value=2026-11-19, `[14:30, window end)`, prev_hash `mock:hash-s1` |
| 4 | Thanks. What did you learn? | thanks, thank, learn, learned | -- | lesson: check the carrier feed before promising a date | S4: KID 5 `parcel-77.status` revised, auth 8, value=held at depot, `[15:10, window end)`, prev_hash `mock:hash-s2` |

Step 3 is the belief revision: state confirmed->revised and authority 6->7 on
the (4, `order-1042.delivery_date`) chain. Evidence strings carry the value as
`value=<v> (mock)`. Entry ids `scn-s1`..`scn-s4`. t_time = k_start; e_time a
minute before. Not-knowing reply: "I don't know. The script has no answer for
that. (mock)". After the last step every message gets the not-knowing reply.

## Work orders

- [x] WO-A Seam mock + scenario (order tasks 1, 2) -- Crew run 2eb9d97613fe9291
- [x] WO-B Chat view (order task 3) -- Crew run 5a81e585fd84deea
- [x] WO-C Calendar drill-down (order task 4) -- Crew run afa304c7d507e2eb
- [x] WO-D Wiring: nav, router, one-seam integration (order tasks 5, 6) -- parent session
- [x] Review: Code Review Sage, independent context -- run 216a9c559c935ee7, SIGN-OFF, see review-1.md
- [ ] Verify: npm test, npm run build, tsc --noEmit done (202/202, clean); dev-server manual pass NOT done (dev server could not be started from the agent harness)

## GRAY found while specifying

- GRAY-1: `Entry.k_time` is a required string, so the UI cannot represent an
  open (still live) interval; the trifecta record uses a null `k_end`. This
  round closes current entries at the mock window end, labeled mock. Not
  resolved: how the live seam will send an open interval.
