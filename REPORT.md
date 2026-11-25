# REPORT: OCME-002-hack, Watson speaks

App branch `feat/watson-mouth` (iamvolshi/kiroween-trifecta, off main
`bce0320`). Bridge branch `watson-bridge-host` (iamvolshi/scribe, off
`watson-bridge` `2b28116`). Neither is merged; Darren merges.

## What changed

| Where | Change |
|---|---|
| `audit-ui/src/watson/bridge.ts` (new) | Calls the bridge's `POST /report`. The address comes from `VITE_WATSON_URL`. It never throws: on any failure it answers null |
| `audit-ui/src/watson/conclusion.ts` (new) | Resolves each citation's KID, renders Watson's box, and keeps one call per answer |
| `audit-ui/src/shell/rail-panels.ts` | Rail Research search (connector `/ask`): Watson's box goes after the hits |
| `audit-ui/src/views/research.ts` | ERIE page retrieval, the chat's ERIE answer per turn: Watson's box goes after the answer |
| `audit-ui/src/styles/watson.css` (new), `main.ts` | The box's look |
| `audit-ui/src/watson/watson.test.ts` (new) | 9 tests |
| scribe `watson/apps/watson-bridge/src/server.ts` | CORS, so the page can call it from the browser. `WATSON_CORS_ORIGINS` (unset means any origin). No key exists to leak |
| scribe `.../render.yaml`, `build-for-host.mjs` (new) | Render blueprint, and a build of the bridge's 17 packages in dependency order |
| scribe `.../tests/report.test.ts` | 2 CORS tests |

The answer is never changed. Watson's box is added after it, or nothing is
added. Both backends are untouched: the connector, TRIFACTA, KIDs 1-29, the
record and the filing rule. There is no LLM analyzer and no twelfth app.

## How the KIDs get through

In the caller. The connector's `/ask` provenance names each hit by entry id
(`content`). The page reads `GET /entries`, the same read every view uses,
and maps that id to its KID. Each citation is sent with `kid`. An entry the
record does not know goes without a KID ("no KID"), never an invented one.
No backend change was needed, so volshi-ai/trifecta is not touched.

## Tests

- **App:** 564 passed (546 on main), and tsc and build are clean. They prove the KIDs carried from an answer into Watson's box. They prove the answer still shows when the bridge throws, returns 500, replies in the wrong shape, has no address, or is slow. A not-found answer is never sent.
- **Bridge:** 11 passed (9 before).
- **Bots:** the Curator and dog tests pass, 32 of them. Nothing in bots changed.

## Live round trip (2026-11-24)

The live connector `/ask`, "a female of another sex, as hideous as myself",
found 3 hits. Their KIDs, 20, 27 and 24, were resolved from live `/entries`.
They went to the bridge built from `watson-bridge-host` and running on
127.0.0.1. Watson answered confidence 0.90, 3 claims, all supported, with
KIDs 20, 27 and 24 back. The built app showed the same thing at 1920 and
1024: `docs/watson-proof/`.

## Hosting

The bridge is live on Render at [watson-bridge-nfkl.onrender.com](https://watson-bridge-nfkl.onrender.com/), from `watson-bridge-host`. Read 2026-11-25: `GET /health` 200 `{ok:true, mode:deterministic}`; CORS preflight 204, any origin. Build the app with `VITE_WATSON_URL=https://watson-bridge-nfkl.onrender.com`.

Hosted round trip (2026-11-25): live connector `/ask` -> hosted bridge, KIDs 20, 27, 24 in and back, 3 supported claims, confidence 0.90, 0.57 s (`docs/watson-proof/hosted-round-trip.json`). The built app (served on 127.0.0.1, live connector, hosted bridge) showed the same at 1920 and 1024 (`docs/watson-proof/watson-*.png`).

## Unproven

- **The bridge on a public URL,** and the Render build on a clean machine. The build was proven locally only.
- **The chat path, live.** It is covered by tests only, because recording a live chat turn was not allowed.
- **Watson's summary on book passages.** The deterministic extractor echoes them, so the rail cuts them to 4 lines. The wording would get better with the LLM analyzer, which is out of scope.
