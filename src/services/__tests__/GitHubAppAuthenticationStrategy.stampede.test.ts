import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubAppAuthenticationStrategy } from '../GitHubAppAuthenticationStrategy';
import type { GitHubAppTokenResponse } from '../types/authentication';

const serviceMocks = vi.hoisted(() => ({
  getAccessToken: vi.fn<[], Promise<GitHubAppTokenResponse>>(),
  setUserToken: vi.fn<[string], void>(),
}));

vi.mock('../GitHubAppService', () => ({
  GitHubAppService: vi.fn().mockImplementation(() => ({
    getAccessToken: serviceMocks.getAccessToken,
    setUserToken: serviceMocks.setUserToken,
  })),
}));

function tokenResponse(accessToken: string): GitHubAppTokenResponse {
  return {
    access_token: accessToken,
    github_username: 'octocat',
    expires_at: '2099-01-01T00:00:00.000Z',
    scopes: ['repo'],
    type: 'github_app',
    renewed: false,
  };
}

describe('GitHubAppAuthenticationStrategy request coalescing', () => {
  beforeEach(() => {
    serviceMocks.getAccessToken.mockReset();
    serviceMocks.setUserToken.mockReset();
  });

  it('invalidates a cached GitHub token when the Supabase identity changes', async () => {
    serviceMocks.getAccessToken
      .mockResolvedValueOnce(tokenResponse('github-token-a'))
      .mockResolvedValueOnce(tokenResponse('github-token-b'));
    const strategy = new GitHubAppAuthenticationStrategy();

    strategy.setUserToken('supabase-user-a');
    await expect(strategy.getToken()).resolves.toBe('github-token-a');
    strategy.setUserToken('supabase-user-b');
    await expect(strategy.getToken()).resolves.toBe('github-token-b');

    expect(serviceMocks.getAccessToken).toHaveBeenCalledTimes(2);
  });

  it('prevents an older in-flight identity from overwriting the newer token cache', async () => {
    let resolveUserA: ((value: GitHubAppTokenResponse) => void) | undefined;
    let resolveUserB: ((value: GitHubAppTokenResponse) => void) | undefined;
    serviceMocks.getAccessToken
      .mockImplementationOnce(
        () =>
          new Promise<GitHubAppTokenResponse>((resolve) => {
            resolveUserA = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<GitHubAppTokenResponse>((resolve) => {
            resolveUserB = resolve;
          })
      );
    const strategy = new GitHubAppAuthenticationStrategy();

    strategy.setUserToken('supabase-user-a');
    const userARequest = strategy.getToken();
    strategy.setUserToken('supabase-user-b');
    const userBRequest = strategy.getToken();

    expect(serviceMocks.getAccessToken).toHaveBeenCalledTimes(2);
    resolveUserB?.(tokenResponse('github-token-b'));
    await expect(userBRequest).resolves.toBe('github-token-b');
    resolveUserA?.(tokenResponse('github-token-a'));
    await expect(userARequest).resolves.toBe('github-token-a');
    await expect(strategy.getToken()).resolves.toBe('github-token-b');
    expect(serviceMocks.getAccessToken).toHaveBeenCalledTimes(2);
  });
});
