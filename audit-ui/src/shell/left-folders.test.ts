/**
 * The sidebar Curator panel (Darren, Nov 25): only the folders the Curator
 * filed, one compact row each (subject, entry count, latest authority), the
 * whole row a link. A subject is in because a curator-folder-<subject>
 * marker is in the record; the seed corpus has none and stays out. The full
 * cards (meter, history, lessons) live on the Curator page.
 * Records and lessons come from stubs (test doubles, never app data).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { LeftPanel, folderHref, groupHref } from './left.ts';
import { CuratorView } from '../views/curator.ts';
import type { Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import { catalog } from '../util/curator.ts';
import { createRecordStub, makeEntry, tick } from '../test-helpers.ts';

const L = (over: Partial<Lesson>): Lesson => ({
  event_id: 'l', event_type: 'lesson', detail: 'd', rule: 'rule', subject: null, status: 'candidate', ...over,
});

// The live seed's shape: corpus entries with no folder marker.
const SEED: Entry[] = [
  makeEntry({ id: 's1', kid: 1, subject: 'frankenstein-letter-1', state: 'MATURE', authority: 8 }),
  makeEntry({ id: 's2', kid: 5, subject: 'frankenstein-chapter-1', state: 'MATURE', authority: 8 }),
  makeEntry({ id: 's3', kid: 28, subject: 'frankenstein-biography-movie', state: 'MATURE', authority: 8 }),
];
// Two user turns about the dog, and the Curator's folder pointing at them.
const T1 = makeEntry({ id: 't1', kid: 30, subject: 'turn', authority: 5, k_start: '2026-11-24T10:00:00.000Z' });
const T2 = makeEntry({ id: 't2', kid: 32, subject: 'turn', authority: 6, k_start: '2026-11-24T10:05:00.000Z' });
const DOG = makeEntry({ id: 'f-dog', kid: 34, subject: 'curator-folder-dog', authority: 5, case_file: ['t1', 't2'] });
// A folder whose subject has entries of its own (an account), the old shape.
const ACCT = [
  makeEntry({ id: 'a1', kid: 41, subject: 'order-1042.status', authority: 6, k_start: '2026-11-16T09:00:00.000Z' }),
  makeEntry({ id: 'a2', kid: 41, subject: 'order-1042.status', authority: 7, k_start: '2026-11-16T14:00:00.000Z' }),
];
const ACCT_FOLDER = makeEntry({ id: 'f-acct', kid: 42, subject: 'curator-folder-order-1042', authority: 5 });

function adapter(entries: Entry[], lessons: Lesson[] = []): SeamAdapter {
  return createRecordStub(entries, { fetchLessons: async () => ({ ok: true, data: lessons }) });
}

let slot: HTMLElement;
afterEach(() => slot?.remove());

async function mount(a: SeamAdapter): Promise<HTMLElement> {
  slot = document.createElement('div');
  document.body.appendChild(slot);
  new LeftPanel(a).mount(slot);
  for (let i = 0; i < 4; i++) await tick();
  return slot;
}

const rows = (s: HTMLElement) => [...s.querySelectorAll<HTMLAnchorElement>('.curator-row')];
const cells = (r: HTMLElement) =>
  ['.curator-row-name', '.curator-row-count', '.curator-row-value'].map((c) => r.querySelector(c)!.textContent);

describe('the marker test: only folders the Curator filed', () => {
  it('seed subjects with no marker are out; a marked subject is in with its count and latest authority', async () => {
    const s = await mount(adapter([...SEED, T1, T2, DOG]));
    expect(rows(s).map(cells)).toEqual([['dog', '2 entries', '6/9']]);
    expect(s.textContent).not.toContain('frankenstein');
    expect(s.querySelector('.subject-folder, .folder-list')).toBeNull(); // no big cards in the sidebar
  });

  it('the marker decides, not the name: a marked frankenstein subject is in', async () => {
    const marked = makeEntry({ id: 'f-ch1', kid: 50, subject: 'curator-folder-frankenstein-chapter-1', authority: 5 });
    const s = await mount(adapter([...SEED, marked]));
    expect(rows(s).map(cells)).toEqual([['frankenstein-chapter-1', '1 entry', '8/9']]);
  });

  it('a subject with entries of its own counts them and shows its latest authority', async () => {
    const s = await mount(adapter([...ACCT, ACCT_FOLDER, ...SEED]));
    expect(rows(s).map(cells)).toEqual([['order-1042', '2 entries', '7/9']]);
  });

  it('a folder with nothing in the record shows 0 and the folder entry authority', async () => {
    const lone = makeEntry({ id: 'f-cat', kid: 60, subject: 'curator-folder-cat', authority: 5, case_file: ['gone'] });
    const s = await mount(adapter([lone]));
    expect(rows(s).map(cells)).toEqual([['cat', '0 entries', '5/9']]);
  });

  it('a re-filed subject is one row, from its standing folder', async () => {
    const older = makeEntry({ id: 'f-dog-0', kid: 33, subject: 'curator-folder-dog', authority: 5, case_file: ['t1'] });
    const s = await mount(adapter([T1, T2, older, DOG]));
    expect(rows(s).map(cells)).toEqual([['dog', '2 entries', '6/9']]);
  });

  it('rows sort by subject, numbers in order', async () => {
    const mk = (n: string) => makeEntry({ id: `f-${n}`, subject: `curator-folder-${n}` });
    const s = await mount(adapter([mk('topic-10'), mk('topic-2'), mk('apple')]));
    expect(rows(s).map((r) => r.dataset.subject)).toEqual(['apple', 'topic-2', 'topic-10']);
  });

  it('ELLE questions and other workspace entries are never case file entries', () => {
    const q = makeEntry({ id: 'q1', subject: 'elle-question-1' });
    const f = makeEntry({ id: 'f-x', subject: 'curator-folder-x', case_file: ['q1'] });
    expect(catalog([q, f])[0]!.caseFile).toEqual([]);
  });
});

describe('the whole row is the link', () => {
  it('the row is one anchor, and it goes where the folder name went (groupHref)', async () => {
    const s = await mount(adapter([...ACCT, ACCT_FOLDER]));
    const [row] = rows(s);
    expect(row!.tagName).toBe('A');
    expect(row!.parentElement!.tagName).toBe('LI');
    expect(row!.querySelectorAll('a')).toHaveLength(0); // no nested link: the whole row taps
    expect(row!.getAttribute('href')).toBe(groupHref('order-1042', ACCT));
    expect(row!.getAttribute('href')).toBe('/record/order-1042');
  });

  it('a folder read from turns opens the newest of them', async () => {
    const s = await mount(adapter([T1, T2, DOG]));
    expect(rows(s)[0]!.getAttribute('href')).toBe('/entry/32/turn/t2');
    expect(folderHref(catalog([T1, T2, DOG])[0]!)).toBe('/entry/32/turn/t2');
  });

  it('a folder with nothing in the record opens its own entry', () => {
    const lone = makeEntry({ id: 'f-cat', kid: 60, subject: 'curator-folder-cat' });
    expect(folderHref(catalog([lone])[0]!)).toBe('/entry/60/curator-folder-cat/f-cat');
  });

  it('the row says what it is to a screen reader', async () => {
    const s = await mount(adapter([T1, T2, DOG]));
    expect(rows(s)[0]!.getAttribute('aria-label')).toBe('dog, 2 entries, authority 6 of 9');
  });
});

describe('the empty state', () => {
  it('zero folder markers: the panel says so, and no seed subject appears', async () => {
    const s = await mount(adapter(SEED));
    expect(s.querySelector('.left-folders .empty-state')?.textContent).toBe(
      'No folders yet. Folders appear as the Curator files them.');
    expect(rows(s)).toHaveLength(0);
    expect(s.querySelector('.left-folders')!.textContent).not.toMatch(/frankenstein|letter|chapter|biography/);
  });
});

describe('the full cards stay on the Curator page', () => {
  it('meter, history and lessons render per folder there', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const lessons = [L({ subject: 'dog', rule: 'Darren likes dogs' })];
    const view = new CuratorView(adapter([...SEED, T1, T2, DOG], lessons));
    view.mount(container);
    for (let i = 0; i < 4; i++) await tick();
    const card = container.querySelector<HTMLElement>('.curator-folder[data-subject="dog"] .subject-folder')!;
    expect(card).not.toBeNull();
    expect(card.dataset.authority).toBe('6'); // the meter reads it
    expect(card.querySelector('.folder-value')?.textContent).toBe('6');
    expect(card.querySelector('.folder-history')?.textContent).toBe('5 -> 6');
    expect(card.querySelector('.lesson-candidate')?.textContent).toContain('Darren likes dogs');
    expect(container.querySelector('.curator-folder[data-subject="dog"] .curator-count')?.textContent).toBe('2 entries');
    expect(container.textContent).not.toContain('frankenstein-letter-1'); // the seed is not a folder there either
    view.unmount();
    container.remove();
  });
});

describe('turns recorded in the same second', () => {
  it('the row opens the later one in record order', () => {
    const at = '2026-11-25T10:00:00.000Z';
    const a = makeEntry({ id: 'ta', kid: 30, subject: 'turn', k_start: at });
    const b = makeEntry({ id: 'tb', kid: 32, subject: 'turn', k_start: at });
    const f = makeEntry({ id: 'f-dog', kid: 34, subject: 'curator-folder-dog', case_file: ['ta', 'tb'] });
    expect(folderHref(catalog([a, b, f])[0]!)).toBe('/entry/32/turn/tb');
  });
});
