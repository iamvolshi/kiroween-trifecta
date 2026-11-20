import type { Register } from '../adapter/seam.ts';
import type { Announcement } from './model-announce.ts';
import { VOICE_LABELS } from './voices.ts';

/**
 * The voice picker: a "Pick your Frankenstein" label over one small bordered
 * chip per voice, in a row above the composer ("[BOOK] 1818"). The picked
 * voice's live model rides at the row's right end (`announcement`, null
 * before a voice is picked: then the row is chips only). A radio group made
 * of real buttons: role=radiogroup (labelled by the caption), role=radio
 * buttons with aria-checked. One Tab stop (the picked chip, else the first:
 * a roving tabindex); Enter / Space pick; Left/Right and Up/Down move to the
 * next chip and pick it.
 */
export function renderVoicePicker(
  voices: readonly Register[],
  selected: Register | null,
  onChoose: (v: Register) => void,
  announcement: Announcement | null = null,
): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'voice-picker-wrap';
  const label = document.createElement('p');
  label.className = 'voice-picker-label';
  label.id = 'voice-picker-label';
  label.textContent = 'Pick your Frankenstein';
  const group = document.createElement('div');
  group.className = 'voice-picker';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', 'voice-picker-label');
  voices.forEach((v, i) => {
    const { tag, year } = VOICE_LABELS[v];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'voice-chip';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === selected));
    b.dataset.voice = v;
    b.tabIndex = v === selected || ((selected === null || !voices.includes(selected)) && i === 0) ? 0 : -1;
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
  if (announcement !== null) {
    const m = document.createElement('span');
    m.className = 'voice-model';
    m.dataset.state = announcement.state;
    m.textContent = announcement.model;
    group.appendChild(m);
  }
  wrap.append(label, group);
  return wrap;
}
