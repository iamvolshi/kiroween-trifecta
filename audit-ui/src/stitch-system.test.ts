/**
 * The visual system measured from the reference mockup's export (Stitch,
 * Nov 18): the font link, the eleven type roles, the surface ramp and
 * outlines, the shell widths, and which role key elements use.
 */
import { describe, it, expect } from 'vitest';
import { ChatView, type ModelSource } from './views/chat.ts';
import { ChatLog } from './views/chat-log.ts';
import { createLiveAdapter, NO_ADDRESS_ERROR } from './adapter/live.ts';
import { tick } from './test-helpers.ts';

// Vitest blanks CSS imports, so read the files from disk (Node built-in, no new dependency).
const nodeFs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as unknown as {
  readFileSync(p: URL, enc: 'utf8'): string;
};
const read = (p: string): string => nodeFs.readFileSync(new URL(p, import.meta.url), 'utf8');
const indexHtml = read('../index.html');
const styleCss = read('./style.css');
const shellCss = read('./styles/shell.css');
const systemCss = read('./styles/stitch-system.css');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(css: string, selector: string): string {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (let m = re.exec(flat); m; m = re.exec(flat)) {
    const sels = m[1]!.split(',').map((s) => s.trim());
    if (sels.includes(selector)) return m[2]!;
  }
  throw new Error(`no rule for ${selector}`);
}

const token = (name: string): string => {
  const m = new RegExp(`${name}:\\s*([^;]+);`).exec(styleCss);
  if (!m) throw new Error(`no token ${name}`);
  return m[1]!.trim();
};

/** A rule uses a role when its size and line-height read that role's tokens. */
const usesRole = (body: string, role: string): boolean =>
  body.includes(`var(--t-${role}-size)`) && body.includes(`var(--t-${role}-lh)`);

describe('fonts', () => {
  it('index.html loads the three families with one link', () => {
    const links = indexHtml.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+"/g) ?? [];
    expect(links).toHaveLength(1);
    for (const fam of ['family=Geist:wght@100..900', 'family=JetBrains+Mono:wght@100..800', 'family=Space+Grotesk:wght@300..700', 'display=swap']) {
      expect(links[0]).toContain(fam);
    }
  });

  it('the families lead the stacks, system fonts behind them', () => {
    expect(token('--display').startsWith("'Space Grotesk', system-ui")).toBe(true);
    expect(token('--sans').startsWith("'Geist', ui-sans-serif")).toBe(true);
    expect(token('--mono').startsWith("'JetBrains Mono', ui-monospace")).toBe(true);
  });
});

describe('the eleven type roles', () => {
  const ROLES: Array<[string, string, string, string | null, string]> = [
    ['label-sm', '9px', '12px', '0.06em', '500'],
    ['label-md', '11px', '14px', '0.05em', '500'],
    ['label-lg', '12px', '16px', '0.08em', '600'],
    ['body-sm', '11px', '16px', null, '400'],
    ['body-md', '13px', '18px', null, '400'],
    ['body-lg', '15px', '22px', null, '400'],
    ['headline-sm', '15px', '20px', '0.08em', '600'],
    ['headline-lg', '22px', '28px', '0.10em', '700'],
    ['headline-xl', '32px', '40px', '0.12em', '700'],
    ['headline-xl-mobile', '24px', '32px', '0.10em', '700'],
    ['telemetry-data', '12px', '16px', '0.02em', '400'],
  ];
  for (const [role, size, lh, ls, wt] of ROLES) {
    it(`${role}: ${size} / ${lh} / ${ls ?? '-'} / ${wt}`, () => {
      expect(token(`--t-${role}-size`)).toBe(size);
      expect(token(`--t-${role}-lh`)).toBe(lh);
      expect(token(`--t-${role}-wt`)).toBe(wt);
      if (ls) expect(token(`--t-${role}-ls`)).toBe(ls);
      else expect(styleCss).not.toContain(`--t-${role}-ls:`);
    });
  }

  it('the old six size roles are gone', () => {
    expect(styleCss).not.toMatch(/--fs-[a-z]+:/);
  });
});

describe('surfaces, outlines, radii', () => {
  it('match the measured values', () => {
    expect(token('--bg')).toBe('#111318');
    expect(token('--panel')).toBe('#1a1b21');
    expect(token('--surface')).toBe('#1e1f25');
    expect(token('--surface-2')).toBe('#282a2f');
    expect(token('--inset')).toBe('#0c0e13');
    expect(token('--line')).toBe('#3b494b');
    expect(token('--line-strong')).toBe('#849495');
    expect(token('--text')).toBe('#e2e2e9');
    expect(token('--muted')).toBe('#b9cacb');
    expect(token('--accent')).toBe('#00f0ff');
    expect(token('--accent-dim')).toBe('#00dbe9');
    expect(token('--primary')).toBe('#dbfcff');
    expect(token('--warn')).toBe('#ffbd58');
    expect(token('--secondary-container')).toBe('#ea9f00');
    expect(token('--on-secondary')).toBe('#442b00');
    expect(token('--error')).toBe('#ffb4ab');
    expect(token('--radius')).toBe('0.25rem');
    expect(token('--radius-lg')).toBe('0.5rem');
    expect(token('--radius-xl')).toBe('0.75rem');
  });
});

describe('the shell', () => {
  it('is 16rem / 1fr / 20rem with a 56px header', () => {
    const shell = rule(shellCss, '.shell');
    expect(shell).toContain('grid-template-columns: 16rem minmax(0, 1fr) 20rem;');
    expect(shell).toContain('grid-template-rows: 56px minmax(0, 1fr);');
    expect(rule(shellCss, '.shell-brand')).toContain('height: 56px;');
  });

  it('the breakpoints keep their structure', () => {
    expect(shellCss).toContain('@media (max-width: 1100px)');
    expect(shellCss).toContain('@media (max-width: 800px)');
  });
});

describe('which role key elements use', () => {
  it('the mask name is headline-lg, the feed text telemetry-data, section headings label-sm', () => {
    expect(usesRole(rule(systemCss, '.mask-name'), 'headline-lg')).toBe(true);
    expect(usesRole(rule(systemCss, '.feed-text'), 'telemetry-data')).toBe(true);
    expect(usesRole(rule(styleCss, 'h2'), 'label-sm')).toBe(true);
    expect(usesRole(rule(shellCss, '.shell-left::before'), 'label-sm')).toBe(true);
    expect(usesRole(rule(systemCss, '.telemetry-heading'), 'label-sm')).toBe(true);
    expect(usesRole(rule(styleCss, '.shell-center h1'), 'headline-sm')).toBe(true);
  });

  it('the rendered elements carry those classes', async () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const models: ModelSource = { status: async () => ({ ok: false, error: NO_ADDRESS_ERROR }) };
    const view = new ChatView(createLiveAdapter(''), new ChatLog(), models);
    view.mount(slot);
    await tick();
    expect(slot.querySelectorAll('.mask-card .mask-name')).toHaveLength(3);
    expect(slot.querySelector('.mask-card .mask-grounding')?.textContent).toBe('Grounding position');
    view.unmount();
    slot.remove();
  });
});

