# Product — Audit UI

## What this is

The Audit UI answers one question: **what did the agent do, and what did it believe when it did it?**

It is the interface showing what the agent does and how it can be audited back to any state it knew before. Time travel: pick any moment and see the belief pool frozen — everything a KID was assigned to at that moment in time.

## The doctrine (settled, do not reinterpret)

- A **KID** is a number, not a name. KATIE mints it at birth and attaches it to the object — a data field, an event, a record. One object, one KID. Everything is born registered.
- **KIDMAP** is the map from a KID number to the thing it points to. KATIE holds it.
- The KID sits in the I/O path as an enforcement valve: null it and the thing is cut off.
- The **record** is append-only and hash-chained per (KID, subject). Nothing is rewritten; corrections are new entries. Exactly one live interval per (KID, subject) at a time, full history behind it.
- Authority is a scale from **0 to 9**. The name follows the part of the system — trust, authority, or confidence. Never fix one word for all of it.
- **Not-knowing is first-class**: when the record has nothing, the UI shows that explicitly. Never fill a gap with a plausible guess.

## The UI's job

Display only. The UI reads the record and shows it. It never writes to the record, never judges entries, never invents data. **No fake status, no fake telemetry, no simulated entries.** Everything shown comes from the real record or from honestly labeled mock data during build.

Plain-language labels. Big labels. A stranger must get it in 30 seconds: what happened, what was believed, when, why.
