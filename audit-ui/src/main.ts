import { createMockAdapter, MOCK_ADAPTER } from './adapter/mock.js';
import { Router } from './router/router.js';

// Active adapter: MOCK_ADAPTER — switch to createLiveAdapter() when live seam is confirmed
export const ACTIVE_ADAPTER = MOCK_ADAPTER;

const adapter = createMockAdapter();
const appEl = document.getElementById('app');

if (!appEl) {
  throw new Error('No #app element found in index.html');
}

const router = new Router(adapter, appEl);
router.navigate('/actions');
