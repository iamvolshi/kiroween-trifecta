/**
 * Shell build (WO-H): the three columns working together on the mock
 * order-1042 scenario. Center = chat and record views, right = Curator + ELLE
 * telemetry, left = directories. Lessons stay grey until promoted and are
 * injected only after they are learned.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createMockAdapter } from './adapter/mock.ts';
import { SCENARIO } from './scenario/script.ts';
import { tick } from './test-helpers.ts';

let container: HTMLElement;
let router: Router | null = null;

function start(path: string): void {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createMockAdapter(), container);
}

afterEach(() => {
  router?.destroy();
  router = null;
  container.remove();
});

async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await tick();
}

async function say(message: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('.shell-center #chat-message')!;
  input.value = message;
  container
    .querySelector<HTMLFormElement>('.shell-center .chat-form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await settle();
}

async function playStep(n: number): Promise<void> {
  await say(SCENARIO.steps[n - 1]!.prompt);
}

function folder(subject: string): HTMLElement | null {
  const all = Array.from(container.querySelectorAll<HTMLElement>('.shell-right .subject-folder'));
  return all.find((f) => f.querySelector('.folder-subject')?.textContent === subject) ?? null;
}

function lastElleRow(): string {
  const rows = container.querySelectorAll('.shell-center .engine-elle');
  return rows[rows.length - 1]?.textContent ?? '';
}

const RULE = 'Check the carrier feed before promising a delivery date.';
const DATE = 'order-1042.delivery_date';
const PARCEL = 'parcel-77.status';

describe('right column: subject folders carry the 0-9 value and move with the record', () => {
  it('delivery_date goes 6 -> 7 and parcel status 7 -> 8 as the scenario plays', async () => {
    start('/chat');
    await settle();
    expect(container.querySelector('.shell-right .empty-state')).not.toBeNull();

    await playStep(1);
    expect(folder(DATE)?.querySelector('.folder-value')?.textContent).toBe('6');

    await playStep(2);
    expect(folder(PARCEL)?.querySelector('.folder-value')?.textContent).toBe('7');

    await playStep(3);
    expect(folder(DATE)?.querySelector('.folder-value')?.textContent).toBe('7');
    expect(folder(DATE)?.querySelector('.folder-history')?.textContent).toBe('6 -> 7');

    await playStep(4);
    expect(folder(PARCEL)?.querySelector('.folder-value')?.textContent).toBe('8');
  });
});

describe('lessons: grey until promoted, injected only after learned', () => {
  it('walks candidate -> held -> promoted -> injected', async () => {
    start('/chat');
    for (const n of [1, 2, 3, 4]) await playStep(n);

    // Step 4 recorded the lesson: grey, inside its subject's folder.
    expect(lastElleRow()).toContain('recorded a lesson (not learned yet)');
    const candidate = folder(DATE)?.querySelector('.lesson-candidate');
    expect(candidate?.textContent).toContain(RULE);
    expect(folder(DATE)?.querySelector('.lesson-promoted')).toBeNull();
    expect(folder(PARCEL)?.querySelector('.lesson')).toBeNull();

    // A prompt seeking the subject before promotion: held back, not injected.
    await say('What is the delivery date?');
    expect(lastElleRow()).toContain('held back (not learned yet)');
    expect(lastElleRow()).not.toContain('injected into this prompt');

    // Step 5 promotes; not injected on that same turn.
    await playStep(5);
    expect(lastElleRow()).toContain('promoted a lesson (learned)');
    expect(lastElleRow()).not.toContain('injected into this prompt');
    expect(folder(DATE)?.querySelector('.lesson-promoted')?.textContent).toContain(RULE);
    expect(folder(DATE)?.querySelector('.lesson-candidate')).toBeNull();

    // Step 6 seeks the subject after it was learned: injected.
    await playStep(6);
    expect(lastElleRow()).toContain('injected into this prompt');
    expect(lastElleRow()).toContain(RULE);

    // A prompt seeking only the parcel never gets the lesson.
    await say('Where is the parcel?');
    expect(lastElleRow()).not.toContain(RULE);
  });
});

describe('KATIE feed and the shell staying put', () => {
  it('feed is newest first, links to Entry Detail, and the columns survive navigation', async () => {
    start('/chat');
    for (const n of [1, 2, 3]) await playStep(n);
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('.shell-right .katie-feed a'));
    expect(links.map((a) => decodeURIComponent(a.getAttribute('href')!.split('/').pop()!))).toEqual([
      'scn-s3',
      'scn-s2',
      'scn-s1',
    ]);

    links[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
    expect(container.querySelector('.shell-center .entry-primary')).not.toBeNull();
    expect(folder(DATE)).not.toBeNull();
    expect(container.querySelectorAll('.shell-left nav').length).toBe(1);
  });
});

describe('left column: record folders and the going-back', () => {
  it('account folders appear as the record reveals them and open the record view', async () => {
    start('/chat');
    expect(container.querySelector('.shell-left a[href="/record/order-1042"]')).toBeNull();
    await playStep(1);
    await playStep(2);
    expect(container.querySelector('.shell-left a[href="/record/order-1042"]')).not.toBeNull();
    const parcel = container.querySelector<HTMLAnchorElement>('.shell-left a[href="/record/parcel-77"]')!;
    parcel.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
    expect(container.querySelector('.shell-center')?.textContent).toContain('parcel-77.status');
  });

  it('hour 14: did = the revision, believed at 14:00 = the old date still standing', async () => {
    start('/chat');
    for (const step of SCENARIO.steps) await say(step.prompt);
    router!.navigate('/calendar/2026-11-16/14');
    await settle();
    const ids = (sel: string): string[] =>
      Array.from(container.querySelectorAll<HTMLAnchorElement>(`${sel} a[href^="/entry/"]`)).map((a) =>
        decodeURIComponent(a.getAttribute('href')!.split('/').pop()!),
      );
    expect(ids('.shell-center .hour-did')).toEqual(['scn-s3']);
    expect(ids('.shell-center .hour-believed')).toContain('scn-s1');
    expect(ids('.shell-center .hour-believed')).not.toContain('scn-s3');
  });
});
