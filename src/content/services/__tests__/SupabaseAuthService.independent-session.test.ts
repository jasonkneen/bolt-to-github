/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('SupabaseAuthService - Independent Session Minting', () => {
  let authService: SupabaseAuthService;

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2024-06-15T12:00:00.000Z') });
    vi.clearAllMocks();

    (SupabaseAuthService as any).instance = null;
    authService = SupabaseAuthService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    authService.cleanup();
  });

  describe('mintIndependentSession', () => {
    test('should call mint-extension-session edge function with current token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'independent-access-token',
            refresh_token: 'independent-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
          }),
      });

      await (authService as any).mintIndependentSession('website-token');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/mint-extension-session'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer website-token',
          }),
        })
      );
    });

    test('should store returned tokens via storeTokenData on success', async () => {
      const storeTokenSpy = vi
        .spyOn(authService as any, 'storeTokenData')
        .mockResolvedValue(undefined);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'independent-access-token',
            refresh_token: 'independent-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
          }),
      });

      await (authService as any).mintIndependentSession('website-token');

      expect(storeTokenSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: 'independent-access-token',
          refresh_token: 'independent-refresh-token',
        })
      );
    });

    test('should set extensionSessionMinted flag on success', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'independent-access-token',
            refresh_token: 'independent-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
          }),
      });

      await (authService as any).mintIndependentSession('website-token');

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSessionMinted: true,
          extensionSessionMintedAt: expect.any(Number),
        })
      );
    });

    test('should return true on success', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'independent-access-token',
            refresh_token: 'independent-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
          }),
      });

      const result = await (authService as any).mintIndependentSession('website-token');

      expect(result).toBe(true);
    });

    test('should return false on HTTP error without clearing existing tokens', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const result = await (authService as any).mintIndependentSession('website-token');

      expect(result).toBe(false);
      expect(mockChromeStorage.local.remove).not.toHaveBeenCalled();
    });

    test('should return false on network error without clearing existing tokens', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await (authService as any).mintIndependentSession('website-token');

      expect(result).toBe(false);
      expect(mockChromeStorage.local.remove).not.toHaveBeenCalled();
    });

    test('should return false when response has no access_token', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 'unexpected format' }),
      });

      const result = await (authService as any).mintIndependentSession('website-token');

      expect(result).toBe(false);
    });

    test('should return false when access_token present but refresh_token missing', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: 'independent-access-token',
            // refresh_token intentionally omitted
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
          }),
      });

      const result = await (authService as any).mintIndependentSession('website-token');

      expect(result).toBe(false);
    });
  });

  describe('hasIndependentSession', () => {
    test('should return false when extensionSessionMinted is not set', async () => {
      mockChromeStorage.local.get.mockResolvedValueOnce({});

      const result = await (authService as any).hasIndependentSession();

      expect(result).toBe(false);
    });

    test('should return true when extensionSessionMinted is true', async () => {
      mockChromeStorage.local.get.mockResolvedValueOnce({
        extensionSessionMinted: true,
      });

      const result = await (authService as any).hasIndependentSession();

      expect(result).toBe(true);
    });

    test('should return false on storage error', async () => {
      mockChromeStorage.local.get.mockRejectedValueOnce(new Error('Storage error'));

      const result = await (authService as any).hasIndependentSession();

      expect(result).toBe(false);
    });
  });

  describe('checkAuthStatus with independent session minting', () => {
    test('should mint independent session on first successful auth', async () => {
      const mintSpy = vi
        .spyOn(authService as any, 'mintIndependentSession')
        .mockResolvedValue(true);

      // hasIndependentSession returns false (no minted session yet)
      vi.spyOn(authService as any, 'hasIndependentSession').mockResolvedValue(false);

      // getAuthToken returns a valid token
      vi.spyOn(authService as any, 'getAuthToken').mockResolvedValue('valid-token');

      // verifyTokenAndGetUser succeeds
      vi.spyOn(authService as any, 'verifyTokenAndGetUser').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      // getSubscriptionStatus returns free plan
      vi.spyOn(authService as any, 'getSubscriptionStatus').mockResolvedValue({
        isActive: false,
        plan: 'free',
      });

      // checkGitHubAppInstallation is a no-op
      vi.spyOn(authService as any, 'checkGitHubAppInstallation').mockResolvedValue(undefined);

      await (authService as any).checkAuthStatus();

      expect(mintSpy).toHaveBeenCalledWith('valid-token');
    });

    test('should NOT re-mint if extensionSessionMinted is already true', async () => {
      const mintSpy = vi.spyOn(authService as any, 'mintIndependentSession');

      vi.spyOn(authService as any, 'hasIndependentSession').mockResolvedValue(true);
      vi.spyOn(authService as any, 'getAuthToken').mockResolvedValue('valid-token');
      vi.spyOn(authService as any, 'verifyTokenAndGetUser').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.spyOn(authService as any, 'getSubscriptionStatus').mockResolvedValue({
        isActive: false,
        plan: 'free',
      });
      vi.spyOn(authService as any, 'checkGitHubAppInstallation').mockResolvedValue(undefined);

      await (authService as any).checkAuthStatus();

      expect(mintSpy).not.toHaveBeenCalled();
    });

    test('should continue normally if minting fails (graceful fallback)', async () => {
      vi.spyOn(authService as any, 'mintIndependentSession').mockResolvedValue(false);
      vi.spyOn(authService as any, 'hasIndependentSession').mockResolvedValue(false);
      vi.spyOn(authService as any, 'getAuthToken').mockResolvedValue('valid-token');
      vi.spyOn(authService as any, 'verifyTokenAndGetUser').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.spyOn(authService as any, 'getSubscriptionStatus').mockResolvedValue({
        isActive: false,
        plan: 'free',
      });
      vi.spyOn(authService as any, 'checkGitHubAppInstallation').mockResolvedValue(undefined);

      const updateSpy = vi.spyOn(authService as any, 'updateAuthState');

      await (authService as any).checkAuthStatus();

      // Should still update auth state as authenticated despite mint failure
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          isAuthenticated: true,
        })
      );
    });
  });

  describe('migration: existing user without independent session', () => {
    test('should mint session for user with pre-existing stored tokens on version upgrade', async () => {
      const mintSpy = vi
        .spyOn(authService as any, 'mintIndependentSession')
        .mockResolvedValue(true);

      // Simulate existing user: has stored tokens, no minted flag
      vi.spyOn(authService as any, 'hasIndependentSession').mockResolvedValue(false);

      // Simulate stored tokens already exist (pre-upgrade state)
      vi.spyOn(authService as any, 'getAuthToken').mockResolvedValue('pre-existing-token');

      vi.spyOn(authService as any, 'verifyTokenAndGetUser').mockResolvedValue({
        id: 'existing-user-456',
        email: 'existing@example.com',
        created_at: '2024-01-01',
        updated_at: '2024-06-15',
      });
      vi.spyOn(authService as any, 'getSubscriptionStatus').mockResolvedValue({
        isActive: true,
        plan: 'monthly',
      });
      vi.spyOn(authService as any, 'checkGitHubAppInstallation').mockResolvedValue(undefined);

      await (authService as any).checkAuthStatus();

      // Should mint with the pre-existing token
      expect(mintSpy).toHaveBeenCalledWith('pre-existing-token');
    });
  });

  describe('clearStoredTokens includes independent session keys', () => {
    test('should clear extensionSessionMinted and extensionSessionMintedAt on logout', async () => {
      await (authService as any).clearStoredTokens();

      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['extensionSessionMinted', 'extensionSessionMintedAt'])
      );
    });
  });

  describe('performTokenRefresh failure clears minted flag', () => {
    test('should clear extensionSessionMinted flag when refresh fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      // Need a stored refresh token for performTokenRefresh to attempt
      const result = await (authService as any).performTokenRefresh('expired-refresh-token');

      expect(result).toBeNull();
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['extensionSessionMinted', 'extensionSessionMintedAt'])
      );
    });
  });

  describe('getValidStoredToken 30-day cleanup clears minted flag', () => {
    test('should clear extensionSessionMinted when refresh token is older than 30 days', async () => {
      const now = Date.now();
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;

      mockChromeStorage.local.get.mockResolvedValueOnce({
        supabaseToken: 'expired-access-token',
        supabaseRefreshToken: 'old-refresh-token',
        supabaseTokenExpiry: now - 1000,
        refreshTokenIssuedAt: thirtyOneDaysAgo,
      });

      await (authService as any).getValidStoredToken();

      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(
        expect.arrayContaining(['extensionSessionMinted', 'extensionSessionMintedAt'])
      );
    });
  });
});
