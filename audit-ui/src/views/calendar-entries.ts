import type { Entry, KidMap } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';

function span(className: string, text: string): HTMLSpanElement {
  return Object.assign(document.createElement('span'), { className, textContent: text });
}

/** A list of entries, each linking to Entry Detail. Data goes in via textContent. */
export function renderEntryList(entries: Entry[], kidMap: KidMap | null): HTMLUListElement {
  const ul = document.createElement('ul');
  ul.className = 'calendar-entries';
  for (const entry of entries) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.setAttribute(
      'href',
      `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${encodeURIComponent(entry.id)}`,
    );
    a.appendChild(span('kid', renderKid(entry.kid, kidMap)));
    a.appendChild(span('subject', entry.subject));
    a.appendChild(span('state', entry.state));
    a.appendChild(span('authority', String(entry.authority)));
    a.appendChild(span('evidence', entry.evidence));
    a.appendChild(span('reason', entry.reason));
    li.appendChild(a);
    ul.appendChild(li);
  }
  return ul;
}
