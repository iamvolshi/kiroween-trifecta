import type { Entry } from '../adapter/seam.ts';
import type { TimeZone } from '../util/timezone.ts';
import { renderEntryGrid, type GridList } from './entry-grid.ts';

/**
 * Entries as the folder's log grid: one row per entry, columns Time, KID,
 * subject, state, authority, evidence, reason (see entry-grid.ts). The KID
 * links to its Entry Detail. Data via textContent. `list` keeps the did and
 * believed lists' sort and widths apart.
 */
export function renderEntryLog(
  entries: Entry[],
  label: string,
  list: GridList,
  zone: TimeZone,
  timeZone: string,
): HTMLElement {
  return renderEntryGrid(entries, label, list, zone, timeZone);
}
