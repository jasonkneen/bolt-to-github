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
});
