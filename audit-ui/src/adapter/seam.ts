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

// ---------------------------------------------------------------------------
// Assembly shapes. These mirror the trifecta service endpoints by SHAPE only
// (/ask, /chat, /update, /lessons, /record). No engine code lives here.
// ---------------------------------------------------------------------------

/** One piece of supporting evidence ERIE found (mirrors /ask provenance). */
export interface Provenance {
  source: string;  // where it came from
  content: string; // what object it points at
  excerpt: string; // the supporting text
}

/** ERIE retrieval result (mirrors POST /ask). */
export interface AskResult {
  question: string;
  state: 'found' | 'not_found';
  text: string;
  provenance: Provenance[];
}

/** An ELLE lesson (mirrors one item of GET /lessons). */
export interface Lesson {
  event_id: string;
  event_type: string;
  detail: string;
  rule: string | null;
}

/** A KATIE write request (mirrors POST /update). Authority 0..9; the machine ceiling is 8. */
export interface UpdateRequest {
  kid: number;
  subject: string;
  value: string;
  reason: string;
  authority: number;
}

/** A KATIE write result (mirrors the /update response). */
export interface UpdateResult {
  kid: number;
  subject: string;
  entry_id: string;
  seated: boolean;
}

/** The record for one account (mirrors GET /record/{account_id}): entries grouped by subject. */
export interface RecordResult {
  account_id: string;
  fields: Record<string, Entry[]>;
}

/** What each engine did on one chat turn. null means the engine did not act. */
export interface EngineActivity {
  arche: { reply: string };          // ARCHE talked (always acts)
  erie: AskResult | null;            // ERIE found
  elle: Lesson | null;               // ELLE learned
  katie: UpdateResult[];             // KATIE recorded (empty = did not act)
}

/** One chat exchange (mirrors POST /chat). */
export interface ChatTurn {
  message: string;
  /** false = the script had no answer; the reply is the scripted not-knowing reply. */
  known: boolean;
  /** Scenario step this turn played (1-based), or null when nothing advanced. */
  step: number | null;
  total_steps: number;
  engines: EngineActivity;
}

export interface SeamAdapter {
  fetchAllEntries(): Promise<AdapterResult<Entry[]>>;
  fetchBeliefPool(momentMs: number): Promise<AdapterResult<Entry[]>>;
  fetchChain(kid: number, subject: string): Promise<AdapterResult<Entry[]>>;
  fetchKidMap(): Promise<AdapterResult<KidMap>>;

  /** ERIE retrieval + provenance (POST /ask). */
  ask(question: string): Promise<AdapterResult<AskResult>>;
  /** ARCHE turn (POST /chat). */
  chat(message: string): Promise<AdapterResult<ChatTurn>>;
  /** KATIE write (POST /update). The UI never calls this; the agent does. */
  update(req: UpdateRequest): Promise<AdapterResult<UpdateResult>>;
  /** ELLE lessons so far (GET /lessons). */
  fetchLessons(): Promise<AdapterResult<Lesson[]>>;
  /** Entries for one account, grouped by subject (GET /record/{account_id}). */
  fetchRecord(accountId: string): Promise<AdapterResult<RecordResult>>;
}
