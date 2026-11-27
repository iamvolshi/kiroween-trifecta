// Sherlock's base URL, set at build time as VITE_SHERLOCK_URL (for example in
// audit-ui/.env.local: VITE_SHERLOCK_URL=http://127.0.0.1:8090). Every search
// in the app goes through Sherlock; there is no other address. With no
// address, every call answers that Sherlock is unreachable.
export const SHERLOCK_URL: string = String(import.meta.env.VITE_SHERLOCK_URL ?? '').trim();

// Optional: the case (corpus) to search. Unset = the first ready case Sherlock lists.
export const SHERLOCK_CASE: string = String(import.meta.env.VITE_SHERLOCK_CASE ?? '').trim();
