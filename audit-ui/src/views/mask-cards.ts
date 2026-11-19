import { PERSONAS, type Persona, type Register } from '../adapter/seam.ts';

/**
 * Before a pick: the three masks of the one entity as cards, a plain group
 * of buttons in Tab order (data-value = the mask name). After a pick the
 * compact persona picker (a radio group) takes over. Frankenstein's card also offers its two
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
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Choose a persona');

  PERSONAS.forEach((p, i) => {
    const card = el('div', 'mask-card');
    card.dataset.mask = p;
    card.appendChild(el('span', 'mask-code', `MASK_${String(i + 1).padStart(2, '0')}`));

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mask-pick';
    b.dataset.value = p;
    b.append(el('span', 'mask-name', p), el('span', 'mask-voice', VOICE[p]));
    b.addEventListener('click', () => onPick(p));
    card.appendChild(b);

    if (p === 'Frankenstein') {
      const pos = el('div', 'mask-positions');
      pos.appendChild(el('span', 'mask-grounding', 'Grounding position'));
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
