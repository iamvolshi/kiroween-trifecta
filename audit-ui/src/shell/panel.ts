/**
 * A shell column panel (left directories, right telemetry). Unlike a View it
 * stays mounted across navigation and is refreshed when the record or the
 * conversation changes.
 */
export interface Panel {
  mount(slot: HTMLElement): void;
  /** Re-read through the seam and re-render. Late results must be dropped. */
  refresh(): void;
  unmount(): void;
}
