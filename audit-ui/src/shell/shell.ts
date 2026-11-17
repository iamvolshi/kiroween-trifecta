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

  const left = document.createElement('aside');
  left.className = 'shell-left';
  left.setAttribute('aria-label', 'Directories');

  const center = document.createElement('main');
  center.className = 'shell-center';

  const right = document.createElement('aside');
  right.className = 'shell-right';
  right.setAttribute('aria-label', 'Telemetry');

  shell.append(left, center, right);
  container.appendChild(shell);
  return { left, center, right };
}
