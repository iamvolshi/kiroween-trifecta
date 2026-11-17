import { describe, it, expect } from 'vitest';
import { createMockAdapter, createErrorMock } from './mock';
import { SCENARIO } from '../scenario/script.ts';
import { createScenarioCursor } from '../scenario/stepper.ts';

const FIXTURE_IDS = ['entry-a1', 'entry-b1', 'entry-c1', 'entry-d3'];

async function ids(a: ReturnType<typeof createMockAdapter>): Promise<string[]> {
  const r = await a.fetchAllEntries();
  if (!r.ok) throw new Error(r.error);
  return r.data.map(e => e.id);
}

describe('mock adapter with scenario', () => {
  it('position 0 returns exactly the 4 fixtures', async () => {
    expect(await ids(createMockAdapter())).toEqual(FIXTURE_IDS);
  });

  it('explicit entries mean no scenario', async () => {
    const a = createMockAdapter([]);
    expect(await ids(a)).toEqual([]);
    const c = await a.chat('When will my order arrive?');
    expect(c.ok && c.data.known).toBe(false);
    const k = await a.fetchKidMap();
    expect(k.ok && k.data[4]).toBeUndefined();
  });

  it('scenario entry appears only after its step', async () => {
    const a = createMockAdapter();
    await a.chat('When will my order arrive?');
    expect(await ids(a)).toEqual([...FIXTURE_IDS, 'scn-s1']);
    await a.chat('Where is the parcel now?');
    expect(await ids(a)).toEqual([...FIXTURE_IDS, 'scn-s1', 'scn-s2']);
  });

  it('chain and pool read the same store', async () => {
    const a = createMockAdapter();
    for (const s of SCENARIO.steps) await a.chat(s.prompt);
    const chain = await a.fetchChain(4, 'order-1042.delivery_date');
    expect(chain.ok && chain.data.map(e => e.id)).toEqual(['scn-s1', 'scn-s3']);
    const pool = await a.fetchBeliefPool(Date.parse('2026-11-16T16:00:00.000Z'));
    expect(pool.ok && pool.data.map(e => e.id).sort()).toEqual(['scn-s3', 'scn-s4']);
  });

  it('kid map adds labels only with a cursor', async () => {
    const withCursor = await createMockAdapter().fetchKidMap();
    expect(withCursor.ok && withCursor.data).toMatchObject({
      1: 'sensor-alpha', 3: 'pressure-gauge', 4: 'order-1042 (mock)', 5: 'parcel-77 (mock)',
    });
    const without = await createMockAdapter(undefined, { cursor: null }).fetchKidMap();
    expect(without.ok && without.data).toEqual({ 1: 'sensor-alpha', 3: 'pressure-gauge' });
  });

  it('chat plays steps in order, then not-knowing', async () => {
    const a = createMockAdapter();
    const out = await a.chat('Where is the parcel now?');
    expect(out.ok && out.data.known).toBe(false);
    expect(out.ok && out.data.engines.arche.reply).toBe(SCENARIO.not_knowing_reply);
    expect(out.ok && out.data.total_steps).toBe(SCENARIO.steps.length);

    for (const [i, s] of SCENARIO.steps.entries()) {
      const r = await a.chat(s.prompt);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.known).toBe(true);
      expect(r.data.step).toBe(i + 1);
      expect(r.data.engines.katie).toEqual(
        s.entries.map(e => ({ kid: e.kid, subject: e.subject, entry_id: e.id, seated: true })),
      );
      expect(r.data.engines.erie?.question ?? null).toBe(s.erie ? s.prompt : null);
    }
    const after = await a.chat('When will my order arrive?');
    expect(after.ok && after.data.known).toBe(false);
    expect(after.ok && after.data.step).toBeNull();
    expect(after.ok && after.data.engines.erie).toBeNull();
    expect(after.ok && after.data.engines.katie).toEqual([]);
  });

  it('chat without a cursor is always not-knowing with total 0', async () => {
    const r = await createMockAdapter(undefined, { cursor: null }).chat('arrive');
    expect(r.ok && r.data.known).toBe(false);
    expect(r.ok && r.data.total_steps).toBe(0);
  });

  it('ask answers only the next step and never advances', async () => {
    const a = createMockAdapter();
    const none = await a.ask('Where is the parcel now?');
    expect(none.ok && none.data.state).toBe('not_found');
    expect(none.ok && none.data.provenance).toEqual([]);
    const hit = await a.ask('delivery date please');
    expect(hit.ok && hit.data.state).toBe('found');
    expect(hit.ok && hit.data.question).toBe('delivery date please');
    expect(hit.ok && hit.data.provenance[0].source.startsWith('mock:')).toBe(true);
    expect(await ids(a)).toEqual(FIXTURE_IDS);
  });

  it('lessons appear only after step 4', async () => {
    const a = createMockAdapter();
    for (const s of SCENARIO.steps.slice(0, 3)) await a.chat(s.prompt);
    const before = await a.fetchLessons();
    expect(before.ok && before.data).toEqual([]);
    await a.chat(SCENARIO.steps[3].prompt);
    const after = await a.fetchLessons();
    expect(after.ok && after.data.map(l => l.event_id)).toEqual(['mock:lesson-1']);
  });

  it('fetchRecord groups by subject, sorted by k_start', async () => {
    const a = createMockAdapter();
    for (const s of SCENARIO.steps) await a.chat(s.prompt);
    const r = await a.fetchRecord('order-1042');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.data.fields)).toEqual(['order-1042.delivery_date']);
    expect(r.data.fields['order-1042.delivery_date'].map(e => e.id)).toEqual(['scn-s1', 'scn-s3']);
    const other = await a.fetchRecord('parcel-77');
    expect(other.ok && other.data.fields['parcel-77.status'].map(e => e.id)).toEqual(['scn-s2', 'scn-s4']);
    const empty = await a.fetchRecord('nope');
    expect(empty.ok && empty.data.fields).toEqual({});
  });

  it('update refuses authority 9 and out-of-range values', async () => {
    const a = createMockAdapter();
    for (const authority of [9, 10, -1, 6.5]) {
      const r = await a.update({ kid: 4, subject: 'order-1042.delivery_date', value: '2026-11-18', reason: 'x', authority });
      expect(r.ok).toBe(false);
    }
    const nine = await a.update({ kid: 4, subject: 'order-1042.delivery_date', value: '2026-11-18', reason: 'x', authority: 9 });
    expect(!nine.ok && nine.error).toMatch(/9/);
    expect(await ids(a)).toEqual(FIXTURE_IDS);
  });

  it('update refuses anything but the scripted next write', async () => {
    const a = createMockAdapter();
    const bad = await a.update({ kid: 4, subject: 'order-1042.delivery_date', value: '2030-01-01', reason: 'x', authority: 6 });
    expect(!bad.ok && bad.error).toBe('mock record is scripted: writes come only from the scenario (mock)');
    const good = await a.update({ kid: 4, subject: 'order-1042.delivery_date', value: '2026-11-18', reason: 'x', authority: 6 });
    expect(good.ok && good.data).toEqual({ kid: 4, subject: 'order-1042.delivery_date', entry_id: 'scn-s1', seated: true });
    expect(await ids(a)).toEqual([...FIXTURE_IDS, 'scn-s1']);
  });

  it('accepts a caller-supplied cursor', async () => {
    const cursor = createScenarioCursor(SCENARIO);
    const a = createMockAdapter([], { cursor });
    await a.chat('delivery');
    expect(cursor.position()).toBe(1);
    expect(await ids(a)).toEqual(['scn-s1']);
  });
});

describe('lessons: promotion and injection (mock)', () => {
  const sought = 'what is the delivery date';
  async function play(a: ReturnType<typeof createMockAdapter>, n: number): Promise<void> {
    for (const s of SCENARIO.steps.slice(0, n)) await a.chat(s.prompt);
  }
  async function turn(a: ReturnType<typeof createMockAdapter>, msg: string) {
    const r = await a.chat(msg);
    if (!r.ok) throw new Error(r.error);
    return r.data.engines;
  }

  it('lesson is a candidate after step 4, promoted after step 5; script stays frozen', async () => {
    const a = createMockAdapter();
    await play(a, 4);
    const l4 = await a.fetchLessons();
    expect(l4.ok && l4.data.map(l => l.status)).toEqual(['candidate']);
    await play(a, 0);
    await a.chat(SCENARIO.steps[4].prompt);
    const l5 = await a.fetchLessons();
    expect(l5.ok && l5.data.map(l => l.status)).toEqual(['promoted']);
    expect(l5.ok && l5.data[0].subject).toBe('order-1042.delivery_date');
    expect(SCENARIO.steps[3].elle?.status).toBe('candidate');
    expect(Object.isFrozen(SCENARIO.steps[3].elle)).toBe(true);
  });

  it('step 1 injects nothing; step 4 turn records the candidate', async () => {
    const a = createMockAdapter();
    const e1 = await turn(a, SCENARIO.steps[0].prompt);
    expect(e1.lessons_in_prompt.injected).toEqual([]);
    expect(e1.lessons_in_prompt.held).toEqual([]);
    expect(e1.elle_promoted).toBeNull();
    await play(a, 0);
    await a.chat(SCENARIO.steps[1].prompt);
    await a.chat(SCENARIO.steps[2].prompt);
    const e4 = await turn(a, SCENARIO.steps[3].prompt);
    expect(e4.elle?.status).toBe('candidate');
    expect(e4.elle_promoted).toBeNull();
  });

  it('a delivery-date prompt after step 4 holds the lesson, not injects', async () => {
    const a = createMockAdapter();
    await play(a, 4);
    const e = await turn(a, sought);
    expect(e.lessons_in_prompt.subjects).toEqual(['order-1042.delivery_date']);
    expect(e.lessons_in_prompt.held.map(l => l.event_id)).toEqual(['mock:lesson-1']);
    expect(e.lessons_in_prompt.injected).toEqual([]);
    expect(e.elle).toBeNull();
    expect(e.elle_promoted).toBeNull();
  });

  it('step 5 promotes without injecting; step 6 injects', async () => {
    const a = createMockAdapter();
    await play(a, 4);
    const e5 = await turn(a, SCENARIO.steps[4].prompt);
    expect(e5.elle_promoted?.event_id).toBe('mock:lesson-1');
    expect(e5.elle_promoted?.status).toBe('promoted');
    expect(e5.lessons_in_prompt.injected).toEqual([]);
    const e6 = await turn(a, SCENARIO.steps[5].prompt);
    expect(e6.lessons_in_prompt.injected.map(l => l.event_id)).toEqual(['mock:lesson-1']);
    expect(e6.lessons_in_prompt.held).toEqual([]);
    expect(e6.erie?.provenance.map(p => p.source)).toEqual(['mock:katie-record', 'mock:carrier-feed']);
    expect(e6.katie).toEqual([]);
  });

  it('after step 6 an unmatched prompt still injects; a parcel-only prompt never does', async () => {
    const a = createMockAdapter();
    await play(a, SCENARIO.steps.length);
    const e = await turn(a, sought);
    expect(e.arche.reply).toBe(SCENARIO.not_knowing_reply);
    expect(e.lessons_in_prompt.injected.map(l => l.event_id)).toEqual(['mock:lesson-1']);
    const p = await turn(a, 'where is the parcel');
    expect(p.lessons_in_prompt.subjects).toEqual(['parcel-77.status']);
    expect(p.lessons_in_prompt.injected).toEqual([]);
    expect(p.lessons_in_prompt.held).toEqual([]);
  });

  it('update-played steps count the same as chat-played steps', async () => {
    const a = createMockAdapter();
    await a.update({ kid: 4, subject: 'order-1042.delivery_date', value: '2026-11-18', reason: 'x', authority: 6 });
    await a.update({ kid: 5, subject: 'parcel-77.status', value: 'in transit', reason: 'x', authority: 7 });
    await a.update({ kid: 4, subject: 'order-1042.delivery_date', value: '2026-11-19', reason: 'x', authority: 7 });
    await a.update({ kid: 5, subject: 'parcel-77.status', value: 'held at depot', reason: 'x', authority: 8 });
    const l = await a.fetchLessons();
    expect(l.ok && l.data.map(x => x.status)).toEqual(['candidate']);
    const e = await turn(a, sought);
    expect(e.lessons_in_prompt.held).toHaveLength(1);
  });

  it('no cursor: empty lessons_in_prompt', async () => {
    const e = await turn(createMockAdapter(undefined, { cursor: null }), sought);
    expect(e.lessons_in_prompt).toEqual({ subjects: [], injected: [], held: [] });
    expect(e.elle_promoted).toBeNull();
  });
});

describe('createErrorMock', () => {
  it('errors on all 9 methods', async () => {
    const m = createErrorMock();
    const results = await Promise.all([
      m.fetchAllEntries(), m.fetchBeliefPool(0), m.fetchChain(1, 's'), m.fetchKidMap(),
      m.ask('q'), m.chat('m'),
      m.update({ kid: 1, subject: 's', value: 'v', reason: 'r', authority: 1 }),
      m.fetchLessons(), m.fetchRecord('a'),
    ]);
    expect(results).toHaveLength(9);
    for (const r of results) expect(r.ok).toBe(false);
  });
});
