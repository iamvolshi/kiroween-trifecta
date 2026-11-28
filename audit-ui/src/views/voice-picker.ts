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

/** One icon per voice, as SVG children (viewBox 0 0 24 24): an open book,
 * a film strip, a top hat. */
const ICONS: Record<Register, Array<[string, Record<string, string>]>> = {
  book: [
    ['path', { d: 'M12 6.5C10 4.8 7 4.2 4 5v13c3-.8 6-.2 8 1.5 2-1.7 5-2.3 8-1.5V5c-3-.8-6-.2-8 1.5z' }],
    ['path', { d: 'M12 6.5V19.5' }],
  ],
  movie: [
    ['rect', { x: '3', y: '5', width: '18', height: '14', rx: '2' }],
    ['path', { d: 'M7.5 5v14M16.5 5v14' }],
    ['path', { d: 'M4.5 8h1.5M4.5 12h1.5M4.5 16h1.5M18 8h1.5M18 12h1.5M18 16h1.5' }],
  ],
  'young-frankenstein': [
    ['path', { d: 'M7 15.5V8a5 5 0 0 1 10 0v7.5' }],
    ['path', { d: 'M7 12h10' }],
    ['rect', { x: '2.5', y: '15.5', width: '19', height: '2.5', rx: '1.2' }],
  ],
};

function icon(register: Register): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of ICONS[register]) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) child.setAttribute(name, value);
    svg.appendChild(child);
  }
  return svg;
}

/**
 * The big picker: "Choose your Frankenstein" over three big tiles in the
 * middle of the chat page, one per voice (Book 1818, Movie 1931, Young
 * 1974), each with its own icon and wearing its own voice's accent when
 * picked. Same radio-group behaviour as the small chips. The chat shows
 * it while the transcript is empty; the small chips stay at the bottom
 * for switching once the conversation is going.
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
  voices.forEach((v, i) => {
    const { tag, year } = VOICE_LABELS[v];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'frankenstein-tile';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(v === selected));
    b.dataset.voice = v;
    b.tabIndex = v === selected || ((selected === null || !voices.includes(selected)) && i === 0) ? 0 : -1;
    b.appendChild(icon(v));
    const t = document.createElement('span');
    t.className = 'frankenstein-tag';
    t.textContent = tag;
    const y = document.createElement('span');
    y.className = 'frankenstein-year';
    y.textContent = year;
    b.append(t, y);
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
  wrap.append(heading, group);
  return wrap;
}
