/**
 * The subpath the app is served under, from Vite's BASE_URL: '/' at root
 * (Netlify), '/hackenstein-katie-preview/' on GitHub Pages. The router
 * matches on app paths (no base); the browser's address bar carries the
 * base. Both helpers take the base explicitly so tests can pass one in;
 * production call sites use the built one.
 */
export function appBase(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.length > 1 && base.endsWith('/') ? base.slice(0, -1) : base;
}

/** Browser URL path -> app path: strip the base ('/hackenstein-katie-preview/calendar' -> '/calendar'). */
export function stripBase(path: string, base: string = appBase()): string {
  if (base === '/') return path;
  if (path === base) return '/';
  if (path.startsWith(base + '/')) return path.slice(base.length);
  return path;
}

/** App path -> browser URL path: prepend the base ('/calendar' -> '/hackenstein-katie-preview/calendar'). */
export function withBase(path: string, base: string = appBase()): string {
  if (base === '/') return path;
  return base + (path.startsWith('/') ? path : `/${path}`);
}
