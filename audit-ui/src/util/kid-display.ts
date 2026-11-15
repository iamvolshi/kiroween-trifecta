import type { KidMap } from "../adapter/seam";

export function renderKid(kid: number, kidMap: KidMap | null): string {
  if (kidMap !== null && kidMap[kid] !== undefined) {
    return `${kid} ${kidMap[kid]}`;
  }
  return String(kid);
}
