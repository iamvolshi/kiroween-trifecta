// The "Attach local drive" control under the GitHub one in the left column: download Rosie,
// pair her with a short code, choose a folder on your own computer, then ask it. Read only
// and in words. Rosie is a small program on the person's computer; Sherlock never reaches in.
import { rosieErrorWords, type RosieStatus } from '../adapter/rosie-client.ts';
import type { RepoSession } from './repo-session.ts';
import type { RosieSession } from './rosie-session.ts';

/** The draft release asset for tag rosie-v0.1.0 in iamvolshi/scribe (a draft until Darren publishes it). */
export const ROSIE_DOWNLOAD_URL = 'https://github.com/iamvolshi/scribe/releases/download/rosie-v0.1.0/Rosie.exe';

export const READ_ONLY_WORDS = 'Rosie only reads. She never changes, deletes or runs anything on your computer, and she reads only the one folder you choose.';
export const NOT_LIVE_WORDS = 'If GitHub says the file is not found, the Rosie download is not published yet. Try again later.';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** One line for where the folder is. Empty when there is nothing to say. */
export function rosieWords(s: RosieStatus): string {
  switch (s.state) {
    case 'not_paired': return '';
    case 'asleep': return 'Rosie is asleep, start her again on your computer.';
    case 'connected': return 'Rosie is connected. Choose a folder.';
    case 'choosing_folder': return 'Rosie is waiting for you to pick a folder on your computer.';
    case 'reading': return `Rosie is reading your folder (${s.files_read} files so far).`;
    case 'indexing': return `Sherlock is indexing ${s.files_read} files.`;
    case 'ready':
      return `Ready. ${s.files_read} files read, ${s.files_skipped} skipped, ${s.passages} passages.` +
        (s.truncated ? ' The folder is bigger than the limits, so only part of it was read.' : '') +
        (s.connection === 'asleep' ? ' Rosie is asleep, but your folder is still here.' : '');
    default: return '';
  }
}

/** "K7QM-X2RD" as typed or shown; the dash is optional when typing it into Rosie. */
const plainCode = (code: string): string => code.replace('-', '');

function problem(rosie: RosieSession): string {
  if (rosie.error !== '') return rosie.error;
  const e = rosie.status?.state === 'failed' ? rosie.status.error : null;
  return e ? rosieErrorWords(e.code, e.message) : '';
}

/**
 * Draws the control into `slot` and redraws whenever the session changes.
 * Returns the unsubscribe. Starts the status poll for a person who paired before.
 */
export function mountRosiePanel(slot: HTMLElement, repo: RepoSession): () => void {
  const rosie = repo.rosie;
  if (!rosie) return () => {};
  let open = false;

  const draw = (): void => {
    const s = rosie.status;
    const bar = el('div', 'rosie-bar');
    bar.dataset.source = repo.source;

    const dl = el('a', 'rosie-download', 'Download Rosie bridge');
    dl.href = ROSIE_DOWNLOAD_URL;
    dl.target = '_blank';
    dl.rel = 'noopener noreferrer';
    dl.title = NOT_LIVE_WORDS;
    const attach = el('button', 'rosie-attach-btn', s?.state === 'ready' ? 'Change folder' : 'Attach local drive');
    attach.type = 'button';
    attach.setAttribute('aria-expanded', String(open));
    attach.addEventListener('click', () => { open = !open; draw(); });
    bar.append(dl, attach);

    if (s?.state === 'ready') {
      const group = el('div', 'rosie-source');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'What the chat asks');
      const book = el('button', 'rosie-source-btn', 'Ask the book');
      book.type = 'button';
      book.dataset.source = 'book';
      book.setAttribute('aria-pressed', String(repo.source !== 'folder'));
      book.addEventListener('click', () => repo.setSource('book'));
      const mine = el('button', 'rosie-source-btn', `Ask ${s.folder ?? 'my folder'}`);
      mine.type = 'button';
      mine.dataset.source = 'folder';
      mine.setAttribute('aria-pressed', String(repo.source === 'folder'));
      mine.addEventListener('click', () => repo.setSource('folder'));
      group.append(book, mine);
      const detach = el('button', 'rosie-detach-btn', 'Detach');
      detach.type = 'button';
      detach.disabled = rosie.busy;
      detach.addEventListener('click', () => void rosie.detach());
      bar.prepend(group);
      bar.appendChild(detach);
    }

    const nodes: HTMLElement[] = [bar];

    const showSteps = open || rosie.pairing !== null || (rosie.paired && s?.state !== 'ready');
    if (showSteps) {
      const box = el('div', 'rosie-steps');
      box.appendChild(el('p', 'rosie-note', READ_ONLY_WORDS));
      if (rosie.pairing) {
        const code = el('p', 'rosie-code', rosie.pairing.code);
        code.setAttribute('aria-label', `Pairing code ${rosie.pairing.code.split('').join(' ')}`);
        box.append(
          code,
          el('p', 'rosie-note', `Start Rosie with this code: Rosie.exe ${rosie.pairing.code}. Or save her as Rosie-${plainCode(rosie.pairing.code)}.exe and open that. The code works once, for 10 minutes.`),
          el('p', 'rosie-note', NOT_LIVE_WORDS),
        );
      } else if (!rosie.paired) {
        const get = el('button', 'rosie-go', 'Get a pairing code');
        get.type = 'button';
        get.disabled = rosie.busy;
        get.addEventListener('click', () => void rosie.pair());
        box.append(el('p', 'rosie-note', 'Rosie is not paired yet. Download her, then get a pairing code.'), get);
      } else if (s) {
        const acts: HTMLElement[] = [];
        const choose = el('button', 'rosie-go', s.state === 'ready' ? 'Choose another folder' : 'Choose folder');
        choose.type = 'button';
        choose.disabled = rosie.busy || s.state === 'reading' || s.state === 'indexing' || s.state === 'choosing_folder';
        choose.addEventListener('click', () => { open = false; void rosie.chooseFolder(); });
        const unpair = el('button', 'rosie-unpair-btn', 'Unpair Rosie');
        unpair.type = 'button';
        unpair.disabled = rosie.busy;
        unpair.addEventListener('click', () => void rosie.unpair());
        acts.push(choose, unpair);
        if (s.connection === 'asleep' && s.state !== 'ready') {
          choose.disabled = true;
        }
        box.append(...acts);
      }
      nodes.push(box);
    }

    if (s && rosieWords(s) !== '' && s.state !== 'failed') {
      const p = el('p', 'rosie-progress', rosieWords(s));
      p.dataset.state = s.state;
      p.setAttribute('role', 'status');
      nodes.push(p);
    }
    const bad = problem(rosie);
    if (bad !== '') {
      const p = el('p', 'error-state rosie-error', bad);
      p.setAttribute('role', 'alert');
      nodes.push(p);
    }
    slot.replaceChildren(...nodes);
  };

  draw();
  return rosie.subscribe(draw);
}
