/**
 * The shell's adjustable layout: the two side panels resize by dragging a
 * grip on their inner edge (the 56px icon rail never moves), and the right
 * panel (the terminal) can be minimized to a strip, maximized to fill the
 * content row, and restored. Widths and state are session-only: nothing is
 * stored, a reload starts from the defaults.
 *
 * Widths live in two inline CSS variables on the shell (--left-width,
 * --right-width) that shell.css feeds into grid-template-columns. They are
 * set only once a panel has been resized: until then shell.css's own
 * defaults apply (16 / 20rem, or 14 / 15.5rem at 1100px and under). A
 * width never squeezes the center column under MIN_CENTER_REM, and is
 * re-clamped when the window resizes. The terminal state lives in
 * data-terminal on the shell.
 *
 * Dragging listens on window for pointermove / pointerup: a grip's
 * pointerdown starts it, and the window listeners (reached by bubbling,
 * never through setPointerCapture, which can throw before they attach)
 * carry it to the end.
 */

export type Side = 'left' | 'right';
export type TerminalState = 'normal' | 'minimized' | 'maximized';

/** Ranges in rem. */
export const RANGES: Record<Side, { min: number; max: number; def: number }> = {
  left: { min: 12, max: 24, def: 16 },
  right: { min: 14, max: 36, def: 20 },
};

const VAR: Record<Side, string> = { left: '--left-width', right: '--right-width' };
/** Room always kept for the center column (the chat), in rem. */
export const MIN_CENTER_REM = 20;
const RAIL_PX = 56;
/** The widths shell.css draws before any resize (they shrink at 1100px and under). */
function drawnDefault(side: Side): number {
  const compact = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1100px)').matches;
  return side === 'left' ? (compact ? 14 : RANGES.left.def) : compact ? 15.5 : RANGES.right.def;
}
const GRIP_LABEL: Record<Side, string> = { left: 'Resize left panel', right: 'Resize right panel' };

const round = (rem: number): number => Math.round(rem * 100) / 100;

function rootRem(): number {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px : 16;
}

function button(className: string, glyph: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = glyph;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

export interface LayoutSlots {
  shell: HTMLElement;
  left: HTMLElement;
  right: HTMLElement;
}

export class ShellLayout {
  /** The terminal's window buttons; the telemetry panel places them in its heading row. */
  readonly controls: HTMLElement;
  private shell: HTMLElement;
  /** The width asked for (a drag, a key), in range; null: never resized, shell.css's default is drawn. */
  private widths: Record<Side, number | null> = { left: null, right: null };
  /** The width drawn: the asked-for one fitted to the window (the center keeps its floor). */
  private drawn: Record<Side, number | null> = { left: null, right: null };
  private listeners = new Set<(s: TerminalState) => void>();
  private terminal: TerminalState = 'normal';
  private grips: Record<Side, HTMLElement>;
  private strip: HTMLElement;
  private buttons: { minimize: HTMLButtonElement; maximize: HTMLButtonElement; restore: HTMLButtonElement; stripRestore: HTMLButtonElement };
  private drag: { side: Side; startX: number; startW: number; floor: number } | null = null;
  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    // Released outside the window (no pointerup reached us): the drag is over.
    if (e.buttons === 0) {
      this.endDrag();
      return;
    }
    const dx = (e.clientX - d.startX) / rootRem();
    // The left grip is the left panel's right edge; the right grip is the terminal's left edge.
    this.setWidth(d.side, d.side === 'left' ? d.startW + dx : d.startW - dx, d.floor);
  };
  private onUp = (): void => this.endDrag();
  // The asked-for widths are kept: a window that grows again gives them back.
  private onResize = (): void => this.apply();

  constructor(slots: LayoutSlots) {
    this.shell = slots.shell;
    const rightSlot = slots.right;
    this.grips = { left: this.makeGrip('left'), right: this.makeGrip('right') };
    // In Tab order beside the panel each one resizes.
    slots.left.after(this.grips.left);
    rightSlot.before(this.grips.right);

    this.controls = document.createElement('div');
    this.controls.className = 'window-controls';
    this.controls.setAttribute('role', 'group');
    this.controls.setAttribute('aria-label', 'Terminal window');
    this.buttons = {
      minimize: button('window-button', '\u2212', 'Minimize terminal', () => this.setTerminal('minimized')),
      maximize: button('window-button', '\u2610', 'Maximize terminal', () => this.setTerminal('maximized')),
      restore: button('window-button', '\u2750', 'Restore terminal', () => this.setTerminal('normal')),
      stripRestore: button('window-button', '\u2750', 'Restore terminal', () => this.setTerminal('normal')),
    };
    this.controls.append(this.buttons.minimize, this.buttons.maximize, this.buttons.restore);

    // The minimized strip: a vertical label and the restore control.
    this.strip = document.createElement('div');
    this.strip.className = 'terminal-strip';
    const label = document.createElement('span');
    label.className = 'terminal-strip-label';
    label.textContent = 'Terminal';
    this.strip.append(this.buttons.stripRestore, label);
    rightSlot.prepend(this.strip);

    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('resize', this.onResize);
    this.apply();
  }

  /** The panel's width in rem: the resized one, else the default shell.css draws. */
  width(side: Side): number {
    return this.drawn[side] ?? drawnDefault(side);
  }

  /** Called after every terminal state change. Returns the unsubscribe function. */
  onChange(fn: (s: TerminalState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  state(): TerminalState {
    return this.terminal;
  }

  /**
   * Set a panel's width in rem, clamped to its range. `floor` lowers the
   * range's minimum for a step that starts under it, so narrowing from
   * there never widens the panel.
   */
  setWidth(side: Side, rem: number, floor = RANGES[side].min): void {
    const r = RANGES[side];
    this.widths[side] = round(Math.min(r.max, Math.max(Math.min(r.min, floor), rem)));
    this.apply();
  }

  /** The most `side` may take beside `otherW` while the center keeps MIN_CENTER_REM. */
  private room(otherW: number): number {
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const unit = Number.isFinite(px) && px > 0 ? px : 16;
    return (window.innerWidth - RAIL_PX) / unit - MIN_CENTER_REM - otherW;
  }

  /** The asked-for width fitted so the center column keeps MIN_CENTER_REM beside `otherW`. */
  private fit(side: Side, rem: number, otherW: number): number {
    return round(Math.max(Math.min(RANGES[side].min, rem), Math.min(rem, this.room(otherW))));
  }

  /** Minimize, maximize or restore the terminal. The dragged widths are kept. */
  setTerminal(s: TerminalState): void {
    if (s === this.terminal) return;
    // Focus follows the control that replaces the one just pressed (it may be hidden now).
    const hadFocus = (Object.values(this.buttons) as HTMLElement[]).includes(document.activeElement as HTMLElement);
    this.terminal = s;
    this.apply();
    for (const fn of [...this.listeners]) fn(s);
    const next = s === 'minimized' ? this.buttons.stripRestore : s === 'maximized' ? this.buttons.restore : this.buttons.maximize;
    if (hadFocus) next.focus();
  }

  destroy(): void {
    this.endDrag();
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('resize', this.onResize);
    this.listeners.clear();
    this.grips.left.remove();
    this.grips.right.remove();
    this.strip.remove();
    this.controls.remove();
    this.shell.style.removeProperty(VAR.left);
    this.shell.style.removeProperty(VAR.right);
    delete this.shell.dataset.terminal;
  }

  private makeGrip(side: Side): HTMLElement {
    const g = document.createElement('div');
    g.className = 'shell-grip';
    g.dataset.side = side;
    g.tabIndex = 0;
    g.setAttribute('role', 'separator');
    g.setAttribute('aria-orientation', 'vertical');
    g.setAttribute('aria-label', GRIP_LABEL[side]);
    g.setAttribute('aria-valuemin', String(RANGES[side].min));
    g.setAttribute('aria-valuemax', String(RANGES[side].max));
    g.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.drag = { side, startX: e.clientX, startW: this.width(side), floor: this.width(side) };
      this.shell.classList.add('is-resizing');
    });
    g.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Home' || e.key === 'End') {
        // Home: the narrowest; End: the widest the range and the window allow.
        e.preventDefault();
        this.setWidth(side, e.key === 'Home' ? RANGES[side].min : RANGES[side].max);
        return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = (e.shiftKey ? 4 : 1) * (e.key === 'ArrowRight' ? 1 : -1);
      // Right arrow moves the edge right: wider on the left, narrower on the right.
      this.setWidth(side, this.width(side) + (side === 'left' ? step : -step), this.width(side));
    });
    return g;
  }

  private endDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.shell.classList.remove('is-resizing');
  }

  private apply(): void {
    this.shell.dataset.terminal = this.terminal;
    // One pass, terminal first: the right fits beside the least the left can draw (its
    // floor, or its default when never resized), then the left beside the right as drawn
    // (2.5rem when minimized). The shrink is even, and the center keeps its floor.
    const wl = this.widths.left;
    const wr = this.widths.right;
    const leftLeast = wl === null ? drawnDefault('left') : Math.min(RANGES.left.min, wl);
    this.drawn.right = wr === null ? null : this.fit('right', wr, leftLeast);
    const rightNow = this.terminal === 'minimized' ? 2.5 : this.drawn.right ?? drawnDefault('right');
    this.drawn.left = wl === null ? null : this.fit('left', wl, rightNow);
    for (const side of ['left', 'right'] as const) {
      const set = this.drawn[side];
      if (set === null) this.shell.style.removeProperty(VAR[side]);
      else this.shell.style.setProperty(VAR[side], `${set}rem`);
      const now = this.width(side);
      // The compact default (14rem) is inside the drag range's floor, so
      // the grip's minimum is the range's own.
      this.grips[side].setAttribute('aria-valuemin', String(Math.min(RANGES[side].min, now)));
      // The max the window allows beside the other panel as drawn, not the range's alone.
      const other: Side = side === 'left' ? 'right' : 'left';
      const otherNow = other === 'right' && this.terminal === 'minimized' ? 2.5 : this.drawn[other] ?? drawnDefault(other);
      const max = round(Math.max(RANGES[side].min, Math.min(RANGES[side].max, this.room(otherNow))));
      this.grips[side].setAttribute('aria-valuemax', String(Math.max(max, now)));
      this.grips[side].setAttribute('aria-valuenow', String(now));
      this.grips[side].setAttribute('aria-valuetext', `${now} rem`);
    }
    // The right grip hides when the terminal is minimized or maximized; the left one when maximized (its panel hides).
    this.grips.right.hidden = this.terminal !== 'normal';
    this.grips.left.hidden = this.terminal === 'maximized';
    // normal: minimize + maximize; maximized: minimize + restore; minimized: restore (on the strip).
    this.buttons.minimize.hidden = this.terminal === 'minimized';
    this.buttons.maximize.hidden = this.terminal !== 'normal';
    this.buttons.restore.hidden = this.terminal !== 'maximized';
    this.strip.hidden = this.terminal !== 'minimized';
  }
}
