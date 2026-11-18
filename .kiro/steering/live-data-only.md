---
inclusion: always
---

# Live data only: nothing fake

The Audit UI is live-only. This rule holds for every build, every round,
every agent.

## The rule

- The app reads from the real connector only, at the build-time address
  `VITE_CONNECTOR_URL` (`audit-ui/src/adapter/connector-url.ts`). The one
  adapter is the live adapter (`audit-ui/src/adapter/live.ts`).
- No mock adapter. No mock scenario. No mock mode. No mock labels. No
  scripted replies, fixtures or prompt hints in app code.
- When the connector is unreachable, or `VITE_CONNECTOR_URL` is unset, every
  view shows the unreachable state in words ("Connector unreachable: ...").
- Never invent fallback data. Never show an empty state that reads as "the
  record is empty" when the read failed.
- Never add mock fixtures, a mock adapter or a mock/live switch back.
- No provider, model or backend address is written in the app. Every name
  shown comes from the connector.

## Tests

- Tests may use test doubles. A double is named as one (`stub`, `double`,
  `fake`), lives in test code or `audit-ui/src/test-helpers.ts`, and is never
  imported by app code.
- A test double is not app data. It never ships in the build.

## Check before reporting a round

- A sweep of `audit-ui/src` for `mock|scenario|scripted` finds nothing in app
  code. Matches in test files are only the test tool's own API
  (`vi.restoreAllMocks`, `.mock.calls`) or a named double.
- A build with no `VITE_CONNECTOR_URL` shows the unreachable words on every
  view.
