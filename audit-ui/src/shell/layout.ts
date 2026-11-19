/**
 * The shell's adjustable layout: the two side panels resize by dragging a
 * grip on their inner edge (the 56px icon rail never moves), and the right
 * panel (the terminal) can be minimized to a strip, maximized to fill the
 * content row, and restored. Widths and state are session-only: nothing is
 * stored, a reload starts from the defaults.
 *
 * Widths live in two inline CSS variables on the shell (--left-width,
 * --right-width) that shell.css feeds into grid-template-columns. The
 * terminal state lives in data-terminal on the shell.
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
const GRIP_LABEL: Record<Side, string> = { left: 'Resize left panel', right: 'Resize right panel' };

const clamp = (side: Side, rem: number): number => {
  const r = RANGES[side];
  return Math.min(r.max, Math.max(r.min, Math.round(rem * 100) / 100));
};

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

export class ShellLayout {
  /** The terminal's window buttons; the telemetry panel places them in its heading row. */
  readonly controls: HTMLElement;
  private shell: HTMLElement;
  private widths: Record<Side, number> = { left: RANGES.left.def, right: RANGES.right.def };
  private terminal: TerminalState = 'normal';
  private grips: Record<Side, HTMLElement>;
  private strip: HTMLElement;
  private buttons: { minimize: HTMLButtonElement; maximize: HTMLButtonElement; restore: HTMLButtonElement; stripRestore: HTMLButtonElement };
  private drag: { side: Side; startX: number; startW: number } | null = null;
  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    const dx = (e.clientX - d.startX) / rootRem();
    // The left grip is the left panel's right edge; the right grip is the terminal's left edge.
    this.setWidth(d.side, d.side === 'left' ? d.startW + dx : d.startW - dx);
  };
  private onUp = (): void => this.endDrag();

  constructor(shell: HTMLElement, rightSlot: HTMLElement) {
    this.shell = shell;
    this.grips = { left: this.makeGrip('left'), right: this.makeGrip('right') };
    shell.append(this.grips.left, this.grips.right);

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
    this.apply();
  }

  width(side: Side): number {
    return this.widths[side];
  }

  state(): TerminalState {
    return this.terminal;
  }

  /** Set a panel's width in rem, clamped to its range. */
  setWidth(side: Side, rem: number): void {
    this.widths[side] = clamp(side, rem);
    this.apply();
  }

  /** Minimize, maximize or restore the terminal. The dragged widths are kept. */
  setTerminal(s: TerminalState): void {
    if (s === this.terminal) return;
    // Focus follows the control that replaces the one just pressed (it may be hidden now).
    const hadFocus = (Object.values(this.buttons) as HTMLElement[]).includes(document.activeElement as HTMLElement);
    this.terminal = s;
    this.apply();
    const next = s === 'minimized' ? this.buttons.stripRestore : s === 'maximized' ? this.buttons.restore : this.buttons.maximize;
    if (hadFocus) next.focus();
  }

  destroy(): void {
    this.endDrag();
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
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
      this.drag = { side, startX: e.clientX, startW: this.widths[side] };
      this.shell.classList.add('is-resizing');
    });
    g.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const step = (e.shiftKey ? 4 : 1) * (e.key === 'ArrowRight' ? 1 : -1);
      // Right arrow moves the edge right: wider on the left, narrower on the right.
      this.setWidth(side, this.widths[side] + (side === 'left' ? step : -step));
    });
    return g;
  }

  private endDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.shell.classList.remove('is-resizing');
  }

  private apply(): void {
    this.shell.style.setProperty(VAR.left, `${this.widths.left}rem`);
    this.shell.style.setProperty(VAR.right, `${this.widths.right}rem`);
    this.shell.dataset.terminal = this.terminal;
    for (const side of ['left', 'right'] as const) {
      this.grips[side].setAttribute('aria-valuenow', String(this.widths[side]));
      this.grips[side].setAttribute('aria-valuetext', `${this.widths[side]} rem`);
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
