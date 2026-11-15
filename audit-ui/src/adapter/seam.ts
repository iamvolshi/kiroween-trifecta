export interface Entry {
  id: string;        // unique row ID
  kid: number;       // KID is a number, never a name
  subject: string;
  state: string;     // e.g. "confirmed", "rejected", "revised", "contradicted"
  authority: number; // 0–9 scale
  pool: string;
  k_start: string;   // ISO-8601 or Unix ms string — start of live interval
  t_time: string;    // wall time (distinct from e_time and k_time)
  e_time: string;    // event time
  k_time: string;    // knowledge time — end of live interval (exclusive)
  evidence: string;
  reason: string;
  prev_hash: string;
}

export type KidMap = Record<number, string>;

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface SeamAdapter {
  fetchAllEntries(): Promise<AdapterResult<Entry[]>>;
  fetchBeliefPool(momentMs: number): Promise<AdapterResult<Entry[]>>;
  fetchChain(kid: number, subject: string): Promise<AdapterResult<Entry[]>>;
  fetchKidMap(): Promise<AdapterResult<KidMap>>;
}
