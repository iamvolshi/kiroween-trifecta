# Requirements Document

## Introduction

The Audit UI is a read-only, browser-based front-end application for the Kiroween 2026 Frankenstein entry. It answers: **What did the agent do, and what did it believe when it did it?** The UI reads the append-only, hash-chained record served by the existing trifecta FastAPI server and presents three distinct views: an action list, a time-travel belief pool inspector, and a full entry detail. The application is built with Vanilla TypeScript, Vite, and a single HTML file with hash/pushState routing. It never writes to the record, never invents content, and never exposes a database key in the browser.

## Glossary

- **Audit UI**: The browser application described in this document.
- **Record**: The append-only, hash-chained data store of belief entries served by the trifecta FastAPI server. Each entry belongs to a (KID, subject) chain.
- **KID**: A numeric identifier (integer) assigned to an agent. KID is never displayed as an invented name.
- **KIDMAP**: A server-provided mapping that resolves a KID number to a display label. The Audit UI uses this mapping as-is; it never constructs or invents a label.
- **Subject**: A string that, together with a KID, identifies a unique hash chain in the Record.
- **Entry**: One node in a (KID, subject) chain. Carries: KID, subject, state, authority, pool, interval (k_start, t_time, e_time, k_time), evidence, reason, prev_hash.
- **Authority**: An integer on the scale 0–9 representing the authority level of an entry.
- **Interval**: The temporal span of an entry, defined by k_start plus three distinct wall/event/knowledge times: t_time (wall time), e_time (event time), k_time (knowledge time).
- **Belief Pool**: The set of entries whose intervals are live (active) at a given moment in time.
- **Moment Cursor**: A user-controlled point in time used to freeze the Belief Pool.
- **Action**: Any entry in the Record. The Action List presents entries as agent actions, newest first.
- **Seam Adapter**: The single TypeScript module that mediates all data access between the Audit UI and the Record. It exposes one contract; a mock implementation and a live implementation are interchangeable behind that contract.
- **Mock Implementation**: The test/development implementation of the Seam Adapter. It is labeled as mock in code and is never used in a live demo as if it were real Record data.
- **Live Implementation**: The Seam Adapter implementation that calls the trifecta FastAPI `/record` endpoint over HTTPS.
- **Empty State**: The UI condition when the Record returns no entries. It is shown explicitly; it is never simulated with placeholder content or loading shimmers.
- **Chain Break**: A condition where a (KID, subject) chain's hash linkage is inconsistent. Resolution of how to surface this is deferred (Architectural GRAY).
- **Trifecta Server**: The existing FastAPI server that owns the Record and exposes it over HTTPS.
- **View**: One of the three primary display modes of the Audit UI: Action List, Time Travel, or Entry Detail.
- **Hash/pushState Routing**: The client-side routing strategy implemented in TypeScript using the browser History API or URL hash, with no server-side routing dependency.

---

## Requirements

### Requirement 1: Read-Only Record Access via Seam Adapter

**User Story:** As an auditor, I want all record data fetched through a single adapter module, so that the live and mock data sources are interchangeable and no database credentials ever appear in the browser.

#### Acceptance Criteria

1. THE Seam Adapter SHALL expose a typed TypeScript contract through which all Audit UI modules request Record data; no other module SHALL access the Trifecta Server directly.
2. THE Seam Adapter SHALL never transmit a database key or credential to the browser.
3. WHEN the Live Implementation is active, THE Seam Adapter SHALL communicate with the Trifecta Server exclusively over HTTPS.
4. THE Mock Implementation SHALL be identified by a code-level label (e.g., a constant or module name containing "mock") that makes its nature unambiguous to any reader of the source.
5. THE Mock Implementation SHALL contain entries with known, deterministic values sufficient to exercise all three Views and all Empty State conditions.
6. WHERE the Live Implementation is wired, THE Seam Adapter SHALL return data in the same shape as the Mock Implementation, with no caller-visible difference in the contract.
7. IF the Seam Adapter receives an error response from the Trifecta Server, THEN THE Seam Adapter SHALL return a typed error value to the caller; the caller SHALL display an explicit error state rather than an empty or partial view.

---

### Requirement 2: Application Shell and Routing

**User Story:** As an auditor, I want to navigate between the three views in a single browser tab without full-page reloads, so that I can move quickly between the action list, time travel, and entry detail without losing my place.

#### Acceptance Criteria

1. THE Audit UI SHALL be delivered as a single HTML file; all JavaScript and CSS assets SHALL be bundled by Vite at build time.
2. THE Audit UI SHALL implement client-side routing in TypeScript using the browser History API (pushState/popstate) or URL hash, with no server-side routing dependency.
3. WHEN the user navigates to the Action List route, THE Router SHALL render the Action List View and remove any previously rendered View.
4. WHEN the user navigates to the Time Travel route, THE Router SHALL render the Time Travel View and remove any previously rendered View.
5. WHEN the user navigates to an Entry Detail route carrying a (KID, subject, entry identifier) parameter, THE Router SHALL render the Entry Detail View for that entry and remove any previously rendered View.
6. WHEN the user presses the browser back or forward button, THE Router SHALL transition to the corresponding View without a full-page reload.
7. IF the user navigates to an unrecognized route, THEN THE Router SHALL display an explicit "not found" message and a link to the Action List View.

---

### Requirement 3: Action List View

**User Story:** As a stranger looking at the UI for the first time, I want to see what the agent did in a clear list ordered newest-first, so that I can understand the agent's actions within 30 seconds without prior knowledge.

#### Acceptance Criteria

1. WHEN the Action List View is rendered, THE Action List SHALL request all entries from the Seam Adapter and display them ordered by k_start descending (newest first).
2. THE Action List SHALL display, for each entry: KID (numeric form), authority value (integer), and the interval defined by k_start, t_time, e_time, and k_time.
3. THE Action List SHALL display a plain-language label for each entry derived from the entry's subject and state fields; THE Action List SHALL never invent a label not derivable from Record fields.
4. WHEN the user selects an entry in the Action List, THE Router SHALL navigate to the Entry Detail View for that entry.
5. THE Action List SHALL link each entry to its Entry Detail View such that the link is reachable by keyboard and by pointer.
6. IF the Seam Adapter returns no entries, THEN THE Action List SHALL display an explicit empty-state message stating that no entries exist in the Record; THE Action List SHALL display no placeholder rows, no loading shimmers, and no zero-value metrics.
7. IF the Seam Adapter returns an error, THEN THE Action List SHALL display the explicit error state returned by the Seam Adapter.

---

### Requirement 4: Time Travel View

**User Story:** As an auditor, I want to move a moment cursor to any point in time and see exactly which belief entries were live at that moment, so that I can reconstruct what the agent believed at any given instant.

#### Acceptance Criteria

1. WHEN the Time Travel View is rendered, THE Time Travel View SHALL present a moment cursor control that accepts a point in time as input.
2. WHEN the user sets the moment cursor to a point T, THE Time Travel View SHALL request from the Seam Adapter all entries whose intervals are live at T, and SHALL display only those entries as the frozen Belief Pool.
3. THE Time Travel View SHALL display, for each entry in the frozen Belief Pool: KID (numeric form), subject, state, authority (integer), evidence, and reason.
4. WHEN the user moves the moment cursor to a new point T′, THE Time Travel View SHALL replace the previously displayed Belief Pool with the entries whose intervals are live at T′.
5. THE Time Travel View SHALL display the value of the moment cursor alongside the frozen Belief Pool so that the displayed moment is unambiguous.
6. IF no entries are live at the selected moment, THEN THE Time Travel View SHALL display an explicit empty-state message stating that no entries were live at that moment; THE Time Travel View SHALL display no placeholder content.
7. IF the Seam Adapter returns an error, THEN THE Time Travel View SHALL display the explicit error state returned by the Seam Adapter.

---

### Requirement 5: Entry Detail View

**User Story:** As an auditor, I want to see every field of a single entry and the full ordered history of its (KID, subject) chain, so that I can trace how the agent's belief evolved and verify that no prior state was erased.

#### Acceptance Criteria

1. WHEN the Entry Detail View is rendered for an entry E, THE Entry Detail View SHALL display all fields of E: KID (numeric form), subject, state, authority (integer), pool, k_start, t_time, e_time, k_time, evidence, reason, and prev_hash.
2. THE Entry Detail View SHALL request from the Seam Adapter the complete (KID, subject) chain for entry E and SHALL display every entry in the chain in ascending chain order (oldest first).
3. THE Entry Detail View SHALL display entries with states classified as rejected, contradicted, or revised without omitting or visually suppressing them; every prior state SHALL appear in the history list.
4. THE Entry Detail View SHALL display the KID as a number; WHERE the KIDMAP provides a resolved label for that KID, THE Entry Detail View SHALL display that label alongside the number; THE Entry Detail View SHALL never display an invented label.
5. IF the Seam Adapter returns no chain entries for the requested (KID, subject), THEN THE Entry Detail View SHALL display an explicit empty-state message; THE Entry Detail View SHALL display no fabricated history rows.
6. IF the Seam Adapter returns an error, THEN THE Entry Detail View SHALL display the explicit error state returned by the Seam Adapter.

---

### Requirement 6: KID Display

**User Story:** As an auditor, I want KIDs shown as numbers with KIDMAP resolution where available, so that I can identify agents accurately without risk of seeing an invented label.

#### Acceptance Criteria

1. THE Audit UI SHALL display every KID in its numeric integer form in all Views.
2. WHERE the KIDMAP resolves a KID to a label, THE Audit UI SHALL display that label alongside the numeric KID; THE Audit UI SHALL present the numeric KID as the primary identifier.
3. THE Audit UI SHALL never construct, infer, or invent a label for a KID that is absent from the KIDMAP.
4. WHEN the KIDMAP data is unavailable, THE Audit UI SHALL display the numeric KID alone with no label; THE Audit UI SHALL not display a placeholder label such as "Unknown" or "Agent".

---

### Requirement 7: Empty States

**User Story:** As an auditor, I want the UI to tell me clearly when there is nothing to show, so that I never mistake an empty record for a loading failure or a zero-value measurement.

#### Acceptance Criteria

1. IF the Record contains no entries relevant to the current View or query, THEN THE Audit UI SHALL display an explicit textual message describing the empty condition (e.g., "No entries in the record", "No entries live at this moment").
2. THE Audit UI SHALL never display a loading shimmer, placeholder row, or animated skeleton when the data request has completed and returned an empty result.
3. THE Audit UI SHALL never display a numeric zero in a context where zero could be misread as a measurement when the actual condition is the absence of entries.
4. THE Audit UI SHALL visually distinguish the empty state from the error state so that an observer can tell whether data is absent or a fetch failed.

---

### Requirement 8: Build, Bundle, and Module Constraints

**User Story:** As a developer, I want the application to build with Vite and be organized into focused TypeScript modules, so that the codebase is maintainable and no single file grows unwieldy.

#### Acceptance Criteria

1. THE Audit UI build system SHALL use Vite to produce a deployable bundle from TypeScript source files.
2. THE Audit UI SHALL be organized such that no TypeScript source file exceeds 500 lines.
3. THE Seam Adapter module SHALL be separate from View modules, routing modules, and utility modules; each SHALL reside in its own file.
4. THE Audit UI test suite SHALL use Vitest as the test runner.
5. WHEN the Vitest test suite is executed with the `--run` flag, THE test suite SHALL complete without hanging or starting a watch process.

---

### Requirement 9: Testing Contract

**User Story:** As a developer, I want automated tests to verify that every View renders only real Record fields, time travel freezes correctly, interval history is complete, empty states are explicit, and the Seam Adapter contract is enforced, so that correctness is machine-verifiable.

#### Acceptance Criteria

1. THE test suite SHALL include at least one test per View that asserts each rendered field value matches the corresponding field in the Mock Implementation's data exactly, with no invented or derived values.
2. WHEN the Time Travel View is given a moment cursor value T against Mock Implementation data with known intervals, THE test suite SHALL assert that the frozen Belief Pool equals the set of entries whose intervals are live at T.
3. THE test suite SHALL include a test that asserts the Entry Detail View renders every entry in a (KID, subject) chain in ascending chain order, including entries with rejected, contradicted, or revised states.
4. THE test suite SHALL include a test per View that asserts the explicit empty-state message is rendered when the Seam Adapter returns an empty result.
5. THE test suite SHALL include a test that asserts no KID label is rendered when the KID is absent from the KIDMAP.
6. THE test suite SHALL include a test that asserts the Mock Implementation and Live Implementation both satisfy the Seam Adapter typed contract, verifiable at the TypeScript type level or via a contract-conformance test.
