import './style.css';
import './styles/record-card.css';
import './styles/chat.css';
import './styles/calendar.css';
import './styles/shell.css';
import './styles/telemetry.css';
import { createMockAdapter, MOCK_ADAPTER } from './adapter/mock.js';
import { boot } from './boot.ts';

// Active adapter: MOCK_ADAPTER - switch to createLiveAdapter() when live seam is confirmed
export const ACTIVE_ADAPTER = MOCK_ADAPTER;

const adapter = createMockAdapter();
const appEl = document.getElementById('app');

if (!appEl) {
  throw new Error('No #app element found in index.html');
}

boot(adapter, appEl);