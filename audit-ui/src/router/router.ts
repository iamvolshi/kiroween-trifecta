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
      // Only plain left clicks navigate in-app; modified and non-left clicks
      // (new tab, new window, download, middle-click) pass through to the browser.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = (event.target as HTMLElement).closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (target.hasAttribute('download')) return;
      const tgt = target.getAttribute('target');
      if (tgt && tgt !== '_self') return;
      // '//host' is protocol-relative (cross-origin), not an in-app path.
      if (href && href.startsWith('/') && !href.startsWith('//')) {
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

  private match(rawPath: string): View {
    // Match on the path only: drop query and hash, and a trailing slash.
    let path = rawPath.split(/[?#]/)[0]!;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
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
      try {
        const subject = decodeURIComponent(entryMatch[2]!);
        const id = decodeURIComponent(entryMatch[3]!);
        return new EntryDetailView(this.adapter, kid, subject, id);
      } catch {
        // Malformed percent-encoding (URIError): no such route.
        return new NotFoundView();
      }
    }

    return new NotFoundView();
  }
}
