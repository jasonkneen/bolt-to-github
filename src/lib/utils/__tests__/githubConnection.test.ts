import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkGitHubConnection,
  checkPopupGitHubConnection,
  type GitHubConnectionAuthClient,
  type GitHubConnectionFailureReason,
  type GitHubConnectionResult,
} from '../githubConnection';

const localGet = vi.fn();
const localSet = vi.fn();
const localRemove = vi.fn();
const syncGet = vi.fn();

global.chrome = {
  storage: {
    local: { get: localGet, set: localSet, remove: localRemove },
    sync: { get: syncGet },
  },
} as unknown as typeof chrome;

function createAuthClient(
  overrides: Partial<GitHubConnectionAuthClient> = {}
): GitHubConnectionAuthClient {
  return {
    getAuthState: vi.fn().mockResolvedValue({ isAuthenticated: true }),
    syncGitHubApp: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as GitHubConnectionAuthClient;
}

function expectFailureReason(
  result: GitHubConnectionResult,
  reason: GitHubConnectionFailureReason
): void {
  expect(result.connected).toBe(false);
  expect(result.reason).toBe(reason);
}

describe('checkGitHubConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localGet.mockResolvedValue({ authenticationMethod: 'github_app' });
    syncGet.mockResolvedValue({});
  });

  it('configured legacy PAT remains connected without a GitHub App check', async () => {
    localGet.mockResolvedValue({ authenticationMethod: 'pat' });
    syncGet.mockResolvedValue({ githubToken: 'ghp_legacy' });
    const authClient = createAuthClient();

    await expect(checkGitHubConnection(authClient)).resolves.toEqual({
      connected: true,
      message: 'GitHub is connected.',
    });
    expect(authClient.getAuthState).not.toHaveBeenCalled();
    expect(authClient.syncGitHubApp).not.toHaveBeenCalled();
  });

  it('unauthenticated users are blocked before GitHub App synchronization', async () => {
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({ isAuthenticated: false }),
    });

    const result: GitHubConnectionResult = await checkGitHubConnection(authClient);
    expect(result).toEqual({
      connected: false,
      reason: 'not_authenticated',
      message: 'Sign in to bolt2github.com before using GitHub features.',
    });
    expectFailureReason(result, 'not_authenticated');
    expect(authClient.syncGitHubApp).not.toHaveBeenCalled();
  });

  it('authenticated users without a GitHub App receive the connect message', async () => {
    const authClient = createAuthClient({
      syncGitHubApp: vi.fn().mockResolvedValue(false),
    });

    const result: GitHubConnectionResult = await checkGitHubConnection(authClient);
    expect(result).toEqual({
      connected: false,
      reason: 'not_connected',
      message: 'Connect GitHub at bolt2github.com before using GitHub features.',
    });
    expectFailureReason(result, 'not_connected');
  });

  it('authenticated users with a live GitHub App are connected', async () => {
    await expect(checkGitHubConnection(createAuthClient())).resolves.toEqual({
      connected: true,
      message: 'GitHub is connected.',
    });
  });

  it('verification failures are visible and do not masquerade as disconnection', async () => {
    const authClient = createAuthClient({
      syncGitHubApp: vi.fn().mockRejectedValue(new Error('Edge Function unavailable')),
    });

    await expect(checkGitHubConnection(authClient)).resolves.toEqual({
      connected: false,
      reason: 'unavailable',
      message: 'Unable to verify the GitHub connection: Edge Function unavailable',
    });
  });

  it('popup checks reuse one recent successful verification for matching identity', async () => {
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        user: { id: 'user-123' },
      }),
    });
    const settings = {
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    localGet.mockResolvedValue(settings);

    await expect(checkPopupGitHubConnection(authClient)).resolves.toMatchObject({
      connected: true,
    });
    const cachedVerification = localSet.mock.calls[0]?.[0];
    localGet.mockResolvedValue({ ...settings, ...cachedVerification });
    await expect(checkPopupGitHubConnection(authClient)).resolves.toMatchObject({
      connected: true,
    });

    expect(authClient.syncGitHubApp).toHaveBeenCalledOnce();
  });

  it('fresh action checks ignore the popup verification cache', async () => {
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        user: { id: 'user-123' },
      }),
    });
    const settings = {
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    localGet.mockResolvedValue(settings);

    await checkPopupGitHubConnection(authClient);
    const cachedVerification = localSet.mock.calls[0]?.[0];
    localGet.mockResolvedValue({ ...settings, ...cachedVerification });
    await checkGitHubConnection(authClient);

    expect(authClient.syncGitHubApp).toHaveBeenCalledTimes(2);
  });

  it('popup checks bypass cached verification when the GitHub token is near expiry', async () => {
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        user: { id: 'user-123' },
      }),
    });
    const settings = {
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: new Date(Date.now() + 30_000).toISOString(),
    };
    localGet.mockResolvedValue(settings);

    await checkPopupGitHubConnection(authClient);
    const cachedVerification = localSet.mock.calls[0]?.[0];
    localGet.mockResolvedValue({ ...settings, ...cachedVerification });
    await checkPopupGitHubConnection(authClient);

    expect(authClient.syncGitHubApp).toHaveBeenCalledTimes(2);
  });

  it('popup checks bypass cached verification after the authenticated user changes', async () => {
    const getAuthState = vi
      .fn()
      .mockResolvedValueOnce({ isAuthenticated: true, user: { id: 'user-123' } })
      .mockResolvedValueOnce({ isAuthenticated: true, user: { id: 'user-456' } });
    const authClient = createAuthClient({ getAuthState });
    const settings = {
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    localGet.mockResolvedValue(settings);

    await checkPopupGitHubConnection(authClient);
    const cachedVerification = localSet.mock.calls[0]?.[0];
    localGet.mockResolvedValue({ ...settings, ...cachedVerification });
    await checkPopupGitHubConnection(authClient);

    expect(authClient.syncGitHubApp).toHaveBeenCalledTimes(2);
  });

  it('popup checks refresh after the sixty-second cache window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T00:00:00.000Z'));
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        user: { id: 'user-123' },
      }),
    });
    const settings = {
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: '2026-07-13T00:10:00.000Z',
    };
    localGet.mockResolvedValue(settings);

    try {
      await checkPopupGitHubConnection(authClient);
      const cachedVerification = localSet.mock.calls[0]?.[0];
      localGet.mockResolvedValue({ ...settings, ...cachedVerification });
      vi.advanceTimersByTime(60_001);
      await checkPopupGitHubConnection(authClient);

      expect(authClient.syncGitHubApp).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('popup checks bypass cached verification after the installation changes', async () => {
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        user: { id: 'user-123' },
      }),
    });
    const settings = {
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    localGet.mockResolvedValue(settings);

    await checkPopupGitHubConnection(authClient);
    const cachedVerification = localSet.mock.calls[0]?.[0];
    localGet.mockResolvedValue({
      ...settings,
      ...cachedVerification,
      githubAppInstallationId: 67890,
    });
    await checkPopupGitHubConnection(authClient);

    expect(authClient.syncGitHubApp).toHaveBeenCalledTimes(2);
  });

  it('popup checks do not cache disconnected results', async () => {
    const authClient = createAuthClient({
      getAuthState: vi.fn().mockResolvedValue({
        isAuthenticated: true,
        user: { id: 'user-123' },
      }),
      syncGitHubApp: vi.fn().mockResolvedValue(false),
    });
    localGet.mockResolvedValue({
      authenticationMethod: 'github_app',
      githubAppInstallationId: 12345,
      githubAppExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    await checkPopupGitHubConnection(authClient);
    await checkPopupGitHubConnection(authClient);

    expect(authClient.syncGitHubApp).toHaveBeenCalledTimes(2);
    expect(localSet).not.toHaveBeenCalled();
  });
});
