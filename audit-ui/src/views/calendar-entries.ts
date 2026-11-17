import type { Entry, KidMap } from '../adapter/seam.ts';
import { renderKid } from '../util/kid-display.ts';

/** Column order for the hour view's entry tables: [header, cell class]. */
const COLUMNS: Array<[string, string]> = [
  ['KID', 'kid'],
  ['Subject', 'subject'],
  ['State', 'state'],
  ['Authority (0-9)', 'authority'],
  ['Evidence', 'evidence'],
  ['Reason', 'reason'],
];

function cell(className: string, text: string): HTMLTableCellElement {
  return Object.assign(document.createElement('td'), { className, textContent: text });
}

/**
 * Entries as a table: column headers on top, one row per entry. Each row has
 * one link to its Entry Detail (in the KID cell; CSS stretches it over the
 * row), so a row is one click target and one tab stop. Data via textContent.
 */
export function renderEntryTable(
  entries: Entry[],
  kidMap: KidMap | null,
  label: string,
): HTMLTableElement {
  const table = document.createElement('table');
  table.className = 'entry-table';
  table.setAttribute('aria-label', label);

  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const [title, cls] of COLUMNS) {
    const th = Object.assign(document.createElement('th'), { className: `col-${cls}`, textContent: title });
    th.setAttribute('scope', 'col');
    headRow.appendChild(th);
  }
  head.appendChild(headRow);
  table.appendChild(head);

  const body = document.createElement('tbody');
  for (const entry of entries) {
    const tr = document.createElement('tr');
    tr.className = 'entry-row';

    const kid = document.createElement('td');
    kid.className = 'kid';
    const a = document.createElement('a');
    a.setAttribute(
      'href',
      `/entry/${entry.kid}/${encodeURIComponent(entry.subject)}/${encodeURIComponent(entry.id)}`,
    );
    a.textContent = renderKid(entry.kid, kidMap);
    kid.appendChild(a);
    tr.appendChild(kid);

    tr.appendChild(cell('subject', entry.subject));
    tr.appendChild(cell('state', entry.state));
    tr.appendChild(cell('authority', String(entry.authority)));
    tr.appendChild(cell('evidence', entry.evidence));
    tr.appendChild(cell('reason', entry.reason));
    body.appendChild(tr);
  }
  table.appendChild(body);
  return table;
}
