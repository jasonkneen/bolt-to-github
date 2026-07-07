/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import { notifyBoltTabsAboutReload } from '../reloadNotification';

const mockChromeTabs = {
  query: vi.fn(),
  sendMessage: vi.fn(),
};

global.chrome = {
  tabs: mockChromeTabs,
} as any;

function reloadNotificationCalls(): unknown[][] {
  return (mockChromeTabs.sendMessage as Mock).mock.calls.filter(
    (call: any[]) => call[1]?.type === 'SHOW_EXTENSION_RELOAD_NOTIFICATION'
  );
}

describe('notifyBoltTabsAboutReload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.chrome = {
      tabs: mockChromeTabs,
    } as any;
    mockChromeTabs.query.mockResolvedValue([]);
    mockChromeTabs.sendMessage.mockResolvedValue(undefined);
  });

  test('broadcasts the reload notification with countdown to every bolt.new tab', async () => {
    mockChromeTabs.query.mockResolvedValue([
      { id: 12, url: 'https://bolt.new/~/first' },
      { id: 34, url: 'https://bolt.new/~/second' },
      { url: 'https://bolt.new/~/missing-id' },
    ]);

    await notifyBoltTabsAboutReload({
      message: 'Restarting now',
      countdownSeconds: 5,
    });

    expect(mockChromeTabs.query).toHaveBeenCalledWith({ url: 'https://bolt.new/*' });
    expect(reloadNotificationCalls()).toEqual([
      [
        12,
        {
          type: 'SHOW_EXTENSION_RELOAD_NOTIFICATION',
          data: {
            message: 'Restarting now',
            countdown: 5,
          },
        },
      ],
      [
        34,
        {
          type: 'SHOW_EXTENSION_RELOAD_NOTIFICATION',
          data: {
            message: 'Restarting now',
            countdown: 5,
          },
        },
      ],
    ]);
  });

  test('resolves silently when a tab has no content script listener', async () => {
    mockChromeTabs.query.mockResolvedValue([
      { id: 12, url: 'https://bolt.new/~/first' },
      { id: 34, url: 'https://bolt.new/~/second' },
    ]);
    mockChromeTabs.sendMessage
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce(undefined);

    await expect(notifyBoltTabsAboutReload()).resolves.toBeUndefined();

    expect(reloadNotificationCalls()).toEqual([
      [
        12,
        {
          type: 'SHOW_EXTENSION_RELOAD_NOTIFICATION',
          data: {
            message: 'Extension needs to restart to fix authentication. Restarting in 3 seconds...',
            countdown: 3,
          },
        },
      ],
      [
        34,
        {
          type: 'SHOW_EXTENSION_RELOAD_NOTIFICATION',
          data: {
            message: 'Extension needs to restart to fix authentication. Restarting in 3 seconds...',
            countdown: 3,
          },
        },
      ],
    ]);
  });

  test('resolves silently when tabs query fails', async () => {
    mockChromeTabs.query.mockRejectedValueOnce(new Error('Tabs query failed'));

    await expect(notifyBoltTabsAboutReload()).resolves.toBeUndefined();

    expect(mockChromeTabs.sendMessage).not.toHaveBeenCalled();
  });

  test('resolves silently when chrome.tabs is unavailable', async () => {
    global.chrome = {} as any;

    await expect(notifyBoltTabsAboutReload()).resolves.toBeUndefined();
  });
});
