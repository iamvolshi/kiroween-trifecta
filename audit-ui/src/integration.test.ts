/**
 * Integration smoke tests — full app bootstrap through the Router.
 *
 * Requirements: 8.1, 8.5
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createMockAdapter } from './adapter/mock.ts';
import { Router } from './router/router.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush the microtask queue so async mount() calls can complete. */
async function tick(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('integration smoke tests', () => {
  let container: HTMLDivElement;
  let adapter: ReturnType<typeof createMockAdapter>;
  let router: Router;

  // Create a fresh container and adapter for each test; destroy the router
  // after each test to remove event listeners and prevent cross-test leakage.
  afterEach(() => {
    router?.destroy();
  });

  it('Test 1: full app bootstrap — Action List loads with entries', async () => {
    adapter = createMockAdapter();
    container = document.createElement('div');
    document.body.appendChild(container);

    router = new Router(adapter, container);
    router.navigate('/actions');

    await tick();

    // Container should have content
    expect(container.innerHTML).not.toBe('');

    // At least one <li> must be present (the mock has 4 entries)
    const items = container.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);

    document.body.removeChild(container);
  });

  it('Test 2: navigate to Time Travel — datetime-local input is present', async () => {
    adapter = createMockAdapter();
    container = document.createElement('div');
    document.body.appendChild(container);

    router = new Router(adapter, container);
    router.navigate('/actions');
    await tick();

    router.navigate('/time-travel');
    await tick();

    const input = container.querySelector<HTMLInputElement>(
      'input[type="datetime-local"]#moment-cursor',
    );
    expect(input).not.toBeNull();

    document.body.removeChild(container);
  });

  it('Test 3: navigate to Entry Detail — entry-primary section is present', async () => {
    adapter = createMockAdapter();
    container = document.createElement('div');
    document.body.appendChild(container);

    router = new Router(adapter, container);
    // kid=1, subject=temperature, id=entry-a1 (from mock fixture)
    router.navigate('/entry/1/temperature/entry-a1');

    await tick();

    const section = container.querySelector('section.entry-primary');
    expect(section).not.toBeNull();

    document.body.removeChild(container);
  });

  it('Test 4: navigate to unknown route — NotFound shows link back to /actions', async () => {
    adapter = createMockAdapter();
    container = document.createElement('div');
    document.body.appendChild(container);

    router = new Router(adapter, container);
    router.navigate('/does-not-exist');

    await tick();

    const link = container.querySelector<HTMLAnchorElement>('a[href="/actions"]');
    expect(link).not.toBeNull();

    document.body.removeChild(container);
  });
});
