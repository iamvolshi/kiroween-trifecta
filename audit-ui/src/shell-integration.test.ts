/**
 * Shell: the three columns working together on the mock order-1042
 * scenario. Left = directories and the subject folders (0-9 meter, history,
 * lessons inside), center = the chat and record views, right = the work
 * column (one activity feed). Lessons stay grey until promoted and are
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
  const pick = container.querySelector<HTMLButtonElement>('.shell-center .persona-picker [data-value="Elara"]');
  if (pick && pick.getAttribute('aria-checked') !== 'true') pick.click();
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
  const all = Array.from(container.querySelectorAll<HTMLElement>('.shell-left .subject-folder'));
  return all.find((f) => f.querySelector('.folder-subject')?.textContent === subject) ?? null;
}

/** The ELLE feed items of the most recent turn, as one string. */
function lastTurnElle(): string {
  const items = Array.from(container.querySelectorAll<HTMLElement>('.shell-right .feed-item'));
  const turnOf = (li: HTMLElement): number => Number(li.dataset.feedId!.split('-')[0]!.slice(1));
  const last = container.querySelectorAll('.shell-center .chat-turn').length - 1;
  return items
    .filter((li) => li.dataset.engine === 'ELLE' && turnOf(li) === last)
    .map((li) => li.textContent)
    .join(' | ');
}

const RULE = 'Check the carrier feed before promising a delivery date.';
const DATE = 'order-1042.delivery_date';
const PARCEL = 'parcel-77.status';

describe('left column: subject folders carry the 0-9 value and move with the record', () => {
  it('delivery_date goes 6 -> 7 and parcel status 7 -> 8 as the scenario plays', async () => {
    start('/chat');
    await settle();
    expect(folder(DATE)).toBeNull();

    await playStep(1);
    expect(folder(DATE)?.querySelector('.folder-value')?.textContent).toBe('6');
    expect(folder(DATE)?.closest('.folder')?.getAttribute('data-group')).toBe('order-1042');

    await playStep(2);
    expect(folder(PARCEL)?.querySelector('.folder-value')?.textContent).toBe('7');

    await playStep(3);
    expect(folder(DATE)?.querySelector('.folder-value')?.textContent).toBe('7');
    expect(folder(DATE)?.querySelector('.folder-history')?.textContent).toBe('6 -> 7');
    expect(folder(DATE)?.getAttribute('data-authority')).toBe('7');

    await playStep(4);
    expect(folder(PARCEL)?.querySelector('.folder-value')?.textContent).toBe('8');
    expect(container.querySelector('.shell-right .subject-folder')).toBeNull();
  });
});

describe('lessons: grey until promoted, injected only after learned', () => {
  it('walks candidate -> held -> promoted -> injected', async () => {
    start('/chat');
    for (const n of [1, 2, 3, 4]) await playStep(n);

    // Step 4 recorded the lesson: grey, inside its subject's folder (left).
    expect(lastTurnElle()).toContain('Recorded a lesson, not learned yet');
    const candidate = folder(DATE)?.querySelector('.lesson-candidate');
    expect(candidate?.textContent).toContain(RULE);
    expect(folder(DATE)?.querySelector('.lesson-promoted')).toBeNull();
    expect(folder(PARCEL)?.querySelector('.lesson')).toBeNull();

    // A prompt seeking the subject before promotion: held back, not injected.
    await say('What is the delivery date?');
    expect(lastTurnElle()).toContain('Held back a lesson that is not learned yet');
    expect(lastTurnElle()).not.toContain('Used a learned lesson');

    // Step 5 promotes; not injected on that same turn.
    await playStep(5);
    expect(lastTurnElle()).toContain('Promoted a lesson, now learned');
    expect(lastTurnElle()).not.toContain('Used a learned lesson');
    expect(folder(DATE)?.querySelector('.lesson-promoted')?.textContent).toContain(RULE);
    expect(folder(DATE)?.querySelector('.lesson-candidate')).toBeNull();

    // Step 6 seeks the subject after it was learned: injected.
    await playStep(6);
    expect(lastTurnElle()).toContain('Used a learned lesson in this reply');
    expect(lastTurnElle()).toContain(RULE);

    // A prompt seeking only the parcel never gets the lesson.
    await say('Where is the parcel?');
    expect(lastTurnElle()).not.toContain(RULE);
  });
});

describe('the work column: one activity feed', () => {
  it('KATIE items are newest first, link to Entry Detail, and the columns survive navigation', async () => {
    start('/chat');
    expect(container.querySelector('.shell-right .empty-state')).not.toBeNull();
    for (const n of [1, 2, 3]) await playStep(n);
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('.shell-right .feed-item[data-engine="KATIE"] .katie-link'),
    );
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

  it('one item per ERIE / ELLE / KATIE event of the played turns, newest first, each tagged', async () => {
    start('/chat');
    for (const step of SCENARIO.steps) await say(step.prompt);
    let expected = 0;
    for (const s of SCENARIO.steps) {
      expected += (s.erie ? 1 : 0) + s.entries.length + (s.elle ? 1 : 0) + (s.promotes ? 1 : 0);
    }
    expected += 1; // step 6 is the one turn that reads a learned lesson into its prompt
    const items = Array.from(container.querySelectorAll<HTMLElement>('.shell-right .feed-item'));
    expect(items).toHaveLength(expected);
    for (const li of items) {
      expect(['ERIE', 'ELLE', 'KATIE']).toContain(li.dataset.engine);
      expect(li.querySelector('.engine-tag')?.textContent).toBe(li.dataset.engine);
    }
    const turnOf = (li: HTMLElement): number => Number(li.dataset.feedId!.split('-')[0]!.slice(1));
    const order = items.map(turnOf);
    expect(order).toEqual([...order].sort((a, b) => b - a));
    expect(container.querySelector('.shell-right')?.textContent).not.toContain('ARCHE');
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
