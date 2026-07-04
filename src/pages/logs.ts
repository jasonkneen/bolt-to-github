import '../styles/gb.css';
import LogViewer from '../lib/components/LogViewer.svelte';

chrome.runtime.sendMessage({
  type: 'ANALYTICS_EVENT',
  eventType: 'page_view',
  eventData: {
    page: 'logs',
    metadata: {
      title: 'Bolt to GitHub - Logs',
      timestamp: new Date().toISOString(),
    },
  },
});

const app = new LogViewer({
  target: document.getElementById('app')!,
});

export default app;
