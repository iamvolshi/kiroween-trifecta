// MOCK ASSEMBLY METHODS -- ask / chat / update / lessons / record.
// MOCK: scripted by the scenario cursor, no engine behind it. Not-knowing is
// returned as-is, never filled.

import type {
  AdapterResult,
  AskResult,
  ChatTurn,
  Entry,
  Lesson,
  LessonsInPrompt,
  RecordResult,
  UpdateRequest,
  UpdateResult,
} from './seam';
import type { ScenarioCursor, ScenarioStep } from '../scenario/types.ts';
import { matchesStep, seeksSubjects } from '../scenario/match.ts';
import { currentLesson, currentLessons, lessonsInPrompt } from '../scenario/lessons.ts';
import { compareKStart } from '../util/interval';

export interface AssemblyMethods {
  ask(question: string): Promise<AdapterResult<AskResult>>;
  chat(message: string): Promise<AdapterResult<ChatTurn>>;
  update(req: UpdateRequest): Promise<AdapterResult<UpdateResult>>;
  fetchLessons(): Promise<AdapterResult<Lesson[]>>;
  fetchRecord(accountId: string): Promise<AdapterResult<RecordResult>>;
}

const NOT_KNOWING_FALLBACK = "I don't know. The script has no answer for that. (mock)";
const SCRIPTED_ONLY = 'mock record is scripted: writes come only from the scenario (mock)';

function notKnowing(cursor: ScenarioCursor | null): string {
  return cursor ? cursor.scenario.not_knowing_reply : NOT_KNOWING_FALLBACK;
}

function valueOf(e: Entry): string {
  return e.evidence.replace(/^value=/, '').replace(/ \(mock\)$/, '');
}

function seated(e: Entry): UpdateResult {
  return { kid: e.kid, subject: e.subject, entry_id: e.id, seated: true };
}

const NO_LESSONS: LessonsInPrompt = { subjects: [], injected: [], held: [] };

// Read BEFORE the turn plays: lessons as they stood when the message arrived.
function injectionFor(cursor: ScenarioCursor | null, message: string): LessonsInPrompt {
  if (!cursor) return NO_LESSONS;
  return lessonsInPrompt(cursor.playedSteps(), seeksSubjects(message, cursor.scenario));
}

function play(cursor: ScenarioCursor): ScenarioStep | null {
  return cursor.advance();
}

export function createAssemblyMethods(
  cursor: ScenarioCursor | null,
  readAll: () => Entry[],
): AssemblyMethods {
  return {
    async ask(question: string): Promise<AdapterResult<AskResult>> {
      const next = cursor ? cursor.next() : null;
      if (next && next.erie && matchesStep(question, next)) {
        return { ok: true, data: { ...next.erie, question } };
      }
      return {
        ok: true,
        data: { question, state: 'not_found', text: notKnowing(cursor), provenance: [] },
      };
    },

    async chat(message: string): Promise<AdapterResult<ChatTurn>> {
      const total = cursor ? cursor.total() : 0;
      const next = cursor ? cursor.next() : null;
      const lessons_in_prompt = injectionFor(cursor, message);
      if (!cursor || !next || !matchesStep(message, next)) {
        return {
          ok: true,
          data: {
            message,
            known: false,
            step: null,
            total_steps: total,
            engines: {
              arche: { reply: notKnowing(cursor) },
              erie: null,
              elle: null,
              elle_promoted: null,
              lessons_in_prompt,
              katie: [],
            },
          },
        };
      }
      const step = play(cursor) as ScenarioStep;
      const elle_promoted =
        step.promotes !== null ? currentLesson(cursor.playedSteps(), step.promotes) : null;
      return {
        ok: true,
        data: {
          message,
          known: true,
          step: step.step,
          total_steps: total,
          engines: {
            arche: { reply: step.reply },
            erie: step.erie ? { ...step.erie, question: message } : null,
            elle: step.elle,
            elle_promoted,
            lessons_in_prompt,
            katie: step.entries.map(seated),
          },
        },
      };
    },

    async update(req: UpdateRequest): Promise<AdapterResult<UpdateResult>> {
      if (!Number.isInteger(req.authority) || req.authority < 0 || req.authority > 8) {
        return {
          ok: false,
          error: 'authority out of range: 9 is held for the user; machine writes are 0 to 8 (mock)',
        };
      }
      const next = cursor ? cursor.next() : null;
      const first = next ? next.entries[0] : undefined;
      if (
        !cursor ||
        !first ||
        first.kid !== req.kid ||
        first.subject !== req.subject ||
        first.authority !== req.authority ||
        valueOf(first) !== req.value
      ) {
        return { ok: false, error: SCRIPTED_ONLY };
      }
      cursor.advance();
      return { ok: true, data: seated(first) };
    },

    async fetchLessons(): Promise<AdapterResult<Lesson[]>> {
      const lessons = cursor ? currentLessons(cursor.playedSteps()) : [];
      return { ok: true, data: lessons };
    },

    async fetchRecord(accountId: string): Promise<AdapterResult<RecordResult>> {
      const prefix = `${accountId}.`;
      const fields: Record<string, Entry[]> = {};
      for (const e of readAll()) {
        if (!e.subject.startsWith(prefix)) continue;
        (fields[e.subject] ??= []).push(e);
      }
      for (const subject of Object.keys(fields)) fields[subject].sort(compareKStart);
      return { ok: true, data: { account_id: accountId, fields } };
    },
  };
}
