/**
 * Every search path goes through Sherlock, and nowhere else. The Sherlock
 * service is a test double (sherlock-double.ts) that records every URL.
 */
import { describe, expect, it } from 'vitest';
import mainTs from '../main.ts?raw';
import type { SeamAdapter } from './seam.ts';
import { createSherlockAdapter } from './sherlock.ts';
import { NO_SHERLOCK_ADDRESS } from './sherlock-client.ts';
import { createSherlockDouble, SHERLOCK_BASE } from '../sherlock-double.ts';

const PATHS: Array<[string, (a: SeamAdapter) => Promise<{ ok: boolean; error?: string }>, string]> = [
  ['ask (rail search, chat ask)', (a) => a.ask('the ice'), '/ask'],
  ['curatorAsk', (a) => a.curatorAsk('folders'), '/curator/ask'],
  ['chat', (a) => a.chat('hello'), '/chat'],
  ['fetchAllEntries', (a) => a.fetchAllEntries(), '/entries'],
  ['fetchBeliefPool', (a) => a.fetchBeliefPool(1700000000000), '/belief-pool?at=1700000000000'],
  ['fetchChain', (a) => a.fetchChain(1, 'temperature'), '/chain?kid=1&subject=temperature'],
  ['fetchKidMap', (a) => a.fetchKidMap(), '/kidmap'],
  ['fetchLessons', (a) => a.fetchLessons(), '/lessons'],
  ['fetchQuestions', (a) => a.fetchQuestions(), '/questions'],
  ['fetchRecord', (a) => a.fetchRecord('acct'), '/record/acct'],
];

describe('every search path hits Sherlock', () => {
  for (const [name, run, route] of PATHS) {
    it(`${name} -> Sherlock ${route}, and no other address`, async () => {
      const d = createSherlockDouble();
      const r = await run(createSherlockAdapter(SHERLOCK_BASE, '', d.fetch));
      expect(r.ok, JSON.stringify(r)).toBe(true);
      expect(d.urls.every((u) => u.startsWith(`${SHERLOCK_BASE}/api/search/`))).toBe(true);
      expect(d.urls.at(-1)).toBe(`${SHERLOCK_BASE}/api/search/cases/double-case${route}`);
    });
  }

  it('the contract questions list becomes question folders, blanks left blank', async () => {
    const r = await createSherlockAdapter(SHERLOCK_BASE, '', createSherlockDouble().fetch).fetchQuestions();
    expect(r.ok && r.data).toMatchObject({ reasoning: null, questions: [{ event_id: 'q1', question: 'who?', state: null, versions: 0 }] });
  });

  it('an answer keeps the KID and authority Sherlock sent', async () => {
    const r = await createSherlockAdapter(SHERLOCK_BASE, '', createSherlockDouble().fetch).ask('the ice');
    expect(r.ok && r.data.provenance[0]).toMatchObject({ kid: 1, authority: 2, excerpt: 'the ice broke' });
  });
});

describe('Sherlock down: a clean failure in words, no fallback', () => {
  for (const [name, run] of PATHS) {
    it(`${name} says Sherlock is unreachable and asks nobody else`, async () => {
      const d = createSherlockDouble({ down: true });
      const r = await run(createSherlockAdapter(SHERLOCK_BASE, '', d.fetch));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/^Sherlock unreachable: /);
      expect(d.urls.every((u) => u.startsWith(`${SHERLOCK_BASE}/api/search/`))).toBe(true);
    });
  }

  it('with no address set, every call says so and sends nothing', async () => {
    const d = createSherlockDouble();
    const r = await createSherlockAdapter('', '', d.fetch).ask('x');
    expect(r).toEqual({ ok: false, error: NO_SHERLOCK_ADDRESS });
    expect(d.urls).toEqual([]);
  });

  it('a 409 says which stage Sherlock has not finished', async () => {
    const d = createSherlockDouble({ overviewStatus: 409 });
    const r = await createSherlockAdapter(SHERLOCK_BASE, '', d.fetch).corpus!.overview();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/not ready, Sherlock has not finished overview/);
  });
});

describe('the app is wired to Sherlock only', () => {
  it('main.ts builds the Sherlock adapter, not the connector one', () => {
    const main = mainTs;
    expect(main).toContain('createSherlockAdapter');
    expect(main).not.toContain('createLiveAdapter');
    expect(main).not.toContain('CONNECTOR_URL');
  });
});
