import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { NotificationOptions } from '../types/UITypes';

const uiNotifications = vi.hoisted(() => [] as NotificationOptions[]);

vi.mock('../UIManager', () => {
  class MockUIManager {
    private static instance: MockUIManager | null = null;

    static getInstance(): MockUIManager {
      if (!MockUIManager.instance) {
        MockUIManager.instance = new MockUIManager();
      }
      return MockUIManager.instance;
    }

    static initialize(): MockUIManager {
      MockUIManager.instance = new MockUIManager();
      return MockUIManager.instance;
    }

    static resetInstance(): void {
      MockUIManager.instance = null;
    }

    showNotification(options: NotificationOptions): void {
      uiNotifications.push(options);
    }

    updateUploadStatus(): void {}

    updateButtonState(): void {}

    handleGitHubPushAction(): void {}

    handleShowChangedFiles(): Promise<void> {
      return Promise.resolve();
    }

    cleanup(): void {}

    getPushReminderService(): unknown {
      return {
        getDebugInfo: () => ({ enabled: true, interval: 300000 }),
        updateSettings: () => Promise.resolve(),
      };
    }

    getPremiumService(): unknown {
      return {
        updatePremiumStatusFromAuth: () => Promise.resolve(),
      };
    }

    getWhatsNewManager(): unknown {
      return {
        showManually: () => Promise.resolve(),
      };
    }

    showReauthenticationModal(): void {}

    snoozePushReminders(): void {}

    snoozeForDuration(): void {}
  }

  return { UIManager: MockUIManager };
});

import { ContentManager } from '../ContentManager';
import { UIManager } from '../UIManager';

type RuntimeMessageListener = (
  message: {
    type?: string;
    action?: string;
    data?: { duration?: number; message?: string; countdown?: number };
    settings?: unknown;
  },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

interface MockPort {
  name: string;
  onDisconnect: {
    addListener: (listener: () => void) => void;
    removeListener: (listener: () => void) => void;
    hasListener: (listener: () => void) => boolean;
  };
  onMessage: {
    addListener: (listener: (message: unknown) => void) => void;
    removeListener: (listener: (message: unknown) => void) => void;
    hasListener: (listener: (message: unknown) => void) => boolean;
  };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  simulateDisconnect: (error?: chrome.runtime.LastError) => void;
}

interface ChromeHarness {
  connect: Mock<[info?: chrome.runtime.ConnectInfo], MockPort>;
  runtimeReload: Mock<[], void>;
  locationReload: Mock<[], void>;
  ports: MockPort[];
  runtimeMessages: RuntimeMessageListener[];
}

function createMockPort(name: string): MockPort {
  const disconnectListeners: Array<() => void> = [];
  const messageListeners: Array<(message: unknown) => void> = [];

  return {
    name,
    onDisconnect: {
      addListener: (listener: () => void) => disconnectListeners.push(listener),
      removeListener: (listener: () => void) => {
        const index = disconnectListeners.indexOf(listener);
        if (index >= 0) disconnectListeners.splice(index, 1);
      },
      hasListener: (listener: () => void) => disconnectListeners.includes(listener),
    },
    onMessage: {
      addListener: (listener: (message: unknown) => void) => messageListeners.push(listener),
      removeListener: (listener: (message: unknown) => void) => {
        const index = messageListeners.indexOf(listener);
        if (index >= 0) messageListeners.splice(index, 1);
      },
      hasListener: (listener: (message: unknown) => void) => messageListeners.includes(listener),
    },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    simulateDisconnect: (error?: chrome.runtime.LastError) => {
      setRuntimeId(
        error?.message?.includes('Extension context invalidated') ? undefined : getRuntimeId()
      );
      (
        chrome.runtime as typeof chrome.runtime & { lastError?: chrome.runtime.LastError }
      ).lastError = error;
      disconnectListeners.forEach((listener) => listener());
    },
  };
}

function getRuntimeId(): string | undefined {
  return chrome.runtime.id;
}

function setRuntimeId(id: string | undefined): void {
  Object.defineProperty(chrome.runtime, 'id', {
    configurable: true,
    writable: true,
    value: id,
  });
}

function installHarness(runtimeId: string | undefined = 'test-extension-id'): ChromeHarness {
  const ports: MockPort[] = [];
  const runtimeMessages: RuntimeMessageListener[] = [];
  const runtimeReload = vi.fn<[], void>();
  const locationReload = vi.fn<[], void>();
  const connect = vi.fn((info?: chrome.runtime.ConnectInfo) => {
    const port = createMockPort(info?.name ?? 'bolt-content');
    ports.push(port);
    return port;
  });

  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      href: 'https://bolt.new/project/orphan-recovery',
      pathname: '/project/orphan-recovery',
      host: 'bolt.new',
      hostname: 'bolt.new',
      protocol: 'https:',
      search: '',
      hash: '',
      reload: locationReload,
    },
  });

  const chromeMock = {
    runtime: {
      id: runtimeId,
      lastError: undefined,
      connect,
      reload: runtimeReload,
      onMessage: {
        addListener: vi.fn((listener: RuntimeMessageListener) => {
          runtimeMessages.push(listener);
        }),
        removeListener: vi.fn(),
        hasListener: vi.fn(() => false),
      },
      onConnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(() => false),
      },
    },
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
    },
  };

  (globalThis as typeof globalThis & { chrome: typeof chrome }).chrome =
    chromeMock as unknown as typeof chrome;

  return { connect, runtimeReload, locationReload, ports, runtimeMessages };
}

function sendRuntimeMessage(
  harness: ChromeHarness,
  message: { type: string; data?: { message?: string; countdown?: number } }
): void {
  harness.runtimeMessages.forEach((listener) => {
    listener(message, {}, vi.fn());
  });
}

function refreshBanner(): HTMLElement | null {
  return document.getElementById('bolt-github-context-invalidation-notice');
}

async function advanceRecoveryToUnrecoverable(): Promise<void> {
  await vi.advanceTimersByTimeAsync(15_000);
}

describe('ContentManager orphaned content-script recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    uiNotifications.length = 0;
    document.body.innerHTML = '';
    UIManager.resetInstance();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    window.dispatchEvent(new Event('unload'));
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
    uiNotifications.length = 0;
  });

  test('unrecoverable context invalidation shows a persistent refresh banner', async () => {
    const harness = installHarness();
    new ContentManager();

    setRuntimeId(undefined);
    harness.ports[0].simulateDisconnect({ message: 'Extension context invalidated' });
    await advanceRecoveryToUnrecoverable();

    const banner = refreshBanner();
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Please manually refresh the page');

    await vi.advanceTimersByTimeAsync(60_000);

    expect(refreshBanner()).toBe(banner);
  });

  test('fallback banner appears when UIManager is unavailable', async () => {
    installHarness();
    setRuntimeId(undefined);
    new ContentManager();

    expect(refreshBanner()).toBeNull();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(refreshBanner()).toBeNull();

    await vi.advanceTimersByTimeAsync(5_000);

    const banner = refreshBanner();
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Extension connection lost');
    expect(uiNotifications).toHaveLength(0);
  });

  test('recovery never reloads the bolt.new tab automatically', async () => {
    const harness = installHarness();
    new ContentManager();

    setRuntimeId(undefined);
    harness.ports[0].simulateDisconnect({ message: 'Extension context invalidated' });
    await advanceRecoveryToUnrecoverable();

    expect(harness.locationReload).not.toHaveBeenCalled();
    expect(harness.runtimeReload).not.toHaveBeenCalled();
  });

  test('service worker restart with valid runtime reconnects without banner', async () => {
    const harness = installHarness();
    new ContentManager();

    harness.ports[0].simulateDisconnect({ message: 'Receiving end does not exist' });
    await vi.advanceTimersByTimeAsync(1_500);

    expect(harness.connect).toHaveBeenCalledTimes(2);
    expect(refreshBanner()).toBeNull();
    expect(uiNotifications).toHaveLength(0);
  });

  test('extension reload notification precedes orphaning during self-heal', async () => {
    const harness = installHarness();
    new ContentManager();

    sendRuntimeMessage(harness, {
      type: 'SHOW_EXTENSION_RELOAD_NOTIFICATION',
      data: {
        message: 'Extension needs to restart to fix authentication. Restarting in 3 seconds...',
        countdown: 3,
      },
    });

    expect(uiNotifications).toContainEqual({
      type: 'info',
      message: 'Extension needs to restart to fix authentication. Restarting in 3 seconds...',
      duration: 3000,
    });

    setRuntimeId(undefined);
    harness.ports[0].simulateDisconnect({ message: 'Extension context invalidated' });
    await advanceRecoveryToUnrecoverable();

    expect(refreshBanner()?.textContent).toContain('Please manually refresh the page');
  });
});
