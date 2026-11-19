import { PERSONAS, type Persona, type Register } from '../adapter/seam.ts';

/**
 * Before a pick: the three masks of the one entity as cards. Each card's
 * main button is a radio (role=radio, data-value = the mask name), so the
 * cards are the persona picker. Frankenstein's card also offers its two
 * grounding positions, Book (1818) and Movie (1931); either one picks
 * Frankenstein with that register. The words here are the app's own labels,
 * not data: names and the model come from the connector after a pick.
 */

const VOICE: Record<Persona, string> = {
  Frankenstein: 'The creature, in two voices: the novel or the film.',
  Elara: 'The singer.',
  ARCHETRON: 'The machine.',
};

const POSITIONS: ReadonlyArray<{ register: Register; label: string }> = [
  { register: 'book', label: '[BOOK] 1818' },
  { register: 'movie', label: '[MOVIE] 1931' },
];

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderMaskCards(
  onPick: (p: Persona) => void,
  onPickPosition: (r: Register) => void,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'persona-picker mask-cards';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Persona');

  const radios: HTMLButtonElement[] = [];
  PERSONAS.forEach((p, i) => {
    const card = el('div', 'mask-card');
    card.dataset.mask = p;
    card.appendChild(el('span', 'mask-code', `MASK_${String(i + 1).padStart(2, '0')}`));

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'radio-option mask-pick';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.dataset.value = p;
    b.append(el('span', 'mask-name', p), el('span', 'mask-voice', VOICE[p]));
    b.addEventListener('click', () => onPick(p));
    b.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      radios[(i + step + radios.length) % radios.length]!.focus();
    });
    radios.push(b);
    card.appendChild(b);

    if (p === 'Frankenstein') {
      const pos = el('div', 'mask-positions');
      for (const o of POSITIONS) {
        const pb = document.createElement('button');
        pb.type = 'button';
        pb.className = 'mask-position';
        pb.dataset.register = o.register;
        pb.textContent = o.label;
        pb.setAttribute('aria-label', `Frankenstein, ${o.register === 'book' ? 'Book' : 'Movie'} voice`);
        pb.addEventListener('click', () => onPickPosition(o.register));
        pos.appendChild(pb);
      }
      card.appendChild(pos);
    }
    group.appendChild(card);
  });
  return group;
}
