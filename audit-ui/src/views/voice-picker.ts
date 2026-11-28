import type { Register } from '../adapter/seam.ts';
import type { Announcement } from './model-announce.ts';
import { VOICE_LABELS } from './voices.ts';
import { withBase } from '../util/base.ts';

/** One picture per voice, served from public/: the 1818 book, the 1931
 * Creature, the 1974 doctor. */
const TILE_IMAGES: Record<Register, string> = {
  book: 'frankenstein-book.png',
  movie: 'frankenstein-movie.png',
  'young-frankenstein': 'frankenstein-young.png',
};

/** How long the picked tile takes to grow and fly down into the chat box. */
export const BIG_PICK_ANIM_MS = 650;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The voice picker: three little picture icons in a row, one per voice,
 * next to the composer (the chat view puts the row to the composer's
 * right; the mini chat stacks it above). No words on the icons: the
 * pictures are the choice, and each carries its name and year for screen
 * readers and as a hover title. The picked voice's live model rides
 * under the icons (`announcement`, null before a voice is picked: then
 * the row is icons only). A radio group made of real buttons:
 * role=radiogroup (aria-label), role=radio buttons with aria-checked.
 * One Tab stop (the picked icon, else the first: a roving tabindex);
 * Enter / Space pick; Left/Right and Up/Down move to the next icon and
 * pick it.
 */
export function renderVoicePicker(
  voices: readonly Register[],
  selected: Register | null,
  onChoose: (v: Register) => void,
  announcement: Announcement | null = null,
): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'voice-picker-wrap';
  const group = document.createElement('div');
  group.className = 'voice-picker';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Pick your Frankenstein');
  voices.forEach((v, i) => {
    const { year, name } = VOICE_LABELS[v];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'voice-icon';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === selected));
    b.setAttribute('aria-label', `${name} ${year}`);
    b.title = `${name} ${year}`;
    b.dataset.voice = v;
    b.tabIndex = v === selected || ((selected === null || !voices.includes(selected)) && i === 0) ? 0 : -1;
    const img = document.createElement('img');
    img.src = withBase(`/${TILE_IMAGES[v]}`);
    img.alt = '';
    b.appendChild(img);
    b.addEventListener('click', () => onChoose(v));
    b.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      onChoose(voices[(i + step + voices.length) % voices.length]!);
    });
    group.appendChild(b);
  });
  if (announcement !== null) {
    const m = document.createElement('span');
    m.className = 'voice-model';
    m.dataset.state = announcement.state;
    m.textContent = announcement.model;
    group.appendChild(m);
  }
  wrap.appendChild(group);
  return wrap;
}

/**
 * The big picker: "Choose your Frankenstein" over three big tiles in the
 * middle of the chat page, one per voice (Book 1818, Movie 1931, Young
 * 1974), each with its picture and wearing its own voice's accent when
 * picked. Same radio-group behaviour as the small icons. A pick grows
 * the chosen tile and flies it down into the chat box while the other
 * two fade; the voice is set when the flight lands, and the picker
 * leaves. The chat shows it while the transcript is empty and no voice
 * is picked; the little picture icons by the composer take over
 * switching after that.
 */
export function renderBigVoicePicker(
  voices: readonly Register[],
  selected: Register | null,
  onChoose: (v: Register) => void,
): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'frankenstein-picker';
  const heading = document.createElement('h2');
  heading.className = 'frankenstein-heading';
  heading.id = 'frankenstein-heading';
  heading.textContent = 'Choose your Frankenstein';
  const group = document.createElement('div');
  group.className = 'frankenstein-tiles';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', 'frankenstein-heading');
  const buttons: HTMLButtonElement[] = [];
  let picking = false;
  const pick = (v: Register, button: HTMLButtonElement): void => {
    if (picking) return;
    if (prefersReducedMotion()) {
      onChoose(v);
      return;
    }
    picking = true;
    wrap.classList.add('is-picking');
    for (const t of Array.from(group.querySelectorAll('.frankenstein-tile'))) {
      t.classList.add('is-faded');
    }
    // The flight is a fixed clone of the picked tile, so it can cross the
    // transcript's edge into the chat box instead of clipping at it.
    const rect = button.getBoundingClientRect();
    const clone = button.cloneNode(true) as HTMLButtonElement;
    clone.classList.remove('is-faded');
    clone.classList.add('frankenstein-fly-clone', 'is-flying');
    clone.setAttribute('aria-hidden', 'true');
    clone.tabIndex = -1;
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    const composer = wrap.closest('.chat-column')?.querySelector('.chat-composer');
    const to = composer?.getBoundingClientRect();
    const dx = to ? to.left + to.width / 2 - (rect.left + rect.width / 2) : 0;
    const dy = to ? to.top + to.height / 2 - (rect.top + rect.height / 2) : window.innerHeight * 0.4;
    clone.style.setProperty('--fly-x', `${dx}px`);
    clone.style.setProperty('--fly-y', `${dy}px`);
    document.body.appendChild(clone);
    window.setTimeout(() => {
      clone.remove();
      onChoose(v);
    }, BIG_PICK_ANIM_MS);
  };
  voices.forEach((v, i) => {
    const { tag, year } = VOICE_LABELS[v];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'frankenstein-tile';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === selected));
    b.dataset.voice = v;
    b.tabIndex = v === selected || ((selected === null || !voices.includes(selected)) && i === 0) ? 0 : -1;
    const img = document.createElement('img');
    img.className = 'frankenstein-image';
    img.src = withBase(`/${TILE_IMAGES[v]}`);
    img.alt = '';
    b.appendChild(img);
    const t = document.createElement('span');
    t.className = 'frankenstein-tag';
    t.textContent = tag;
    const y = document.createElement('span');
    y.className = 'frankenstein-year';
    y.textContent = year;
    b.append(t, y);
    b.addEventListener('click', () => pick(v, b));
    b.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      const next = buttons[(i + step + voices.length) % voices.length]!;
      pick(voices[(i + step + voices.length) % voices.length]!, next);
    });
    buttons.push(b);
    group.appendChild(b);
  });
  wrap.append(heading, group);
  return wrap;
}
