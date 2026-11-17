import { ACTIVE_ADAPTER_KIND } from '../adapter/active.ts';

/** True when path is the destination href or sits under it (/calendar/2026/11). */
function isCurrent(path: string, href: string): boolean {
  return path === href || path.startsWith(href + '/');
}

/**
 * Navigation, built once in the shell's left column (not by each view).
 * Plain links; the Router intercepts plain left clicks.
 * Carries a visible data-source label: while the mock adapter is active the
 * chrome says MOCK DATA, so mock never reads as the live record.
 */
export function createNav(currentPath: string | null = null): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'main-nav';

  const links: Array<[string, string]> = [
    ['/actions', 'Action List'],
    ['/time-travel', 'Time Travel'],
    ['/chat', 'Chat'],
    ['/calendar', 'Calendar'],
  ];

  for (const [href, text] of links) {
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.setAttribute('href', href);
    a.textContent = text;
    if (currentPath !== null && isCurrent(currentPath, href)) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }

  if (ACTIVE_ADAPTER_KIND === 'mock') {
    const badge = document.createElement('span');
    badge.className = 'mock-badge';
    badge.textContent = 'MOCK DATA: scripted scenario, not the live record';
    nav.appendChild(badge);
  }

  return nav;
}
