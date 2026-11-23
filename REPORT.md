# REPORT: OCME-004, PEEP and RATR inspector drawer

Branch `feat/peep-ratr` off main `5e5e0a1`. Not merged; the merge is Darren's.

## What changed

| File | Change |
|---|---|
| `audit-ui/src/inspector/trifacta.ts` | TRIFACTA client: demo key read once from `GET /config`, sent as `X-API-Key`; `ask`, `record`, `lessons`, `insights`; every reply shape-checked |
| `audit-ui/src/inspector/drawer.ts` | The two header buttons and the drawer, tabs PEEP and RATR, Esc closes |
| `audit-ui/src/inspector/peep.ts` | PEEP: the trace of one query |
| `audit-ui/src/inspector/ratr.ts` | RATR: the witness log |
| `audit-ui/src/styles/inspector.css` | The quiet pair, the drawer |
| `audit-ui/src/router/router.ts` | Mounts the inspector in the header on every view |
| `audit-ui/src/inspector/inspector.test.ts` | 13 tests, against a stub fetch |
| `docs/peep-ratr-proof/` | The shot script and the shots |

The connector seam is untouched. The drawer is a second data source.

## What the drawer shows

- **Buttons:** `PEEP` `RATR`, side by side, at the right of the header, 9px, 35% opacity until hovered.
- **PEEP:** a question (pre-filled "What city does Darren live in?"), Ask, then the call (`POST /ask`, question, state, text, docket, count touched) and each entry touched: its key, the authority and state read from `GET /record`, the source, the excerpt, the KID and entry hash. No commentary.
- **RATR:** account picker (acct-001 to acct-005, default acct-001), `GET /record/{account}` as a flat list in k order: k_start, k_end, field, value, state, authority, KID, entry_hash, reason. Then `GET /insights` counts and `GET /lessons` events as sent.
- **Errors:** an unreachable API or a wrong-shaped reply shows its error in words, and no entry.

## Live proof (2026-11-23)

- `GET /health`: 200, `ok: true`, engines `erie, katie, elle, arche`. `GET /config`: 200, `api_key` present.
- PEEP, Darren city trace: 4 entries touched. `city@1-2` Raleigh authority 5, `city@2-3` Charlotte authority 3 (crm import), `city@3-live` Chapel Hill authority 8 CONFIRMED with the correction reason, `cust_name@1-live` authority 8.
- RATR acct-001: 13 intervals.
- Shots at 1920x1080 and 1024x768, both tabs: `docs/peep-ratr-proof/shots/`.

## Tests

555 passed (floor 542). `tsc` clean, `npm run build` clean.

## Unproven and flags

1. **PEEP's ask is not write-free.** TRIFACTA logs every `POST /ask` as an
   ELLE event. `GET /lessons` went from 1 to 4 events during this build
   (one probe, two proof shots). PEEP asks only when Ask is pressed.
2. **Authority on a PEEP entry** comes from `GET /record`, matched on the
   provenance key (`acct-001.city@2-3`). `/ask` itself carries authority
   only inside the excerpt text. A key that matches no interval says so.
3. **The TRIFACTA address** defaults to `https://trifacta-api.onrender.com`
   in `trifacta.ts` (`VITE_TRIFACTA_URL` overrides it). It is a public URL,
   not a key, but it is an address written in code.
4. **The drawer sits above the boot loading modal**, so it works while the
   connector is still waking.
5. `.kiro/steering/tech.md` still describes a mock seam; the app is
   live-only. Not changed here.
