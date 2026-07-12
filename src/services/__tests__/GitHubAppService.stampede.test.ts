import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setupCommonMockResponses,
  setupGitHubAppServiceTest,
  type GitHubAppServiceTestEnvironment,
} from './test-fixtures';

describe('GitHubAppService request coalescing', () => {
  let env: GitHubAppServiceTestEnvironment;

  beforeEach(() => {
    env = setupGitHubAppServiceTest({
      useRealService: true,
      withSupabaseToken: true,
    });
    setupCommonMockResponses(env.fetchMock, 'success');
  });

  afterEach(() => {
    env.cleanup();
  });

  it('turns one hundred direct service token requests into one Edge Function request', async () => {
    const requests = Array.from({ length: 100 }, () => env.service.getAccessToken());

    const results = await Promise.all(requests);
    const tokenRequests = env.fetchMock
      .getCallHistory()
      .filter((call) => call.url.includes('/functions/v1/get-github-token'));

    expect(results).toHaveLength(100);
    expect(results.every((result) => result.access_token.length > 0)).toBe(true);
    expect(tokenRequests).toHaveLength(1);
  });

  it('coalesces token retrieval shared by direct and validation callers', async () => {
    const requests = [
      env.service.getAccessToken(),
      ...Array.from({ length: 20 }, () => env.service.validateAuth()),
    ];

    await Promise.all(requests);
    const tokenRequests = env.fetchMock
      .getCallHistory()
      .filter((call) => call.url.includes('/functions/v1/get-github-token'));

    expect(tokenRequests).toHaveLength(1);
  });

  it('keeps in-flight token requests isolated across Supabase identity changes', async () => {
    let resolveUserA: ((response: Response) => void) | undefined;
    let resolveUserB: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((_, options?: RequestInit) => {
      const authorization = (options?.headers as Record<string, string>)?.Authorization;
      return new Promise<Response>((resolve) => {
        if (authorization === 'Bearer supabase-user-a') {
          resolveUserA = resolve;
        } else if (authorization === 'Bearer supabase-user-b') {
          resolveUserB = resolve;
        }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    env.service.setUserToken('supabase-user-a');
    const userARequest = env.service.getAccessToken();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    env.service.setUserToken('supabase-user-b');
    const userBRequest = env.service.getAccessToken();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    resolveUserB?.(createTokenResponse('github-token-b'));
    await expect(userBRequest).resolves.toMatchObject({ access_token: 'github-token-b' });
    resolveUserA?.(createTokenResponse('github-token-a'));
    await expect(userARequest).resolves.toMatchObject({ access_token: 'github-token-a' });
  });
});

function createTokenResponse(accessToken: string): Response {
  return {
    ok: true,
    json: async () => ({
      access_token: accessToken,
      github_username: 'octocat',
      expires_at: '2099-01-01T00:00:00.000Z',
      scopes: ['repo'],
      type: 'github_app',
      renewed: false,
    }),
  } as Response;
}
