# Remove mock: notes

Order: "delete all mock data ... we are wiring this up." The app is live-only.
It talks to the connector, and when the connector cannot be reached it says
so in words, on every view.

Base: `main` at `9bfccc6` (the model-switch merge; read first, it had landed).
Branch: `feat/remove-mock`. Kiroween repo only; the bots repo is untouched.

## Deleted (files removed)

| File | What it was |
|---|---|
| `audit-ui/src/scenario/script.ts` | the scripted scenario: fixtures, replies, hashes, KID labels |
| `audit-ui/src/scenario/types.ts` | its types, including each step's suggested user message (the chat prompt hint) |
| `audit-ui/src/scenario/stepper.ts` | the scenario cursor |
| `audit-ui/src/scenario/match.ts` | keyword matching for the scripted chat |
| `audit-ui/src/scenario/lessons.ts` | scripted ELLE lessons |
| `audit-ui/src/scenario/scenario.test.ts` | tests of the scenario |
| `audit-ui/src/adapter/mock.ts` | the mock adapter (fixture entries + scenario) |
| `audit-ui/src/adapter/mock-assembly.ts` | the mock chat / ask / update / lessons / record |
| `audit-ui/src/adapter/active.ts` | the mock/live switch (`ACTIVE_ADAPTER_KIND`) |
| `audit-ui/src/adapter/mock-assembly.test.ts` | mock-mode tests |
| `audit-ui/src/adapter/mock-numeric.test.ts` | mock-mode tests |
| `audit-ui/src/shell-integration.test.ts` | tests that played the scenario through the shell |

## Removed from kept files

| Where | What went |
|---|---|
| `views/nav.ts`, `styles/shell.css` | the `MOCK DATA` badge and its style |
| `views/chat.ts`, `styles/chat.css` | "Replies are scripted mock. No model is running.", the "Scenario not started" / "Step n of m" chip, the mock kind of `ModelSource` |
| `views/model-banner.ts`, `styles/model-banner.css` | the banner's mock state ("No live model"); the banner keeps live, unconfigured, unreachable and loading |
| `shell/telemetry.ts` | "(mock)" in the work-column heading; the "(step n)" label on feed items (after review). A failed record read now shows the connector's words above the feed instead of "Nothing has happened yet". |
| `shell/shell.ts` | the mock seam-chip text. The chip now says "Seam: live adapter, active." or, with no address, "Seam: live adapter. No connector address set." |
| `style.css` | the `--mock` / `--mock-text` tokens |
| `adapter/seam.ts`, `adapter/live-models.ts`, `shell/left.ts` | comments describing mock or scripted behaviour. The contract types are unchanged. |
| `docs/assembly-parts.md` | the "Mock mode shows No live model" line and the scenario-id example; it now says the app is live-only |

## Added

- `adapter/connector-url.ts`: the one build-time address (`VITE_CONNECTOR_URL`).
  No backend address is written anywhere.
- `adapter/live.ts`: `NO_ADDRESS_ERROR`, "Connector unreachable: no connector
  address was set at build time (VITE_CONNECTOR_URL)", replacing "Live
  adapter not wired". `/models` gives the same words.
- `main.ts` builds `createLiveAdapter(CONNECTOR_URL)`: one adapter.
- `no-connector.test.ts`: every view with no address, and with an address
  nothing answers, shows the unreachable words, through the real live adapter.

## What stayed, and why

| Kept | Why |
|---|---|
| Persona picker, Book/Movie switch, model banner, record views, folders | live UI |
| The seam contract (`ChatTurn`, `Entry`, `served_by`, `/models` shape), including `ChatTurn.step` / `total_steps` | the order keeps the contract unchanged; the connector sends `step: null` |
| `util/interval.ts` `isLiveAt` | a pure interval rule; now used only by the record stub in tests |
| `docs/` proof screenshots of earlier rounds | history, not served data |
| README and disclosure | Darren's; not in the diff |
| `persona-picker.ts` option hints ("The novel's eloquent creature", "The film monster") | tooltips naming the two Frankenstein positions, not scripted data |

## Every remaining stub (test doubles, test files only)

None is imported by app code.

| Stub | File | What it is |
|---|---|---|
| `createRecordStub(entries?, extra?)` | `src/test-helpers.ts` | record reads over fixed entries, applying the seam's interval rule; `fetchRecord` groups by account prefix; chat / ask / update / lessons answer "not used in this test" unless `extra` overrides |
| `STUB_ENTRIES`, `STUB_TIMES`, `STUB_KID_LABELS` | `src/test-helpers.ts` | four fixed test entries (the old fixtures, renamed), moments around them, KID labels |
| `createFailingStub(error?)` | `src/test-helpers.ts` | every call answers one error |
| `makeEntry`, `assemblyNotUsed` | `src/test-helpers.ts` | an entry builder; typed "not used" answers |
| `stubFetch` / `routed` / `stubConnector` | `adapter/live-assembly.test.ts`, `adapter/live-record-reads.test.ts`, `wired-chat.test.ts` | stub `fetch` for the real live adapter |
| `ModelSource` stubs | `views/model-banner.test.ts` | stub `/models` answers |
| `createEmptyStub`, `createErrorStub` | `views/states.test.ts` | empty and failing adapters |
| inline stub `chat` | `assembly-integration.test.ts`, `bug-hunt-fixes.test.ts` | a fixed `ChatTurn` |
| `vi.fn`, `vi.restoreAllMocks`, `.mock.calls` | `views/calendar.test.ts`, `router/router-*.test.ts` | Vitest's own API |

## Grep sweep (`mock|scenario|scripted` across all of `audit-ui/src`)

App code: none. Test files: only Vitest's API names:

```
router/router-fixes.test.ts:22: vi.restoreAllMocks();
router/router-links.test.ts:25: vi.restoreAllMocks();
views/calendar.test.ts:98: ... vi.fn>).mock.calls[0][0];
```

`index.html` and `vite.config.ts`: none.

## Tests

- Base `main` `9bfccc6`: 361 tests in 38 files.
- Branch: 315 tests in 35 files, all pass. Deleted: the four mock / scenario
  test files above plus the scenario-only cases in kept files (the scenario
  flow in `assembly-integration`, `bug-hunt-fixes` LOW-5, the mock persona
  case in `wired-chat`, the mock banner cases). Added: `no-connector.test.ts`
  (11) and the no-address banner case; after review, right-column unreachable assertions and a left-folder refresh test (the meter moves with the record). Retargeted: every test that used the
  mock adapter as a convenient adapter now uses `createRecordStub`.
- `npx tsc --noEmit` clean, `npm run build` clean, no new dependencies.

## Real-browser pass (`docs/remove-mock-proof/`)

| Shots | Against |
|---|---|
| `01`-`04` (`stub-connector-*`) | a STUB connector in scratch, never in the repo, speaking the contract with values labelled "stub". Chat on Movie and Book with the band and `served_by`, Action List with the left folders, Entry Detail. |
| `05`-`09` (`no-connector-*`) | a build with no `VITE_CONNECTOR_URL`: Action List, Time Travel, Calendar, Chat (band and send error), Entry Detail, each with the unreachable words; the left column too |

## Known consequence

The deployed site (Netlify) served the old demo. After this deploys, it
shows the unreachable state until the backend is hosted somewhere reachable.
The connector binds loopback only. Where the backend runs is Darren's call;
this round sets no backend address.
