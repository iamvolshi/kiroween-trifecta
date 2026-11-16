/**
 * Navigation bar shown at the top of every view.
 * Plain links; the Router intercepts plain left clicks.
 */
export function createNav(): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'main-nav';

  const links: Array<[string, string]> = [
    ['/actions', 'Action List'],
    ['/time-travel', 'Time Travel'],
  ];

  for (const [href, text] of links) {
    const a = document.createElement('a');
    a.className = 'nav-link';
    a.setAttribute('href', href);
    a.textContent = text;
    nav.appendChild(a);
  }

  return nav;
}
