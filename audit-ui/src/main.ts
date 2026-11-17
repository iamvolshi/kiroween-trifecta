import './style.css';
import './styles/record-card.css';
import './styles/chat.css';
import './styles/calendar.css';
import './styles/shell.css';
import './styles/telemetry.css';
import { createActiveAdapter } from './adapter/active.ts';
import { boot } from './boot.ts';

// The adapter and its chrome label both come from ACTIVE_ADAPTER_KIND in
// adapter/active.ts: switch it there, nowhere else.
const adapter = createActiveAdapter();
const appEl = document.getElementById('app');

if (!appEl) {
  throw new Error('No #app element found in index.html');
}

boot(adapter, appEl);