import { describe, it, expect } from 'vitest';
import { SCENARIO } from './script.ts';
import { createScenarioCursor } from './stepper.ts';
import { matchesStep } from './match.ts';
import { parseMs } from '../util/interval';

const allEntries = SCENARIO.steps.flatMap(s => s.entries);

describe('scenario script', () => {
  it('has 4 steps with ids scn-s1..scn-s4 and at least 3 entries, 2 KIDs', () => {
    expect(SCENARIO.steps).toHaveLength(4);
    expect(allEntries.map(e => e.id)).toEqual(['scn-s1', 'scn-s2', 'scn-s3', 'scn-s4']);
    expect(new Set(allEntries.map(e => e.kid)).size).toBe(2);
  });

  it('revises (4, order-1042.delivery_date): state and authority change', () => {
    const chain = allEntries.filter(e => e.kid === 4 && e.subject === 'order-1042.delivery_date');
    expect(chain).toHaveLength(2);
    expect(chain[0].state).toBe('confirmed');
    expect(chain[1].state).toBe('revised');
    expect(chain[0].authority).toBe(6);
    expect(chain[1].authority).toBe(7);
    expect(chain[0].prev_hash).toBe('mock:genesis');
    expect(chain[1].prev_hash).toBe('mock:hash-s1');
  });

  it('chain intervals are contiguous and non-overlapping', () => {
    const bySubject = new Map<string, typeof allEntries>();
    for (const e of allEntries) bySubject.set(`${e.kid}|${e.subject}`, [...(bySubject.get(`${e.kid}|${e.subject}`) ?? []), e]);
    for (const chain of bySubject.values()) {
      for (let i = 1; i < chain.length; i++) {
        expect(parseMs(chain[i].k_start)).toBe(parseMs(chain[i - 1].k_time));
      }
      for (const e of chain) expect(parseMs(e.k_start)).toBeLessThan(parseMs(e.k_time));
    }
  });

  it('labels mock data and is frozen', () => {
    for (const e of allEntries) {
      expect(e.evidence).toMatch(/^value=.+ \(mock\)$/);
      expect(e.pool).toBe('pool-mock-scenario');
      expect(Object.isFrozen(e)).toBe(true);
    }
    expect(Object.isFrozen(SCENARIO)).toBe(true);
    expect(Object.isFrozen(SCENARIO.steps[0].erie)).toBe(true);
    expect(SCENARIO.steps[0].erie?.provenance[0].source.startsWith('mock:')).toBe(true);
    expect(SCENARIO.steps[3].elle?.event_id).toBe('mock:lesson-1');
    expect(SCENARIO.steps[3].elle?.event_type).toBe('trifecta.chat');
  });
});

describe('scenario cursor', () => {
  it('shows exactly entries through step N', () => {
    const c = createScenarioCursor(SCENARIO);
    expect(c.position()).toBe(0);
    expect(c.visibleEntries()).toEqual([]);
    for (let n = 1; n <= 4; n++) {
      c.advance();
      expect(c.position()).toBe(n);
      expect(c.visibleEntries().map(e => e.id)).toEqual(allEntries.slice(0, n).map(e => e.id));
    }
  });

  it('never rewrites earlier entries', () => {
    const c = createScenarioCursor(SCENARIO);
    c.advance();
    c.advance();
    const before = structuredClone(c.visibleEntries());
    c.advance();
    c.advance();
    expect(c.visibleEntries().slice(0, 2)).toEqual(before);
  });

  it('full record equals the script in order, then finishes', () => {
    const c = createScenarioCursor(SCENARIO);
    while (c.advance()) { /* play all */ }
    expect(c.visibleEntries()).toEqual(allEntries);
    expect(c.next()).toBeNull();
    expect(c.advance()).toBeNull();
    expect(c.playedSteps()).toHaveLength(4);
  });
});

describe('matchesStep', () => {
  const step = SCENARIO.steps[0];
  it('matches whole words, case-insensitive, punctuation stripped', () => {
    expect(matchesStep('When will my order ARRIVE?', step)).toBe(true);
    expect(matchesStep('delivery!', step)).toBe(true);
  });
  it('does not match substrings, blanks or other words', () => {
    expect(matchesStep('arrived', step)).toBe(false);
    expect(matchesStep('   ', step)).toBe(false);
    expect(matchesStep('', step)).toBe(false);
    expect(matchesStep('hello', step)).toBe(false);
  });
  it('every suggested prompt matches its own step', () => {
    for (const s of SCENARIO.steps) expect(matchesStep(s.prompt, s)).toBe(true);
  });
});
