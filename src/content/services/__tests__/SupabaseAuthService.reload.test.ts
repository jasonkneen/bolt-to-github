/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

const mockChromeRuntime = {
  id: 'test-extension-id',
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
  reload: vi.fn(),
};

const mockChromeStorage = {
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  sync: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockChromeTabs = {
  query: vi.fn().mockResolvedValue([]),
  onUpdated: {
    addListener: vi.fn(),
  },
  onActivated: {
    addListener: vi.fn(),
  },
};

const mockChromeAlarms = {
  create: vi.fn(),
  clear: vi.fn().mockResolvedValue(true),
  onAlarm: {
    addListener: vi.fn(),
  },
};

global.chrome = {
  runtime: mockChromeRuntime,
  storage: mockChromeStorage,
  tabs: mockChromeTabs,
  alarms: mockChromeAlarms,
} as any;

import { SupabaseAuthService } from '../SupabaseAuthService';

describe('SupabaseAuthService - Extension Reload Logic', () => {
  let authService: SupabaseAuthService;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2024-01-01T00:00:00.000Z') });
    vi.clearAllMocks();
    global.chrome.alarms = mockChromeAlarms as any;

    (SupabaseAuthService as any).instance = null;
    authService = SupabaseAuthService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    authService.cleanup();
  });

  describe('Reload Tracking', () => {
    test('should initialize with zero consecutive auth failures', () => {
      const failures = (authService as any).consecutiveAuthFailures;
      expect(failures).toBe(0);
    });

    test('should track consecutive auth failures', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);

      await (authService as any).triggerReAuthentication('Test failure 1');
      expect((authService as any).consecutiveAuthFailures).toBe(1);

      await (authService as any).triggerReAuthentication('Test failure 2');
      expect((authService as any).consecutiveAuthFailures).toBe(2);

      await (authService as any).triggerReAuthentication('Test failure 3');
      expect((authService as any).consecutiveAuthFailures).toBe(3);
    });

    test('should request extension reload after MAX_AUTH_FAILURES_BEFORE_RELOAD', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);
      const requestReloadSpy = vi.spyOn(authService as any, 'requestExtensionReload');

      const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

      for (let i = 0; i < maxFailures; i++) {
        await (authService as any).triggerReAuthentication(`Test failure ${i + 1}`);
      }

      expect(requestReloadSpy).toHaveBeenCalledOnce();
    });

    test('should reset consecutive failures on successful authentication', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);

      await (authService as any).triggerReAuthentication('Test failure');
      expect((authService as any).consecutiveAuthFailures).toBe(1);

      (authService as any).updateAuthState({
        isAuthenticated: true,
        user: { id: 'test-user', email: 'test@example.com' },
        subscription: { isActive: false, plan: 'free' },
      });

      expect((authService as any).consecutiveAuthFailures).toBe(0);
    });
  });

  describe('Extension Reload Request', () => {
    test('should schedule self-heal reload alarm directly when alarms API is available', async () => {
      const sendMessageSpy = mockChromeRuntime.sendMessage as Mock;
      const alarmCreateSpy = mockChromeAlarms.create as Mock;

      await (authService as any).requestExtensionReload();

      expect(alarmCreateSpy).toHaveBeenCalledWith('self-heal-reload', {
        delayInMinutes: 3 / 60,
      });
      expect(sendMessageSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RELOAD_EXTENSION',
        })
      );
    });

    test('should record last reload timestamp', async () => {
      const beforeReload = Date.now();
      await (authService as any).requestExtensionReload();
      const afterReload = Date.now();

      const lastReload = (authService as any).lastReloadTimestamp;

      expect(lastReload).toBeGreaterThanOrEqual(beforeReload);
      expect(lastReload).toBeLessThanOrEqual(afterReload);
    });

    test('should prevent reload loops by enforcing minimum time between reloads', async () => {
      const alarmCreateSpy = mockChromeAlarms.create as Mock;

      alarmCreateSpy.mockClear();

      await (authService as any).requestExtensionReload();

      const reloadCalls = alarmCreateSpy.mock.calls.filter(
        (call) => call[0] === 'self-heal-reload'
      );
      expect(reloadCalls.length).toBe(1);

      alarmCreateSpy.mockClear();

      await (authService as any).requestExtensionReload();

      const secondReloadCalls = alarmCreateSpy.mock.calls.filter(
        (call) => call[0] === 'self-heal-reload'
      );
      expect(secondReloadCalls.length).toBe(0);
    });

    test('should allow reload after minimum time has passed', async () => {
      const alarmCreateSpy = mockChromeAlarms.create as Mock;

      alarmCreateSpy.mockClear();

      await (authService as any).requestExtensionReload();

      const firstReloadCalls = alarmCreateSpy.mock.calls.filter(
        (call) => call[0] === 'self-heal-reload'
      );
      expect(firstReloadCalls.length).toBe(1);

      alarmCreateSpy.mockClear();

      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      (authService as any).lastReloadTimestamp = sixMinutesAgo;

      await (authService as any).requestExtensionReload();

      const secondReloadCalls = alarmCreateSpy.mock.calls.filter(
        (call) => call[0] === 'self-heal-reload'
      );
      expect(secondReloadCalls.length).toBe(1);
    });

    test('should handle sendMessage errors gracefully', async () => {
      global.chrome.alarms = undefined as any;
      const sendMessageSpy = mockChromeRuntime.sendMessage as Mock;
      sendMessageSpy.mockRejectedValueOnce(new Error('Message failed'));

      await expect((authService as any).requestExtensionReload()).resolves.not.toThrow();
      expect(sendMessageSpy).toHaveBeenCalledWith({
        type: 'RELOAD_EXTENSION',
        data: {
          reason: 'Multiple authentication failures - clearing stale state',
        },
      });
    });
  });

  describe('Integration with triggerReAuthentication', () => {
    test('should not trigger reload on first auth failure', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);
      const requestReloadSpy = vi.spyOn(authService as any, 'requestExtensionReload');

      await (authService as any).triggerReAuthentication('First failure');

      expect(requestReloadSpy).not.toHaveBeenCalled();
    });

    test('should trigger reload only after threshold is reached', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);
      const requestReloadSpy = vi.spyOn(authService as any, 'requestExtensionReload');

      const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

      for (let i = 0; i < maxFailures - 1; i++) {
        await (authService as any).triggerReAuthentication(`Failure ${i + 1}`);
      }

      expect(requestReloadSpy).not.toHaveBeenCalled();

      await (authService as any).triggerReAuthentication(`Failure ${maxFailures}`);

      expect(requestReloadSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Cleanup', () => {
    test('should reset failure counter on cleanup', () => {
      (authService as any).consecutiveAuthFailures = 5;

      authService.cleanup();

      expect((authService as any).consecutiveAuthFailures).toBe(0);
    });

    test('should preserve reload timestamp on cleanup', () => {
      const timestamp = Date.now();
      (authService as any).lastReloadTimestamp = timestamp;

      authService.cleanup();

      expect((authService as any).lastReloadTimestamp).toBe(timestamp);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid successive failures correctly', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);
      const requestReloadSpy = vi.spyOn(authService as any, 'requestExtensionReload');

      const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

      const promises = [];
      for (let i = 0; i < maxFailures + 2; i++) {
        promises.push((authService as any).triggerReAuthentication(`Rapid failure ${i + 1}`));
      }

      await Promise.all(promises);

      expect(requestReloadSpy).toHaveBeenCalledTimes(1);
    });

    test('should not count failures after reload is requested', async () => {
      vi.spyOn(authService as any, 'logout').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'showReauthenticationModal').mockResolvedValue(undefined);
      vi.spyOn(authService as any, 'requestExtensionReload');

      const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

      for (let i = 0; i < maxFailures; i++) {
        await (authService as any).triggerReAuthentication(`Failure ${i + 1}`);
      }

      const failuresAfterReload = (authService as any).consecutiveAuthFailures;

      await (authService as any).triggerReAuthentication('Post-reload failure');

      expect((authService as any).consecutiveAuthFailures).toBe(failuresAfterReload);
    });
  });
});
