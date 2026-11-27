/**
 * The rail icons are the navigation: five of them, each in its engine's
 * color; no directories list; every destination still reachable.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router/router.ts';
import { createModelsStub, createRecordStub, makeEntry, tick } from './test-helpers.ts';
import { RAIL } from './shell/rail.ts';

interface Fs { readFileSync(p: URL, enc: 'utf8'): string }
const nodeFs = (globalThis as unknown as { process: { getBuiltinModule(n: string): Fs } }).process.getBuiltinModule('node:fs');
const read = (p: string): string => nodeFs.readFileSync(new URL(p, import.meta.url), 'utf8');
const styleCss = read('./style.css');
const shellCss = read('./styles/shell.css');

let container: HTMLElement;
let router: Router | null = null;

afterEach(() => {
  router?.destroy();
  router = null;
  container?.remove();
});

const FOLDERS = [
  makeEntry({ id: 'm', kid: 40, subject: 'curator-folder-order-1042', authority: 5 }),
  makeEntry({ id: 'a', kid: 41, subject: 'order-1042.status', authority: 6 }),
];

async function start(path: string): Promise<void> {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createRecordStub(FOLDERS), container, createModelsStub());
  for (let i = 0; i < 6; i++) await tick();
}

const rail = (key: string): HTMLButtonElement => container.querySelector<HTMLButtonElement>(`.rail-button[data-rail="${key}"]`)!;
const list = (): HTMLElement => container.querySelector<HTMLElement>('.shell-left')!;
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await tick();
}

describe('rail navigation', () => {
  it('the directories list is gone', async () => {
    await start('/chat');
    expect(container.querySelector('nav')).toBeNull();
    expect(container.querySelector('.main-nav')).toBeNull();
    expect(list().querySelector('.nav-link')).toBeNull();
  });

  it('five icons in order', () => {
    expect(RAIL.map((r) => r.key)).toEqual(['chat', 'audit', 'research', 'lessons', 'curator']);
  });

  it.each([
    ['chat', 'var(--accent)'],
    ['audit', 'var(--rail-audit)'],
    ['research', 'var(--rail-research)'],
    ['lessons', 'var(--rail-lessons)'],
    ['curator', 'var(--rail-curator)'],
  ])('the %s icon takes its color from %s', (key, value) => {
    expect(shellCss).toContain(`.rail-button[data-rail='${key}'] { --rail-color: ${value}; }`);
  });

  it.each([
    ['--accent', '#00f0ff'],
    ['--rail-audit', 'var(--engine-katie)'],
    ['--rail-research', 'var(--engine-erie)'],
    ['--rail-lessons', 'var(--engine-elle)'],
    ['--rail-curator', '#a78bfa'],
  ])('%s is %s', (name, hex) => {
    expect(styleCss).toContain(`${name}: ${hex};`);
  });

  it('the active icon is marked beyond color: a ring and an edge bar', () => {
    expect(shellCss).toMatch(/\.rail-button\[aria-pressed='true'\] \{[^}]*border-color: var\(--rail-color\)[^}]*box-shadow/);
  });
  it('the Curator icon goes to /curator and its panel shows the folder rows', async () => {
    await start('/chat');
    rail('curator').click();
    await settle();
    expect(window.location.pathname).toBe('/curator');
    expect(container.querySelector('.shell-center .curator-head h1')?.textContent).toBe('Curator');
    expect(rail('curator').getAttribute('aria-pressed')).toBe('true');
    expect(list().dataset.panel).toBe('curator');
    const rows = list().querySelectorAll('.curator-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute('data-subject')).toBe('order-1042');
    expect(list().querySelector('.left-back')).toBeNull();
  });

  it.each([
    ['chat', '/chat'],
    ['audit', '/calendar'],
    ['research', '/research'],
    ['lessons', '/lessons'],
    ['curator', '/curator'],
  ])('the %s icon reaches %s', async (key, path) => {
    await start(key === 'chat' ? '/lessons' : '/chat');
    rail(key).click();
    await settle();
    expect(window.location.pathname).toBe(path);
    expect(rail(key).getAttribute('aria-pressed')).toBe('true');
  });

  it('the Action List and the Calendar are in the Audit panel', async () => {
    await start('/chat');
    rail('audit').click();
    await settle();
    const hrefs = Array.from(list().querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/actions');
    expect(hrefs).toContain('/calendar');
  });
});