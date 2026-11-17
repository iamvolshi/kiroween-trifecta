import type { View } from '../router/router.ts';
import { createIntro } from './intro.ts';

export class NotFoundView implements View {
  private container: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = '';
    const section = document.createElement('section');
    section.className = 'not-found';
    section.innerHTML = `
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <p><a href="/actions">Back to Action List</a></p>
    `;
    container.appendChild(section);
    section.querySelector('h1')?.after(createIntro('notFound'));
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
