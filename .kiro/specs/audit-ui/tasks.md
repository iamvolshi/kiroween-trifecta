# Implementation Plan: Audit UI

## Overview

Build a read-only Vanilla TypeScript + Vite single-page application that presents three views (Action List, Time Travel, Entry Detail) of the trifecta FastAPI record. All data access goes through a Seam Adapter contract; a Mock Implementation drives development and testing. Seventeen correctness properties are verified via Vitest + fast-check property-based tests alongside example-based unit tests.

## Tasks

- [x] 1. Repo foundation and project scaffold
  - [x] 1.1 Initialise Vite + TypeScript project
    - Run `npm create vite@latest` (or equivalent) targeting a Vanilla TypeScript template inside the workspace root
    - Confirm `tsconfig.json` has `"strict": true`
    - Add `vitest` and `@vitest/ui` as dev dependencies; add `fast-check` as a dev dependency for property-based tests
    - Add `jsdom` (or `happy-dom`) environment config to `vite.config.ts` / `vitest.config.ts` so view tests can mount DOM
    - Confirm `npm run build` and `vitest --run` both succeed on the empty scaffold
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 1.2 Establish src/ directory layout
    - Create stub files (empty exports) at every path listed in the design module boundary table: `src/adapter/seam.ts`, `src/adapter/mock.ts`, `src/adapter/live.ts`, `src/router/router.ts`, `src/views/action-list.ts`, `src/views/time-travel.ts`, `src/views/entry-detail.ts`, `src/views/not-found.ts`, `src/util/kid-display.ts`, `src/util/interval.ts`, `src/util/format.ts`, `src/main.ts`
    - Create `index.html` with a `<div id="app"></div>` shell and a `<script type="module" src="/src/main.ts">` tag
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Seam Adapter contract and Mock Implementation
  - [x] 2.1 Define the SeamAdapter TypeScript contract
    - Write the `Entry`, `KidMap`, `AdapterResult<T>`, and `SeamAdapter` interface types in `src/adapter/seam.ts` exactly as specified in the design
    - Export all four types; nothing else is exported from this file
    - _Requirements: 1.1, 1.6_

  - [x] 2.2 Implement the Mock Adapter
    - Write `src/adapter/mock.ts` exporting the `MOCK_ADAPTER` constant (string `'mock'`) and a default `createMockAdapter()` factory returning a `SeamAdapter`
    - Fixture data must cover: ≥3 Action List entries with distinct `k_start` and mixed authority; Time Travel entries with non-overlapping and overlapping intervals (cursor at T1 → set A, T2 → set B, gap → empty); a (kid, subject) chain of ≥3 entries including at least one `"rejected"` and one `"revised"` state; KIDMAP with kid 1 mapped to a label, kid 2 absent
    - Also export `createErrorMock()` returning `{ ok: false }` from all methods
    - All fixture data is TypeScript literals — no disk reads at runtime
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 2.3 Write contract-conformance test for Mock and Live adapters
    - Assert that `createMockAdapter()` satisfies the `SeamAdapter` interface at the TypeScript type level (assignability check)
    - Assert that `createErrorMock()` returns `{ ok: false }` from all four methods
    - Assert that `createLiveAdapter()` (stub at this point) also satisfies the interface
    - **Property 17: Error adapter typed result** — generate arbitrary error strings; assert each `createErrorMock()` call returns `{ ok: false, error }` with a non-empty string
    - **Validates: Requirements 1.7, 9.6**
    - _Requirements: 1.7, 9.6_

- [x] 3. Utility modules
  - [x] 3.1 Implement `isLiveAt` interval predicate (`src/util/interval.ts`)
    - Write `export function isLiveAt(entry: Entry, momentMs: number): boolean`
    - Interval lower bound is `k_start` (inclusive); upper bound is `k_time` (exclusive) — consistent with the design spec
    - Parse both bounds from their ISO-8601 / Unix ms string values to numeric ms for comparison
    - _Requirements: 4.2, 4.4_

  - [x] 3.2 Write property-based tests for `isLiveAt`
    - **Property 7 (partial — predicate only): Time Travel pool correctness**
    - **Validates: Requirements 4.2, 4.4, 9.2**
    - Generate arbitrary (k_start, k_time, momentMs) triples; assert `isLiveAt` returns true iff `k_start_ms ≤ momentMs < k_time_ms`
    - Verify the predicate is consistent: `isLiveAt(e, T)` for all T in a generated set matches the expected partition
    - _Requirements: 4.2, 4.4, 9.2_

  - [x] 3.3 Implement `renderKid` utility (`src/util/kid-display.ts`)
    - Write `export function renderKid(kid: number, kidMap: KidMap | null): string`
    - If `kidMap` is non-null and `kidMap[kid]` exists, return `"${kid} ${kidMap[kid]}"` (or equivalent with label appended)
    - If `kidMap` is null or `kid` is absent, return `String(kid)` — no "Unknown", no "Agent"
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 3.4 Write property-based tests for `renderKid`
    - **Property 12: KID numeric primacy** — for any (kid, kidMap) pair the output starts with the numeric kid string
    - **Property 13: KIDMAP label fidelity** — for kid present in kidMap, label matches exactly; for kid absent, no extra string appears
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 3.5 Implement `formatLabel` utility (`src/util/format.ts`)
    - Write `export function formatLabel(subject: string, state: string): string`
    - Return a plain-language label composed solely from `subject` and `state` (e.g., `"${subject}: ${state}"`)
    - _Requirements: 3.3_

  - [x] 3.6 Write property-based tests for `formatLabel`
    - **Property 5: Label derivation integrity** — generate arbitrary subject/state pairs; assert the returned string contains only substrings derivable from subject or state (no injected content)
    - **Validates: Requirements 3.3**
    - _Requirements: 3.3_

- [x] 4. Router
  - [x] 4.1 Implement the client-side router (`src/router/router.ts`)
    - Export `class Router` accepting a `SeamAdapter` and a container `HTMLElement`
    - Implement the route table from the design: `/actions` → ActionListView, `/time-travel` → TimeTravelView, `/entry/:kid/:subject/:id` → EntryDetailView, anything else → NotFoundView
    - On navigation: call `unmount()` on the previous view; instantiate the new view; call `mount(container)`
    - Intercept `<a>` clicks on hrefs starting with `/` and call `pushState`; listen to `popstate`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.2 Write property-based tests for the router
    - **Property 1: Routing exclusivity** — for any route in the route table, navigate to it and assert exactly one view is mounted in `#app`
    - **Property 2: Unrecognized route renders not-found** — generate arbitrary path strings not in the route table; assert NotFoundView is mounted and contains a link to `/actions`
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.7**
    - Also add example-based test: push two routes, trigger `popstate` back, assert correct view mounts (Requirement 2.6)
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Checkpoint — core infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Action List View
  - [x] 6.1 Implement `ActionListView` (`src/views/action-list.ts`)
    - Export `class ActionListView` implementing `View` (`mount(container)` / `unmount()`)
    - On `mount`: call `adapter.fetchAllEntries()`; sort by `k_start` descending; render `<ul>` with one `<li>` per entry
    - Each `<li>` contains: `<span class="kid">` with `renderKid(entry.kid, kidMap)` output, `formatLabel(entry.subject, entry.state)`, `entry.authority` as integer, and all four timestamps (`k_start`, `t_time`, `e_time`, `k_time`) as distinct visible values
    - Each `<li>` wraps an `<a href="/entry/${entry.kid}/${entry.subject}/${entry.id}">` that is keyboard-focusable (no `tabindex="-1"`) and not pointer-event-disabled
    - On empty result: render `<p class="empty-state">No entries in the record.</p>`
    - On error: render `<p class="error-state">${error}</p>`
    - Fetch KIDMAP via `adapter.fetchKidMap()` before rendering; fall back to numeric-only if unavailable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 6.2 Write property-based tests for ActionListView
    - **Property 3: Action List ordering invariant** — generate non-empty entry arrays with arbitrary `k_start` values; assert rendered list order is descending by `k_start`
    - **Property 4: Action List field completeness** — generate arbitrary entries; assert each rendered `<li>` contains numeric kid, integer authority, and all four timestamps as distinct visible text nodes
    - **Property 5 (view layer): Label derivation integrity** — assert no label text outside subject/state appears in rendered items
    - **Property 6: Action List entry navigability** — assert each `<li>` contains an `<a>` with correct href, no `tabindex="-1"`, not pointer-event-disabled
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - Also add example-based tests: empty-state message rendered on empty result (Req 3.6, 9.4); error-state rendered on error (Req 3.7); each field value matches fixture exactly (Req 9.1)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.4_

- [x] 7. Time Travel View
  - [x] 7.1 Implement `TimeTravelView` (`src/views/time-travel.ts`)
    - Export `class TimeTravelView` implementing `View`
    - On `mount`: render `<input type="datetime-local" id="moment-cursor">` and `<div id="belief-pool">`
    - On cursor `change`: read value → convert to Unix ms → call `adapter.fetchBeliefPool(momentMs)` → clear `#belief-pool` → render `<p class="cursor-display">Moment: ${isoString}</p>` then entries
    - Each entry in pool renders: `renderKid(entry.kid, kidMap)`, `entry.subject`, `entry.state`, `entry.authority` (integer), `entry.evidence`, `entry.reason`
    - On empty result: render `<p class="empty-state">No entries were live at this moment.</p>`
    - On error: render `<p class="error-state">${error}</p>`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 7.2 Write property-based tests for TimeTravelView
    - **Property 7 (view layer): Time Travel pool correctness** — generate moment values T and entry sets; assert the rendered pool contains exactly the entries for which `isLiveAt(entry, T)` is true
    - **Property 8: Time Travel cursor display** — for any moment T, assert a `.cursor-display` element containing T's representation appears before pool entries
    - **Property 9: Belief Pool field completeness** — generate arbitrary pool entries; assert each rendered entry shows kid (numeric), subject, state, authority (integer), evidence, reason as distinct values
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 9.2**
    - Also add example-based tests: `<input type="datetime-local">` present on mount (Req 4.1); empty-state message on empty pool (Req 4.6, 9.4); error-state on error (Req 4.7); pool replaces on cursor change (Req 4.4)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.2, 9.4_

- [x] 8. Entry Detail View
  - [x] 8.1 Implement `EntryDetailView` (`src/views/entry-detail.ts`)
    - Export `class EntryDetailView` implementing `View`; constructor receives parsed `kid`, `subject`, `id` from route params
    - On `mount`: call `adapter.fetchChain(kid, subject)` → render primary entry panel with all twelve fields: `kid` (numeric via `renderKid`), `subject`, `state`, `authority` (integer), `pool`, `k_start`, `t_time`, `e_time`, `k_time`, `evidence`, `reason`, `prev_hash`
    - Below the primary panel: render the full chain in ascending chain order (oldest first) — include every entry regardless of `state`
    - KID rendered as number; if KIDMAP resolves it, label appended in `<span class="kid-label">` — never standalone label
    - On empty chain: render `<p class="empty-state">No chain entries found.</p>`
    - On error: render `<p class="error-state">${error}</p>`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 8.2 Write property-based tests for EntryDetailView
    - **Property 10: Entry Detail field completeness** — generate arbitrary entries; assert all twelve fields appear as distinct visible values in the primary panel
    - **Property 11: Chain ordering and completeness** — generate chains with arbitrary state values including `"rejected"`, `"contradicted"`, `"revised"`; assert all entries appear in ascending chain order, none omitted
    - **Property 12 (view layer): KID numeric primacy** — assert no view renders a KID position containing only a text label
    - **Property 13 (view layer): KIDMAP label fidelity** — assert label matches KIDMAP exactly when present; no label when absent
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 9.3**
    - Also add example-based tests: empty-state on empty chain (Req 5.5, 9.4); error-state on error (Req 5.6); each field value matches fixture exactly (Req 9.1); no KID label rendered when KID absent from KIDMAP (Req 9.5)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.1, 9.3, 9.4, 9.5_

- [x] 9. Checkpoint — all views
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. NotFoundView and global empty/error state polish
  - [x] 10.1 Implement `NotFoundView` (`src/views/not-found.ts`)
    - Export `class NotFoundView` implementing `View`
    - Renders an explicit "not found" message and an `<a href="/actions">` link back to the Action List
    - _Requirements: 2.7_

  - [x] 10.2 Audit all views for empty-state and error-state CSS class correctness
    - Verify every empty result renders `<p class="empty-state">` and every error result renders `<p class="error-state">` — no shared class, no shared text pattern
    - Verify no view renders placeholder rows, loading shimmers, or animated skeleton elements on empty result
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.3 Write property-based tests for empty vs error state distinction
    - **Property 15: Empty state explicitness** — render each view with an empty-result adapter; assert `.empty-state` present and no `.error-state`, no skeleton/shimmer/zero-metric elements
    - **Property 16: Empty state vs error state distinction** — render each view with an error adapter; assert `.error-state` present and CSS class is structurally distinct from `.empty-state`
    - **Property 14: Error propagation** — generate arbitrary error strings; for each view assert `<p class="error-state">` contains the exact error string and no partial entry data appears
    - **Validates: Requirements 3.6, 3.7, 4.6, 4.7, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4**
    - _Requirements: 1.7, 3.6, 3.7, 4.6, 4.7, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4_

- [x] 11. Live Adapter stub and main.ts wiring
  - [x] 11.1 Implement Live Adapter stub (`src/adapter/live.ts`)
    - Export `createLiveAdapter(baseUrl: string): SeamAdapter`
    - Each method wraps a `fetch` call in try/catch; non-2xx responses return `{ ok: false, error: ... }`; network errors return `{ ok: false, error: message }`
    - Stub returns `{ ok: false, error: 'Live adapter not wired' }` from all methods until the actual endpoint URL is confirmed — keeping the seam boundary clean
    - _Requirements: 1.2, 1.3, 1.6, 1.7_

  - [x] 11.2 Wire `main.ts`
    - Import `createMockAdapter` from `src/adapter/mock.ts`; instantiate router with mock adapter and `document.getElementById('app')`
    - Navigate to `/actions` on initial load (call `router.navigate('/actions')` or equivalent)
    - Export a named constant `ACTIVE_ADAPTER = MOCK_ADAPTER` so the wiring is unambiguous in code review
    - _Requirements: 1.1, 1.4, 2.1, 2.2_

- [x] 12. Build validation and CI lint
  - [x] 12.1 Verify file line counts
    - Run a line-count check (e.g., via a small script or `wc -l`) on every `src/**/*.ts` file; confirm none exceeds 500 lines
    - _Requirements: 8.2_

  - [x] 12.2 Write final integration smoke tests
    - Confirm `vitest --run` exits cleanly (exit code 0) with all tests passing
    - Confirm `npm run build` produces a `dist/index.html`
    - _Requirements: 8.1, 8.5_

- [x] 13. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical seams
- Property tests use Vitest + fast-check; each runs ≥100 iterations
- Unit/example tests use jsdom (or happy-dom) so view classes can mount real DOM nodes
- The Live Adapter boundary is intentionally left clean per the BuildPrint GRAY; wiring it to a real URL is a separate task not included here
- The `.kiro` directory must not appear in `.gitignore`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "3.3", "3.5"] },
    { "id": 3, "tasks": ["2.3", "3.2", "3.4", "3.6", "4.1"] },
    { "id": 4, "tasks": ["4.2", "6.1", "7.1", "8.1"] },
    { "id": 5, "tasks": ["6.2", "7.2", "8.2", "10.1"] },
    { "id": 6, "tasks": ["10.2"] },
    { "id": 7, "tasks": ["10.3", "11.1"] },
    { "id": 8, "tasks": ["11.2"] },
    { "id": 9, "tasks": ["12.1", "12.2"] }
  ]
}
```
