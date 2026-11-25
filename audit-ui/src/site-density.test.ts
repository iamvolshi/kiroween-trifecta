/**
 * Site density: blank fields stay out of Entry Detail, the Audit records
 * list shows a few and folds the rest, the calendar names the month once,
 * and empty boxes are one short line. Record reads come from the record
 * stub and a chain adapter (test doubles, never app data).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Router } from './router/router.ts';
import { EntryDetailView } from './views/entry-detail.ts';
import { ChatLog } from './views/chat-log.ts';
import { ResearchView } from './views/research.ts';
import { columnsOf } from './views/entry-grid.ts';
import { createModelsStub, createRecordStub, makeEntry, tick } from './test-helpers.ts';
import type { SeamAdapter } from './adapter/seam.ts';

let container: HTMLElement;
let router: Router | null = null;

afterEach(() => {
  router?.destroy();
  router = null;
  container?.remove();
});

async function start(path: string, adapter: SeamAdapter = createRecordStub()): Promise<void> {
  window.history.replaceState({}, '', path);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(adapter, container, createModelsStub());
  for (let i = 0; i < 6; i++) await tick();
}

describe('Entry Detail hides a field with no value', () => {
  it('no E-Time or K-Time row when they are blank; the rest stay', async () => {
    const e = makeEntry({ id: 'x', e_time: '', k_time: '', evidence: 'ev', reason: 'why' });
    const adapter: SeamAdapter = { ...createRecordStub([e]), fetchChain: async () => ({ ok: true, data: [e] }) };
    container = document.createElement('div');
    document.body.appendChild(container);
    new EntryDetailView(adapter, e.kid, e.subject, 'x').mount(container);
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(container.querySelector('.entry-primary .e-time')).toBeNull();
    expect(container.querySelector('.entry-primary .k-time')).toBeNull();
    const labels = Array.from(container.querySelectorAll('.entry-primary dt')).map((d) => d.textContent);
    expect(labels).not.toContain('E-Time (event)');
    for (const l of ['KID', 'Subject', 'State', 'Authority', 'K-Start', 'Evidence', 'Reason', 'Prev Hash']) expect(labels).toContain(l);
    expect(container.querySelectorAll('.entry-primary dd').length).toBe(labels.length);
  });
});

describe('Audit records list', () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    makeEntry({ id: `e${i}`, kid: i + 1, subject: `subject-${i}`, k_start: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }));

  it('shows the count and the five most recent; the rest wait behind one Show all', async () => {
    await start('/chat', createRecordStub(many));
    container.querySelector<HTMLButtonElement>('.rail-button[data-rail="audit"]')!.click();
    for (let i = 0; i < 4; i++) await tick();
    const left = container.querySelector<HTMLElement>('.shell-left')!;
    expect(left.querySelector('.list-meta')?.textContent).toBe('12 entries in the record');
    const visible = () => Array.from(left.querySelectorAll<HTMLElement>('.audit-accounts li')).filter((li) => !li.hidden);
    expect(visible().map((li) => li.querySelector('a')?.textContent)).toEqual(['subject-11', 'subject-10', 'subject-9', 'subject-8', 'subject-7']);
    const more = left.querySelector<HTMLButtonElement>('.list-more')!;
    expect(more.textContent).toBe('Show all 12');
    more.click();
    expect(visible().length).toBe(12);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    more.click();
    expect(visible().length).toBe(5);
  });

  it('a short list has no control', async () => {
    await start('/chat', createRecordStub(many.slice(0, 4)));
    container.querySelector<HTMLButtonElement>('.rail-button[data-rail="audit"]')!.click();
    for (let i = 0; i < 4; i++) await tick();
    expect(container.querySelector('.shell-left .list-more')).toBeNull();
  });
});

describe('calendar names the month once', () => {
  it('the month level has a title and no repeating folder caption', async () => {
    await start('/calendar/2026-11', createRecordStub([makeEntry({ k_start: '2026-11-18T10:00:00.000Z' })]));
    expect(container.querySelector('.calendar-title')?.textContent).toBe('November 2026 (UTC)');
    expect(container.querySelector('.ktie-folder-caption')?.textContent).toBe('');
    expect(container.textContent).not.toContain('Folder: November 2026');
  });
});

describe('empty states are one short line', () => {
  it('Research: retrieval and injection carry the one-line class', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    new ResearchView(createRecordStub([]), new ChatLog()).mount(container);
    await new Promise<void>((r) => setTimeout(r, 0));
    for (const sel of ['.erie-retrieval', '.erie-injection']) {
      const line = container.querySelector(`${sel} .empty-state`)!;
      expect(line.classList.contains('empty-line')).toBe(true);
      expect(line.textContent).toBe('No chat turns yet.');
    }
  });

  it('the pool has no Time column, so Authority and Reason fit', () => {
    expect(columnsOf('pool')).toEqual(['kid', 'subject', 'state', 'authority', 'evidence', 'reason']);
  });
});