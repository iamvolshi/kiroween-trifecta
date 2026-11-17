import { PERSONAS, type Persona, type Register } from '../adapter/seam.ts';

/**
 * A radio group made of real buttons: role=radiogroup with role=radio
 * buttons and aria-checked. Each option is a Tab stop and answers Enter /
 * Space (native button click); Left/Right and Up/Down move to the next
 * option and choose it, as a radio group does.
 */
export function radioGroup<T extends string>(
  className: string,
  label: string,
  options: ReadonlyArray<{ value: T; text: string; hint?: string }>,
  selected: T | null,
  onChoose: (v: T) => void,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = className;
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', label);

  const caption = document.createElement('span');
  caption.className = 'radio-caption';
  caption.setAttribute('aria-hidden', 'true');
  caption.textContent = label;
  group.appendChild(caption);

  const buttons: HTMLButtonElement[] = [];
  options.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'radio-option';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.value === selected));
    b.dataset.value = o.value;
    b.textContent = o.text;
    if (o.hint) b.title = o.hint;
    b.addEventListener('click', () => onChoose(o.value));
    b.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (step === 0) return;
      e.preventDefault();
      const next = options[(i + step + options.length) % options.length]!;
      onChoose(next.value);
    });
    buttons.push(b);
    group.appendChild(b);
  });
  return group;
}

/** The persona picker: ARCHE runs whichever face you choose. */
export function renderPersonaPicker(selected: Persona | null, onChoose: (p: Persona) => void): HTMLDivElement {
  return radioGroup(
    'persona-picker',
    'Persona',
    PERSONAS.map((p) => ({ value: p, text: p })),
    selected,
    onChoose,
  );
}

/** Frankenstein's Book / Movie switch. Sends the register NAME only. */
export function renderRegisterSwitch(selected: Register, onChoose: (r: Register) => void): HTMLDivElement {
  return radioGroup(
    'register-switch',
    'Frankenstein voice',
    [
      { value: 'book', text: 'Book', hint: "The novel's eloquent creature" },
      { value: 'movie', text: 'Movie', hint: 'The film monster' },
    ],
    selected,
    onChoose,
  );
}
