/**
 * Contract-conformance tests for SeamAdapter implementations.
 * Validates: Requirements 1.7, 9.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRecordStub, createFailingStub } from '../test-helpers.ts';
import { createLiveAdapter } from './live';
import type { SeamAdapter } from './seam';

// ---------------------------------------------------------------------------
// 1. TypeScript assignability: createRecordStub() satisfies SeamAdapter
//    This is a compile-time check — if the file compiles, the type is correct.
// ---------------------------------------------------------------------------

const _stubAssignability: SeamAdapter = createRecordStub();
void _stubAssignability; // prevent unused-variable warning

// ---------------------------------------------------------------------------
// 2. TypeScript assignability: createLiveAdapter() satisfies SeamAdapter
// ---------------------------------------------------------------------------

const _liveAssignability: SeamAdapter = createLiveAdapter('https://example.com');
void _liveAssignability;

// ---------------------------------------------------------------------------
// 3. createFailingStub() — behavioral: all methods return { ok: false }
// ---------------------------------------------------------------------------

describe('createFailingStub', () => {
  const errorAdapter = createFailingStub();

  it('fetchAllEntries returns { ok: false }', async () => {
    const result = await errorAdapter.fetchAllEntries();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
    }
  });

  it('fetchBeliefPool(0) returns { ok: false }', async () => {
    const result = await errorAdapter.fetchBeliefPool(0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
    }
  });

  it('fetchChain(1, "x") returns { ok: false }', async () => {
    const result = await errorAdapter.fetchChain(1, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
    }
  });

  it('fetchKidMap() returns { ok: false }', async () => {
    const result = await errorAdapter.fetchKidMap();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Property 17: Error adapter typed result
//    Generate arbitrary non-empty error strings; assert createFailingStub()
//    always returns { ok: false, error } where error is a non-empty string.
//    Validates: Requirements 1.7, 9.6
// ---------------------------------------------------------------------------

describe('Property 17: Error adapter typed result', () => {
  it('fetchAllEntries always yields { ok: false } with a non-empty string error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (_arbitraryError) => {
          // createFailingStub() always returns its fixed error; we test the shape holds
          const adapter = createFailingStub();
          const result = await adapter.fetchAllEntries();
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(typeof result.error).toBe('string');
            expect(result.error.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });

  it('fetchBeliefPool always yields { ok: false } with a non-empty string error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (_arbitraryError) => {
          const adapter = createFailingStub();
          const result = await adapter.fetchBeliefPool(0);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(typeof result.error).toBe('string');
            expect(result.error.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });

  it('fetchChain always yields { ok: false } with a non-empty string error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (_arbitraryError) => {
          const adapter = createFailingStub();
          const result = await adapter.fetchChain(1, 'x');
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(typeof result.error).toBe('string');
            expect(result.error.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });

  it('fetchKidMap always yields { ok: false } with a non-empty string error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (_arbitraryError) => {
          const adapter = createFailingStub();
          const result = await adapter.fetchKidMap();
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(typeof result.error).toBe('string');
            expect(result.error.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});
