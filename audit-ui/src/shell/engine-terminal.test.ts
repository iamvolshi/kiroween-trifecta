/**
 * The terminal (Piece 2: oldest first, follows the bottom only when the
 * reader is there) and the layout (Piece 3: drag grips on both side panels,
 * the terminal's minimize / maximize / restore). Pointer drags are tested
 * with events dispatched on window, the code path the grips use. Record
 * data comes from the record stub (a test double).
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { ChatTurn, SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from '../views/chat-log.ts';
import { Router } from '../router/router.ts';
import { createModelsStub, createRecordStub, tick } from '../test-helpers.ts';
import { TelemetryPanel, FOLLOW_SLACK_PX } from './telemetry.ts';
import { RANGES } from './layout.ts';
import { engineFocusChannel } from './engine-focus-channel.ts';

function turn(message: string): ChatTurn {
  return {
    message, known: true, step: null, total_steps: 0,
    engines: {
      arche: { reply: 'r' }, erie: { question: message, state: 'not_found', text: '', provenance: [] },
      elle: null, elle_promoted: null, lessons_in_prompt: { subjects: [], injected: [], held: [] }, katie: [],
    },
  };
}

let container: HTMLElement;
let router: Router | null = null;
let panel: TelemetryPanel | null = null;
afterEach(() => {
  router?.destroy();
  router = null;
  panel?.unmount();
  panel = null;
  container?.remove();
  engineFocusChannel.publish(null);
});

/** A scroll box double: jsdom has no layout, so heights are set by hand. */
function scrollBox(height: number, viewport: number): HTMLElement {
  const box = document.createElement('div');
  let top = 0;
  Object.defineProperty(box, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(box, 'clientHeight', { configurable: true, get: () => viewport });
  Object.defineProperty(box, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = Math.max(0, Math.min(v, height - viewport)); } });
  return box;
}

describe('the terminal feed', () => {
  async function terminal(box: HTMLElement): Promise<ChatLog> {
    const log = new ChatLog();
    container = box;
    document.body.appendChild(box);
    panel = new TelemetryPanel(createRecordStub([]), log);
    panel.mount(box);
    await tick();
    return log;
  }

  it('new lines follow the bottom when the reader is already there (within the slack)', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    box.scrollTop = 1000 - 200 - FOLLOW_SLACK_PX; // just inside the slack
    log.push(turn('one'));
    await tick();
    expect(box.scrollTop).toBe(800);
  });

  it('a reader who scrolled up is not yanked down by new lines', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    box.scrollTop = 300;
    log.push(turn('one'));
    await tick();
    expect(box.scrollTop).toBe(300);
  });

  it('the specific feed does not auto-scroll on a new turn', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    log.push(turn('one'));
    await tick();
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    box.scrollTop = 780; // near the bottom of the detail
    log.push(turn('two'));
    await tick();
    expect(box.scrollTop).toBe(780);
    expect(box.querySelector('.engine-detail-name')?.textContent).toBe('ERIE');
  });

  it('every engine wears its colour token: tag and marker (ERIE is amber, not grey)', async () => {
    // Vitest blanks CSS imports, so read the files from disk (run from audit-ui/; Node built-in, no new dependency).
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as unknown as { readFileSync(p: string, e: 'utf8'): string };
    const read = (f: string): string => fs.readFileSync(`src/${f}`, 'utf8');
    const css = read('styles/telemetry.css');
    const style = read('style.css');
    expect(style).toContain('--engine-katie: var(--accent);');
    expect(style).toContain('--engine-erie: var(--warn);');
    expect(style).toContain('--engine-elle: var(--ok);');
    for (const [e, v] of [['KATIE', 'katie'], ['ERIE', 'erie'], ['ELLE', 'elle']]) {
      expect(css).toContain(`.feed-item[data-engine='${e}']::before { background: var(--engine-${v}); }`);
      expect(css).toContain(`.feed-item[data-engine='${e}'] > .engine-tag { color: var(--engine-${v}); }`);
    }
    // No engine rule anywhere falls back to grey.
    const sys = read('styles/stitch-system.css');
    expect(`${css}\n${sys}`).not.toMatch(/data-engine='ERIE'\][^{]*\{[^}]*--muted/);
  });
});

describe('the layout: drag grips and the terminal window', () => {
  async function start(adapter: SeamAdapter = createRecordStub()): Promise<HTMLElement> {
    window.history.replaceState({}, '', '/chat');
    container = document.createElement('div');
    document.body.appendChild(container);
    router = new Router(adapter, container, createModelsStub());
    for (let i = 0; i < 4; i++) await tick();
    return container.querySelector<HTMLElement>('.shell')!;
  }
  const grip = (side: string): HTMLElement => container.querySelector<HTMLElement>(`.shell-grip[data-side="${side}"]`)!;
  const ctl = (label: string): HTMLButtonElement => container.querySelector<HTMLButtonElement>(`.window-button[aria-label="${label}"]:not([hidden])`)!;
  const Ptr = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
  const pointer = (target: EventTarget, type: string, clientX: number): void => {
    target.dispatchEvent(new Ptr(type, { bubbles: true, cancelable: true, clientX, button: 0 }));
  };

  it('two grips: separators on the inner edges, focusable, with their range in rem; the rail has none', async () => {
    await start();
    const grips = Array.from(container.querySelectorAll<HTMLElement>('.shell-grip'));
    expect(grips.map((g) => g.dataset.side)).toEqual(['left', 'right']);
    for (const g of grips) {
      expect(g.getAttribute('role')).toBe('separator');
      expect(g.getAttribute('aria-orientation')).toBe('vertical');
      expect(g.tabIndex).toBe(0);
    }
    expect(grip('left').getAttribute('aria-label')).toBe('Resize left panel');
    expect(grip('right').getAttribute('aria-label')).toBe('Resize right panel');
    expect([grip('left').getAttribute('aria-valuemin'), grip('left').getAttribute('aria-valuemax'), grip('left').getAttribute('aria-valuenow')]).toEqual(['12', '24', '16']);
    expect([grip('right').getAttribute('aria-valuemin'), grip('right').getAttribute('aria-valuemax'), grip('right').getAttribute('aria-valuenow')]).toEqual(['14', '36', '20']);
    expect(container.querySelector('.shell-rail .shell-grip')).toBeNull();
  });

  it('a pointer drag on window sets the width live, clamped at the ends', async () => {
    const shell = await start();
    pointer(grip('left'), 'pointerdown', 300);
    pointer(window, 'pointermove', 300 + 64); // +4rem at 16px
    expect(shell.style.getPropertyValue('--left-width')).toBe('20rem');
    expect(grip('left').getAttribute('aria-valuenow')).toBe('20');
    pointer(window, 'pointermove', 300 + 1000);
    expect(shell.style.getPropertyValue('--left-width')).toBe(`${RANGES.left.max}rem`);
    pointer(window, 'pointerup', 300 + 1000);
    pointer(window, 'pointermove', 0); // the drag ended: nothing moves
    expect(shell.style.getPropertyValue('--left-width')).toBe('24rem');
    // The terminal's grip is its left edge: dragging left widens it.
    pointer(grip('right'), 'pointerdown', 1000);
    pointer(window, 'pointermove', 1000 - 128);
    expect(shell.style.getPropertyValue('--right-width')).toBe('28rem');
    pointer(window, 'pointermove', 5000);
    expect(shell.style.getPropertyValue('--right-width')).toBe(`${RANGES.right.min}rem`);
    pointer(window, 'pointerup', 5000);
  });

  it('arrow keys resize by 1rem, Shift by 4rem, clamped, with aria-valuenow kept in step', async () => {
    const shell = await start();
    const key = (g: HTMLElement, k: string, shiftKey = false): void => {
      g.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true }));
    };
    key(grip('left'), 'ArrowRight');
    expect(grip('left').getAttribute('aria-valuenow')).toBe('17');
    key(grip('left'), 'ArrowLeft', true);
    expect(grip('left').getAttribute('aria-valuenow')).toBe('13');
    key(grip('left'), 'ArrowLeft', true);
    expect(grip('left').getAttribute('aria-valuenow')).toBe('12'); // clamped
    key(grip('right'), 'ArrowLeft', true); // the terminal's edge moves left: wider
    expect(shell.style.getPropertyValue('--right-width')).toBe('24rem');
    key(grip('right'), 'ArrowRight');
    expect(grip('right').getAttribute('aria-valuenow')).toBe('23');
  });

  it('window controls sit in the telemetry heading row; which show follows the state', async () => {
    const shell = await start();
    const row = container.querySelector('.shell-right .telemetry-head')!;
    expect(row.querySelector('.window-controls')).not.toBeNull();
    const shown = (): string[] =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('.window-button')).filter((b) => !b.hidden && !b.closest('[hidden]')).map((b) => b.getAttribute('aria-label')!);
    expect(shell.dataset.terminal).toBe('normal');
    expect(shown()).toEqual(['Minimize terminal', 'Maximize terminal']);
    ctl('Maximize terminal').click();
    expect(shell.dataset.terminal).toBe('maximized');
    expect(shown()).toEqual(['Minimize terminal', 'Restore terminal']);
    ctl('Minimize terminal').click();
    expect(shell.dataset.terminal).toBe('minimized');
    expect(shown()).toEqual(['Restore terminal']);
    const strip = container.querySelector<HTMLElement>('.shell-right .terminal-strip')!;
    expect(strip.hidden).toBe(false);
    expect(strip.querySelector('.terminal-strip-label')?.textContent).toBe('Terminal');
    strip.querySelector<HTMLButtonElement>('.window-button')!.click();
    expect(shell.dataset.terminal).toBe('normal');
    expect(strip.hidden).toBe(true);
  });

  it('minimize and maximize hide the grips; the panels stay mounted; restore returns the dragged width', async () => {
    const shell = await start();
    const center = container.querySelector('.shell-center')!.firstElementChild;
    pointer(grip('right'), 'pointerdown', 1000);
    pointer(window, 'pointermove', 1000 - 160); // +10rem
    pointer(window, 'pointerup', 1000 - 160);
    expect(shell.style.getPropertyValue('--right-width')).toBe('30rem');
    ctl('Minimize terminal').click();
    expect(grip('right').hidden).toBe(true);
    expect(grip('left').hidden).toBe(false);
    container.querySelector<HTMLButtonElement>('.terminal-strip .window-button')!.click();
    ctl('Maximize terminal').click();
    expect(grip('right').hidden).toBe(true);
    expect(grip('left').hidden).toBe(true);
    // Hidden by CSS only: the list panel and the chat are still there, with their state.
    expect(container.querySelector('.shell-left .main-nav')).not.toBeNull();
    expect(container.querySelector('.shell-center')!.firstElementChild).toBe(center);
    ctl('Restore terminal').click();
    expect(shell.dataset.terminal).toBe('normal');
    expect(shell.style.getPropertyValue('--right-width')).toBe('30rem');
    expect(grip('right').hidden).toBe(false);
    expect(grip('left').hidden).toBe(false);
  });

  it('focus follows the control that replaces the one pressed', async () => {
    await start();
    ctl('Minimize terminal').focus();
    ctl('Minimize terminal').click();
    expect(document.activeElement?.closest('.terminal-strip')).not.toBeNull();
    (document.activeElement as HTMLButtonElement).click();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Maximize terminal');
  });

  it('widths are session-only: nothing is stored, a new shell starts at the defaults', async () => {
    const shell = await start();
    pointer(grip('left'), 'pointerdown', 0);
    pointer(window, 'pointermove', 64);
    pointer(window, 'pointerup', 64);
    expect(shell.style.getPropertyValue('--left-width')).toBe('20rem');
    expect(window.localStorage.length).toBe(0);
    router!.destroy();
    router = null;
    container.remove();
    const again = await start();
    expect(again.style.getPropertyValue('--left-width')).toBe('16rem');
  });
});
