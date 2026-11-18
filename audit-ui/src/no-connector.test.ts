/**
 * Live-only: with no connector address (the build had no VITE_CONNECTOR_URL),
 * every view says the connector is unreachable, in words. No crash, no empty
 * shell pretending to be data. The adapter here is the REAL live adapter.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createLiveAdapter, NO_ADDRESS_ERROR, type FetchLike } from './adapter/live.ts';
import { tick } from './test-helpers.ts';

let container: HTMLElement;
let router: Router | null = null;

afterEach(() => {
  router?.destroy();
  router = null;
  container.remove();
});

async function open(path: string, fetchImpl?: FetchLike, base = ''): Promise<void> {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createLiveAdapter(base, fetchImpl), container);
  for (let i = 0; i < 8; i++) await tick();
}

const center = (): string => container.querySelector('.shell-center')?.textContent ?? '';
const left = (): string => container.querySelector('.shell-left')?.textContent ?? '';
const right = (): string => container.querySelector('.shell-right')?.textContent ?? '';

describe('no connector address: every view says so', () => {
  const routes = [
    '/actions',
    '/time-travel',
    '/calendar',
    '/calendar/2026-11-16/14',
    '/entry/1/turn/some-id',
    '/record/frankenstein',
  ];
  for (const path of routes) {
    it(`${path} shows the unreachable words`, async () => {
      await open(path);
      if (path === '/time-travel') {
        const input = container.querySelector<HTMLInputElement>('#moment-cursor')!;
        input.value = '2026-11-16T14:00';
        input.dispatchEvent(new Event('change'));
        for (let i = 0; i < 6; i++) await tick();
      }
      expect(center()).toContain(NO_ADDRESS_ERROR);
      expect(left()).toContain(NO_ADDRESS_ERROR);
      expect(right()).toContain(NO_ADDRESS_ERROR);
      expect(right()).not.toContain('Nothing has happened yet');
    });
  }

  it('/chat: the banner under the chat box says the connector is unreachable', async () => {
    await open('/chat');
    const banner = container.querySelector<HTMLElement>('.chat-form .model-banner')!;
    expect(banner.dataset.state).toBe('unreachable');
    expect(banner.textContent).toContain(NO_ADDRESS_ERROR);
    container.querySelector<HTMLButtonElement>('.persona-picker [data-value="Elara"]')!.click();
    container.querySelector<HTMLInputElement>('#chat-message')!.value = 'hello';
    container.querySelector<HTMLFormElement>('.chat-form')!.requestSubmit();
    for (let i = 0; i < 6; i++) await tick();
    expect(container.querySelector('.chat-error')?.textContent).toContain(NO_ADDRESS_ERROR);
    expect(container.querySelectorAll('.chat-turn')).toHaveLength(0);
  });
});

describe('connector down (address set, nothing answers): every view says so', () => {
  const down: FetchLike = async () => {
    throw new TypeError('Failed to fetch');
  };
  for (const path of ['/actions', '/calendar', '/entry/1/turn/x']) {
    it(`${path} shows "Connector unreachable"`, async () => {
      await open(path, down, 'http://127.0.0.1:9');
      expect(center()).toContain('Connector unreachable: Failed to fetch');
      expect(right()).toContain('Connector unreachable: Failed to fetch');
    });
  }

  it('/chat banner shows "Connector unreachable"', async () => {
    await open('/chat', down, 'http://127.0.0.1:9');
    // The banner reads the build-time address, which tests leave unset.
    expect(container.querySelector('.model-banner')?.getAttribute('data-state')).toBe('unreachable');
  });
});
