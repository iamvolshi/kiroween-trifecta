/**
 * The corpus views (overview, nouns, graph) and the rail search, over a
 * Sherlock test double (sherlock-double.ts): the shapes are the contract's.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createSherlockAdapter } from '../adapter/sherlock.ts';
import { ResearchPanel } from '../shell/rail-panels.ts';
import { Router } from '../router/router.ts';
import { CorpusView } from './corpus.ts';
import { layout, pick } from './corpus-graph.ts';
import { DOUBLE_GRAPH, SHERLOCK_BASE, createSherlockDouble } from '../sherlock-double.ts';
import { createModelsStub, tick } from '../test-helpers.ts';
import type { WatsonBridge } from '../watson/bridge.ts';

const noWatson: WatsonBridge = { report: async () => { throw new Error('no watson in this test'); } } as unknown as WatsonBridge;
const flush = async (): Promise<void> => { for (let i = 0; i < 8; i++) await tick(); };

afterEach(() => { document.body.innerHTML = ''; });

function mountCorpus(tab: 'overview' | 'nouns' | 'graph', down = false) {
  const d = createSherlockDouble({ down });
  const host = document.createElement('div');
  document.body.appendChild(host);
  new CorpusView(createSherlockAdapter(SHERLOCK_BASE, '', d.fetch), tab).mount(host);
  return { d, host };
}

describe('corpus views render from the contract shapes', () => {
  it('overview: counts, sections with KIDs, top terms, opening and closing', async () => {
    const { host } = mountCorpus('overview');
    await flush();
    const text = host.textContent ?? '';
    expect(text).toContain('double.txt');
    expect(host.querySelectorAll('.corpus-table tbody tr')).toHaveLength(2);
    expect(text).toContain('Letter 1');
    expect(text).toContain('father 9');
    expect(text).toContain('You will rejoice to hear');
  });

  it('nouns: every noun, and the kind buttons filter', async () => {
    const { host } = mountCorpus('nouns');
    await flush();
    expect(host.querySelectorAll('.corpus-table tbody tr')).toHaveLength(3);
    [...host.querySelectorAll<HTMLButtonElement>('.corpus-kind')].find((b) => b.textContent === 'place')!.click();
    const rows = host.querySelectorAll('.corpus-table tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('Geneva');
  });

  it('graph: one circle per noun, one line per link, as SVG', async () => {
    const { host } = mountCorpus('graph');
    await flush();
    const svg = host.querySelector('svg.corpus-graph-svg')!;
    expect(svg.querySelectorAll('.cg-node')).toHaveLength(3);
    expect(svg.querySelectorAll('.cg-edge')).toHaveLength(2);
    expect(host.textContent).toContain('3 of 3 nouns drawn');
  });

  it('graph layout is the same every time and stays inside the frame', () => {
    const { nodes, edges } = pick(DOUBLE_GRAPH);
    const a = layout(nodes, edges), b = layout(nodes, edges);
    expect(a.map((p) => [p.x, p.y])).toEqual(b.map((p) => [p.x, p.y]));
    expect(a.every((p) => p.x >= 0 && p.x <= 960 && p.y >= 0 && p.y <= 640)).toBe(true);
  });

  it('Sherlock down: each view says so in words and draws nothing', async () => {
    for (const tab of ['overview', 'nouns', 'graph'] as const) {
      const { host } = mountCorpus(tab, true);
      await flush();
      expect(host.querySelector('.error-state')?.textContent).toMatch(/^Sherlock unreachable: /);
      expect(host.querySelector('svg')).toBeNull();
    }
  });
});

describe('rail Research search goes through Sherlock', () => {
  function search(down: boolean) {
    const d = createSherlockDouble({ down });
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    new ResearchPanel(createSherlockAdapter(SHERLOCK_BASE, '', d.fetch), noWatson).mount(slot);
    slot.querySelector<HTMLInputElement>('#research-q')!.value = 'the ice';
    slot.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    return { d, slot };
  }

  it('shows the answer with its KID, authority and excerpt', async () => {
    const { d, slot } = search(false);
    await flush();
    expect(d.urls).toContain(`${SHERLOCK_BASE}/api/search/cases/double-case/ask`);
    const hit = slot.querySelector('.research-hit')!.textContent ?? '';
    expect(hit).toContain('KID 1');
    expect(hit).toContain('authority 2 of 9');
    expect(hit).toContain('the ice broke');
  });

  it('with Sherlock down it says so, and no other request is made', async () => {
    const { d, slot } = search(true);
    await flush();
    expect(slot.querySelector('.error-state')?.textContent).toMatch(/^Sherlock unreachable: /);
    expect(d.urls.every((u) => u.startsWith(`${SHERLOCK_BASE}/api/search/`))).toBe(true);
  });

  it('has no Sherlock button: the corpus links name the views, not her', () => {
    const slot = document.createElement('div');
    new ResearchPanel(createSherlockAdapter(SHERLOCK_BASE, '', createSherlockDouble().fetch), noWatson).mount(slot);
    expect(slot.textContent ?? '').not.toMatch(/sherlock/i);
  });
});

describe('the router', () => {
  it('/research/graph opens the corpus graph inside Research', async () => {
    window.history.pushState({}, '', '/research/graph');
    const app = document.createElement('div');
    document.body.appendChild(app);
    const d = createSherlockDouble();
    const router = new Router(createSherlockAdapter(SHERLOCK_BASE, '', d.fetch), app, createModelsStub());
    await flush();
    expect(app.querySelector('[data-corpus="graph"]')).not.toBeNull();
    expect(app.querySelectorAll('.cg-node')).toHaveLength(3);
    router.destroy();
  });
});
