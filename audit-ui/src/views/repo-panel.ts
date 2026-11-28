// The "Attach GitHub repo" control above the composer: the form, the progress from
// /status, the error in words, the source switch (book or repo) and Detach.
// Also how a repo answer is drawn: each citation shows its file path and KID.
import type { AskResult } from '../adapter/seam.ts';
import { errorWords, type RepoAnswer, type RepoStatus } from '../adapter/github-client.ts';
import { answerNotes } from '../util/sherlock-notes.ts';
import { renderKid } from '../util/kid-display.ts';
import type { RepoSession, RepoTurn } from './repo-session.ts';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** One line of progress for a repo that is not ready yet, or a summary when it is. */
export function progressWords(s: RepoStatus): string {
  const where = `${s.repo}${s.branch ? ` (${s.branch})` : ''}${s.folder ? ` / ${s.folder}` : ''}`;
  const files = `${s.files_ingested} of ${s.files_listed} files read`;
  switch (s.state) {
    case 'queued': return `Waiting to read ${where}.`;
    case 'fetching': return `Fetching ${where}: ${files}.`;
    case 'indexing': return `Indexing ${where}: ${files}, ${s.passages} passages so far.`;
    case 'ready':
      return `Ready: ${where}. ${s.files_ingested} files read, ${s.files_skipped} skipped, ${s.passages} passages.` +
        (s.truncated ? ' The repo is bigger than the limits, so only part of it was read.' : '');
    case 'failed': return `Could not read ${where}.`;
    default: return '';
  }
}

/** The words for what went wrong, from the last call or from the repo's own failed status. */
function problem(repo: RepoSession): string {
  if (repo.error !== '') return repo.error;
  const e = repo.status?.error;
  return repo.status?.state === 'failed' && e ? errorWords(e.code, e.message, e.reset_at) : '';
}

/**
 * Draws the control into `slot` and redraws it whenever the session changes.
 * Returns the unsubscribe. The open form and its typed values survive a redraw.
 */
export function mountRepoPanel(slot: HTMLElement, repo: RepoSession): () => void {
  let open = false;
  const values = { repo: '', branch: '', folder: '' };

  const draw = (): void => {
    const s = repo.status;
    const bar = el('div', 'repo-bar');
    bar.dataset.source = repo.source;

    if (s) {
      const group = el('div', 'repo-source');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'What the chat asks');
      const book = el('button', 'repo-source-btn', 'Ask the book');
      book.type = 'button';
      book.dataset.source = 'book';
      book.setAttribute('aria-pressed', String(repo.source === 'book'));
      book.addEventListener('click', () => repo.setSource('book'));
      const mine = el('button', 'repo-source-btn', `Ask ${s.repo}`);
      mine.type = 'button';
      mine.dataset.source = 'repo';
      mine.disabled = !repo.ready;
      mine.setAttribute('aria-pressed', String(repo.source === 'repo'));
      mine.addEventListener('click', () => repo.setSource('repo'));
      group.append(book, mine);
      bar.appendChild(group);
    }

    const attachBtn = el('button', 'repo-attach-btn', s ? 'Change repo' : 'Attach GitHub repo');
    attachBtn.type = 'button';
    attachBtn.setAttribute('aria-expanded', String(open));
    attachBtn.addEventListener('click', () => { open = !open; draw(); });
    bar.appendChild(attachBtn);
    if (s) {
      const detach = el('button', 'repo-detach-btn', 'Detach');
      detach.type = 'button';
      detach.addEventListener('click', () => void repo.detach());
      bar.appendChild(detach);
    }

    const nodes: HTMLElement[] = [bar];

    if (open) {
      const form = el('form', 'repo-form');
      const field = (name: 'repo' | 'branch' | 'folder', label: string, placeholder: string): HTMLElement => {
        const wrap = el('label', 'repo-field');
        wrap.append(el('span', 'repo-field-label', label));
        const input = el('input');
        input.type = 'text';
        input.name = name;
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        input.value = values[name];
        input.addEventListener('input', () => { values[name] = input.value; });
        wrap.appendChild(input);
        return wrap;
      };
      const go = el('button', 'repo-go', 'Attach');
      go.type = 'submit';
      go.disabled = repo.working;
      form.append(
        field('repo', 'Public GitHub repo', 'owner/repo or https://github.com/owner/repo'),
        field('branch', 'Branch (optional)', 'default branch'),
        field('folder', 'Folder (optional)', 'whole repo'),
        go,
      );
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const r = values.repo.trim();
        if (r === '') return;
        open = false;
        const req: { repo: string; branch?: string; folder?: string } = { repo: r };
        if (values.branch.trim() !== '') req.branch = values.branch.trim();
        if (values.folder.trim() !== '') req.folder = values.folder.trim();
        void repo.attach(req);
      });
      nodes.push(form);
    }

    if (repo.attaching) {
      const p = el('p', 'repo-progress', 'Sending the repo to Sherlock.');
      p.setAttribute('role', 'status');
      nodes.push(p);
    } else if (s && s.state !== 'detached' && progressWords(s) !== '' && s.state !== 'failed') {
      const p = el('p', 'repo-progress', progressWords(s));
      p.dataset.state = s.state;
      p.setAttribute('role', 'status');
      nodes.push(p);
    }
    const bad = problem(repo);
    if (bad !== '') {
      const p = el('p', 'error-state repo-error', bad);
      p.setAttribute('role', 'alert');
      nodes.push(p);
    }
    slot.replaceChildren(...nodes);
  };

  draw();
  return repo.subscribe(draw);
}

/** A repo answer as an AskResult shape, for the shared weak-sure and rerank notes. */
function asAsk(a: RepoAnswer, question: string): AskResult {
  const r: AskResult = { question, state: a.state, text: a.text, provenance: [] };
  if (a.status !== undefined) r.status = a.status;
  if (a.low_confidence !== undefined) r.low_confidence = a.low_confidence;
  if (a.rerank) r.rerank = a.rerank;
  return r;
}

/** One repo turn: the question, the answer, and each citation with its file path and KID. */
export function renderRepoTurn(t: RepoTurn): HTMLElement {
  const root = el('div', t.answer.state === 'found' ? 'chat-turn repo-turn' : 'chat-turn repo-turn not-knowing');
  const userRow = el('div', 'bubble-row bubble-row-user');
  const user = el('p', 'bubble chat-user');
  user.append(el('span', 'sr-only', 'You said: '), document.createTextNode(t.message));
  userRow.appendChild(user);

  const replyRow = el('div', 'bubble-row bubble-row-reply');
  const bubble = el('div', 'bubble chat-reply');
  bubble.appendChild(el('p', 'bubble-text', t.answer.text));
  const notes = answerNotes(asAsk(t.answer, t.message));
  if (notes) bubble.appendChild(notes);
  if (t.answer.citations.length > 0) {
    const list = el('ol', 'repo-citations');
    for (const c of t.answer.citations) {
      const li = el('li', 'repo-citation');
      if (c.machine) li.append(el('span', 'repo-machine', c.machine), document.createTextNode(' '));
      li.append(el('code', 'repo-path', c.path));
      const kid = c.kid === undefined ? c.kid_label ?? '' : `KID ${renderKid(c.kid)}`;
      if (kid !== '') li.append(document.createTextNode(' '), el('span', 'repo-kid', kid));
      if (c.excerpt !== '') li.appendChild(el('blockquote', 'repo-excerpt', c.excerpt));
      list.appendChild(li);
    }
    bubble.appendChild(list);
  }
  replyRow.appendChild(bubble);
  root.append(userRow, replyRow);
  return root;
}
