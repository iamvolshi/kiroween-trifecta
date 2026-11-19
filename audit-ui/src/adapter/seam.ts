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
 * `subject` and `status` were added to the seam 2026-11-16 (GRAY-2); the
 * connector sends `subject` null and `status` 'promoted' (the loop has no
 * subjects for lessons and no held stage).
 */
export interface Lesson {
  event_id: string;
  event_type: string;
  detail: string;
  rule: string | null;
  /** The subject this lesson is about. null = no subject. */
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
  /** Subjects this prompt seeks (the connector sends []). */
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

/** The mask ARCHE runs: Frankenstein, in three voices. The app sends the NAME; the loop owns the voices. */
export type Persona = 'Frankenstein';
export const PERSONAS: readonly Persona[] = ['Frankenstein'];

/** Frankenstein's voice (register): the novel's creature, the film's, or Young Frankenstein's. */
export type Register = 'book' | 'movie' | 'young-frankenstein';
export const REGISTERS: readonly Register[] = ['book', 'movie', 'young-frankenstein'];

export function isRegister(v: unknown): v is Register {
  return typeof v === 'string' && (REGISTERS as readonly string[]).includes(v);
}

/** Sent with every chat call: the mask and the picked voice. */
export interface ChatOptions {
  persona: Persona;
  register?: Register;
}

/**
 * A provenance link span inside the reply text, AUTHORED BY THE RESPONDING
 * SIDE (never derived by matching words at render time). `start`/`end` are
 * offsets into `engines.arche.reply` in UTF-16 code units, end exclusive
 * (JavaScript string indices). Spans must not overlap; a span that is out
 * of range or overlaps an earlier one is rendered as plain text.
 */
export interface ReplyLink {
  start: number;
  end: number;
  /** The record entry the words are grounded in. */
  kid: number;
  subject: string;
  entry_id: string;
}

/** The provider + model that actually served one live turn (from the connector). */
export interface ServedBy {
  provider: string;
  model: string;
}

/** One chat exchange (mirrors POST /chat). */
export interface ChatTurn {
  message: string;
  /** Who served this turn (provider + model), as the connector reports it. */
  served_by?: ServedBy;
  /** false = the responding side had no answer. */
  known: boolean;
  /** Step this turn played (1-based), or null; the connector sends null. */
  step: number | null;
  total_steps: number;
  engines: EngineActivity;
  /** Provenance link spans over `engines.arche.reply`. Absent = no links. */
  links?: ReplyLink[];
}

export interface SeamAdapter {
  fetchAllEntries(): Promise<AdapterResult<Entry[]>>;
  fetchBeliefPool(momentMs: number): Promise<AdapterResult<Entry[]>>;
  fetchChain(kid: number, subject: string): Promise<AdapterResult<Entry[]>>;
  fetchKidMap(): Promise<AdapterResult<KidMap>>;

  /** ERIE retrieval + provenance (POST /ask). */
  ask(question: string): Promise<AdapterResult<AskResult>>;
  /**
   * One chat turn (POST /chat). `options` carries the persona name (and the
   * Frankenstein register); the live adapter sends it with every call.
   */
  chat(message: string, options?: ChatOptions): Promise<AdapterResult<ChatTurn>>;
  /** KATIE write (POST /update). The UI never calls this; the agent does. */
  update(req: UpdateRequest): Promise<AdapterResult<UpdateResult>>;
  /** ELLE lessons so far (GET /lessons). */
  fetchLessons(): Promise<AdapterResult<Lesson[]>>;
  /** Entries for one account, grouped by subject (GET /record/{account_id}). */
  fetchRecord(accountId: string): Promise<AdapterResult<RecordResult>>;
}

/** True when `v` has the ChatTurn fields the app renders; a connector reply without them is refused. */
export function isChatTurn(v: unknown): v is ChatTurn {
  const t = v as ChatTurn | null;
  return (
    typeof t === 'object' && t !== null &&
    typeof t.message === 'string' &&
    typeof t.known === 'boolean' &&
    typeof t.engines === 'object' && t.engines !== null &&
    typeof t.engines.arche?.reply === 'string' &&
    Array.isArray(t.engines.katie) &&
    typeof t.engines.lessons_in_prompt === 'object' && t.engines.lessons_in_prompt !== null &&
    Array.isArray(t.engines.lessons_in_prompt.injected) &&
    Array.isArray(t.engines.lessons_in_prompt.held) &&
    (t.links === undefined || Array.isArray(t.links)) &&
    (t.served_by === undefined || isServedBy(t.served_by))
  );
}

/** True when `v` names a provider and a model, both non-empty strings. */
export function isServedBy(v: unknown): v is ServedBy {
  const s = v as ServedBy | null;
  return (
    typeof s === 'object' && s !== null &&
    typeof s.provider === 'string' && s.provider !== '' &&
    typeof s.model === 'string' && s.model !== ''
  );
}
