import { describe, it, expect } from 'vitest';
import { createLiveAdapter } from './live';

describe('live adapter assembly stubs', () => {
  it('each new method returns ok:false "Live adapter not wired"', async () => {
    const a = createLiveAdapter('http://localhost:0');
    const results = await Promise.all([
      a.ask('q'),
      a.chat('m'),
      a.update({ kid: 1, subject: 's', value: 'v', reason: 'r', authority: 1 }),
      a.fetchLessons(),
      a.fetchRecord('acct'),
    ]);
    for (const r of results) {
      expect(r).toEqual({ ok: false, error: 'Live adapter not wired' });
    }
  });
});
