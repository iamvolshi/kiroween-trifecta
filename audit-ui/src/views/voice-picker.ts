import type { Register } from '../adapter/seam.ts';
import { VOICE_LABELS } from './voices.ts';

/**
 * The voice picker: one small bordered chip per voice, in a row above the
 * composer ("[BOOK] 1818"). A radio group made of real buttons:
 * role=radiogroup, role=radio buttons with aria-checked. Each chip is a Tab
 * stop and answers Enter / Space; Left/Right and Up/Down move to the next
 * chip and pick it.
 */
export function renderVoicePicker(
  voices: readonly Register[],
  selected: Register | null,
  onChoose: (v: Register) => void,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'voice-picker';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Voice');
  voices.forEach((v, i) => {
    const { tag, year } = VOICE_LABELS[v];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'voice-chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === selected));
    b.dataset.voice = v;
    const t = document.createElement('span');
    t.className = 'voice-tag';
    t.textContent = `[${tag}]`;
    const y = document.createElement('span');
    y.className = 'voice-year';
    y.textContent = year;
    b.append(t, ' ', y);
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
  return group;
}
