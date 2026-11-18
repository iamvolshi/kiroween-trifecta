import './style.css';
import './styles/record-card.css';
import './styles/chat.css';
import './styles/model-banner.css';
import './styles/calendar.css';
import './styles/shell.css';
import './styles/telemetry.css';
import './styles/folders.css';
import { createLiveAdapter } from './adapter/live.ts';
import { CONNECTOR_URL } from './adapter/connector-url.ts';
import { boot } from './boot.ts';

// Live-only: one adapter, the connector at the build-time address.
const adapter = createLiveAdapter(CONNECTOR_URL);
const appEl = document.getElementById('app');

if (!appEl) {
  throw new Error('No #app element found in index.html');
}

boot(adapter, appEl);