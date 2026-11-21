/**
 * Property-based tests for empty vs error state distinction across all views.
 *
 * **Validates: Requirements 1.7, 3.6, 3.7, 4.6, 4.7, 5.5, 5.6, 7.1, 7.2, 7.3, 7.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { AdapterResult, Entry, KidMap, SeamAdapter } from '../adapter/seam.ts';
import { assemblyNotUsed } from '../test-helpers.ts';
import { createFailingStub } from '../test-helpers.ts';
import { ActionListView } from './action-list.ts';
import { EntryDetailView } from './entry-detail.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns { ok: true, data: [] } from every method — simulates empty record. */
function createEmptyStub(): SeamAdapter {
  return {
    ...assemblyNotUsed(),
    async fetchAllEntries(): Promise<AdapterResult<Entry[]>> {
      return { ok: true, data: [] };
    },
    async fetchBeliefPool(_momentMs: number): Promise<AdapterResult<Entry[]>> {
      return { ok: true, data: [] };
    },
    async fetchChain(_kid: number, _subject: string): Promise<AdapterResult<Entry[]>> {
      return { ok: true, data: [] };
    },
    async fetchKidMap(): Promise<AdapterResult<KidMap>> {
      return { ok: true, data: {} };
    },
  };
}

/** Build a custom error adapter that returns a specific error string from every method. */
function createErrorStub(errorMessage: string): SeamAdapter {
  const err = { ok: false as const, error: errorMessage };
  return {
    ...assemblyNotUsed(),
    async fetchAllEntries(): Promise<AdapterResult<Entry[]>> { return err; },
    async fetchBeliefPool(_momentMs: number): Promise<AdapterResult<Entry[]>> { return err; },
    async fetchChain(_kid: number, _subject: string): Promise<AdapterResult<Entry[]>> { return err; },
    async fetchKidMap(): Promise<AdapterResult<KidMap>> { return err; },
  };
}

/** Create a fresh container div for each test. */
function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

/** Flush the microtask queue so async view renders complete. */
function flushAsync(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Property 15: Empty state explicitness
// ---------------------------------------------------------------------------

describe('Property 15: Empty state explicitness', () => {
  it('ActionListView with empty adapter shows .empty-state, no .error-state, no skeleton/loading elements', async () => {
    const container = makeContainer();
    const view = new ActionListView(createEmptyStub());
    view.mount(container);
    await view.load(container);

    const emptyEl = container.querySelector('.empty-state');
    const errorEl = container.querySelector('.error-state');

    expect(emptyEl).not.toBeNull();
    expect(errorEl).toBeNull();

    // No skeleton / shimmer / loading / placeholder elements
    expect(container.querySelector('.skeleton')).toBeNull();
    expect(container.querySelector('.shimmer')).toBeNull();
    expect(container.querySelector('.loading')).toBeNull();
    expect(container.querySelector('.placeholder')).toBeNull();

    // The empty-state element has non-empty text
    expect(emptyEl!.textContent!.trim().length).toBeGreaterThan(0);

    view.unmount();
  });

  it('EntryDetailView with empty adapter shows .empty-state, no .error-state', async () => {
    const container = makeContainer();
    const view = new EntryDetailView(createEmptyStub(), 1, 'temperature', 'entry-a1');
    view.mount(container);
    await flushAsync();

    const emptyEl = container.querySelector('.empty-state');
    const errorEl = container.querySelector('.error-state');

    expect(emptyEl).not.toBeNull();
    expect(errorEl).toBeNull();

    expect(container.querySelector('.skeleton')).toBeNull();
    expect(container.querySelector('.shimmer')).toBeNull();
    expect(container.querySelector('.loading')).toBeNull();
    expect(container.querySelector('.placeholder')).toBeNull();

    expect(emptyEl!.textContent!.trim().length).toBeGreaterThan(0);

    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// Property 16: Empty vs error state distinction
// ---------------------------------------------------------------------------

describe('Property 16: Empty vs error state distinction', () => {
  it('ActionListView with error adapter shows .error-state, no .empty-state', async () => {
    const container = makeContainer();
    const view = new ActionListView(createFailingStub());
    view.mount(container);
    await view.load(container);

    const errorEl = container.querySelector('.error-state');
    const emptyEl = container.querySelector('.empty-state');

    expect(errorEl).not.toBeNull();
    expect(emptyEl).toBeNull();

    // CSS class names are structurally distinct
    expect('error-state').not.toBe('empty-state');

    view.unmount();
  });

  it('EntryDetailView with error adapter shows .error-state, no .empty-state', async () => {
    const container = makeContainer();
    const view = new EntryDetailView(createFailingStub(), 1, 'temperature', 'entry-a1');
    view.mount(container);
    await flushAsync();

    const errorEl = container.querySelector('.error-state');
    const emptyEl = container.querySelector('.empty-state');

    expect(errorEl).not.toBeNull();
    expect(emptyEl).toBeNull();

    expect('error-state').not.toBe('empty-state');

    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// Property 14: Error propagation — arbitrary error strings reach the DOM
// ---------------------------------------------------------------------------

describe('Property 14: Error propagation', () => {
  it('ActionListView renders the exact error string in .error-state, no partial entry data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMsg) => {
          const container = makeContainer();
          const view = new ActionListView(createErrorStub(errorMsg));
          view.mount(container);
          await view.load(container);

          const errorEl = container.querySelector<HTMLElement>('p.error-state');
          expect(errorEl).not.toBeNull();
          expect(errorEl!.textContent).toBe(errorMsg);

          // No partial entry data
          expect(container.querySelector('.kid')).toBeNull();
          expect(container.querySelector('.authority')).toBeNull();
          expect(container.querySelector('.action-list')).toBeNull();
          expect(container.querySelector('.belief-pool')).toBeNull();
          expect(container.querySelector('.entry-primary')).toBeNull();

          view.unmount();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('EntryDetailView renders the exact error string in .error-state, no partial entry data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMsg) => {
          const container = makeContainer();
          const view = new EntryDetailView(createErrorStub(errorMsg), 1, 'temperature', 'entry-a1');
          view.mount(container);
          await flushAsync();

          const errorEl = container.querySelector<HTMLElement>('p.error-state');
          expect(errorEl).not.toBeNull();
          expect(errorEl!.textContent).toBe(errorMsg);

          // No partial entry data
          expect(container.querySelector('.kid')).toBeNull();
          expect(container.querySelector('.authority')).toBeNull();
          expect(container.querySelector('.action-list')).toBeNull();
          expect(container.querySelector('.belief-pool')).toBeNull();
          expect(container.querySelector('.entry-primary')).toBeNull();

          view.unmount();
        },
      ),
      { numRuns: 50 },
    );
  });
});
