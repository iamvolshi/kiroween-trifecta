import { describe, expect, it } from 'vitest';
import { compareNatural } from './natural.ts';

describe('compareNatural', () => {
  it('a numbered name sorts by the number, not the first digit', () => {
    const names = [
      'frankenstein-chapter-1',
      'frankenstein-chapter-10',
      'frankenstein-chapter-2',
      'frankenstein-chapter-20',
      'frankenstein-chapter-9',
    ];
    expect([...names].sort(compareNatural)).toEqual([
      'frankenstein-chapter-1',
      'frankenstein-chapter-2',
      'frankenstein-chapter-9',
      'frankenstein-chapter-10',
      'frankenstein-chapter-20',
    ]);
  });

  it('plain alphabetical order still holds where there is no number', () => {
    expect(['parcel', 'order', 'account'].sort(compareNatural)).toEqual([
      'account',
      'order',
      'parcel',
    ]);
  });

  it('letters sort before chapters, numbers inside each', () => {
    expect(
      ['frankenstein-chapter-2', 'frankenstein-letter-4', 'frankenstein-chapter-10'].sort(
        compareNatural,
      ),
    ).toEqual([
      'frankenstein-chapter-2',
      'frankenstein-chapter-10',
      'frankenstein-letter-4',
    ]);
  });
});
