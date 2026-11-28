/**
 * The monster mark in color. The mark is one solid shape with the face
 * knocked out, so a color is just a file: favicon.png is rose, and
 * favicon-<color>.png is the same shape in another app color. Swapping
 * the file is exact, no hue math, no CSS mask tricks.
 *
 * Two rules, both Darren's (Nov 28):
 * - every new splash gets a new color: the splash advances one step
 *   through the palette on each load, remembered in sessionStorage, so
 *   two loads in a row never show the same color.
 * - once you are in the site, the mark matches the page: cyan on
 *   chat, rose on audit, gold on research, green on lessons, purple
 *   on curator. The same rule the page titles already follow.
 */
import { stripBase, withBase } from '../util/base.ts';
import type { ShellSlots } from './shell.ts';

/** The app's colors, in splash cycle order. Rose first: it is the brand. */
export const MARK_COLORS = ['rose', 'cyan', 'gold', 'green', 'purple'] as const;
export type MarkColor = (typeof MARK_COLORS)[number];

export const MARK_COLOR_HEX: Record<MarkColor, string> = {
  rose: '#ff5c8a',
  cyan: '#00f0ff',
  gold: '#ffbd58',
  green: '#3ddc97',
  purple: '#a855f7',
};

/** The file for a color. Rose is the plain favicon, the brand default. */
export function markFile(color: MarkColor): string {
  return color === 'rose' ? '/favicon.png' : `/favicon-${color}.png`;
}

/** sessionStorage remembers which splash color ran last, per tab. */
export const SPLASH_MARK_KEY = 'hackenstein-splash-mark';

/**
 * The next splash color: one step past the last one stored, wrapping
 * around, and stored again. Nothing stored yet means the last splash
 * was rose, so the next one is cyan. A storage that refuses (private
 * mode, tests without one) falls back to rose.
 */
export function nextSplashColor(storage?: Pick<Storage, 'getItem' | 'setItem'> | null): MarkColor {
  const store =
    storage === undefined
      ? typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null
      : storage;
  if (store === null) return 'rose';
  let last = 0;
  try {
    const raw = store?.getItem(SPLASH_MARK_KEY);
    const parsed = raw === null || raw === undefined ? NaN : parseInt(raw, 10);
    if (!Number.isNaN(parsed)) last = ((parsed % MARK_COLORS.length) + MARK_COLORS.length) % MARK_COLORS.length;
  } catch {
    return 'rose';
  }
  const next = (last + 1) % MARK_COLORS.length;
  try {
    store?.setItem(SPLASH_MARK_KEY, String(next));
  } catch {
    // A read-only store still gives the color, it just does not remember it.
  }
  return MARK_COLORS[next]!;
}

/** The page's color, by app path. Anything unlisted is the brand rose. */
export function pageMarkColor(rawPath: string): MarkColor {
  let path = stripBase(rawPath).split(/[?#]/)[0]!;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path === '/chat') return 'cyan';
  if (path === '/calendar' || path.startsWith('/calendar/')) return 'rose';
  if (path === '/research' || path.startsWith('/research/')) return 'gold';
  if (path === '/lessons') return 'green';
  if (path === '/curator') return 'purple';
  return 'rose';
}

/**
 * Recolor the mark everywhere it lives: the header mark and the tab
 * favicon. The splash mark is its own img and is set where the splash
 * is built. A missing favicon link (tests) is fine, the header still
 * changes.
 */
export function applyMarkColor(slots: ShellSlots, color: MarkColor): void {
  slots.mark.src = withBase(markFile(color));
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.setAttribute('href', withBase(markFile(color)));
}
