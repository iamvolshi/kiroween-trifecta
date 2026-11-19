import { CONNECTOR_URL } from '../adapter/connector-url.ts';

export interface ShellSlots {
  /** The icon rail (far left). */
  rail: HTMLElement;
  /** The list panel the rail swaps (Chat's is the directories column). */
  left: HTMLElement;
  center: HTMLElement;
  right: HTMLElement;
  /** The header's "View: <name>" label; set by `setViewLabel`. */
  view: HTMLElement;
}

/**
 * Builds the shell once: the icon rail, the list panel (left), the routed
 * View (center), telemetry (right). The Router mounts the panels into the
 * side columns.
 */
export function createShell(container: HTMLElement): ShellSlots {
  container.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'shell';

  // Skip link: first Tab stop, jumps keyboard focus past the left column.
  // Handled here (no hash change), so the router never re-resolves on it.
  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.setAttribute('href', '#main-view');
  skip.textContent = 'Skip to the view';

  // Presentational header: the app's name, the seam it reads, and where you are.
  const brand = document.createElement('header');
  brand.className = 'shell-brand';
  const mark = document.createElement('span');
  mark.className = 'brand-mark';
  mark.textContent = 'Hackenstein';
  const tag = document.createElement('span');
  tag.className = 'brand-tag';
  tag.textContent = 'What did the agent do, and what did it believe when it did it?';
  // Seam chip: the app is live-only; it says when no connector address was set.
  const seam = document.createElement('span');
  seam.className = 'seam-chip';
  seam.dataset.seam = CONNECTOR_URL === '' ? 'no-address' : 'live';
  seam.textContent =
    CONNECTOR_URL === '' ? 'Seam: live adapter. No connector address set.' : 'Seam: live adapter, active.';
  // Current view: set in JS from the mounted view's own intro (setViewLabel).
  const view = document.createElement('span');
  view.className = 'brand-view';
  view.setAttribute('aria-hidden', 'true');
  view.hidden = true;
  brand.append(mark, tag, seam, view);

  const rail = document.createElement('aside');
  rail.className = 'shell-rail';
  rail.setAttribute('aria-label', 'Panels');

  const left = document.createElement('aside');
  left.className = 'shell-left';
  left.setAttribute('aria-label', 'Directories');

  const center = document.createElement('main');
  center.className = 'shell-center';
  center.id = 'main-view';
  center.tabIndex = -1;
  center.setAttribute('aria-label', 'View');

  const right = document.createElement('aside');
  right.className = 'shell-right';
  right.setAttribute('aria-label', 'Telemetry');

  skip.addEventListener('click', (e) => {
    e.preventDefault();
    center.focus();
  });

  shell.append(skip, brand, rail, left, center, right);
  container.appendChild(shell);
  return { rail, left, center, right, view };
}

/**
 * Sets the header's "View: <name>" from the view mounted in the center
 * (the first data-view in it: an intro's, or the chat view's own). A view
 * without one hides the label rather than showing a bare "View:".
 */
export function setViewLabel(slots: ShellSlots): void {
  const name = slots.center.querySelector<HTMLElement>('[data-view]')?.dataset.view ?? '';
  slots.view.textContent = name ? `View: ${name}` : '';
  slots.view.hidden = name === '';
}
