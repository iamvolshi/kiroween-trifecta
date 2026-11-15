# Design Document

## Overview

The Audit UI is a read-only, single-page browser application built with Vanilla TypeScript and Vite. It presents three views of the append-only record served by the trifecta FastAPI server: an Action List, a Time Travel belief pool inspector, and an Entry Detail. All data access is mediated by a single Seam Adapter module; the application never touches a server endpoint directly. The UI is delivered as one HTML file with all assets bundled at build time. Client-side routing uses the browser History API (pushState/popstate).

---

## Architecture

### Module Boundaries

The codebase is divided into five responsibility layers, each in its own file (or small directory of files). No file exceeds 500 lines.

```
src/
  adapter/
    seam.ts           # Typed contract (interface + factory)
    mock.ts           # Mock Implementation (label: MOCK_ADAPTER)
    live.ts           # Live Implementation (wired later)
  router/
    router.ts         # Hash/pushState router
  views/
    action-list.ts    # Action List View
    time-travel.ts    # Time Travel View
    entry-detail.ts   # Entry Detail View
    not-found.ts      # 404 / unrecognized route
  util/
    kid-display.ts    # KID + KIDMAP label resolution
    interval.ts       # Interval live-at(T) predicate
    format.ts         # Plain-language label derivation from subject + state
  main.ts             # Entry point: wires adapter, instantiates router
  index.html          # Single HTML shell
```

### Data Flow

```
index.html (shell)
  └─ main.ts
       ├─ seam.ts (SeamAdapter interface)
       │    ├─ mock.ts  ──  returns deterministic fixture data
       │    └─ live.ts  ──  calls trifecta /record over HTTPS (future)
       ├─ router.ts
       │    ├─ action-list.ts   (renders on /actions route)
       │    ├─ time-travel.ts   (renders on /time-travel route)
       │    ├─ entry-detail.ts  (renders on /entry/:kid/:subject/:id route)
       │    └─ not-found.ts     (renders on unrecognized routes)
       └─ kid-display.ts (shared by all views)
```

No view module imports from another view module. All views receive a `SeamAdapter` instance injected by `main.ts`.

---

## Components and Interfaces

### SeamAdapter Contract (`src/adapter/seam.ts`)

```typescript
// All times are ISO-8601 strings or Unix ms numbers — callers treat them as opaque display values.
// Authority is always an integer 0–9.

export interface Entry {
  kid: number;           // numeric only; never a name
  subject: string;
  state: string;
  authority: number;     // 0–9
  pool: string;
  k_start: string;
  t_time: string;        // wall time
  e_time: string;        // event time
  k_time: string;        // knowledge time
  evidence: string;
  reason: string;
  prev_hash: string | null;
}

export interface KidMap {
  [kid: number]: string; // label resolved from server; never constructed by the UI
}

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface SeamAdapter {
  /** Fetch all entries, any order; callers sort as needed. */
  fetchAllEntries(): Promise<AdapterResult<Entry[]>>;

  /** Fetch the full (kid, subject) chain in ascending chain order. */
  fetchChain(kid: number, subject: string): Promise<AdapterResult<Entry[]>>;

  /** Fetch entries whose intervals are live at moment T (Unix ms). */
  fetchBeliefPool(momentMs: number): Promise<AdapterResult<Entry[]>>;

  /** Fetch the KIDMAP. Returns empty object if unavailable. */
  fetchKidMap(): Promise<AdapterResult<KidMap>>;
}
```

The Live Implementation wraps every fetch in a try/catch; any non-2xx response or network error produces `{ ok: false, error: ... }`. The Mock Implementation never produces an error result unless explicitly configured for error-testing scenarios.

### Mock Implementation (`src/adapter/mock.ts`)

```typescript
export const MOCK_ADAPTER = 'mock'; // code-level label — unambiguous to any reader

// Fixture data covers:
//   - Action List: ≥3 entries with distinct k_start, mixed authority levels
//   - Time Travel: entries with non-overlapping and overlapping intervals
//     so that cursor at T1 returns set A, cursor at T2 returns set B, cursor
//     at a gap returns empty set
//   - Entry Detail: a chain of ≥3 entries for one (kid, subject),
//     including at least one entry with state "rejected" and one "revised"
//   - KIDMAP: maps kid 1 to a label; kid 2 is absent (tests no-label path)
//   - Error scenarios: a separate factory `createErrorMock()` returns
//     { ok: false } from all methods, for error-state testing
```

The mock never reads from disk at runtime — all data is defined as TypeScript literals.

### Router (`src/router/router.ts`)

The router listens to `popstate` and intercepts link clicks on `<a>` elements whose href starts with `/`. On each navigation event it:

1. Parses the URL path.
2. Calls `unmount()` on the previously active view (if any).
3. Instantiates and mounts the matching view into `#app`.
4. For unrecognized paths, mounts `NotFoundView`.

Route table:

| Path pattern                           | View mounted        |
|----------------------------------------|---------------------|
| `/actions`                             | ActionListView      |
| `/time-travel`                         | TimeTravelView      |
| `/entry/:kid/:subject/:id`             | EntryDetailView     |
| *(anything else)*                      | NotFoundView        |

Each view class exposes:
```typescript
interface View {
  mount(container: HTMLElement): void;
  unmount(): void;
}
```

### Action List View (`src/views/action-list.ts`)

1. On `mount`: calls `adapter.fetchAllEntries()`.
2. Sorts result by `k_start` descending.
3. Renders one `<li>` per entry containing:
   - KID as `<span class="kid">` (numeric; label appended if KIDMAP resolves it)
   - Plain-language label via `formatLabel(entry.subject, entry.state)` from `src/util/format.ts`
   - Authority integer
   - All four interval timestamps: `k_start`, `t_time`, `e_time`, `k_time`
   - An `<a>` element linking to `/entry/:kid/:subject/:id`, focusable by keyboard and pointer
4. If `data` is empty: renders `<p class="empty-state">No entries in the record.</p>` — no other content.
5. If `ok === false`: renders `<p class="error-state">${error}</p>`.

### Time Travel View (`src/views/time-travel.ts`)

1. On `mount`: renders a `<input type="datetime-local" id="moment-cursor">` and an empty `<div id="belief-pool">`.
2. On cursor change:
   a. Reads the input value and converts to Unix ms.
   b. Calls `adapter.fetchBeliefPool(momentMs)`.
   c. Clears `#belief-pool`.
   d. Renders the cursor value as a visible label `<p class="cursor-display">Moment: ${isoString}</p>`.
   e. For each entry: renders KID (numeric + optional KIDMAP label), subject, state, authority, evidence, reason.
   f. If `data` is empty: renders `<p class="empty-state">No entries were live at this moment.</p>`.
   g. If `ok === false`: renders `<p class="error-state">${error}</p>`.

The interval live-at predicate lives in `src/util/interval.ts` and is used by both the Mock Implementation and the view.

### Entry Detail View (`src/views/entry-detail.ts`)

1. On `mount`: parses `kid`, `subject`, `id` from the URL.
2. Calls `adapter.fetchChain(kid, subject)`.
3. Renders a primary entry panel with all twelve fields: `kid`, `subject`, `state`, `authority`, `pool`, `k_start`, `t_time`, `e_time`, `k_time`, `evidence`, `reason`, `prev_hash`.
4. Renders the full chain below, in ascending chain order, including every entry regardless of `state` value.
5. KID is rendered as a number; if KIDMAP resolves it, the label is appended in `<span class="kid-label">` — never a standalone label.
6. If chain is empty: renders `<p class="empty-state">No chain entries found.</p>`.
7. If `ok === false`: renders `<p class="error-state">${error}</p>`.

### KID Display Utility (`src/util/kid-display.ts`)

```typescript
export function renderKid(kid: number, kidMap: KidMap | null): string {
  // Always starts with the numeric KID.
  // If kidMap is non-null and kidMap[kid] exists, appends the resolved label.
  // If kidMap is null or kid is absent: returns numeric only, no "Unknown", no "Agent".
}
```

### Interval Utility (`src/util/interval.ts`)

```typescript
export function isLiveAt(entry: Entry, momentMs: number): boolean {
  // Returns true if momentMs falls within the entry's active interval.
  // Interval bounds are determined by k_start and k_time.
  // Exact bound semantics (inclusive/exclusive) are consistent across
  // Mock and Live implementations.
}
```

### Label Format Utility (`src/util/format.ts`)

```typescript
export function formatLabel(subject: string, state: string): string {
  // Returns a plain-language label composed only from subject and state.
  // No invented content. Example: "auth-service: active"
}
```

---

## Data Models

### Entry (canonical shape)

| Field       | Type            | Notes                                      |
|-------------|------------------|--------------------------------------------|
| kid         | number           | Numeric agent identifier; never a name     |
| subject     | string           | Chain namespace                            |
| state       | string           | e.g. active, rejected, contradicted, revised |
| authority   | number           | Integer 0–9                               |
| pool        | string           | Belief pool tag                            |
| k_start     | string           | Chain start time                           |
| t_time      | string           | Wall time                                  |
| e_time      | string           | Event time                                 |
| k_time      | string           | Knowledge time                             |
| evidence    | string           | Supporting evidence                        |
| reason      | string           | Rationale                                  |
| prev_hash   | string \| null   | Hash of prior entry; null for chain head   |

The three timestamps `t_time`, `e_time`, `k_time` are always displayed as distinct fields; no view conflates them.

### KidMap

```typescript
{ [kid: number]: string }
```

Sourced entirely from the server. The UI stores it as received with no augmentation.

### AdapterResult\<T\>

A discriminated union:
```typescript
{ ok: true; data: T } | { ok: false; error: string }
```

Every caller checks `ok` before accessing `data`. No caller reaches for `data` on a failed result.

---

## Error Handling

| Scenario                              | Behavior                                                    |
|---------------------------------------|-------------------------------------------------------------|
| Network error on live fetch           | Adapter catches, returns `{ ok: false, error: message }`    |
| Non-2xx HTTP response                 | Adapter reads status, returns `{ ok: false, error: ... }`   |
| `ok === false` received by a view     | View renders `<p class="error-state">` with the error string |
| KIDMAP fetch fails                    | View falls back to numeric-only KID display; no label shown  |
| Empty result (`data: []`)             | View renders explicit `<p class="empty-state">` message     |
| Unrecognized route                    | Router mounts NotFoundView with link back to `/actions`      |
| Chain break (hash inconsistency)      | GRAY — not resolved in this design                          |

Error states and empty states always use different CSS classes (`error-state` vs `empty-state`) so they are visually distinguishable.

---

## Routing Details

### URL Scheme

The router uses the HTML5 History API (`pushState` / `popstate`). No server-side routing is needed because Vite's dev server and typical static hosts can be configured to serve `index.html` for all paths.

An alternative hash-based fallback (`/#/actions`) is noted as an option if the host cannot be configured — this choice is not locked in design.

### Navigation Links

All `<a>` elements use relative paths (`/actions`, `/time-travel`, `/entry/...`). The router intercepts clicks before the browser performs a full navigation. Each entry in the Action List and each chain entry in Entry Detail is wrapped in an `<a>` that is both pointer-clickable and keyboard-focusable (no `tabindex="-1"`, no `pointer-events: none`).

---

## Build and Bundle

- **Vite** bundles `src/main.ts` and `index.html` into `dist/`.
- Output is a single `index.html` with inlined or referenced JS/CSS assets.
- TypeScript strict mode is enabled.
- `vitest` is listed as a dev dependency; tests run via `vitest --run`.
- No file in `src/` exceeds 500 lines; enforced by CI lint step.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Routing exclusivity

*For any* URL route in the application's route table, navigating to that route results in exactly one view being mounted in `#app` — the view corresponding to that route — and all previously mounted views being removed.

**Validates: Requirements 2.3, 2.4, 2.5**

---

### Property 2: Unrecognized route renders not-found

*For any* URL path string that does not match any entry in the route table, the router mounts the NotFoundView, which contains an explicit "not found" message and a navigable link to the Action List route.

**Validates: Requirements 2.7**

---

### Property 3: Action List ordering invariant

*For any* non-empty collection of entries returned by the Seam Adapter, the Action List View renders them such that for every adjacent pair of rendered items (i, i+1), item i has a `k_start` value that is greater than or equal to item i+1's `k_start` (descending order).

**Validates: Requirements 3.1**

---

### Property 4: Action List field completeness

*For any* entry returned by the Seam Adapter, the Action List View's rendered item for that entry contains the entry's `kid` as a numeric integer, its `authority` as an integer, and all four interval timestamps (`k_start`, `t_time`, `e_time`, `k_time`) as distinct visible values.

**Validates: Requirements 3.2**

---

### Property 5: Label derivation integrity

*For any* entry, the plain-language label rendered in the Action List is composed solely from that entry's `subject` and `state` fields — no string from outside those two fields appears as part of the label.

**Validates: Requirements 3.3**

---

### Property 6: Action List entry navigability

*For any* entry rendered in the Action List, the DOM element representing that entry contains an `<a>` element that (a) has a valid `href` pointing to the correct Entry Detail route for that entry, (b) is reachable by keyboard focus (not `tabindex="-1"`), and (c) is not pointer-event-disabled.

**Validates: Requirements 3.4, 3.5**

---

### Property 7: Time Travel pool correctness

*For any* moment value T (expressed as Unix milliseconds) and *for any* set of entries with known interval bounds, the Time Travel View's frozen Belief Pool contains exactly the entries for which `isLiveAt(entry, T)` returns true — no more, no fewer.

**Validates: Requirements 4.2, 4.4, 9.2**

---

### Property 8: Time Travel cursor display

*For any* moment T set by the user, the Time Travel View renders a visible element whose text content reflects T, displayed alongside the frozen Belief Pool before any other pool content.

**Validates: Requirements 4.5**

---

### Property 9: Belief Pool field completeness

*For any* entry in the frozen Belief Pool, the Time Travel View renders all six required fields for that entry: `kid` (numeric), `subject`, `state`, `authority` (integer), `evidence`, and `reason` as distinct visible values.

**Validates: Requirements 4.3**

---

### Property 10: Entry Detail field completeness

*For any* entry E rendered by the Entry Detail View, the rendered output contains all twelve fields: `kid` (numeric), `subject`, `state`, `authority` (integer), `pool`, `k_start`, `t_time`, `e_time`, `k_time`, `evidence`, `reason`, and `prev_hash`.

**Validates: Requirements 5.1**

---

### Property 11: Chain ordering and completeness

*For any* (KID, subject) chain of entries returned by the Seam Adapter, the Entry Detail View renders every entry in the chain in ascending chain order (oldest first), including entries whose `state` is `"rejected"`, `"contradicted"`, or `"revised"` — none are omitted or visually hidden.

**Validates: Requirements 5.2, 5.3, 9.3**

---

### Property 12: KID numeric primacy

*For any* entry rendered in any view, the `kid` value is present as a numeric integer in the rendered DOM — no view renders a KID-identifying position that contains only a text label with no accompanying number.

**Validates: Requirements 6.1**

---

### Property 13: KIDMAP label fidelity

*For any* KID that is present in the KIDMAP, the rendered label alongside the numeric KID matches the value from the KIDMAP exactly. *For any* KID that is absent from the KIDMAP (or when the KIDMAP is unavailable), no label string is rendered adjacent to that KID — specifically, strings such as "Unknown" or "Agent" do not appear.

**Validates: Requirements 5.4, 6.2, 6.3, 6.4, 9.5**

---

### Property 14: Error propagation

*For any* typed error value (`{ ok: false, error: string }`) returned by the Seam Adapter to any view, that view renders an explicit `<p class="error-state">` element containing the error string, and renders no partial entry data alongside it.

**Validates: Requirements 1.7, 3.7, 4.7, 5.6**

---

### Property 15: Empty state explicitness

*For any* view rendered after the Seam Adapter returns an empty result (`{ ok: true, data: [] }`), the rendered DOM contains an explicit `<p class="empty-state">` element with a descriptive message, and contains no placeholder rows, loading shimmers, animated skeleton elements, or numeric zero values in a count/metric context.

**Validates: Requirements 3.6, 4.6, 5.5, 7.1, 7.2, 7.3**

---

### Property 16: Empty state vs error state distinction

*For any* view, the DOM element rendered for an empty result (`class="empty-state"`) is structurally and visually distinct from the DOM element rendered for an error result (`class="error-state"`) — they do not share the same CSS class, element identity, or text content pattern.

**Validates: Requirements 7.4**

---

### Property 17: Error adapter typed result

*For any* error response (network failure or non-2xx HTTP status) encountered by the Live Implementation, the Seam Adapter returns `{ ok: false, error: string }` with a non-empty error string — it never throws an unhandled exception to the caller.

**Validates: Requirements 1.7**

---

## Testing Strategy

**Unit and example-based tests** cover:
- Contract conformance: both `MockAdapter` and `LiveAdapter` satisfy the `SeamAdapter` TypeScript interface (type-level + runtime conformance test, Requirement 9.6).
- Per-view field rendering: each view is rendered against mock data and asserted to contain the correct field values from the fixture (Requirements 9.1, 3.2, 4.3, 5.1).
- Empty state per view: each view is rendered with an empty-result adapter and asserted to show the explicit empty-state message with no placeholder rows (Requirements 3.6, 4.6, 5.5, 9.4).
- KIDMAP unavailable: render any view with no KIDMAP and assert only numeric KID appears — no "Unknown" or "Agent" (Requirement 6.4).
- Browser back/forward: push two routes, trigger `popstate` back, assert correct view is mounted (Requirement 2.6).
- Vitest `--run` flag: the test suite exits cleanly without hanging (Requirement 8.5).
- Moment cursor control presence: render Time Travel View and assert the `<input type="datetime-local">` element exists (Requirement 4.1).

**Property-based tests** (Vitest + fast-check) cover the seventeen correctness properties above. Each property test runs a minimum of 100 iterations. Test tags use the format: `Feature: audit-ui, Property N: <property title>`.

The `isLiveAt` interval predicate in `src/util/interval.ts` is a pure function and is the primary target for property-based testing around time travel correctness (Property 7). Rendering properties (Properties 3–6, 8–16) use generated mock entries fed through the view's render functions in a jsdom environment.

No property-based tests are written for build output, file line counts, or CSS class presence checks — those are verified by smoke tests and static analysis in CI.
