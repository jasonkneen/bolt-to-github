const DEFAULT_RELOAD_MESSAGE =
  'Extension needs to restart to fix authentication. Restarting in 3 seconds...';
const DEFAULT_COUNTDOWN_SECONDS = 3;

export async function notifyBoltTabsAboutReload(
  options: { message?: string; countdownSeconds?: number } = {}
): Promise<void> {
  try {
    if (
      typeof chrome === 'undefined' ||
      typeof chrome.tabs?.query !== 'function' ||
      typeof chrome.tabs?.sendMessage !== 'function'
    ) {
      return;
    }

    const tabs = await chrome.tabs.query({ url: 'https://bolt.new/*' });
    const message = options.message ?? DEFAULT_RELOAD_MESSAGE;
    const countdown = options.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;

    await Promise.all(
      tabs.map(async (tab) => {
        if (typeof tab.id !== 'number') {
          return;
        }

        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SHOW_EXTENSION_RELOAD_NOTIFICATION',
            data: {
              message,
              countdown,
            },
          });
        } catch {
          // The tab may not have an active content script; reload should continue.
        }
      })
    );
  } catch {
    // Notification delivery is best effort and must never block a reload.
  }
}
