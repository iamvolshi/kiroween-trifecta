/** A KID displays as its number, nothing else. The kidmap's tag is the
 * machine key behind the number; it is never printed. */
export function renderKid(kid: number): string {
  return String(kid);
}
