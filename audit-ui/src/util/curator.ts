import type { Entry } from '../adapter/seam.ts';

/**
 * Curator's folders in the record (bots: engines/curator.py). Each folder
 * is an entry with subject "curator-folder-<subject>", born with its own
 * KID; a change is a new folder entry, so a subject can have several, in
 * record order, the last one standing.
 */
export const FOLDER_PREFIX = 'curator-folder-';

/** ELLE's question folders: hers, listed on the Lessons page. */
export const QUESTION_PREFIX = 'elle-question-';

/** A workspace entry (a Curator folder or an ELLE question), never a subject. */
export function isWorkspace(e: Entry): boolean {
  return e.subject.startsWith(FOLDER_PREFIX) || e.subject.startsWith(QUESTION_PREFIX);
}

export function isFolder(e: Entry): boolean {
  return e.subject.startsWith(FOLDER_PREFIX);
}

export interface CuratorFolder {
  /** The subject the folder files. */
  subject: string;
  /** The folder entry standing now (the newest). */
  folder: Entry;
  /** Every folder entry for this subject, oldest first (more than one = re-filed). */
  versions: Entry[];
  /** The entries under the subject, record order: the case file. */
  caseFile: Entry[];
}

/** The catalog from the live entries, in the order Curator filed the folders. */
export function catalog(entries: Entry[]): CuratorFolder[] {
  const versions = new Map<string, Entry[]>();
  const bySubject = new Map<string, Entry[]>();
  for (const e of entries) {
    if (isFolder(e)) {
      const subject = e.subject.slice(FOLDER_PREFIX.length);
      const list = versions.get(subject);
      if (list) list.push(e);
      else versions.set(subject, [e]);
    } else {
      const list = bySubject.get(e.subject);
      if (list) list.push(e);
      else bySubject.set(e.subject, [e]);
    }
  }
  return [...versions.entries()].map(([subject, vs]) => ({
    subject,
    folder: vs[vs.length - 1]!,
    versions: vs,
    caseFile: bySubject.get(subject) ?? [],
  }));
}
