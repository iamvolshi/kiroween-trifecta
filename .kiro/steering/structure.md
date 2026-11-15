# Structure — Audit UI

## Layout principles

- One clear responsibility per file. Files that change together live together. Split by responsibility, not by technical layer.
- **No god files: nothing over ~500 lines.** If a unit would exceed it, split it. A small overage on a single-concept file stays; a file holding more than one concept splits.
- Contracts and interfaces come before implementations. The seam adapter contract is the boundary everything else builds against.

## Modules

- **Seam adapter** (`seam.ts` + `mock.ts`): the only module that speaks the record contract. All views read through it. Nothing else touches record shapes directly.
- **Views**: Action List, Time Travel, Entry Detail. Each reads from the seam adapter. Each carries explicit empty and error states.
- **Router**: manual pathname routing in one module (pushState + popstate). Unknown paths go to a NotFound view.
- **Utilities**: the interval live-at predicate, KID display formatting, label formatting. Pure functions, property-tested.

## Repo

- `.kiro/` at the repo root holds specs, hooks, and steering. Never gitignore it.
- The repo carries an open-source license (MIT, matching the author's other public repos).
- Pre-existing code incorporated into this project (the engines, the seam contract, the KIDMAP doctrine) must be disclosed in the repo — it is the author's own prior work, built before the window, disclosed per the Kiroween rules.
