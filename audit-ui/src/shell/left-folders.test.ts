/** Subject folders now live in the left column, nested under their group. */
import { describe, it, expect } from 'vitest';
import { LeftPanel } from './left.ts';
import type { Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import { makeEntry, tick } from '../test-helpers.ts';

const L = (over: Partial<Lesson>): Lesson => ({
  event_id: 'l', event_type: 'lesson', detail: 'd', rule: 'rule', subject: null, status: 'candidate', ...over,
});

function adapter(entries: Entry[], lessons: Lesson[]): SeamAdapter {
  return {
    fetchAllEntries: async () => ({ ok: true, data: entries }),
    fetchLessons: async () => ({ ok: true, data: lessons }),
  } as unknown as SeamAdapter;
}

async function mount(a: SeamAdapter): Promise<HTMLElement> {
  const slot = document.createElement('div');
  new LeftPanel(a).mount(slot);
  await tick();
  await tick();
  return slot;
}

describe('LeftPanel subject folders', () => {
  it('groups come from the subject prefix; folders nest inside with meter number, history and lessons', async () => {
    const slot = await mount(
      adapter(
        [
          makeEntry({ id: 'a', kid: 4, subject: 'order-1042.delivery_date', authority: 6, k_start: '2026-11-16T09:00:00.000Z' }),
          makeEntry({ id: 'b', kid: 4, subject: 'order-1042.delivery_date', authority: 7, k_start: '2026-11-16T14:00:00.000Z' }),
          makeEntry({ id: 'c', kid: 5, subject: 'parcel-77.status', authority: 8 }),
        ],
        [
          L({ subject: 'order-1042.delivery_date', rule: 'grey one' }),
          L({ event_id: 'l2', subject: 'order-1042.delivery_date', rule: 'green one', status: 'promoted' }),
          L({ event_id: 'l3', subject: null, rule: 'floating' }),
        ],
      ),
    );
    const groups = Array.from(slot.querySelectorAll<HTMLElement>('.folder-list > .folder')).map((g) => g.dataset.group);
    expect(groups).toEqual(['order-1042', 'parcel-77']);
    const date = slot.querySelector<HTMLElement>('.folder[data-group="order-1042"] .subject-folder[data-subject="order-1042.delivery_date"]')!;
    expect(date.dataset.authority).toBe('7');
    expect(date.querySelector('.folder-value')?.textContent).toBe('7');
    expect(date.querySelector('.folder-history')?.textContent).toBe('6 -> 7');
    expect(date.querySelector('.lesson-candidate')?.textContent).toContain('grey one');
    expect(date.querySelector('.lesson-promoted')?.textContent).toContain('green one');
    expect(slot.querySelector('.lessons-unfiled')?.textContent).toContain('floating');
    // Nothing invented: no group name the data did not give.
    expect(slot.textContent).not.toContain('Volshi');
  });

  it('a long name and a long history keep their full text on hover', async () => {
    const slot = await mount(
      adapter(
        [
          makeEntry({ id: 'a', kid: 4, subject: 'order-1042.delivery_date', authority: 6, k_start: '2026-11-16T09:00:00.000Z' }),
          makeEntry({ id: 'b', kid: 4, subject: 'order-1042.delivery_date', authority: 7, k_start: '2026-11-16T14:00:00.000Z' }),
        ],
        [],
      ),
    );
    const head = slot.querySelector<HTMLAnchorElement>('.folder[data-group="order-1042"] .folder-head a')!;
    expect(head.textContent).toBe('order-1042');
    expect(head.title).toBe('order-1042');
    const history = slot.querySelector<HTMLElement>('.subject-folder[data-subject="order-1042.delivery_date"] .folder-history')!;
    expect(history.textContent).toBe('6 -> 7');
    expect(history.title).toBe('6 -> 7');
  });

  it('heads show the part that differs: the shared prefix is cut, the full name stays on hover', async () => {
    const slot = await mount(
      adapter(
        [
          makeEntry({ id: 'a', kid: 1, subject: 'frankenstein-chapter-1' }),
          makeEntry({ id: 'b', kid: 10, subject: 'frankenstein-chapter-10' }),
          makeEntry({ id: 'c', kid: 4, subject: 'frankenstein-letter-4' }),
        ],
        [],
      ),
    );
    const heads = Array.from(slot.querySelectorAll<HTMLAnchorElement>('.folder-list > .folder > .folder-head a')).map(
      (a) => [a.textContent, a.title],
    );
    expect(heads).toEqual([
      ['chapter-1', 'frankenstein-chapter-1'],
      ['chapter-10', 'frankenstein-chapter-10'],
      ['letter-4', 'frankenstein-letter-4'],
    ]);
  });

  it('numbered folders sort by the number: chapter-2 before chapter-10', async () => {
    const slot = await mount(
      adapter(
        [
          makeEntry({ id: 'a', kid: 1, subject: 'frankenstein-chapter-1' }),
          makeEntry({ id: 'b', kid: 10, subject: 'frankenstein-chapter-10' }),
          makeEntry({ id: 'c', kid: 2, subject: 'frankenstein-chapter-2' }),
          makeEntry({ id: 'd', kid: 20, subject: 'frankenstein-chapter-20' }),
        ],
        [],
      ),
    );
    const heads = Array.from(slot.querySelectorAll<HTMLAnchorElement>('.folder-list > .folder > .folder-head a')).map(
      (a) => a.title,
    );
    expect(heads).toEqual([
      'frankenstein-chapter-1',
      'frankenstein-chapter-2',
      'frankenstein-chapter-10',
      'frankenstein-chapter-20',
    ]);
  });

  it('one unrelated group does not break the cut for the rest: turn stays turn, chapters stay chapters', async () => {
    const slot = await mount(
      adapter(
        [
          makeEntry({ id: 'a', kid: 1, subject: 'frankenstein-chapter-1' }),
          makeEntry({ id: 'b', kid: 2, subject: 'frankenstein-chapter-2' }),
          makeEntry({ id: 'c', kid: 4, subject: 'frankenstein-letter-4' }),
          makeEntry({ id: 'd', kid: 28, subject: 'turn' }),
        ],
        [],
      ),
    );
    const heads = Array.from(slot.querySelectorAll<HTMLAnchorElement>('.folder-list > .folder > .folder-head a')).map(
      (a) => [a.textContent, a.title],
    );
    expect(heads).toEqual([
      ['chapter-1', 'frankenstein-chapter-1'],
      ['chapter-2', 'frankenstein-chapter-2'],
      ['letter-4', 'frankenstein-letter-4'],
      ['turn', 'turn'],
    ]);
  });

  it('heads keep the full name when the groups share nothing worth cutting', async () => {
    const slot = await mount(
      adapter(
        [
          makeEntry({ id: 'a', kid: 4, subject: 'order-1042.delivery_date' }),
          makeEntry({ id: 'b', kid: 5, subject: 'parcel-77.status' }),
        ],
        [],
      ),
    );
    const heads = Array.from(slot.querySelectorAll<HTMLAnchorElement>('.folder-list > .folder > .folder-head a')).map(
      (a) => a.textContent,
    );
    expect(heads).toEqual(['order-1042', 'parcel-77']);
  });

  it('a lesson-only subject gets a folder with "--" and no meter', async () => {
    const slot = await mount(adapter([], [L({ subject: 'acct.thing' })]));
    const f = slot.querySelector<HTMLElement>('.subject-folder[data-subject="acct.thing"]')!;
    expect(f.querySelector('.folder-value')?.textContent).toBe('--');
    expect(f.dataset.authority).toBeUndefined();
    expect(slot.querySelector('.folder[data-group="acct"] .folder-head a')).toBeNull();
  });

  it('an empty record and no lessons show "No subjects yet"', async () => {
    const slot = await mount(adapter([], []));
    expect(slot.querySelector('.empty-state')?.textContent).toMatch(/No subjects yet/);
  });

  it('when the record read fails (live path), folders still come from the lessons', async () => {
    const a = {
      fetchAllEntries: async () => ({ ok: false, error: 'not in the connector contract yet' }),
      fetchLessons: async () => ({ ok: true, data: [L({ subject: 'order-1042.delivery_date', rule: 'from ELLE' })] }),
    } as unknown as SeamAdapter;
    const slot = await mount(a);
    expect(slot.querySelector('.prompt-state')?.textContent).toMatch(/Record entries not available/);
    const f = slot.querySelector('.folder[data-group="order-1042"] .subject-folder')!;
    expect(f.querySelector('.folder-value')?.textContent).toBe('--');
    expect(f.querySelector('.lesson-candidate')?.textContent).toContain('from ELLE');
  });

  it('a dotless subject does not show its name twice', async () => {
    const slot = await mount(adapter([makeEntry({ id: 'p', subject: 'pressure' })], []));
    expect(slot.querySelector('.folder[data-group="pressure"] .folder-subject')?.classList.contains('sr-only')).toBe(true);
  });
});

describe('LeftPanel refresh: the meter moves with the record', () => {
  it('a new entry on the subject moves the number and the history on refresh', async () => {
    const entries: Entry[] = [makeEntry({ id: 'a', subject: 'turn', authority: 5, k_start: '2026-11-18T15:00:00.000Z' })];
    const a = {
      fetchAllEntries: async () => ({ ok: true, data: [...entries] }),
      fetchLessons: async () => ({ ok: true, data: [] }),
    } as unknown as SeamAdapter;
    const slot = document.createElement('div');
    const panel = new LeftPanel(a);
    panel.mount(slot);
    await tick(); await tick();
    const folder = (): HTMLElement => slot.querySelector<HTMLElement>('.subject-folder[data-subject="turn"]')!;
    expect(folder().querySelector('.folder-value')?.textContent).toBe('5');
    // No label on the card: it said the same thing on every folder.
    expect(folder().querySelector('.folder-label')).toBeNull();
    entries.push(makeEntry({ id: 'b', subject: 'turn', authority: 7, k_start: '2026-11-18T15:01:00.000Z' }));
    panel.refresh();
    await tick(); await tick();
    expect(folder().querySelector('.folder-value')?.textContent).toBe('7');
    expect(folder().querySelector('.folder-history')?.textContent).toBe('5 -> 7');
  });
});
