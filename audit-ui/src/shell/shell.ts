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

  // Presentational header: the app's name and the question it answers.
  const brand = document.createElement('header');
  brand.className = 'shell-brand';
  const mark = document.createElement('span');
  mark.className = 'brand-mark';
  mark.textContent = 'Audit UI';
  const tag = document.createElement('span');
  tag.className = 'brand-tag';
  tag.textContent = 'What did the agent do, and what did it believe when it did it?';
  brand.append(mark, tag);

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
