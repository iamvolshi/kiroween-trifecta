import { withBase } from '../util/base.ts';

/**
 * The first-load splash story: the app announcement, the first thing
 * a user sees. It opens on what it is, eleven apps sewn together,
 * three monster personas, one application, then the promise, then
 * short beats, looping back to the announcement so the resting state
 * is the announcement and there is never dead air. Click to enter is
 * always visible and enters at once.
 *
 * Nothing here waits on, checks, or mentions the backend. The record
 * service boots in the background on its own; the splash does not
 * know or care whether it is up. There is no ready state at all.
 *
 * Timing follows Nielsen Norman Group's rule for auto-advancing
 * slides: one second per three words. The screens run 12, 22, 24, 16
 * and 29 words, so the floor is 8 seconds and the longest screen gets
 * 10. NN/g's own study is the warning: a 5-second rotation made a
 * shopper miss the offer she was looking for because she did not have
 * time to read it before it flashed away. Click to enter is the stop
 * control (WCAG 2.2.2): the loop never traps anyone on a screen.
 */

/** How long each screen stays up, in milliseconds, one per screen. */
export const SPLASH_SCREEN_MS: number[] = [8000, 8000, 8000, 8000, 10000];

/** The announcement, in Darren's own words: what it is. */
export const SPLASH_IDENTITY: string[] = [
  '11 apps sewn together.',
  '3 Frankenstein monster personas.',
  '1 incredibly useful application.',
];

/** The promise, in Darren's own words from the app's own tagline. */
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

export interface SplashScreen {
  headline?: string;
  lines: string[];
  /** Class on each line, for the identity stack's uppercase shout. */
  lineClass?: string;
}

/** Every screen, in order: what it is, the promise, then the beats. */
export const SPLASH_SCREENS: SplashScreen[] = [
  { lines: SPLASH_IDENTITY, lineClass: 'splash-identity' },
  { headline: SPLASH_HEADLINE, lines: SPLASH_OPENING },
  ...SPLASH_BEATS.map((beat) => ({ lines: [beat] })),
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

    const mark = document.createElement('img');
    mark.className = 'splash-mark';
    mark.src = withBase('/favicon.png');
    mark.alt = '';

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

    card.append(mark, wordmark, screen, enter);
    overlay.append(card);
    host.append(overlay);

    this.el = overlay;
    this.screen = screen;
    this.render();

    // Announcement, promise, beat, beat, beat, announcement: the loop
    // opens and closes on the announcement. Each screen stays up for
    // its own duration, so the timer is chained, not a fixed interval.
    this.schedule();
  }

  private schedule(): void {
    const ms = this.screenMs[this.index] ?? SPLASH_SCREEN_MS[0]!;
    this.timer = setTimeout(() => {
      this.index = (this.index + 1) % SPLASH_SCREENS.length;
      this.render();
      this.schedule();
    }, ms);
  }

  private render(): void {
    this.screen.replaceChildren();
    const current = SPLASH_SCREENS[this.index]!;
    if (current.headline) {
      const headline = document.createElement('p');
      headline.className = 'splash-headline';
      headline.textContent = current.headline;
      this.screen.append(headline);
    }
    if (current.lines.length > 1) {
      const opening = document.createElement('div');
      opening.className = 'splash-opening';
      for (const line of current.lines) {
        const item = document.createElement('p');
        if (current.lineClass) item.className = current.lineClass;
        item.textContent = line;
        opening.append(item);
      }
      this.screen.append(opening);
      return;
    }
    const beat = document.createElement('p');
    beat.className = 'splash-beat';
    beat.textContent = current.lines[0]!;
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
