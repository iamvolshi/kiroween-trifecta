/**
 * Natural sort for names that carry a number: chapter-2 before chapter-10.
 * A plain string sort puts chapter-10 first ('1' < '2'), which is the wrong
 * order for numbered subjects. `localeCompare` with `numeric` compares the
 * runs of digits by value, so chapter-2 < chapter-10 and letter-2 < letter-10,
 * while plain alphabetical order still holds where there is no number.
 */
export function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
