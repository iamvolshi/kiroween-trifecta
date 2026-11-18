// The connector's base URL, set at build time as VITE_CONNECTOR_URL (for
// example in audit-ui/.env.local: VITE_CONNECTOR_URL=http://127.0.0.1:8787).
// The app is live-only: with no address, every call answers that the
// connector is unreachable. No backend address is written here.
export const CONNECTOR_URL: string = String(import.meta.env.VITE_CONNECTOR_URL ?? '').trim();
