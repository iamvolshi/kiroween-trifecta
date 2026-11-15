import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatLabel } from './format';

/**
 * Property 5: Label derivation integrity
 * Validates: Requirements 3.3
 *
 * For any entry, the plain-language label rendered in the Action List is
 * composed solely from that entry's subject and state fields — no string
 * from outside those two fields appears as part of the label.
 */
describe('formatLabel', () => {
  // Example-based tests
  describe('example-based', () => {
    it('formats subject and state with a colon separator', () => {
      expect(formatLabel('temperature', 'confirmed')).toBe('temperature: confirmed');
    });

    it('formats another subject and state pair', () => {
      expect(formatLabel('pressure', 'rejected')).toBe('pressure: rejected');
    });

    it('handles empty strings — produces just the separator', () => {
      expect(formatLabel('', '')).toBe(': ');
    });

    it('passes through a subject that already contains the separator', () => {
      expect(formatLabel('a: b', 'c')).toBe('a: b: c');
    });
  });

  // Property-based test: Property 5
  describe('property-based', () => {
    it(
      'Property 5: label contains only characters derivable from subject, state, and the ": " separator',
      () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.string(),
            (subject, state) => {
              const result = formatLabel(subject, state);

              // Strict derivation check: the result must equal exactly `${subject}: ${state}`
              expect(result).toBe(`${subject}: ${state}`);

              // Lenient derivation check: every character in the result must
              // be present in the allowed character pool (subject + state + ": ")
              const allowedChars = new Set([...subject, ...state, ...': ']);
              for (const ch of result) {
                expect(allowedChars.has(ch)).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  });
});
