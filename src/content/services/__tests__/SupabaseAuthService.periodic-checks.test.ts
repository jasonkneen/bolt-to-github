/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Behavioral tests for manifest: alarm-driven-unauthenticated-auth-checks
 *
 * Contract under test: unauthenticated and aggressive auth-check modes keep a
 * one-minute chrome.alarms wake-up registered while still using setInterval for
 * awake responsiveness. Only cleanup clears the periodic auth alarm.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
  create: vi.fn().mockResolvedValue({ id: 99 }),
  sendMessage: vi.fn().mockResolvedValue(undefined),
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

const mockChromeScripting = {
  executeScript: vi.fn().mockResolvedValue([]),
};

global.chrome = {
  runtime: mockChromeRuntime,
  storage: mockChromeStorage,
  tabs: mockChromeTabs,
  alarms: mockChromeAlarms,
  scripting: mockChromeScripting,
} as any;

global.fetch = vi.fn();

import { SupabaseAuthService } from '../SupabaseAuthService';

function createService(): SupabaseAuthService {
  (SupabaseAuthService as any).instance = null;
  return SupabaseAuthService.getInstance();
}

function authPeriodicAlarmCreates(): unknown[][] {
  return (mockChromeAlarms.create as Mock).mock.calls.filter(
    (call) => call[0] === 'auth-periodic-check'
  );
}

function authPeriodicAlarmClears(): unknown[][] {
  return (mockChromeAlarms.clear as Mock).mock.calls.filter(
    (call) => call[0] === 'auth-periodic-check'
  );
}

describe('SupabaseAuthService - alarm-driven unauthenticated periodic checks', () => {
  let authService: SupabaseAuthService;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-07-04T00:00:00.000Z') });
    vi.clearAllMocks();
    mockChromeStorage.local.get.mockResolvedValue({});
    mockChromeTabs.query.mockResolvedValue([]);
    global.chrome.alarms = mockChromeAlarms as any;
    authService = createService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    authService.cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('unauthenticated mode registers a wake-up alarm alongside the interval check', async () => {
    const checkAuthStatus = vi
      .spyOn(authService as any, 'checkAuthStatus')
      .mockResolvedValue(undefined);

    (authService as any).authState.isAuthenticated = false;
    (authService as any).isInitialOnboarding = false;
    (authService as any).isPostConnectionMode = false;

    (authService as any).startPeriodicChecks();

    expect(authPeriodicAlarmCreates()).toEqual([['auth-periodic-check', { periodInMinutes: 1 }]]);
    expect(authPeriodicAlarmClears()).toEqual([]);

    checkAuthStatus.mockClear();
    await vi.advanceTimersByTimeAsync(30000);

    expect(checkAuthStatus).toHaveBeenCalled();
  });

  test('entering aggressive detection does not clear the periodic auth alarm', () => {
    (authService as any).authState.isAuthenticated = false;
    (authService as any).isInitialOnboarding = false;
    (authService as any).isPostConnectionMode = false;
    (authService as any).startPeriodicChecks();

    (mockChromeAlarms.create as Mock).mockClear();
    (mockChromeAlarms.clear as Mock).mockClear();

    authService.enterPostConnectionMode();

    expect(authPeriodicAlarmCreates()).toEqual([['auth-periodic-check', { periodInMinutes: 1 }]]);
    expect(authPeriodicAlarmClears()).toEqual([]);
  });

  test('authenticated mode alarm scheduling is unchanged', async () => {
    (authService as any).authState.isAuthenticated = true;
    (authService as any).authState.subscription = { isActive: false, plan: 'free' };

    (authService as any).startPeriodicChecks();

    expect(authPeriodicAlarmCreates()).toEqual([['auth-periodic-check', { periodInMinutes: 60 }]]);
    expect(authPeriodicAlarmClears()).toEqual([]);

    const checkAuthStatus = vi
      .spyOn(authService as any, 'checkAuthStatus')
      .mockResolvedValue(undefined);

    (mockChromeAlarms.create as Mock).mockRejectedValueOnce(new Error('alarm rejected'));
    (authService as any).startPeriodicChecks();

    await Promise.resolve();
    checkAuthStatus.mockClear();
    await vi.advanceTimersByTimeAsync(3600000);

    expect(checkAuthStatus).toHaveBeenCalled();
  });

  test('cleanup clears the periodic auth alarm', () => {
    (authService as any).authState.isAuthenticated = false;
    (authService as any).isInitialOnboarding = false;
    (authService as any).startPeriodicChecks();

    (mockChromeAlarms.clear as Mock).mockClear();

    authService.cleanup();

    expect(authPeriodicAlarmClears()).toEqual([['auth-periodic-check']]);
  });
});
