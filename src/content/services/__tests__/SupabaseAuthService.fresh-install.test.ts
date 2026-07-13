import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SupabaseAuthService } from '../SupabaseAuthService';

describe('SupabaseAuthService - fresh installation', () => {
  let authService: SupabaseAuthService | undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined);
    vi.mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    vi.mocked(chrome.alarms.create).mockReturnValue(undefined);
    chrome.alarms.clear = vi.fn(() =>
      Promise.resolve(true)
    ) as unknown as typeof chrome.alarms.clear;
  });

  afterEach(() => {
    authService?.cleanup();
    vi.clearAllMocks();
  });

  test('does not open login tabs when an unauthenticated extension has no stored session', async () => {
    authService = SupabaseAuthService.getInstance();

    await authService.forceCheck();

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(authService.getAuthState()).toMatchObject({
      isAuthenticated: false,
      user: null,
      subscription: { isActive: false, plan: 'free' },
    });
  });

  test('opens recovery when a previously stored session can no longer provide a token', async () => {
    const storedSession: Record<string, unknown> = {
      supabaseToken: 'expired-access-token',
      supabaseRefreshToken: 'stale-refresh-token',
      supabaseTokenExpiry: Date.now() - 60_000,
      refreshTokenIssuedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const requestedKeys = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requestedKeys
          .filter((key): key is string => typeof key === 'string' && key in storedSession)
          .map((key) => [key, storedSession[key]])
      );
    });
    vi.mocked(chrome.storage.local.remove).mockImplementation(async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete storedSession[key];
      }
    });

    authService = SupabaseAuthService.getInstance();

    await authService.forceCheck();

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://bolt2github.com/login',
      active: true,
    });
    expect(authService.getAuthState()).toMatchObject({
      isAuthenticated: false,
      user: null,
      subscription: { isActive: false, plan: 'free' },
    });
  });

  test('opens only one recovery tab when stored-session checks overlap', async () => {
    const storedSession: Record<string, unknown> = {
      supabaseToken: 'expired-access-token',
      supabaseRefreshToken: 'stale-refresh-token',
      supabaseTokenExpiry: Date.now() - 60_000,
      refreshTokenIssuedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    };
    vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
      const requestedKeys = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requestedKeys
          .filter((key): key is string => typeof key === 'string' && key in storedSession)
          .map((key) => [key, storedSession[key]])
      );
    });
    vi.mocked(chrome.storage.local.remove).mockImplementation(async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete storedSession[key];
      }
    });

    authService = SupabaseAuthService.getInstance();

    await Promise.all([authService.forceCheck(), authService.forceCheck()]);

    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://bolt2github.com/login',
      active: true,
    });
  });
});
