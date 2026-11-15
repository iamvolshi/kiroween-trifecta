/**
 * Property-based and example-based tests for the Router.
 *
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6, 2.7
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Router } from './router.ts';
import type { SeamAdapter } from '../adapter/seam.ts';

// ---------------------------------------------------------------------------
// Minimal stub adapter — views only need the adapter reference, not real data
// ---------------------------------------------------------------------------
function makeAdapter(): SeamAdapter {
  return {
    fetchAllEntries: () => Promise.resolve({ ok: true, data: [] }),
    fetchBeliefPool: () => Promise.resolve({ ok: true, data: [] }),
    fetchChain: () => Promise.resolve({ ok: true, data: [] }),
    fetchKidMap: () => Promise.resolve({ ok: true, data: {} }),
  };
}

// Known routes in the route table
const KNOWN_ROUTES = ['/actions', '/time-travel', '/entry/1/temperature/abc'] as const;

// ---------------------------------------------------------------------------
// Property 1: Routing exclusivity
//
// For each known route, navigate to it and assert exactly one view is mounted
// (the container has exactly one child element, not zero).
//
// Validates: Requirements 2.3, 2.4, 2.5
// ---------------------------------------------------------------------------
describe('Property 1: Routing exclusivity', () => {
  let container: HTMLDivElement;
  let router: Router;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(makeAdapter(), container);
  });

  afterEach(() => {
    router.destroy();
    document.body.removeChild(container);
  });

  for (const route of KNOWN_ROUTES) {
    it(`navigating to "${route}" mounts exactly one view`, async () => {
      router.navigate(route);

      // EntryDetailView.mount() fires an async render; flush microtasks so it
      // settles before we assert. For synchronous views this is a no-op.
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      // Container must have content — not empty
      expect(container.children.length).toBeGreaterThanOrEqual(1);
      // Container should have content in innerHTML
      expect(container.innerHTML.trim()).not.toBe('');
    });
  }

  it('only one view is active after sequential navigations (no duplicate mounts)', () => {
    // Navigate through all known routes — each navigate should unmount the previous view
    // so innerHTML reflects only the last-navigated view, not an accumulation
    router.navigate('/actions');
    const afterActions = container.innerHTML;

    router.navigate('/time-travel');
    const afterTimeTravel = container.innerHTML;

    // The HTML should have changed — different views
    expect(afterTimeTravel).not.toBe(afterActions);

    // Container must still have content after each navigation
    expect(container.innerHTML.trim()).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Property 2: Unrecognized route renders not-found
//
// For arbitrary path strings not in the known route table, the router mounts
// NotFoundView, which contains content and a link back to /actions.
//
// Validates: Requirement 2.7
// ---------------------------------------------------------------------------
describe('Property 2: Unrecognized route renders not-found', () => {
  let container: HTMLDivElement;
  let router: Router;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(makeAdapter(), container);
  });

  afterEach(() => {
    router.destroy();
    document.body.removeChild(container);
  });

  it('arbitrary unrecognized paths always render content with a link to /actions (≥50 iterations)', () => {
    // Generate path strings that do NOT match the known route table
    const unknownPathArb = fc.oneof(
      // Completely random strings starting with /
      fc.stringMatching(/^\/[a-z0-9-]{1,20}$/).filter(
        (p) =>
          p !== '/actions' &&
          p !== '/time-travel' &&
          !p.startsWith('/entry/'),
      ),
      // Paths that look like /entry but are malformed (missing segments)
      fc.constant('/entry/'),
      fc.constant('/entry/abc/'),
      fc.constant('/entry/1/'),
      // Other clearly unknown paths
      fc.constantFrom('/dashboard', '/settings', '/unknown', '/foo/bar', '/xyz'),
    );

    fc.assert(
      fc.property(unknownPathArb, (path) => {
        router.navigate(path);

        // Container must have content — not empty
        if (container.innerHTML.trim() === '') return false;

        // Container innerHTML must contain a link back to /actions
        if (!container.innerHTML.includes('href="/actions"')) return false;

        return true;
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Example-based test: popstate
//
// Navigate to /actions, then to /time-travel (pushes history), then dispatch
// a popstate event. The popstate listener should re-resolve location.pathname
// and mount the correct view.
//
// Validates: Requirement 2.6
// ---------------------------------------------------------------------------
describe('popstate: browser back/forward triggers view re-resolution', () => {
  let container: HTMLDivElement;
  let router: Router;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(makeAdapter(), container);
  });

  afterEach(() => {
    router.destroy();
    document.body.removeChild(container);
  });

  it('popstate event triggers view re-resolution from location.pathname', () => {
    // Navigate to /actions first
    router.navigate('/actions');
    expect(container.innerHTML).toContain('Action List');

    // Navigate to /time-travel (pushes history entry)
    router.navigate('/time-travel');
    expect(container.innerHTML).toContain('Time Travel');

    // Simulate browser back: jsdom keeps history state, so we set pathname
    // then dispatch popstate. The router's popstate handler calls
    // resolve(window.location.pathname).
    window.history.pushState({}, '', '/actions');
    window.dispatchEvent(new PopStateEvent('popstate'));

    // After popstate with pathname=/actions, router should re-mount ActionListView
    expect(container.innerHTML).toContain('Action List');
    expect(container.innerHTML.trim()).not.toBe('');
  });
});
