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
  /**
   * The case file, record order: the entries under the subject, and the
   * entries the standing folder points at (its `case_file` event ids, the
   * turns the Curator read the subject from). Only entries in the record;
   * a pointer the record does not hold is left out, never invented.
   */
  caseFile: Entry[];
}

/** The catalog from the live entries, in the order Curator filed the folders. */
export function catalog(entries: Entry[]): CuratorFolder[] {
  const versions = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!isFolder(e)) continue;
    const subject = e.subject.slice(FOLDER_PREFIX.length);
    const list = versions.get(subject);
    if (list) list.push(e);
    else versions.set(subject, [e]);
  }
  return [...versions.entries()].map(([subject, vs]) => {
    const folder = vs[vs.length - 1]!;
    const pointed = new Set(folder.case_file ?? []);
    const caseFile = entries.filter((e) => !isWorkspace(e) && (e.subject === subject || e.subject.startsWith(subject + '.') || pointed.has(e.id)));
    return { subject, folder, versions: vs, caseFile };
  });
}
