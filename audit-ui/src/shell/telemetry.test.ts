import { describe, it, expect, beforeEach } from 'vitest';
import type { AdapterResult, ChatTurn, Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from '../views/chat-log.ts';
import { makeEntry, tick, deferred } from '../test-helpers.ts';
import { TelemetryPanel } from './telemetry.ts';

const SUBJ = 'order-1042.delivery_date';

function lesson(over: Partial<Lesson> = {}): Lesson {
  return {
    event_id: 'l1',
    event_type: 'lesson',
    detail: 'd',
    rule: 'check the carrier feed',
    subject: SUBJ,
    status: 'candidate',
    ...over,
  };
}

function turn(message: string, step: number, katie: ChatTurn['engines']['katie']): ChatTurn {
  return {
    message,
    known: true,
    step,
    total_steps: 6,
    engines: {
      arche: { reply: 'r' },
      erie: null,
      elle: null,
      elle_promoted: null,
      lessons_in_prompt: { subjects: [], injected: [], held: [] },
      katie,
    },
  };
}

interface State {
  entries: Entry[];
  lessons: Lesson[];
}

function fake(state: State): SeamAdapter {
  return {
    fetchAllEntries: async () => ({ ok: true, data: [...state.entries] }),
    fetchLessons: async () => ({ ok: true, data: [...state.lessons] }),
  } as unknown as SeamAdapter;
}

function entry(id: string, subject: string, authority: number, kStart: string, evidence = 'ev'): Entry {
  return makeEntry({ id, kid: 4, subject, authority, k_start: kStart, evidence });
}

describe('TelemetryPanel', () => {
  let slot: HTMLElement;
  beforeEach(() => {
    slot = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(slot);
  });

  it('shows heading and empty state before any turn', async () => {
    new TelemetryPanel(fake({ entries: [], lessons: [] }), new ChatLog()).mount(slot);
    await tick();
    expect(slot.querySelector('h2')?.textContent).toBe('Curator + ELLE (mock)');
    expect(slot.querySelector('.subject-folders .empty-state')?.textContent).toBe(
      'No subjects yet. Folders appear as the conversation records them.',
    );
    expect(slot.querySelectorAll('.subject-folder')).toHaveLength(0);
    expect(slot.querySelector('.katie-box .empty-state')).not.toBeNull();
  });

  it('makes a folder per touched subject in first-seen order', async () => {
    const log = new ChatLog();
    const state: State = {
      entries: [entry('a', 'zeta', 3, '2026-01-01T00:00:00Z'), entry('b', 'alpha', 4, '2026-01-02T00:00:00Z')],
      lessons: [lesson({ subject: 'omega' })],
    };
    new TelemetryPanel(fake(state), log).mount(slot);
    log.push(turn('m1', 1, [{ kid: 4, subject: 'zeta', entry_id: 'a', seated: true }]));
    log.push(turn('m2', 2, [{ kid: 4, subject: 'alpha', entry_id: 'b', seated: true }]));
    await tick();
    const names = [...slot.querySelectorAll('.subject-folder .folder-subject')].map((n) => n.textContent);
    expect(names).toEqual(['zeta', 'alpha', 'omega']);
  });

  it('folder value is the latest entry authority and moves 6 -> 7 on refresh', async () => {
    const log = new ChatLog();
    const state: State = { entries: [entry('s1', SUBJ, 6, '2026-11-18T00:00:00Z')], lessons: [] };
    const panel = new TelemetryPanel(fake(state), log);
    panel.mount(slot);
    log.push(turn('m1', 1, [{ kid: 4, subject: SUBJ, entry_id: 's1', seated: true }]));
    await tick();
    expect(slot.querySelector('.folder-value')?.textContent).toBe('6');
    expect(slot.querySelector('.folder-authority')?.textContent).toContain('authority of latest entry');
    state.entries.push(entry('s3', SUBJ, 7, '2026-11-19T00:00:00Z'));
    panel.refresh();
    await tick();
    expect(slot.querySelector('.folder-value')?.textContent).toBe('7');
    expect(slot.querySelector('.folder-history')?.textContent).toBe('6 -> 7');
  });

  it('folder with no entry shows -- and no entry recorded', async () => {
    new TelemetryPanel(fake({ entries: [], lessons: [lesson()] }), new ChatLog()).mount(slot);
    await tick();
    expect(slot.querySelector('.folder-value')?.textContent).toBe('--');
    expect(slot.querySelector('.folder-history')?.textContent).toBe('no entry recorded');
  });

  it('candidate lesson is grey inside its folder; promoted shows learned; unfiled listed', async () => {
    const state: State = {
      entries: [],
      lessons: [
        lesson({ event_id: 'l1' }),
        lesson({ event_id: 'l2', rule: 'promoted rule', status: 'promoted' }),
        lesson({ event_id: 'l3', rule: 'loose rule', subject: null }),
      ],
    };
    new TelemetryPanel(fake(state), new ChatLog()).mount(slot);
    await tick();
    const folder = slot.querySelector('.subject-folder')!;
    const cand = folder.querySelector('.lesson-candidate')!;
    expect(cand.textContent).toContain('not learned yet');
    expect(cand.textContent).toContain('check the carrier feed');
    const prom = folder.querySelector('.lesson-promoted')!;
    expect(prom.textContent).toContain('learned');
    expect(prom.textContent).not.toContain('not learned');
    const unfiled = slot.querySelectorAll('.lessons-unfiled li');
    expect(unfiled).toHaveLength(1);
    expect(unfiled[0].textContent).toContain('loose rule');
    expect(slot.querySelectorAll('.subject-folder')).toHaveLength(1);
  });

  it('KATIE feed is newest first with href, evidence and from text', async () => {
    const log = new ChatLog();
    const state: State = {
      entries: [entry('s1', SUBJ, 6, '2026-11-18T00:00:00Z', 'first evidence')],
      lessons: [],
    };
    new TelemetryPanel(fake(state), log).mount(slot);
    log.push(turn('When will it arrive?', 1, [{ kid: 4, subject: SUBJ, entry_id: 's1', seated: true }]));
    log.push(turn('It moved', 3, [{ kid: 4, subject: 'other thing', entry_id: 'x/9', seated: true }]));
    await tick();
    const items = [...slot.querySelectorAll('.katie-feed .katie-item')];
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('a')?.textContent).toBe('other thing');
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/entry/4/other%20thing/x%2F9');
    expect(items[0].textContent).toContain('entry not visible');
    expect(items[0].textContent).toContain('from: "It moved" (step 3)');
    expect(items[1].querySelector('a')?.getAttribute('href')).toBe(`/entry/4/${SUBJ}/s1`);
    expect(items[1].textContent).toContain('first evidence');
    expect(items[1].textContent).toContain('from: "When will it arrive?" (step 1)');
  });

  it('a late refresh after unmount is dropped', async () => {
    const d = deferred<AdapterResult<Entry[]>>();
    const adapter = {
      fetchAllEntries: () => d.promise,
      fetchLessons: async () => ({ ok: true, data: [] }),
    } as unknown as SeamAdapter;
    const panel = new TelemetryPanel(adapter, new ChatLog());
    panel.mount(slot);
    panel.unmount();
    d.resolve({ ok: true, data: [] });
    await tick();
    expect(slot.innerHTML).toBe('');
  });

  it('a stale refresh does not overwrite a newer one', async () => {
    const d1 = deferred<AdapterResult<Entry[]>>();
    let n = 0;
    const adapter = {
      fetchAllEntries: () => (++n === 1 ? d1.promise : Promise.resolve({ ok: true, data: [] })),
      fetchLessons: async () => ({ ok: true, data: [lesson()] }),
    } as unknown as SeamAdapter;
    const panel = new TelemetryPanel(adapter, new ChatLog());
    panel.mount(slot);
    panel.refresh();
    await tick();
    expect(slot.querySelector('.folder-value')?.textContent).toBe('--');
    d1.resolve({ ok: true, data: [entry('old', SUBJ, 1, '2026-01-01T00:00:00Z')] });
    await tick();
    expect(slot.querySelector('.folder-value')?.textContent).toBe('--');
  });
});
