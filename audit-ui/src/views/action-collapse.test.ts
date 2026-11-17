/**
 * Action List collapse round: rows start collapsed (KID, headline,
 * authority + a separate Inspect link); the title row toggles its own
 * details; other card views keep the full skeleton.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ActionListView } from './action-list.ts';
import { TimeTravelView } from './time-travel.ts';
import { EntryDetailView } from './entry-detail.ts';
import { RecordView } from './record.ts';
import { Router } from '../router/router.ts';
import { createMockAdapter } from '../adapter/mock.ts';
import { makeEntry, tick } from '../test-helpers.ts';
import type { Entry } from '../adapter/seam.ts';

const ENTRIES: Entry[] = [
  makeEntry({ id: 'a1', kid: 4, subject: 'order-1042.delivery_date', state: 'confirmed', authority: 6,
    k_start: '2026-11-16T09:12:00.000Z', k_time: '2026-11-16T14:30:00.000Z', reason: 'R-A1', evidence: 'value=a (mock)' }),
  makeEntry({ id: 'a2', kid: 4, subject: 'order-1042.delivery_date', state: 'revised', authority: 7,
    k_start: '2026-11-16T14:30:00.000Z', k_time: '2026-11-17T00:00:00.000Z', reason: 'R-A2', evidence: 'value=b (mock)' }),
  makeEntry({ id: 'b1', kid: 5, subject: 'parcel-77.status', state: 'confirmed', authority: 7,
    k_start: '2026-11-16T10:05:00.000Z', k_time: '2026-11-16T15:10:00.000Z', reason: 'R-B1', evidence: 'value=c (mock)' }),
];

let container: HTMLElement;

async function mountList(entries = ENTRIES): Promise<HTMLElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  new ActionListView(createMockAdapter(entries)).mount(container);
  for (let i = 0; i < 4; i++) await tick();
  return container;
}

afterEach(() => {
  container?.remove();
});

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLLIElement>('.action-list > li'));
const toggleOf = (li: Element) => li.querySelector<HTMLButtonElement>('.card-toggle')!;
const detailsOf = (li: Element) => li.querySelector<HTMLElement>('.card-details')!;

describe('collapsed by default', () => {
  it('every row shows only KID, headline and authority, with details hidden', async () => {
    const c = await mountList();
    const lis = rows(c);
    expect(lis).toHaveLength(3);
    for (const li of lis) {
      const t = toggleOf(li);
      expect(t.getAttribute('aria-expanded')).toBe('false');
      expect(Array.from(t.children).filter((s) => !s.classList.contains('sr-only')).map((s) => s.className)).toEqual(['kid', 'label', 'authority']);
      expect(detailsOf(li).hidden).toBe(true);
      // The highlights carry real values from the entry.
      expect(t.querySelector('.kid')!.textContent).toMatch(/^\d+/);
      expect(t.querySelector('.authority')!.textContent).toMatch(/^\d$/);
    }
  });

  it('the toggle is tied to its details region', async () => {
    const c = await mountList();
    const ids = new Set<string>();
    for (const li of rows(c)) {
      const id = toggleOf(li).getAttribute('aria-controls')!;
      expect(detailsOf(li).id).toBe(id);
      expect(detailsOf(li).getAttribute('role')).toBe('region');
      ids.add(id);
    }
    expect(ids.size).toBe(3);
  });

  it('a fresh mount starts collapsed again (no persistence)', async () => {
    const c = await mountList();
    toggleOf(rows(c)[0]!).click();
    c.remove();
    const c2 = await mountList();
    expect(rows(c2).every((li) => detailsOf(li).hidden)).toBe(true);
  });
});

describe('click toggles the details', () => {
  it('click expands (inset + times appear), click again collapses', async () => {
    const c = await mountList();
    const li = rows(c)[0]!;
    const t = toggleOf(li);
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(detailsOf(li).hidden).toBe(false);
    expect(detailsOf(li).querySelector('.card-inset .reason')).not.toBeNull();
    expect(detailsOf(li).querySelector('.card-inset .evidence')).not.toBeNull();
    expect(detailsOf(li).querySelector('.card-times .k-time')).not.toBeNull();
    t.click();
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(detailsOf(li).hidden).toBe(true);
  });

  it('toggles are independent: two rows open at once, the third stays closed', async () => {
    const c = await mountList();
    const [r0, r1, r2] = rows(c);
    toggleOf(r0!).click();
    toggleOf(r1!).click();
    expect(detailsOf(r0!).hidden).toBe(false);
    expect(detailsOf(r1!).hidden).toBe(false);
    expect(detailsOf(r2!).hidden).toBe(true);
  });
});

describe('keyboard', () => {
  it('the toggle is a real button, so Enter and Space activate it', async () => {
    const c = await mountList();
    const t = toggleOf(rows(c)[0]!);
    // Native <button type="button">: browsers fire click on Enter and Space.
    expect(t.tagName).toBe('BUTTON');
    expect(t.type).toBe('button');
    expect(t.tabIndex).toBe(0);
    expect(t.hasAttribute('disabled')).toBe(false);
  });

  it('Enter and Space (dispatched as the browser does: keydown then click) toggle the row', async () => {
    const c = await mountList();
    const li = rows(c)[0]!;
    const t = toggleOf(li);
    t.focus();
    expect(document.activeElement).toBe(t);
    for (const key of ['Enter', ' ']) {
      const before = t.getAttribute('aria-expanded');
      t.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      t.click();
      expect(t.getAttribute('aria-expanded')).not.toBe(before);
    }
  });
});

describe('Inspect stays one click away, and never nests in the toggle', () => {
  it('Inspect is a link outside the toggle, with the entry href', async () => {
    const c = await mountList();
    for (const li of rows(c)) {
      const a = li.querySelector<HTMLAnchorElement>('.card-row > a.card-action')!;
      expect(a).not.toBeNull();
      expect(a.getAttribute('href')).toMatch(/^\/entry\/\d+\//);
      expect(toggleOf(li).contains(a)).toBe(false);
      expect(toggleOf(li).querySelector('a, button')).toBeNull();
      expect(a.closest('[hidden]')).toBeNull();
    }
  });

  it('clicking Inspect on a collapsed row opens Entry Detail', async () => {
    window.history.replaceState({}, '', '/actions');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const router = new Router(createMockAdapter(ENTRIES), root);
    for (let i = 0; i < 4; i++) await tick();
    const li = root.querySelector('.action-list > li')!;
    expect(detailsOf(li).hidden).toBe(true);
    li.querySelector<HTMLAnchorElement>('a.card-action')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    for (let i = 0; i < 4; i++) await tick();
    expect(window.location.pathname).toMatch(/^\/entry\//);
    expect(root.querySelector('.entry-primary')).not.toBeNull();
    router.destroy();
    root.remove();
  });
});

describe('the other card views keep the full skeleton', () => {
  async function mountView(make: (c: HTMLElement) => void): Promise<HTMLElement> {
    container = document.createElement('div');
    document.body.appendChild(container);
    make(container);
    for (let i = 0; i < 4; i++) await tick();
    return container;
  }
  const expectFull = (c: HTMLElement) => {
    const cards = c.querySelectorAll('.record-card');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of Array.from(cards)) {
      expect(card.classList.contains('card-collapsible')).toBe(false);
      expect(card.querySelector('.card-toggle')).toBeNull();
      expect(card.querySelector('[hidden]')).toBeNull();
      expect(card.querySelector('.card-chips')).not.toBeNull();
      expect(card.querySelector('.card-inset')).not.toBeNull();
    }
  };

  it('Time Travel pool', async () => {
    const c = await mountView((el) => new TimeTravelView(createMockAdapter(ENTRIES)).mount(el));
    const input = c.querySelector<HTMLInputElement>('#moment-cursor')!;
    input.value = '2026-11-16T14:00';
    input.dispatchEvent(new Event('change'));
    for (let i = 0; i < 4; i++) await tick();
    expectFull(c);
  });

  it('Entry Detail chain', async () => {
    const c = await mountView((el) =>
      new EntryDetailView(createMockAdapter(ENTRIES), 4, 'order-1042.delivery_date', 'a2').mount(el),
    );
    expect(c.querySelectorAll('.chain-list .record-card')).toHaveLength(2);
    expectFull(c);
  });

  it('Record view', async () => {
    const c = await mountView((el) => new RecordView(createMockAdapter(ENTRIES), 'order-1042').mount(el));
    expect(c.querySelectorAll('.record-entries .record-card')).toHaveLength(2);
    expectFull(c);
  });
});
