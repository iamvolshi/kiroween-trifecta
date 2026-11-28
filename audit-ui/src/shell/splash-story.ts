/**
 * The first-load splash story: the app announcement, the first thing
 * a user sees. It opens on the announcement, then short beats, looping
 * back to the announcement so the resting state is the announcement
 * and there is never dead air. Click to enter is always visible and
 * enters at once.
 *
 * Nothing here waits on, checks, or mentions the backend. The record
 * service boots in the background on its own; the splash does not
 * know or care whether it is up. There is no ready state at all.
 *
 * Timing follows Nielsen Norman Group's rule for auto-advancing
 * slides: one second per three words. The screens run 23, 24, 16 and
 * 29 words, so the floor is 8 seconds and the longest screen gets 10.
 * NN/g's own study is the warning: a 5-second rotation made a shopper
 * miss the offer she was looking for because she did not have time to
 * read it before it flashed away. Click to enter is the stop control
 * (WCAG 2.2.2): the loop never traps anyone on a screen.
 */

/** How long each screen stays up, in milliseconds: the announcement, then one per beat. */
export const SPLASH_SCREEN_MS: number[] = [8000, 8000, 8000, 10000];

/** The opening, in Darren's own words from the app's own tagline. */
export const SPLASH_HEADLINE = 'Never lies.';

export const SPLASH_OPENING: string[] = [
  'Ask Frankenstein\u2019s monster anything.',
  'Every answer carries the file and the record behind it.',
  'When it doesn\u2019t know, it says so.',
];

/** The beats between announcements. */
export const SPLASH_BEATS: string[] = [
  'Three Frankensteins to talk to: the book (1818), the 1931 film, Young Frankenstein (1974). Or attach your own GitHub repo and ask about that.',
  'Eleven apps work the record: ERIE, KATIE, ELLE, ARCHE, SHERLOCK, PEEP, RATR, CURATOR, WATSON, ROSIE, TEMPE.',
  'It learns lessons and develops identity through use. Everything it says is written to the record, with the file and the moment behind it. That is the whole point.',
];

export const SPLASH_ENTER_LABEL = 'CLICK TO ENTER';

export class SplashStory {
  private el: HTMLElement;
  private screen: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private index = 0;
  private gone = false;
  private screenMs: number[];

  constructor(host: HTMLElement, opts?: { screenMs?: number[] }) {
    this.screenMs = opts?.screenMs ?? SPLASH_SCREEN_MS;

    const overlay = document.createElement('div');
    overlay.className = 'splash-story';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'About Hackenstein');

    const card = document.createElement('div');
    card.className = 'splash-card';

    const wordmark = document.createElement('p');
    wordmark.className = 'splash-wordmark';
    wordmark.textContent = 'Hackenstein';

    const screen = document.createElement('div');
    screen.className = 'splash-screen';

    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'splash-enter';
    enter.textContent = SPLASH_ENTER_LABEL;
    enter.setAttribute('aria-label', 'Enter Hackenstein');
    enter.addEventListener('click', () => this.enter());

    card.append(wordmark, screen, enter);
    overlay.append(card);
    host.append(overlay);

    this.el = overlay;
    this.screen = screen;
    this.render();

    // Announcement, beat, beat, beat, announcement: the loop opens and
    // closes on the announcement. Each screen stays up for its own
    // duration, so the timer is chained, not a fixed interval.
    this.schedule();
  }

  private schedule(): void {
    const ms = this.screenMs[this.index] ?? SPLASH_SCREEN_MS[0]!;
    this.timer = setTimeout(() => {
      this.index = (this.index + 1) % (SPLASH_BEATS.length + 1);
      this.render();
      this.schedule();
    }, ms);
  }

  private render(): void {
    this.screen.replaceChildren();
    if (this.index === 0) {
      const headline = document.createElement('p');
      headline.className = 'splash-headline';
      headline.textContent = SPLASH_HEADLINE;
      const opening = document.createElement('div');
      opening.className = 'splash-opening';
      for (const line of SPLASH_OPENING) {
        const item = document.createElement('p');
        item.textContent = line;
        opening.append(item);
      }
      this.screen.append(headline, opening);
      return;
    }
    const beat = document.createElement('p');
    beat.className = 'splash-beat';
    beat.textContent = SPLASH_BEATS[this.index - 1]!;
    this.screen.append(beat);
  }

  /** Enter the app at once and stop the loop. Safe to call twice. */
  enter(): void {
    if (this.gone) return;
    this.gone = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.el.remove();
  }
}
