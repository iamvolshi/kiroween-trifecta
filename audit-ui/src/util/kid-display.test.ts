import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { renderKid } from "./kid-display";

// ---------------------------------------------------------------------------
// A KID displays as its number, nothing else. The kidmap's tag is the
// machine key behind the number; it is never printed. (Darren, Nov 20:
// the long tag in the log was ridiculous.)
// ---------------------------------------------------------------------------
describe("renderKid – examples", () => {
  it("returns String(kid)", () => {
    expect(renderKid(42)).toBe("42");
  });

  it("returns String(kid) for 1", () => {
    expect(renderKid(1)).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// Property 12: KID numeric primacy
// The output is exactly String(kid), always.
//
// Validates: Requirements 6.1, 6.2
// ---------------------------------------------------------------------------
describe("Property 12 – KID numeric primacy", () => {
  it("output is exactly String(kid)", () => {
    fc.assert(
      fc.property(fc.integer(), (kid) => {
        expect(renderKid(kid)).toBe(String(kid));
      }),
      { numRuns: 100 },
    );
  });
});
