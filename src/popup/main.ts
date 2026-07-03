import '../styles/gb.css';
import App from './App.svelte';
import { createLogger } from '$lib/utils/logger';

const logger = createLogger('PopupMain');
logger.info('🎯 Popup entry point loaded');

// Track popup opening via background script
chrome.runtime.sendMessage({
  type: 'ANALYTICS_EVENT',
  eventType: 'page_view',
  eventData: {
    page: 'popup',
    metadata: {
      title: 'Bolt to GitHub - Popup',
      timestamp: new Date().toISOString(),
    },
  },
});

const app = new App({
  target: document.getElementById('app')!,
});

logger.info('🚀 Popup App component mounted');

export default app;
