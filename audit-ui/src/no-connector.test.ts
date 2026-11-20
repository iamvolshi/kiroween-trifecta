/**
 * Live-only: with no connector address (the build had no VITE_CONNECTOR_URL),
 * every view says the connector is unreachable, in words. No crash, no empty
 * shell pretending to be data. The adapter here is the REAL live adapter.
 */
import { fetchModelStatus } from './adapter/live-models.ts';
import type { ModelSource } from './views/chat.ts';
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

async function open(path: string, fetchImpl?: FetchLike, base = '', models?: ModelSource): Promise<void> {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createLiveAdapter(base, fetchImpl), container, models);
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

  it('/chat: no voices can load, so the picker slot says the connector is unreachable', async () => {
    await open('/chat');
    // No voice can be picked: no model shown, the composer stays locked.
    expect(container.querySelector('.voice-model')).toBeNull();
    expect(container.querySelector('.voice-picker')).toBeNull();
    expect(container.querySelector('.voice-slot .error-state')?.textContent).toBe(NO_ADDRESS_ERROR);
    const input = container.querySelector<HTMLInputElement>('#chat-message')!;
    expect(input.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('.chat-send')!.disabled).toBe(true);
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

  it('/chat picker slot shows "Connector unreachable"', async () => {
    const models: ModelSource = { status: () => fetchModelStatus('http://127.0.0.1:9', down) };
    await open('/chat', down, 'http://127.0.0.1:9', models);
    expect(container.querySelector('.voice-slot .error-state')?.textContent).toBe('Connector unreachable: Failed to fetch');
    expect(container.querySelector('.voice-picker')).toBeNull();
    expect(container.querySelector('.voice-model')).toBeNull();
  });
});
