import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { renderKid } from "./kid-display";
import type { KidMap } from "../adapter/seam";

// ---------------------------------------------------------------------------
// Example-based tests
// ---------------------------------------------------------------------------
describe("renderKid – examples", () => {
  it("returns 'kid label' when kid is present in kidMap", () => {
    expect(renderKid(42, { 42: "sensor-alpha" })).toBe("42 sensor-alpha");
  });

  it("returns String(kid) when kid is absent from kidMap", () => {
    expect(renderKid(42, { 99: "other" })).toBe("42");
  });

  it("returns String(kid) when kidMap is null", () => {
    expect(renderKid(42, null)).toBe("42");
  });

  it("returns String(kid) when kidMap is empty", () => {
    expect(renderKid(1, {})).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Property 12: KID numeric primacy
// The output always starts with String(kid), regardless of kidMap contents.
//
// Validates: Requirements 6.1, 6.2
// ---------------------------------------------------------------------------
describe("Property 12 – KID numeric primacy", () => {
  it("output always starts with String(kid)", () => {
    fc.assert(
      fc.property(
        // kid: any safe integer
        fc.integer(),
        // kidMap: null, empty, or a map that may or may not contain kid
        fc.option(
          fc.dictionary(
            fc.integer().map(String),
            fc.string(),
          ),
          { nil: null },
        ),
        (kid, rawMap) => {
          // Build a KidMap (Record<number, string>) from the dictionary
          const kidMap: KidMap | null =
            rawMap === null
              ? null
              : Object.fromEntries(
                  Object.entries(rawMap).map(([k, v]) => [Number(k), v]),
                );

          const result = renderKid(kid, kidMap);
          expect(result.startsWith(String(kid))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: KIDMAP label fidelity
// Case A – kid present in kidMap: output contains exactly the label, unaltered.
// Case B – kid absent from kidMap: output is exactly String(kid), nothing appended.
//
// Validates: Requirements 6.3, 6.4
// ---------------------------------------------------------------------------
describe("Property 13 – KIDMAP label fidelity", () => {
  it("Case A: when kid is in kidMap the output contains the full, unaltered label", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.string({ minLength: 1 }),
        // Extra entries that do NOT include kid (we add kid separately below)
        fc.dictionary(fc.integer().filter((n) => n !== 0).map(String), fc.string()),
        (kid, label, extraRaw) => {
          const kidMap: KidMap = {
            ...Object.fromEntries(
              Object.entries(extraRaw).map(([k, v]) => [Number(k), v]),
            ),
            [kid]: label,
          };

          const result = renderKid(kid, kidMap);
          expect(result).toContain(label);
          // The label must appear verbatim (no truncation)
          expect(result.indexOf(label)).toBeGreaterThanOrEqual(0);
          const extractedLabel = result.slice(String(kid).length + 1); // after "kid "
          expect(extractedLabel).toBe(label);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Case B: when kid is absent from kidMap the output is exactly String(kid)", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        // A kidMap whose keys are all different from kid
        fc.array(
          fc.tuple(fc.integer(), fc.string()),
        ),
        (kid, entries) => {
          // Build a map guaranteed not to contain kid
          const kidMap: KidMap = Object.fromEntries(
            entries
              .filter(([k]) => k !== kid)
              .map(([k, v]) => [k, v]),
          );

          const result = renderKid(kid, kidMap);
          expect(result).toBe(String(kid));
        },
      ),
      { numRuns: 100 },
    );
  });
});
