// LIVE ADAPTER — wires to the trifecta FastAPI service.
// All methods return { ok: false, error: 'Live adapter not wired' } until
// the actual endpoint URL is confirmed and this stub is replaced with real fetch calls.
import type { AdapterResult, Entry, KidMap, SeamAdapter } from './seam';

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
  };
}
