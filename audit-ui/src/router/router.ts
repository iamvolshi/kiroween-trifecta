import type { SeamAdapter } from '../adapter/seam.ts';
import { ActionListView } from '../views/action-list.ts';
import { TimeTravelView } from '../views/time-travel.ts';
import { EntryDetailView } from '../views/entry-detail.ts';
import { NotFoundView } from '../views/not-found.ts';

export interface View {
  mount(container: HTMLElement): void;
  unmount(): void;
}

export class Router {
  private container: HTMLElement;
  private adapter: SeamAdapter;
  private currentView: View | null = null;
  private clickHandler: (event: MouseEvent) => void;
  private popstateHandler: () => void;

  constructor(adapter: SeamAdapter, container: HTMLElement) {
    this.adapter = adapter;
    this.container = container;

    this.clickHandler = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && href.startsWith('/')) {
        event.preventDefault();
        this.navigate(href);
      }
    };

    this.popstateHandler = () => {
      this.resolve(window.location.pathname);
    };

    document.addEventListener('click', this.clickHandler);
    window.addEventListener('popstate', this.popstateHandler);

    // Mount the initial view based on the current URL
    this.resolve(window.location.pathname);
  }

  navigate(path: string): void {
    window.history.pushState({}, '', path);
    this.resolve(path);
  }

  destroy(): void {
    document.removeEventListener('click', this.clickHandler);
    window.removeEventListener('popstate', this.popstateHandler);
    if (this.currentView) {
      this.currentView.unmount();
      this.currentView = null;
    }
  }

  private resolve(path: string): void {
    const view = this.match(path);
    if (this.currentView) {
      this.currentView.unmount();
    }
    this.currentView = view;
    this.currentView.mount(this.container);
  }

  private match(path: string): View {
    if (path === '/actions') {
      return new ActionListView(this.adapter);
    }

    if (path === '/time-travel') {
      return new TimeTravelView(this.adapter);
    }

    const entryMatch = path.match(
      /^\/entry\/(\d+)\/([^/]+)\/([^/]+)$/,
    );
    if (entryMatch) {
      const kid = parseInt(entryMatch[1]!, 10);
      const subject = decodeURIComponent(entryMatch[2]!);
      const id = decodeURIComponent(entryMatch[3]!);
      return new EntryDetailView(this.adapter, kid, subject, id);
    }

    return new NotFoundView();
  }
}
