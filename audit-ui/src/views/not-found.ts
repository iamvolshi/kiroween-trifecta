import type { View } from '../router/router.ts';

export class NotFoundView implements View {
  private container: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    this.container = container;
    container.innerHTML = `
      <section class="not-found">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <p><a href="/actions">Back to Action List</a></p>
      </section>
    `;
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}
