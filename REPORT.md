# REPORT: OCME-003-hack, the Curator panel shows only your folders

App branch `feat/curator-panel` (off main `ca766bf`). Connector branch
`feat/curator-folders-persist` on iamvolshi/bots (off main `2bc03a7`), with
its own REPORT.md. Neither is merged; Darren merges.

## What changed in the panel

| File | Change |
|---|---|
| `audit-ui/src/shell/left.ts` | The Curator panel is built from `catalog(entries)`: one compact row per filed folder (subject, entry count, latest authority), the whole row one link. No cards and no lessons in the sidebar |
| `audit-ui/src/util/curator.ts` | A folder's case file is the entries under its subject (or its group), plus the entries its standing folder points at (`case_file`). Only entries in the record are used, never invented |
| `audit-ui/src/adapter/seam.ts`, `live-guards.ts` | `Entry.case_file?: string[]`, optional. A reply that sends anything other than a string list is refused |
| `audit-ui/src/views/curator.ts`, `shell/subject-folders.ts` | The full card (meter, history, lessons) now renders inside each folder on the Curator page |
| `audit-ui/src/styles/folders.css` | Rows are 36 px, a finger-sized target. The meter legend moves to the Curator page |
| tests | `shell/left-folders.test.ts` rewritten (14), `left.test.ts` (4), plus updates to `shell.test.ts`, `stitch-face.test.ts` and `live-record-reads.test.ts` |

## The marker test

A subject is in the panel only when a `curator-folder-<subject>` entry is
in the record. The seed has no marker, so it never shows. Nothing is matched
on the name "frankenstein": a marked Frankenstein subject would show (there
is a test for that).

A row's parts:
- **Count:** the size of the folder's case file.
- **Value:** the authority of the latest entry in the case file, or the folder entry's own when the case file is empty.
- **Link:** `groupHref` over the case file (the name's destination). Otherwise the newest entry in the case file, or the folder entry itself.

With no folders, the panel says "No folders yet. Folders appear as the Curator files them." It never falls back to the seed.

## Tests

567 passed (564 on main). tsc is clean and the build is clean. The Watson
tests pass. Bots: 403 passed, including the Curator and dog tests.

## Proof (local, 2026-11-25)

I ran the bots branch on 127.0.0.1 with a stub model reply. The dog turns
were filed, the data dir was wiped, and the record was restored from a local
Postgres. The built app then read it:
- **Sidebar, desktop and phone (390x844):** one row, `dog 2 5`. No card and no seed.
- **Tapping the row** opened the newest dog turn.
- **The Curator page** showed the full card: 2 entries, value 5, history 5 -> 5.

Shots are in `docs/curator-panel-proof/`.

## Unproven

- **The live app.** It still reads the old connector, which sends no `case_file`. Until the bots branch deploys, a case-crawler folder row reads count 0.
- **The live record has no folders today** (29 seed entries, 0 folders, read 2026-11-25). Once the app deploys, the panel shows the empty state until the Curator files one.
- **The Render restart proof.** See the bots REPORT.md.
