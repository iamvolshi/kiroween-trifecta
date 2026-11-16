# WO-C -- Calendar drill-down (order task 4)

Read `tasks.md` in this folder first (CalendarTarget is defined there).
Contract, do NOT change: `audit-ui/src/adapter/seam.ts`. Reuse, do NOT
change: `audit-ui/src/util/interval.ts` (isLiveAt, parseMs, compareKStart),
`util/moment.ts` (parseUtcInput), `util/kid-display.ts` (renderKid),
`views/nav.ts` (createNav), `router/router.ts` (View). Read
`views/time-travel.ts` and `views/action-list.ts` for style, the request
token pattern and the Entry Detail href format; `test-helpers.ts`
(makeEntry, tick); `style.css`.

## You own only

`audit-ui/src/util/calendar.ts`, `audit-ui/src/views/calendar.ts` (split
into `views/calendar-*.ts` if it nears 300 lines), tests
`audit-ui/src/util/calendar.test.ts` and `audit-ui/src/views/
calendar*.test.ts`, and an APPENDED `/* Calendar view */` section at the END
of `audit-ui/src/style.css` (append only; WO-B appends too). Do not touch
router.ts, nav.ts, mock.ts (WO-A is rewriting it) or anything else.

## Build (all dates UTC)

- `util/calendar.ts`, pure:
  - `entryDayKey(e): string | null`: `YYYY-MM-DD` of k_start (parseMs);
    null if unparseable.
  - `daysWithEntries(entries, year, month): Map<number, number>`: day ->
    count of entries whose k_start falls on that UTC day.
  - `monthGrid(year, month): (number | null)[][]`: weeks, Monday first,
    with matching headers.
  - `entriesInHour(entries, y, m, d, h): Entry[]`: k_start in [hour start,
    +1h), sorted by compareKStart.
  - `hourMomentInput(y, m, d, h): string` -> `YYYY-MM-DDTHH:00`; the queried
    moment is `parseUtcInput(that string)`, so shown and queried moments are
    the same.
  - `CalendarTarget` type exactly as tasks.md; `parseCalendarPath(path):
    CalendarTarget | 'default' | null`: bare `/calendar` -> `'default'`;
    `/calendar/YYYY-MM`, `/calendar/YYYY-MM-DD`, `/calendar/YYYY-MM-DD/HH`
    -> a target; anything else or an invalid range -> null (the router
    shows NotFound). `calendarHref(target)`.
- `views/calendar.ts`: `export class CalendarView implements View {
  constructor(adapter: SeamAdapter, target: CalendarTarget | null) }`; null
  = `/calendar` default: month of the newest entry by k_start
  (fetchAllEntries), else current UTC month. createNav() at every level and
  in the error state.
  - Month: h1 `Calendar`, title like `November 2026 (UTC)`, prev/next links
    to `/calendar/YYYY-MM`, the grid; each day links to
    `/calendar/YYYY-MM-DD`. A day with entries has a `.day-dot` (title/aria
    gives the count). Days without entries have no dot.
  - Day: title, link back to month; `.empty-state` `No record entries on
    this day.` when none; 24 hour links 00..23 to `/calendar/YYYY-MM-DD/HH`,
    each with a count when > 0.
  - Hour: link back to the day; `.cursor-display` `Moment (UTC):
    YYYY-MM-DDTHH:00` (the same string fed to parseUtcInput); section `What
    the agent did this hour` = entriesInHour (or `.empty-state` `Nothing was
    recorded in this hour.`); section `What it believed at this moment` =
    `adapter.fetchBeliefPool(moment)` (or `.empty-state` `No entries were
    live at this moment.`).
  - Every listed entry shows KID (renderKid + fetchKidMap), subject, state,
    authority, evidence, reason, and links to Entry Detail.
  - Adapter errors -> `.error-state`. Request token / unmount guard.
    textContent for data.

## Regression tests

Do NOT depend on WO-A's mock: use a local fake adapter over makeEntry()
lists, record methods via isLiveAt (assembly methods may return ok:false).
Required: dots match the record's days (fast-check: dotted days == k_start
days); hour view shows exactly the live intervals at that moment (rendered
belief ids == entries.filter(isLiveAt) ids); hour "did" list ==
entriesInHour; an empty day shows the empty state and no dot in its month;
displayed moment parses to the queried moment (spy on fetchBeliefPool arg);
parseCalendarPath accepts the 4 forms and rejects 2026-13, 2026-02-30, hour
24 and junk; `/calendar` default picks the newest entry's month; nav at
every level and in the error state; entry links go to `/entry/...`.

## Rules

Built-in file tools only (UTF-8 no BOM; never PowerShell Set-Content).
Verify from `audit-ui/`: `npx vitest run src/util/calendar src/views/
calendar` and `npx tsc --noEmit` (errors only inside adapter/mock.ts are
WO-A's). Do NOT commit or push. Report: files + line counts, signatures,
tests, results, any GRAY.
