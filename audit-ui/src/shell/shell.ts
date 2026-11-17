import { ACTIVE_ADAPTER_KIND } from '../adapter/active.ts';

export interface ShellSlots {
  left: HTMLElement;
  center: HTMLElement;
  right: HTMLElement;
}

/**
 * Builds the three-column shell once: directories (left), the routed View
 * (center), telemetry (right). The Router mounts the panels into the side
 * columns.
 */
export function createShell(container: HTMLElement): ShellSlots {
  container.innerHTML = '';
  const shell = document.createElement('div');
  shell.className = 'shell';

  // Presentational header: the app's name, the seam it reads, and where you are.
  const brand = document.createElement('header');
  brand.className = 'shell-brand';
  const mark = document.createElement('span');
  mark.className = 'brand-mark';
  mark.textContent = 'Audit UI';
  const tag = document.createElement('span');
  tag.className = 'brand-tag';
  tag.textContent = 'What did the agent do, and what did it believe when it did it?';
  // Seam chip: states the active adapter in words, from ACTIVE_ADAPTER_KIND.
  const seam = document.createElement('span');
  seam.className = 'seam-chip';
  seam.dataset.seam = ACTIVE_ADAPTER_KIND;
  seam.textContent =
    ACTIVE_ADAPTER_KIND === 'mock'
      ? 'Seam: mock adapter, active. Record is a scripted scenario.'
      : 'Seam: live adapter, active.';
  // Current view: filled by CSS from the view's own intro (data-view), no logic.
  const view = document.createElement('span');
  view.className = 'brand-view';
  view.setAttribute('aria-hidden', 'true');
  brand.append(mark, tag, seam, view);

  const left = document.createElement('aside');
  left.className = 'shell-left';
  left.setAttribute('aria-label', 'Directories');

  const center = document.createElement('main');
  center.className = 'shell-center';
  center.setAttribute('aria-label', 'View');

  const right = document.createElement('aside');
  right.className = 'shell-right';
  right.setAttribute('aria-label', 'Telemetry');

  shell.append(brand, left, center, right);
  container.appendChild(shell);
  return { left, center, right };
}
