# WO-B -- Chat view (order task 3)

Read `tasks.md` in this folder first. Contract, do NOT change:
`audit-ui/src/adapter/seam.ts` (ChatTurn, EngineActivity, AskResult, Lesson,
UpdateResult, SeamAdapter). Read for style: `audit-ui/src/views/
time-travel.ts`, `action-list.ts`, `entry-detail.ts`, `nav.ts`
(`createNav()`), `router/router.ts` (View), `util/kid-display.ts`,
`test-helpers.ts`, `style.css`.

## You own only

`audit-ui/src/views/chat-log.ts`, `chat-turn.ts`, `chat.ts`, tests
`audit-ui/src/views/chat*.test.ts`, and an APPENDED `/* Chat view */`
section at the END of `audit-ui/src/style.css` (append only; WO-C appends
too). WO-A is rewriting `adapter/mock.ts` now. WO-D adds the route and nav
link later: do NOT touch router.ts or nav.ts.

## Build

- `chat-log.ts`: `export class ChatLog { turns(): ChatTurn[]; push(t:
  ChatTurn): void }`. Append-only; turns() returns a copy.
- `chat.ts`: `export class ChatView implements View { constructor(adapter:
  SeamAdapter, log: ChatLog) }`. createNav() on top; h1 `Chat with the agent
  (ARCHE)`; visible note that replies are scripted mock, no model;
  transcript; form with labeled text input `Your message` and a Send button.
  Log empty: `.empty-state` saying the scenario has not started. On mount,
  render turns already in the log. Submit: ignore blank; disable Send while
  waiting; call `adapter.chat(message)`; ok -> push + render, clear input;
  ok:false -> `.error-state` with the error text (not pushed). Request
  token + unmount guard like time-travel.ts. Progress `.step-progress`:
  `Step N of M` from the latest turn with a step, else `Scenario not
  started`. Data via textContent only.
- `chat-turn.ts`: render one ChatTurn: user message, ARCHE reply, then
  `.engines` with four rows `.engine-arche`, `.engine-erie`, `.engine-elle`,
  `.engine-katie`, each with a label element text exactly `ARCHE`, `ERIE`,
  `ELLE`, `KATIE`.
  - ARCHE: `talked`.
  - ERIE present: `found`, its text, and a provenance list (source, content,
    excerpt per item). null: `did not act this turn`.
  - ELLE present: `learned` + rule (detail when rule is null). null: `did
    not act this turn`.
  - KATIE non-empty: `recorded` + one link per UpdateResult,
    `/entry/{kid}/{encodeURIComponent(subject)}/{encodeURIComponent(
    entry_id)}` (same format as action-list.ts), text = entry id. Empty:
    `did not act this turn`.
  - `known:false` turns get class `not-knowing`.

## Regression tests (Vitest + jsdom)

Do NOT depend on WO-A's mock: use a local fake SeamAdapter whose chat()
returns scripted ChatTurns. Required: empty state before any turn; one
submit calls chat once and renders the turn, progress `Step 1 of 4`; the
four engine labels render with correct acted / not-acted text; ERIE
provenance rendered; KATIE link href is `/entry/4/order-1042.delivery_date/
scn-s1` for `{kid:4, subject:'order-1042.delivery_date', entry_id:
'scn-s1'}`; not-knowing turn has class not-knowing and no KATIE link; error
result shows error-state; blank input does not call chat; a reply after
unmount neither throws nor renders; the log survives remount; nav present.

## Rules

Built-in file tools only (UTF-8 no BOM; never PowerShell Set-Content).
Each file under ~300 lines. Verify from `audit-ui/`: `npx vitest run
src/views/chat` and `npx tsc --noEmit` (errors inside adapter/mock.ts are
WO-A's, in progress; yours must be zero). Do NOT commit or push. Report:
files + line counts, signatures, tests, results, questions.
