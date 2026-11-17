# WO-F -- Shell: three columns, left directories, record view

Read `tasks.md` in this folder first. Contracts, do NOT edit:
`audit-ui/src/shell/panel.ts` (Panel), `audit-ui/src/views/chat-log.ts`
(ChatLog.subscribe), `audit-ui/src/adapter/seam.ts` (fetchRecord,
RecordResult). Read `router/router.ts`, `views/nav.ts`, `boot.ts`, each view
in `views/`, `adapter/active.ts`, `style.css`, and the tests that check
`nav` (`views/nav.test.ts`, `views/chat.test.ts`, `views/calendar.test.ts`,
`assembly-integration.test.ts`, `router/*.test.ts`).

## You own only

New: `audit-ui/src/shell/shell.ts`, `audit-ui/src/shell/left.ts`,
`audit-ui/src/views/record.ts`, tests `audit-ui/src/shell/shell.test.ts`,
`audit-ui/src/shell/left.test.ts`, `audit-ui/src/views/record.test.ts`.
Edit: `router/router.ts`, `views/nav.ts`, and in every view file
(`action-list.ts`, `time-travel.ts`, `entry-detail.ts`, `not-found.ts`,
`chat.ts`, `calendar.ts`) ONLY the lines that add the nav. Edit nav
assertions in `views/nav.test.ts`, `views/chat.test.ts`,
`views/calendar.test.ts`, `assembly-integration.test.ts` (task 6 block) and
router tests. Append a `/* Shell */` section to the end of `style.css`.
Do NOT edit `views/chat-turn.ts`, `scenario/*`, `adapter/*` (other
implementers own them now).

## Build

1. shell.ts: `createShell(container): { left, center, right }` builds
   `<div class="shell">` with `.shell-left`, `.shell-center`,
   `.shell-right` (right shows `.telemetry-pending` "Telemetry" heading
   only; the parent wires the real panel later). CSS grid, three columns,
   readable, existing CSS variables, collapses to one column on narrow
   screens. No colors decided: no new palette.
2. Router: builds the shell ONCE in its container; mounts the routed View
   into `center`; mounts the left Panel into `left`; keeps one ChatLog;
   subscribes the left panel's `refresh()` to `chatLog.subscribe`; calls
   refresh after each navigation too (to mark the current destination).
   Expose `getChatLog()` and `getShellSlots()` for the parent's wiring.
   `destroy()` unmounts view + panels, unsubscribes, empties the container.
   Add route `/record/:account` (decodeURIComponent, malformed -> NotFound)
   -> `RecordView`. Every existing route keeps working; `/` boot unchanged.
3. Views stop rendering the nav themselves. The nav (createNav: Action
   List, Time Travel, Chat, Calendar + MOCK badge) lives once, in the left
   column. Mark the current destination with `aria-current="page"`.
4. left.ts: `class LeftPanel implements Panel { constructor(adapter, log) }`.
   Renders: the nav; a "Record" section with one folder link per account
   `/record/<account>`, accounts = distinct subject prefixes before the
   first `.` among `fetchAllEntries()` (subjects with no `.` go under one
   folder per subject, linking to its Entry Detail chain instead: use the
   latest entry's href); each folder shows its entry count; empty record ->
   `.empty-state`; error -> `.error-state`. A "Going back" section: Calendar
   and Time Travel links. Request token so late results are dropped.
5. views/record.ts: `RecordView(adapter, accountId)` calls
   `fetchRecord(accountId)`; per subject a list in k_start order showing
   KID (renderKid), state, authority, evidence, k_start..k_time, each
   linking to Entry Detail; none -> `.empty-state` "No record entries for
   this account."; error -> `.error-state`. Mock label is already in the
   left column.

## Regression tests

Shell has the three slots and the routed view lands in the center; the
nav exists exactly once on every route (list the routes) with all four
destinations + the MOCK badge; aria-current follows navigation; left
folders = the record's accounts and update after a chat turn reveals
parcel-77 (push to the ChatLog through the real flow or call refresh);
record view lists the account's entries in k_start order and links to
Entry Detail; unknown account empty state; malformed `/record/%E0%A4%A`
-> NotFound; destroy() leaves the container empty and stops listening.

## Rules

Built-in file tools only (UTF-8, no BOM). Run from
`D:\kiroween-trifecta\kiroween-trifecta\audit-ui`: `npx vitest run` and
`npx tsc --noEmit`; failures clearly in another work order's files
(scenario, adapter, chat-turn, telemetry): note only. Do NOT commit, push
or change git state. Report: files + line counts, exports, tests, results.
