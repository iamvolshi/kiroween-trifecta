import type { SeamAdapter } from '../adapter/seam.ts';
import { ActionListView } from '../views/action-list.ts';
import { TimeTravelView } from '../views/time-travel.ts';
import { EntryDetailView } from '../views/entry-detail.ts';
import { NotFoundView } from '../views/not-found.ts';
import { ChatView, type ModelSource } from '../views/chat.ts';
import { ChatLog } from '../views/chat-log.ts';
import { CalendarView } from '../views/calendar.ts';
import { parseCalendarPath } from '../util/calendar.ts';
import { RecordView } from '../views/record.ts';
import { createShell, setViewLabel, type ShellSlots } from '../shell/shell.ts';
import { RailPanel } from '../shell/rail.ts';
import { TelemetryPanel } from '../shell/telemetry.ts';
import { ShellLayout } from '../shell/layout.ts';
import type { Panel } from '../shell/panel.ts';

export interface View {
  mount(container: HTMLElement): void;
  unmount(): void;
}

export class Router {
  private container: HTMLElement;
  private adapter: SeamAdapter;
  private currentView: View | null = null;
  /** One chat transcript per Router, so the conversation survives navigation. */
  private chatLog = new ChatLog();
  private clickHandler: (event: MouseEvent) => void;
  private popstateHandler: () => void;
  private slots: ShellSlots;
  private leftPanel: Panel;
  private rightPanel: Panel;
  private unsubscribeLog: () => void;
  /** Panel widths (drag grips) and the terminal's window state. */
  private layout: ShellLayout;
  /** Where the chat reads its voices and models; undefined = the connector (GET /models). */
  private models: ModelSource | undefined;

  constructor(adapter: SeamAdapter, container: HTMLElement, models?: ModelSource) {
    this.adapter = adapter;
    this.models = models;
    this.container = container;
    this.slots = createShell(container);
    // The rail and the list panel it swaps (Chat's list is the directories column).
    const left = new RailPanel(adapter, this.slots.rail, this.slots.left);
    this.leftPanel = left;
    left.mount();
    this.unsubscribeLog = this.chatLog.subscribe(() => this.leftPanel.refresh());
    // Right column: Curator + ELLE telemetry. It subscribes to the log itself.
    this.layout = new ShellLayout(this.slots.shell, this.slots.right);
    this.rightPanel = new TelemetryPanel(adapter, this.chatLog, this.layout);
    this.rightPanel.mount(this.slots.right);

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

  /** The one chat transcript; the parent wires the right column to it. */
  getChatLog(): ChatLog {
    return this.chatLog;
  }

  destroy(): void {
    document.removeEventListener('click', this.clickHandler);
    window.removeEventListener('popstate', this.popstateHandler);
    if (this.currentView) {
      this.currentView.unmount();
      this.currentView = null;
    }
    this.unsubscribeLog();
    this.leftPanel.unmount();
    this.rightPanel.unmount();
    this.layout.destroy();
    this.container.innerHTML = '';
  }

  private resolve(path: string): void {
    const view = this.match(path);
    if (this.currentView) {
      this.currentView.unmount();
    }
    this.currentView = view;
    this.currentView.mount(this.slots.center);
    setViewLabel(this.slots);
    this.leftPanel.refresh();
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

    if (path === '/chat') {
      return new ChatView(this.adapter, this.chatLog, this.models);
    }

    if (path === '/calendar' || path.startsWith('/calendar/')) {
      const target = parseCalendarPath(path);
      if (target === null) return new NotFoundView();
      return new CalendarView(this.adapter, target === 'default' ? null : target);
    }

    const recordMatch = path.match(/^\/record\/([^/]+)$/);
    if (recordMatch) {
      try {
        return new RecordView(this.adapter, decodeURIComponent(recordMatch[1]!));
      } catch {
        return new NotFoundView();
      }
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
