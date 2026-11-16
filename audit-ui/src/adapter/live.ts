// LIVE ADAPTER — wires to the trifecta FastAPI service.
// All methods return { ok: false, error: 'Live adapter not wired' } until
// the actual endpoint URL is confirmed and this stub is replaced with real fetch calls.
import type {
  AdapterResult,
  AskResult,
  ChatTurn,
  Entry,
  KidMap,
  Lesson,
  RecordResult,
  SeamAdapter,
  UpdateRequest,
  UpdateResult,
} from './seam';

const NOT_WIRED = Object.freeze({ ok: false as const, error: 'Live adapter not wired' });

export function createLiveAdapter(baseUrl: string): SeamAdapter {
  return {
    async fetchAllEntries(): Promise<AdapterResult<Entry[]>> {
      // TODO: Wire when live seam is confirmed (trifecta /record vs katied API — unresolved GRAY)
      // const url = `${baseUrl}/record`;
      // try {
      //   const res = await fetch(url);
      //   if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
      //   const data: Entry[] = await res.json();
      //   return { ok: true, data };
      // } catch (e) {
      //   return { ok: false, error: (e as Error).message };
      // }
      void baseUrl;
      return { ok: false, error: 'Live adapter not wired' };
    },

    async fetchBeliefPool(momentMs: number): Promise<AdapterResult<Entry[]>> {
      // TODO: Wire when live seam is confirmed (trifecta /record vs katied API — unresolved GRAY)
      // const url = `${baseUrl}/record?moment=${momentMs}`;
      // try {
      //   const res = await fetch(url);
      //   if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
      //   const data: Entry[] = await res.json();
      //   return { ok: true, data };
      // } catch (e) {
      //   return { ok: false, error: (e as Error).message };
      // }
      void baseUrl;
      void momentMs;
      return { ok: false, error: 'Live adapter not wired' };
    },

    async fetchChain(kid: number, subject: string): Promise<AdapterResult<Entry[]>> {
      // TODO: Wire when live seam is confirmed (trifecta /record vs katied API — unresolved GRAY)
      // const url = `${baseUrl}/record/${kid}/${encodeURIComponent(subject)}`;
      // try {
      //   const res = await fetch(url);
      //   if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
      //   const data: Entry[] = await res.json();
      //   return { ok: true, data };
      // } catch (e) {
      //   return { ok: false, error: (e as Error).message };
      // }
      void baseUrl;
      void kid;
      void subject;
      return { ok: false, error: 'Live adapter not wired' };
    },

    async fetchKidMap(): Promise<AdapterResult<KidMap>> {
      // TODO: Wire when live seam is confirmed (trifecta /record vs katied API — unresolved GRAY)
      // const url = `${baseUrl}/kid-map`;
      // try {
      //   const res = await fetch(url);
      //   if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
      //   const data: KidMap = await res.json();
      //   return { ok: true, data };
      // } catch (e) {
      //   return { ok: false, error: (e as Error).message };
      // }
      void baseUrl;
      return { ok: false, error: 'Live adapter not wired' };
    },

    // Assembly methods: stubs until the live seam is confirmed (unresolved GRAY).
    async ask(question: string): Promise<AdapterResult<AskResult>> {
      void baseUrl;
      void question;
      return NOT_WIRED;
    },

    async chat(message: string): Promise<AdapterResult<ChatTurn>> {
      void baseUrl;
      void message;
      return NOT_WIRED;
    },

    async update(req: UpdateRequest): Promise<AdapterResult<UpdateResult>> {
      void baseUrl;
      void req;
      return NOT_WIRED;
    },

    async fetchLessons(): Promise<AdapterResult<Lesson[]>> {
      void baseUrl;
      return NOT_WIRED;
    },

    async fetchRecord(accountId: string): Promise<AdapterResult<RecordResult>> {
      void baseUrl;
      void accountId;
      return NOT_WIRED;
    },
  };
}
