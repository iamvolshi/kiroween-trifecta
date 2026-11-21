/** True when path is the destination href or sits under it (/calendar/2026/11). */
function isCurrent(path: string, href: string): boolean {
  return path === href || path.startsWith(href + '/');
}

/**
 * Navigation, built once in the shell's left column (not by each view).
 * Plain links; the Router intercepts plain left clicks.
 */
export function createNav(currentPath: string | null = null): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'main-nav';

  const links: Array<[string, string]> = [
    ['/chat', 'Chat'],
    ['/actions', 'Action List'],
    ['/calendar', 'Calendar'],
    ['/research', 'Research'],
  ];

  for (const [href, text] of links) {
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.setAttribute('href', href);
    a.textContent = text;
    if (currentPath !== null && isCurrent(currentPath, href)) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }

  return nav;
}
