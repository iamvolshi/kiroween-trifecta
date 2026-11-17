/**
 * Assembly wiring (order tasks 5 and 6): one record, one seam, every view.
 * The scenario's entries, revealed by chatting, show up in Action List,
 * Time Travel, Entry Detail and Calendar through the same mock adapter.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createMockAdapter } from './adapter/mock.ts';
import { SCENARIO } from './scenario/script.ts';
import { isLiveAt } from './util/interval.ts';
import { parseUtcInput } from './util/moment.ts';
import type { SeamAdapter } from './adapter/seam.ts';
import { tick } from './test-helpers.ts';

let container: HTMLElement;
let router: Router | null = null;
let adapter: SeamAdapter;

function start(path: string): void {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  adapter = createMockAdapter();
  router = new Router(adapter, container);
}

afterEach(() => {
  router?.destroy();
  router = null;
  container.remove();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await tick();
}

async function say(message: string): Promise<void> {
  // The chat needs a persona before the first send.
  const pick = container.querySelector<HTMLButtonElement>('.persona-picker [data-value="Elara"]');
  if (pick && pick.getAttribute('aria-checked') !== 'true') pick.click();
  const input = container.querySelector<HTMLInputElement>('#chat-message')!;
  input.value = message;
  container
    .querySelector<HTMLFormElement>('.chat-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
}

async function playAll(): Promise<void> {
  for (const step of SCENARIO.steps) await say(step.prompt);
}

function actionIds(): string[] {
  return Array.from(container.querySelectorAll('.action-list a')).map(
    (a) => decodeURIComponent(a.getAttribute('href')!.split('/').pop()!),
  );
}

async function timeTravelTo(value: string): Promise<string[]> {
  const input = container.querySelector<HTMLInputElement>('#moment-cursor')!;
  input.value = value;
  input.dispatchEvent(new Event('change'));
  await settle();
  return Array.from(container.querySelectorAll('.belief-pool li .reason')).map(
    (s) => s.textContent ?? '',
  );
}

const S1 = SCENARIO.steps[0]!.entries[0]!;

describe('task 5: scenario entries flow through the one seam', () => {
  it('Action List shows a scenario entry only after its step is revealed', async () => {
    start('/actions');
    await settle();
    expect(actionIds()).not.toContain(S1.id);

    router!.navigate('/chat');
    await say(SCENARIO.steps[0]!.prompt);
    router!.navigate('/actions');
    await settle();
    expect(actionIds()).toContain(S1.id);
    expect(actionIds()).not.toContain(SCENARIO.steps[1]!.entries[0]!.id);
  });

  it("Time Travel's frozen pool holds the entry at a moment inside its interval", async () => {
    const inside = '2026-11-16T10:00';
    const ms = parseUtcInput(inside)!;
    expect(isLiveAt(S1, ms)).toBe(true);

    start('/time-travel');
    expect(await timeTravelTo(inside)).not.toContain(S1.reason);

    router!.navigate('/chat');
    await say(SCENARIO.steps[0]!.prompt);
    router!.navigate('/time-travel');
    expect(await timeTravelTo(inside)).toContain(S1.reason);
  });

  it('the KATIE item in the work column opens that entry in Entry Detail', async () => {
    start('/chat');
    await say(SCENARIO.steps[0]!.prompt);
    const link = container.querySelector<HTMLAnchorElement>('.shell-right .feed-item[data-engine="KATIE"] .katie-link')!;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
    expect(container.querySelector('.entry-not-found')).toBeNull();
    expect(container.querySelector('.entry-primary .reason')?.textContent).toBe(S1.reason);
  });

  it('after the revision, Entry Detail shows the whole (KID 4) chain', async () => {
    start('/chat');
    await playAll();
    const s3 = SCENARIO.steps[2]!.entries[0]!;
    router!.navigate(`/entry/4/${encodeURIComponent(s3.subject)}/${s3.id}`);
    await settle();
    const chainText = container.querySelector('.chain-list')?.textContent ?? '';
    expect(chainText).toContain(S1.reason);
    expect(chainText).toContain(s3.reason);
  });

  it('Calendar dots the scenario day only after reveal, and the hour view matches isLiveAt', async () => {
    start('/calendar/2026-11');
    await settle();
    expect(container.querySelectorAll('.day-dot').length).toBe(0);

    router!.navigate('/chat');
    await playAll();
    router!.navigate('/calendar/2026-11');
    await settle();
    expect(container.querySelectorAll('.day-dot').length).toBe(1);

    router!.navigate('/calendar/2026-11-16/14');
    await settle();
    const all = await adapter.fetchAllEntries();
    const moment = parseUtcInput('2026-11-16T14:00')!;
    const live = all.ok ? all.data.filter((e) => isLiveAt(e, moment)) : [];
    const shown = container.querySelectorAll('.hour-believed tbody tr').length;
    expect(live.length).toBe(2); // S1 [09:12,14:30) and S2 [10:05,15:10)
    expect(shown).toBe(live.length);
    expect(container.querySelector('.cursor-display')?.textContent).toBe(
      'Moment (UTC): 2026-11-16T14:00',
    );
  });
});

describe('task 6: the shell nav links all four destinations on every route', () => {
  const destinations = ['/actions', '/time-travel', '/chat', '/calendar'];
  const paths = [
    '/actions',
    '/time-travel',
    '/chat',
    '/calendar',
    '/calendar/2026-11',
    '/calendar/2026-11-16',
    '/calendar/2026-11-16/14',
    '/entry/1/temperature/entry-a1',
    '/record/order-1042',
    '/no-such-page',
  ];
  for (const path of paths) {
    it(`${path} renders one nav with all four links and the mock label`, async () => {
      start(path);
      await settle();
      expect(container.querySelectorAll('nav')).toHaveLength(1);
      expect(container.querySelector('.shell-left nav')).not.toBeNull();
      const hrefs = Array.from(container.querySelectorAll('nav a')).map((a) =>
        a.getAttribute('href'),
      );
      for (const d of destinations) expect(hrefs).toContain(d);
      expect(container.querySelector('nav .mock-badge')?.textContent).toMatch(/MOCK/);
    });
  }

  it('an invalid calendar path is NotFound', async () => {
    start('/calendar/2026-13');
    await settle();
    expect(container.querySelector('.not-found')).not.toBeNull();
  });

  it('the chat transcript survives navigating away and back', async () => {
    start('/chat');
    await say(SCENARIO.steps[0]!.prompt);
    router!.navigate('/actions');
    router!.navigate('/chat');
    await settle();
    expect(container.querySelector('.step-progress')?.textContent).toBe('Step 1 of 6');
  });
});
