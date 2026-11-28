/**
 * The GitHub panel lives in the left column (OCME-010-hack): not above the
 * composer, one mount, and the shared session survives the chat view mounting
 * and unmounting. Sherlock is a fetch double; no network.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Router } from './router.ts';
import { createRecordStub, tick, createModelsStub } from '../test-helpers.ts';
import { RepoSession } from '../views/repo-session.ts';
import { createGithubClient } from '../adapter/github-client.ts';

let container: HTMLElement;
let router: Router;
let repo: RepoSession;

function start(path: string): void {
  window.history.replaceState({}, '', path);
  const client = createGithubClient('https://sherlock.test', (() => Promise.reject(new Error('no network'))) as typeof fetch, { getItem: () => null, setItem: () => {} });
  repo = new RepoSession(client, 0);
  container = document.createElement('div');
  document.body.appendChild(container);
  router = new Router(createRecordStub(), container, createModelsStub(), undefined, repo);
}

/** Put a ready repo on the shared session, as an attach would. */
function attached(): void {
  repo.status = {
    state: 'ready', repo: 'octo/hello', branch: 'main', folder: '', files_listed: 12, files_ingested: 10,
    files_skipped: 2, passages: 31, truncated: false, error: null,
  } as RepoSession['status'];
  (repo as unknown as { emit(): void }).emit();
}

afterEach(() => {
  router.destroy();
  container.remove();
});

describe('the GitHub panel is in the left column', () => {
  it('is in the left column, and not in the chat dock or the chat column', async () => {
    start('/chat');
    await tick();
    attached();
    const left = container.querySelector('.shell-left')!;
    expect(left.querySelectorAll('.repo-slot')).toHaveLength(1);
    expect(left.querySelector('.repo-source-btn[data-source="repo"]')).not.toBeNull();
    expect(left.querySelector('.repo-attach-btn')!.textContent).toBe('Change repo');
    // The scan's progress lives in the telemetry, in the right column, not here.
    expect(left.querySelector('.repo-progress')).toBeNull();
    expect(container.querySelector('.shell-right .repo-progress')!.textContent).toMatch(/^Ready: octo\/hello/);
    const column = container.querySelector('.chat-column')!;
    expect(column.querySelector('.repo-slot, .repo-bar, .repo-form, .repo-progress')).toBeNull();
    expect(Array.from(column.querySelector('.chat-dock')!.children).map((c) => c.className)).toEqual(['voice-slot', 'chat-composer']);
  });

  it('keeps one panel and the same session when the chat view unmounts and mounts again', async () => {
    start('/chat');
    await tick();
    attached();
    const status = repo.status;
    router.navigate('/calendar');
    await tick();
    router.navigate('/chat');
    await tick();
    expect(repo.status).toBe(status);
    expect(repo.source).toBe('book');
    const left = container.querySelector('.shell-left')!;
    expect(left.querySelectorAll('.repo-slot')).toHaveLength(1);
    expect(left.querySelectorAll('.repo-bar')).toHaveLength(1);
    expect(left.querySelector('.repo-progress')).toBeNull();
    expect(container.querySelector('.shell-right .repo-progress')!.textContent).toMatch(/^Ready: octo\/hello/);
    // One live subscription: a change draws once, into the one bar.
    repo.setSource('repo');
    expect(left.querySelectorAll('.repo-bar')).toHaveLength(1);
    expect(left.querySelector('.repo-bar')!.getAttribute('data-source')).toBe('repo');
    expect(container.querySelector<HTMLInputElement>('#chat-message')!.placeholder).toBe('Ask octo/hello');
  });
});