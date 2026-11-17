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

/**
 * An ELLE lesson (mirrors one item of GET /lessons).
 * `subject` and `status` are a MOCK extension decided 2026-11-16 (GRAY-2):
 * the trifecta /lessons shape does not carry them today.
 */
export interface Lesson {
  event_id: string;
  event_type: string;
  detail: string;
  rule: string | null;
  /** The subject this lesson is about, named by the script (mock). null = no subject. */
  subject: string | null;
  /**
   * 'candidate' = recorded but not learned yet: shown grey, never injected.
   * 'promoted'  = learned: injected into any prompt that seeks its subject.
   * Promotion is a new event; the recorded lesson is never edited.
   */
  status: 'candidate' | 'promoted';
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

/** Lessons on the subjects one prompt seeks, read BEFORE the turn plays. */
export interface LessonsInPrompt {
  /** Subjects this prompt seeks (mock: matched by the script's subject keywords). */
  subjects: string[];
  /** Promoted lessons on those subjects: injected into this prompt. */
  injected: Lesson[];
  /** Candidate lessons on those subjects: held back, not learned yet. */
  held: Lesson[];
}

/** What each engine did on one chat turn. null means the engine did not act. */
export interface EngineActivity {
  arche: { reply: string };          // ARCHE talked (always acts)
  erie: AskResult | null;            // ERIE found
  elle: Lesson | null;               // ELLE recorded a lesson (as a candidate)
  elle_promoted: Lesson | null;      // ELLE promoted a lesson on this turn (now learned)
  lessons_in_prompt: LessonsInPrompt; // ELLE: what was injected into this prompt
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
