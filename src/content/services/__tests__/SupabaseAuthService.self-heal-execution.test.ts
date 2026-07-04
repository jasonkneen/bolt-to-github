/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Behavioral tests for manifest: fix-auth-self-heal-reload-execution
 *
 * Contract under test: the auth self-heal reload and re-auth tab opening must
 * execute directly when the privileged Chrome APIs are available in the
 * current context (background/popup), because chrome.runtime.sendMessage is
 * never delivered back to the sending context — the background's own
 * RELOAD_EXTENSION message goes nowhere. The runtime message remains only as
 * the fallback for unprivileged contexts (content scripts). A reload that was
 * requested but NOT actually scheduled (throttled or failed) must not leave
 * the re-authentication flow permanently disabled.
 *
 * Tests drive the flow through triggerReAuthentication (the single entry
 * point for auth-failure handling, per existing suite convention) and assert
 * only on observable Chrome API effects — never on private state.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

const BOLT_TAB_ID = 42;

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
  query: vi.fn().mockImplementation(async (queryInfo: { url?: string }) => {
    if (queryInfo?.url?.includes('bolt.new')) {
      return [{ id: BOLT_TAB_ID, url: 'https://bolt.new/~/project' }];
    }
    return [];
  }),
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

global.chrome = {
  runtime: mockChromeRuntime,
  storage: mockChromeStorage,
  tabs: mockChromeTabs,
  alarms: mockChromeAlarms,
} as any;

import { SupabaseAuthService } from '../SupabaseAuthService';

function createService(): SupabaseAuthService {
  (SupabaseAuthService as any).instance = null;
  return SupabaseAuthService.getInstance();
}

async function failAuthTimes(service: SupabaseAuthService, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await (service as any).triggerReAuthentication(`Simulated auth failure ${i + 1}`);
  }
}

function selfHealAlarmCalls(): unknown[][] {
  return (mockChromeAlarms.create as Mock).mock.calls.filter(
    (call) => call[0] === 'self-heal-reload'
  );
}

function runtimeMessageCalls(type: string): unknown[][] {
  return (mockChromeRuntime.sendMessage as Mock).mock.calls.filter(
    (call: any[]) => call[0]?.type === type
  );
}

function reauthModalCalls(): unknown[][] {
  return (mockChromeTabs.sendMessage as Mock).mock.calls.filter(
    (call: any[]) => call[1]?.type === 'SHOW_REAUTHENTICATION_MODAL'
  );
}

function reauthTabCreateCalls(): unknown[][] {
  return (mockChromeTabs.create as Mock).mock.calls.filter((call: any[]) =>
    String(call[0]?.url ?? '').includes('bolt2github.com')
  );
}

describe('SupabaseAuthService - self-heal execution (fix-auth-self-heal-reload-execution)', () => {
  let authService: SupabaseAuthService;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2024-01-01T00:00:00.000Z') });
    vi.clearAllMocks();
    global.chrome.alarms = mockChromeAlarms as any;
    global.chrome.tabs = mockChromeTabs as any;
  });

  afterEach(() => {
    authService?.cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('schedules self-heal reload alarm directly after max auth failures in background context', async () => {
    authService = createService();
    const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

    await failAuthTimes(authService, maxFailures);

    // With chrome.alarms available (background/popup context) the reload must
    // be scheduled directly; a self-addressed runtime message would be lost.
    expect(selfHealAlarmCalls().length).toBe(1);
    expect(runtimeMessageCalls('RELOAD_EXTENSION').length).toBe(0);
  });

  test('falls back to RELOAD_EXTENSION runtime message when alarms API is unavailable', async () => {
    // Content-script-like context: no chrome.alarms.
    global.chrome.alarms = undefined as any;
    authService = createService();
    const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

    await failAuthTimes(authService, maxFailures);

    expect(runtimeMessageCalls('RELOAD_EXTENSION').length).toBe(1);
  });

  test('re-auth flow retries after a throttled reload instead of staying disabled', async () => {
    authService = createService();
    const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

    // A reload happened moments ago, so the next reload request is throttled
    // by MIN_TIME_BETWEEN_RELOADS (setup seam, mirrors existing suite).
    (authService as any).lastReloadTimestamp = Date.now();

    await failAuthTimes(authService, maxFailures);

    // Throttled: no reload may be scheduled through any channel.
    expect(selfHealAlarmCalls().length).toBe(0);
    expect(runtimeMessageCalls('RELOAD_EXTENSION').length).toBe(0);

    // The re-auth flow must remain operational: a later auth failure still
    // guides the user to sign in again instead of silently doing nothing.
    (mockChromeTabs.sendMessage as Mock).mockClear();
    await failAuthTimes(authService, 1);

    expect(reauthModalCalls().length).toBeGreaterThan(0);
  });

  test('re-auth flow retries after reload scheduling fails', async () => {
    authService = createService();
    const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

    // The privileged reload channel is broken in this scenario.
    (mockChromeAlarms.create as Mock).mockImplementation(() => {
      throw new Error('alarm creation failed');
    });

    await failAuthTimes(authService, maxFailures);

    // A failed reload must not leave the flow disabled: the next failure
    // still shows the re-authentication modal.
    (mockChromeTabs.sendMessage as Mock).mockClear();
    await failAuthTimes(authService, 1);

    expect(reauthModalCalls().length).toBeGreaterThan(0);
  });

  test('re-auth flow retries after reload message send fails', async () => {
    // Content-script-like context: no chrome.alarms, and the fallback message
    // has no receiving end.
    global.chrome.alarms = undefined as any;
    authService = createService();
    const maxFailures = (authService as any).MAX_AUTH_FAILURES_BEFORE_RELOAD;

    (mockChromeRuntime.sendMessage as Mock).mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    );

    await failAuthTimes(authService, maxFailures);

    // A failed fallback message must not leave the flow disabled: the next
    // failure still shows the re-authentication modal.
    (mockChromeTabs.sendMessage as Mock).mockClear();
    await failAuthTimes(authService, 1);

    expect(reauthModalCalls().length).toBeGreaterThan(0);
  });

  test('opens re-authentication tab directly when tabs API is available', async () => {
    authService = createService();

    // A single failure (below the reload threshold) runs the normal re-auth
    // flow, which must open the sign-in page directly instead of sending an
    // OPEN_REAUTHENTICATION message the background can never receive from
    // itself.
    await failAuthTimes(authService, 1);

    expect(reauthTabCreateCalls().length).toBe(1);
    expect(runtimeMessageCalls('OPEN_REAUTHENTICATION').length).toBe(0);
  });
});
