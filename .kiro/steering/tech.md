# Tech — Audit UI

## Stack

- **Vite + vanilla TypeScript.** No framework. No React, no Vue — nothing in this project's lineage uses a framework, and none is wanted here.
- **`index.html` entry point with manual pathname routing** (pushState + popstate, no hash). Routes: `/actions`, `/time-travel`, `/entry/:kid/:subject/:id`. Deploys as a static bundle; the host must serve `index.html` for deep links (SPA fallback).
- **Vitest** for unit/integration tests, including property-based tests for the interval and time-travel logic.
- **TypeScript strict.** `tsc --noEmit` must pass. Tests must pass before a task is done.

## The seam

- The UI reads the record through a **seam adapter**: one module speaking the seam contract (`seam.ts`), backed only by the live connector (`live.ts`, address `VITE_CONNECTOR_URL`).
- **Live data only.** No mock adapter, scenario, mock mode or mock label. See `live-data-only.md`.
- The live seam is NOT wired. A stub returning a typed error stands in its place until a real endpoint is confirmed. Do not wire it, do not guess an endpoint.
- **No-holes rule**: the browser never talks to Postgres directly and no DB key may sit in the page. The record stays behind Darren's own server, reached over HTTPS.

## Boundaries

- Do not redesign settled architecture. Do not invent unresolved schemas, thresholds, or policy — build up to the boundary cleanly and stop, asking one precise question if genuinely blocked.
- Do not create a server layer. The server already exists (the trifecta FastAPI service). This project is the front-end UI plus the seam adapter.
