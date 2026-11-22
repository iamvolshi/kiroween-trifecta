import { describe, it, expect, beforeEach } from 'vitest';
import type { AdapterResult, ChatTurn, Entry, Lesson, SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from '../views/chat-log.ts';
import { makeEntry, tick, deferred } from '../test-helpers.ts';
import { TelemetryPanel, WORK_HEADING } from './telemetry.ts';
import { provenanceChannel } from './provenance-channel.ts';

const SUBJ = 'order-1042.delivery_date';

function lesson(over: Partial<Lesson> = {}): Lesson {
  return { event_id: 'l1', event_type: 'lesson', detail: 'd', rule: 'check the carrier feed', subject: SUBJ, status: 'candidate', ...over };
}

function turn(message: string, step: number | null, over: Partial<ChatTurn['engines']> = {}): ChatTurn {
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
      katie: [],
      ...over,
    },
  };
}

function fake(entries: () => Promise<AdapterResult<Entry[]>>): SeamAdapter {
  return { fetchAllEntries: entries, fetchLessons: async () => ({ ok: true, data: [] }) } as unknown as SeamAdapter;
}

const ok = (data: Entry[]) => async (): Promise<AdapterResult<Entry[]>> => ({ ok: true, data });

describe('TelemetryPanel: the work column', () => {
  let slot: HTMLElement;
  beforeEach(() => {
    slot = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(slot);
  });

  it('heading names the work column; empty state in words', async () => {
    new TelemetryPanel(fake(ok([])), new ChatLog()).mount(slot);
    await tick();
    expect(slot.querySelector('h2')?.textContent).toBe(WORK_HEADING);
    expect(WORK_HEADING).toBe('Telemetry — Machine state');
    expect(slot.querySelector('.empty-state')?.textContent).toMatch(/Nothing has happened yet/);
    expect(slot.querySelector('.subject-folder')).toBeNull();
  });

  it('one item per event, oldest first, newest appended at the bottom, each with its engine tag', async () => {
    const log = new ChatLog();
    new TelemetryPanel(fake(ok([makeEntry({ id: 'e1', kid: 4, subject: SUBJ, evidence: 'value=x (stub)' })])), log).mount(slot);
    log.push(
      turn('first', 1, {
        erie: { question: 'q', state: 'found', text: 'it says x', provenance: [{ source: 'stub:src', content: 'c', excerpt: 'ex' }] },
        katie: [{ kid: 4, subject: SUBJ, entry_id: 'e1', seated: true }],
      }),
    );
    log.push(turn('second', 2, { elle: lesson(), lessons_in_prompt: { subjects: [SUBJ], injected: [], held: [lesson()] } }));
    log.push(turn('third', null, { erie: { question: 'zzz', state: 'not_found', text: '', provenance: [] } }));
    await tick();
    const items = Array.from(slot.querySelectorAll<HTMLElement>('.feed-item'));
    expect(items.map((li) => [li.dataset.feedId, li.dataset.engine])).toEqual([
      ['t0-0', 'ERIE'],
      ['t0-1', 'KATIE'],
      ['t1-0', 'ELLE'],
      ['t1-1', 'ELLE'],
      ['t2-0', 'ERIE'],
    ]);
    for (const li of items) expect(li.querySelector('.engine-tag')?.textContent).toBe(li.dataset.engine);
    expect(slot.querySelector('.activity-feed')?.getAttribute('aria-label')).toBe('Activity, oldest first');
    expect(items[4]!.querySelector('.feed-text')?.textContent).toBe("ERIE found nothing for 'zzz'");
    expect(items[3]!.textContent).toContain('ELLE recorded a lesson, not learned yet: check the carrier feed');
    expect(items[2]!.textContent).toContain('ELLE held back a lesson that is not learned yet');
    const katie = items[1]!;
    expect(katie.querySelector('.feed-text')?.textContent).toBe('KTIE recorded 1 entry for this turn.');
    const row = katie.querySelector<HTMLElement>('.katie-entry')!;
    expect(row.dataset.kid).toBe('4');
    expect(row.dataset.subject).toBe(SUBJ);
    expect(row.dataset.entryId).toBe('e1');
    expect(row.querySelector('a')?.getAttribute('href')).toBe(`/entry/4/${encodeURIComponent(SUBJ)}/e1`);
    expect(katie.querySelector('.katie-evidence')?.textContent).toBe('value=x (stub)');
    expect(katie.querySelector('.feed-from')?.textContent).toBe('from: "first"');
    expect(items[0]!.querySelector('.feed-source')?.textContent).toBe('stub:src ex');
    expect(slot.textContent).not.toContain('ARCHE');
  });

  it('a failed record read still shows the feed, with "entry not visible"', async () => {
    const log = new ChatLog();
    log.push(turn('m', 1, { katie: [{ kid: 4, subject: SUBJ, entry_id: 'e1', seated: true }] }));
    new TelemetryPanel(fake(async () => ({ ok: false, error: 'boom' })), log).mount(slot);
    await tick();
    expect(slot.querySelector('.feed-item .katie-evidence')?.textContent).toBe('entry not visible');
  });

  it('two entries on one turn make ONE KATIE item with two rows', async () => {
    const log = new ChatLog();
    log.push(turn('m', 1, { katie: [{ kid: 4, subject: SUBJ, entry_id: 'e1', seated: true }, { kid: 5, subject: 'p.s', entry_id: 'e2', seated: true }] }));
    new TelemetryPanel(fake(ok([])), log).mount(slot);
    await tick();
    const katie = slot.querySelectorAll('.feed-item[data-engine="KATIE"]');
    expect(katie).toHaveLength(1);
    expect(katie[0]!.querySelector('.feed-text')?.textContent).toBe('KTIE recorded 2 entries for this turn.');
    expect(Array.from(katie[0]!.querySelectorAll<HTMLElement>('.katie-entry')).map((r) => r.dataset.entryId)).toEqual(['e1', 'e2']);
  });

  it('a provenance target highlights its KATIE item; an unknown target changes nothing', async () => {
    const log = new ChatLog();
    log.push(turn('m', 1, { katie: [{ kid: 4, subject: SUBJ, entry_id: 'e1', seated: true }, { kid: 5, subject: 'p.s', entry_id: 'e2', seated: true }] }));
    new TelemetryPanel(fake(ok([])), log).mount(slot);
    await tick();
    provenanceChannel.publish({ kid: 4, subject: SUBJ, entry_id: 'e1' });
    expect(Array.from(slot.querySelectorAll<HTMLElement>('.is-highlighted')).map((li) => li.dataset.entryId)).toEqual(['e1']);
    provenanceChannel.publish({ kid: 5, subject: 'p.s', entry_id: 'e2' });
    expect(Array.from(slot.querySelectorAll<HTMLElement>('.is-highlighted')).map((li) => li.dataset.entryId)).toEqual(['e2']);
    provenanceChannel.publish({ kid: 9, subject: 'nope', entry_id: 'x' });
    expect(Array.from(slot.querySelectorAll<HTMLElement>('.is-highlighted')).map((li) => li.dataset.entryId)).toEqual(['e2']);
  });

  it('an ERIE found is a short report, not the found text', async () => {
    const log = new ChatLog();
    const chapter = `CHAPTER VII. ${'My present situation was one in which all voluntary thought was swallowed up and lost. '.repeat(60)}`;
    log.push(turn('m', 1, {
      erie: {
        question: 'q', state: 'found', text: chapter,
        provenance: [{ source: 'K-record day 20778 tick 26, Mary Shelley', content: 'e1', excerpt: 'CHAPTER VII. My present situation' }],
      },
    }));
    new TelemetryPanel(fake(ok([makeEntry({ id: 'e1', kid: 11, subject: 'frankenstein-chapter-7', authority: 8 })])), log).mount(slot);
    await tick();
    const item = slot.querySelector<HTMLElement>('.feed-item[data-engine="ERIE"]')!;
    expect(item.querySelector('.feed-text')?.textContent).toBe('ERIE found what this needs: located 1 reference. Provenance OK. Trust 8.');
    expect(item.textContent).not.toContain('My present situation was one in which');
  });

  it('a late refresh after unmount is dropped, and unmount stops listening', async () => {
    const late = deferred<AdapterResult<Entry[]>>();
    const log = new ChatLog();
    const panel = new TelemetryPanel(fake(() => late.promise), log);
    panel.mount(slot);
    panel.unmount();
    late.resolve({ ok: true, data: [] });
    await tick();
    expect(slot.innerHTML).toBe('');
    log.push(turn('after', 1));
    provenanceChannel.publish({ kid: 4, subject: SUBJ, entry_id: 'e1' });
    await tick();
    expect(slot.innerHTML).toBe('');
  });
});
