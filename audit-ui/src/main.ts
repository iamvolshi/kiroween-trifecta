import './style.css';
import './styles/record-card.css';
import './styles/chat.css';
import './styles/stitch-chat.css';
import './styles/calendar.css';
import './styles/calendar-rail.css';
import './styles/shell.css';
import './styles/telemetry.css';
import './styles/mini-chat.css';
import './styles/repo.css';
import './styles/folders.css';
import './styles/loading-modal.css';
import './styles/research.css';
import './styles/corpus.css';
import './styles/lessons.css';
import './styles/curator.css';
import './styles/inspector.css';
import './styles/watson.css';
import './styles/stitch-system.css';
import { createSherlockAdapter } from './adapter/sherlock.ts';
import { SHERLOCK_URL, SHERLOCK_CASE } from './adapter/sherlock-url.ts';
import { boot } from './boot.ts';

// Live-only: one adapter, and every search goes through Sherlock at the build-time address.
const adapter = createSherlockAdapter(SHERLOCK_URL, SHERLOCK_CASE);
const appEl = document.getElementById('app');

if (!appEl) {
  throw new Error('No #app element found in index.html');
}

boot(adapter, appEl);