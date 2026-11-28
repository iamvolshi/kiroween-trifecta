/**
 * The mark in color: the splash advances one step through the palette
 * on each load, and inside the site the mark matches the page.
 */
import { describe, it, expect } from 'vitest';
import {
  MARK_COLORS,
  SPLASH_MARK_KEY,
  nextSplashColor,
  pageMarkColor,
  markFile,
} from './mark-color.ts';

function fakeStorage(): { data: Record<string, string> } & Pick<Storage, 'getItem' | 'setItem'> {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k: string) => (k in data ? data[k]! : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('nextSplashColor', () => {
  it('advances one step per load, wraps around, and never repeats', () => {
    const store = fakeStorage();
    const seen: string[] = [];
    for (let i = 0; i < MARK_COLORS.length + 1; i++) seen.push(nextSplashColor(store));
    expect(seen).toEqual(['cyan', 'gold', 'green', 'purple', 'rose', 'cyan']);
    expect(store.data[SPLASH_MARK_KEY]).toBe('1');
  });

  it('starts after rose when nothing is stored, so the first new splash is cyan', () => {
    expect(nextSplashColor(fakeStorage())).toBe('cyan');
  });

  it('ignores a stored value that is not a number', () => {
    const store = fakeStorage();
    store.data[SPLASH_MARK_KEY] = 'nope';
    expect(nextSplashColor(store)).toBe('cyan');
  });

  it('falls back to rose when there is no storage at all', () => {
    expect(nextSplashColor(null)).toBe('rose');
  });
});

describe('pageMarkColor', () => {
  it('matches the page: cyan chat, rose audit, gold research, green lessons, purple curator', () => {
    expect(pageMarkColor('/chat')).toBe('cyan');
    expect(pageMarkColor('/chat/')).toBe('cyan');
    expect(pageMarkColor('/chat?voice=book')).toBe('cyan');
    expect(pageMarkColor('/calendar')).toBe('rose');
    expect(pageMarkColor('/calendar/2026-11')).toBe('rose');
    expect(pageMarkColor('/research')).toBe('gold');
    expect(pageMarkColor('/research/erie')).toBe('gold');
    expect(pageMarkColor('/lessons')).toBe('green');
    expect(pageMarkColor('/curator')).toBe('purple');
  });

  it('defaults to the brand rose for pages with no color', () => {
    expect(pageMarkColor('/investigate')).toBe('rose');
    expect(pageMarkColor('/actions')).toBe('rose');
    expect(pageMarkColor('/record/order-1042')).toBe('rose');
    expect(pageMarkColor('/no-such-page')).toBe('rose');
  });
});

describe('markFile', () => {
  it('rose is the plain favicon, the rest are named files', () => {
    expect(markFile('rose')).toBe('/favicon.png');
    expect(markFile('cyan')).toBe('/favicon-cyan.png');
    expect(markFile('gold')).toBe('/favicon-gold.png');
    expect(markFile('green')).toBe('/favicon-green.png');
    expect(markFile('purple')).toBe('/favicon-purple.png');
  });
});
