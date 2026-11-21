/**
 * The first-load modal: the record service sleeps on the free tier and takes
 * ~35s to wake, and until it answers the page sits there looking frozen.
 * This says so, instead of leaving a blank page.
 *
 * Shown by the Router at boot. It hides the moment the left panel's folder
 * list first gets children — every settle path in LeftPanel.refresh (folders,
 * empty state, error state) replaces the list's children, so the first
 * mutation means the connector has answered or failed. Nothing here measures
 * progress: the spinner is indeterminate, and the slow line is a general
 * truth about the service waking, not a claim about the current load.
 *
 * A short show delay (default 300ms) keeps fast loads from flashing the
 * modal; a Hide button is the escape hatch if a load hangs forever.
 */
export const LOADING_LINE = 'Loading the record…';
export const LOADING_LINE_SLOW =
  'Still loading — the record service sometimes takes a while to wake after it sleeps.';

export class LoadingModal {
  private el: HTMLElement;
  private line: HTMLElement;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private slowTimer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver | null = null;
  private gone = false;

  constructor(
    watch: HTMLElement,
    host: HTMLElement,
    opts?: { showAfterMs?: number; slowAfterMs?: number },
  ) {
    const showAfterMs = opts?.showAfterMs ?? 300;
    const slowAfterMs = opts?.slowAfterMs ?? 8000;

    const overlay = document.createElement('div');
    overlay.className = 'loading-modal loading-hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Loading the record');

    const card = document.createElement('div');
    card.className = 'loading-card';

    const wordmark = document.createElement('p');
    wordmark.className = 'loading-wordmark';
    wordmark.textContent = 'Hackenstein';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const line = document.createElement('p');
    line.className = 'loading-line';
    line.textContent = LOADING_LINE;

    const hide = document.createElement('button');
    hide.type = 'button';
    hide.className = 'loading-hide';
    hide.textContent = 'Hide';
    hide.setAttribute('aria-label', 'Hide the loading message');
    hide.addEventListener('click', () => this.hide());

    card.append(wordmark, spinner, line, hide);
    overlay.append(card);
    host.append(overlay);

    this.el = overlay;
    this.line = line;

    // Reveal only if the load is actually slow; a fast settle hides first.
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (!this.gone) this.el.classList.remove('loading-hidden');
    }, showAfterMs);

    // The slow line is about the service, not the current load: it says
    // "sometimes", and it fires from boot, not from the reveal.
    this.slowTimer = setTimeout(() => {
      this.slowTimer = null;
      this.line.textContent = LOADING_LINE_SLOW;
    }, slowAfterMs);

    this.observer = new MutationObserver(() => this.hide());
    this.observer.observe(watch, { childList: true });
  }

  /** Remove the modal and stop watching. Safe to call twice. */
  hide(): void {
    if (this.gone) return;
    this.gone = true;
    if (this.showTimer !== null) clearTimeout(this.showTimer);
    if (this.slowTimer !== null) clearTimeout(this.slowTimer);
    this.showTimer = null;
    this.slowTimer = null;
    this.observer?.disconnect();
    this.observer = null;
    this.el.remove();
  }
}
