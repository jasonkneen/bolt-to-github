import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkGitHubConnection,
  type GitHubConnectionAuthClient,
  type GitHubConnectionFailureReason,
  type GitHubConnectionResult,
} from '../githubConnection';

const localGet = vi.fn();
const syncGet = vi.fn();

global.chrome = {
  storage: {
    local: { get: localGet },
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
});
