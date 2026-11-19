/**
 * The terminal (Piece 2: oldest first, follows the bottom only when the
 * reader is there) and the layout (Piece 3: drag grips on both side panels,
 * the terminal's minimize / maximize / restore). Pointer drags are tested
 * with events dispatched on window, the code path the grips use. Record
 * data comes from the record stub (a test double).
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import type { ChatTurn, SeamAdapter } from '../adapter/seam.ts';
import { ChatLog } from '../views/chat-log.ts';
import { Router } from '../router/router.ts';
import { createModelsStub, createRecordStub, tick } from '../test-helpers.ts';
import { TelemetryPanel, FOLLOW_SLACK_PX } from './telemetry.ts';
import { RANGES, MIN_CENTER_REM } from './layout.ts';
import { provenanceChannel } from './provenance-channel.ts';
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
    box.dispatchEvent(new Event('scroll'));
    log.push(turn('one'));
    await tick();
    expect(box.scrollTop).toBe(800);
  });

  it('a reader who scrolled up is not yanked down by new lines', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    box.scrollTop = 300;
    box.dispatchEvent(new Event('scroll'));
    log.push(turn('one'));
    await tick();
    expect(box.scrollTop).toBe(300);
  });

  it('back from a detail view gives the general feed its place again', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    log.push(turn('one'));
    await tick();
    box.scrollTop = 300; // reading, not following
    box.dispatchEvent(new Event('scroll'));
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    expect(box.scrollTop).toBe(0); // the detail starts at its top
    engineFocusChannel.publish(null);
    expect(box.scrollTop).toBe(300);
    // A reader who was following goes back to the live end.
    box.scrollTop = 800;
    box.dispatchEvent(new Event('scroll'));
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    engineFocusChannel.publish(null);
    expect(box.scrollTop).toBe(800);
  });

  it('the back button hands focus to the feed; a re-render keeps it on the back button', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    log.push(turn('one'));
    await tick();
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    box.querySelector<HTMLButtonElement>('.engine-detail-back')!.focus();
    log.push(turn('two')); // a new turn re-renders the detail
    await tick();
    expect(document.activeElement?.classList.contains('engine-detail-back')).toBe(true);
    (document.activeElement as HTMLButtonElement).click();
    expect(document.activeElement?.classList.contains('activity-feed')).toBe(true);
  });

  it('after a provenance click, a detail view without that entry stays open (round-2 regression)', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    log.push({ ...turn('one'), engines: { ...turn('one').engines, katie: [{ kid: 1, subject: 'turn', entry_id: 'stub-e1', seated: true }] } });
    await tick();
    provenanceChannel.publish({ kid: 1, subject: 'turn', entry_id: 'stub-e1' });
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    expect(engineFocusChannel.current()).toEqual({ engine: 'ERIE', turnIndex: 0 });
    expect(box.querySelector('.engine-detail-name')?.textContent).toBe('ERIE');
    log.push(turn('two')); // a re-render with the old highlight target still set
    await tick();
    expect(box.querySelector('.engine-detail-name')?.textContent).toBe('ERIE');
  });

  it('a link to an entry no feed holds leaves the detail view open', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    log.push(turn('one'));
    await tick();
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    provenanceChannel.publish({ kid: 1, subject: 'turn', entry_id: 'nowhere' });
    expect(engineFocusChannel.current()).toEqual({ engine: 'ERIE', turnIndex: 0 });
  });

  it('a provenance link while a detail view is open goes back to the general feed and highlights there', async () => {
    const box = scrollBox(1000, 200);
    const log = await terminal(box);
    log.push({ ...turn('one'), engines: { ...turn('one').engines, katie: [{ kid: 1, subject: 'turn', entry_id: 'stub-e1', seated: true }] } });
    await tick();
    engineFocusChannel.publish({ engine: 'ERIE', turnIndex: 0 });
    provenanceChannel.publish({ kid: 1, subject: 'turn', entry_id: 'stub-e1' });
    expect(engineFocusChannel.current()).toBeNull();
    expect(box.querySelector<HTMLElement>('.katie-entry.is-highlighted')?.dataset.entryId).toBe('stub-e1');
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
  const realWidth = window.innerWidth;
  beforeEach(() => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 }); });
  afterEach(() => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: realWidth }); });
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
  const pointer = (target: EventTarget, type: string, clientX: number, buttons = type === 'pointerup' ? 0 : 1): void => {
    target.dispatchEvent(new Ptr(type, { bubbles: true, cancelable: true, clientX, button: 0, buttons }));
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

  it('before any resize the shell sets no width: shell.css\'s own defaults (and its 1100px ones) apply', async () => {
    const shell = await start();
    expect(shell.style.getPropertyValue('--left-width')).toBe('');
    expect(shell.style.getPropertyValue('--right-width')).toBe('');
    router!.destroy();
    router = null;
    container.remove();
    // A compact window: the grips report the widths shell.css draws there.
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q === '(max-width: 1100px)' })) as unknown as typeof window.matchMedia;
    try {
      const compact = await start();
      expect(compact.style.getPropertyValue('--left-width')).toBe('');
      expect(grip('left').getAttribute('aria-valuenow')).toBe('11.5');
      expect(grip('right').getAttribute('aria-valuenow')).toBe('15.5');
    } finally {
      window.matchMedia = mm;
    }
  });

  it('a panel never squeezes the center column under its floor, also after a window resize', async () => {
    const shell = await start();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1100 });
    grip('right').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    // (1100 - 56) / 16 = 65.25rem; less the center floor and the left 16rem.
    expect(shell.style.getPropertyValue('--right-width')).toBe(`${65.25 - MIN_CENTER_REM - 16}rem`);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    window.dispatchEvent(new Event('resize'));
    expect(shell.style.getPropertyValue('--right-width')).toBe(`${(1000 - 56) / 16 - MIN_CENTER_REM - 16}rem`);
    grip('right').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(shell.style.getPropertyValue('--right-width')).toBe(`${RANGES.right.min}rem`);
  });

  it('a drag released outside the window ends at the next move with no button down', async () => {
    const shell = await start();
    pointer(grip('left'), 'pointerdown', 0);
    pointer(window, 'pointermove', 32);
    expect(shell.style.getPropertyValue('--left-width')).toBe('18rem');
    pointer(window, 'pointermove', 64, 0); // no pointerup reached us; the button is up
    pointer(window, 'pointermove', 96);
    expect(shell.style.getPropertyValue('--left-width')).toBe('18rem');
  });

  it('a reader who scrolled up keeps their place across minimize and restore', async () => {
    await start();
    const right = container.querySelector<HTMLElement>('.shell-right')!;
    let top = 0;
    Object.defineProperty(right, 'scrollHeight', { configurable: true, get: () => 900 });
    Object.defineProperty(right, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(right, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = Math.max(0, Math.min(v, 600)); } });
    top = 200;
    right.dispatchEvent(new Event('scroll'));
    ctl('Minimize terminal').click();
    top = 0; // the hidden content lost its place
    right.dispatchEvent(new Event('scroll')); // ignored while minimized
    container.querySelector<HTMLButtonElement>('.terminal-strip .window-button')!.click();
    expect(top).toBe(200);
  });

  it('narrowing from the compact default never widens the panel; a window that grows gives a width back', async () => {
    const mm = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q === '(max-width: 1100px)' })) as unknown as typeof window.matchMedia;
    try {
      const shell = await start();
      grip('left').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true, cancelable: true }));
      expect(shell.style.getPropertyValue('--left-width')).toBe('11.5rem');
    } finally {
      window.matchMedia = mm;
    }
    router!.destroy();
    router = null;
    container.remove();
    const shell = await start();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1100 });
    grip('right').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(shell.style.getPropertyValue('--right-width')).toBe(`${65.25 - MIN_CENTER_REM - 16}rem`);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    window.dispatchEvent(new Event('resize'));
    expect(shell.style.getPropertyValue('--right-width')).toBe(`${RANGES.right.max}rem`);
  });

  it('a grip sits next to the panel it resizes, in Tab order', async () => {
    await start();
    expect(container.querySelector('.shell-left')!.nextElementSibling).toBe(grip('left'));
    expect(container.querySelector('.shell-right')!.previousElementSibling).toBe(grip('right'));
  });

  it('a minimized terminal that was following is back at its live end on restore', async () => {
    await start();
    const right = container.querySelector<HTMLElement>('.shell-right')!;
    let top = 0;
    Object.defineProperty(right, 'scrollHeight', { configurable: true, get: () => 900 });
    Object.defineProperty(right, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(right, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = Math.max(0, Math.min(v, 600)); } });
    ctl('Minimize terminal').click();
    top = 0; // hidden content lost its place
    container.querySelector<HTMLButtonElement>('.terminal-strip .window-button')!.click();
    expect(top).toBe(600);
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
    expect(again.style.getPropertyValue('--left-width')).toBe('');
    expect(grip('left').getAttribute('aria-valuenow')).toBe('16');
  });
});
