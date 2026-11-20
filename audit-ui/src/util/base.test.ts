import { describe, expect, it } from 'vitest';
import { appBase, stripBase, withBase } from './base.ts';

describe('appBase', () => {
  it('is / under the test runner (Vite default)', () => {
    expect(appBase()).toBe('/');
  });
});

describe('stripBase', () => {
  it('is the identity at the root', () => {
    expect(stripBase('/calendar/2026-03-03/11', '/')).toBe('/calendar/2026-03-03/11');
    expect(stripBase('/', '/')).toBe('/');
  });

  it('strips a subpath base', () => {
    const base = '/hackenstein-katie-preview';
    expect(stripBase('/hackenstein-katie-preview/calendar', base)).toBe('/calendar');
    expect(stripBase('/hackenstein-katie-preview/calendar/2026-03-03/11', base)).toBe('/calendar/2026-03-03/11');
    expect(stripBase('/hackenstein-katie-preview/chat', base)).toBe('/chat');
  });

  it('turns the bare base into /', () => {
    expect(stripBase('/hackenstein-katie-preview', '/hackenstein-katie-preview')).toBe('/');
  });

  it('leaves a path outside the base alone', () => {
    expect(stripBase('/other/calendar', '/hackenstein-katie-preview')).toBe('/other/calendar');
  });
});

describe('withBase', () => {
  it('is the identity at the root', () => {
    expect(withBase('/calendar', '/')).toBe('/calendar');
    expect(withBase('/chat', '/')).toBe('/chat');
  });

  it('prepends a subpath base', () => {
    const base = '/hackenstein-katie-preview';
    expect(withBase('/calendar', base)).toBe('/hackenstein-katie-preview/calendar');
    expect(withBase('/chat', base)).toBe('/hackenstein-katie-preview/chat');
  });

  it('round-trips with stripBase', () => {
    const base = '/hackenstein-katie-preview';
    for (const path of ['/', '/chat', '/calendar', '/calendar/2026-03-03/11', '/record/1']) {
      expect(stripBase(withBase(path, base), base)).toBe(path);
    }
  });
});
