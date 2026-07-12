/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  })),
}));

const localData: Record<string, unknown> = {
  supabaseToken: 'supabase-token',
  supabaseTokenExpiry: Date.now() + 60 * 60 * 1000,
  extensionSessionMinted: true,
};

global.chrome = {
  runtime: { id: 'test-extension', sendMessage: vi.fn() },
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[]) => {
        const requested = typeof keys === 'string' ? [keys] : (keys ?? Object.keys(localData));
        return requested.reduce<Record<string, unknown>>((result, key) => {
          result[key] = localData[key];
          return result;
        }, {});
      }),
      set: vi.fn(async (items: Record<string, unknown>) => Object.assign(localData, items)),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const key of typeof keys === 'string' ? [keys] : keys) {
          delete localData[key];
        }
      }),
    },
    sync: { get: vi.fn(async () => ({})), set: vi.fn() },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: { query: vi.fn(async () => []), sendMessage: vi.fn(), create: vi.fn() },
  alarms: { create: vi.fn(), clear: vi.fn(async () => true) },
} as any;

import { SupabaseAuthService } from '../SupabaseAuthService';
import { stableGitHubAppInstallationId } from '../githubAppIdentity';

describe('SupabaseAuthService - stable GitHub App metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete localData.githubAppInstallationId;
    (SupabaseAuthService as any).instance = null;
  });

  it('accepts only a stable positive server-provided installation ID', () => {
    expect(stableGitHubAppInstallationId(12345)).toBe(12345);
    expect(stableGitHubAppInstallationId(undefined)).toBeUndefined();
    expect(stableGitHubAppInstallationId(null)).toBeUndefined();
    expect(stableGitHubAppInstallationId(0)).toBeUndefined();
    expect(stableGitHubAppInstallationId(Number.NaN)).toBeUndefined();
    expect(stableGitHubAppInstallationId(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(stableGitHubAppInstallationId(-1)).toBeUndefined();
    expect(stableGitHubAppInstallationId('12345' as unknown as number)).toBeUndefined();
  });

  it('does not synthesize a changing installation ID when the edge response omits it', async () => {
    localData.githubAppInstallationId = 1783806518231;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1', email: 'user@example.com' }), {
          status: 200,
        });
      }
      if (url.includes('/rest/v1/profiles')) {
        return new Response(JSON.stringify([{ subscription_status: 'inactive' }]), { status: 200 });
      }
      if (url.includes('/functions/v1/get-github-token')) {
        return new Response(
          JSON.stringify({
            type: 'github_app',
            access_token: 'github-token',
            github_username: 'octocat',
            expires_at: '2026-07-12T02:00:00Z',
            scopes: ['repo'],
          }),
          { status: 200 }
        );
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ login: 'octocat', avatar_url: 'avatar' }), {
          status: 200,
        });
      }
      return new Response('{}', { status: 404 });
    }) as any;

    const service = SupabaseAuthService.getInstance();
    await service.forceCheck();

    const installationValues = (chrome.storage.local.set as any).mock.calls
      .filter(([items]: [Record<string, unknown>]) => 'githubAppInstallationId' in items)
      .map(([items]: [Record<string, unknown>]) => items.githubAppInstallationId);

    expect(installationValues.every((value: unknown) => value == null)).toBe(true);
    expect(installationValues.some((value: unknown) => typeof value === 'number')).toBe(false);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining('get-github-token contract violation')
    );
    expect(localData.githubAppInstallationId).toBe(1783806518231);
    expect(chrome.storage.local.remove).not.toHaveBeenCalledWith('githubAppInstallationId');
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NOTIFY_GITHUB_APP_SYNC' })
    );
    expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ authenticationMethod: 'github_app' })
    );
  });

  it('persists the exact positive installation ID supplied by the edge response', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1', email: 'user@example.com' }), {
          status: 200,
        });
      }
      if (url.includes('/rest/v1/profiles')) {
        return new Response(JSON.stringify([{ subscription_status: 'inactive' }]), { status: 200 });
      }
      if (url.includes('/functions/v1/get-github-token')) {
        return new Response(
          JSON.stringify({
            type: 'github_app',
            access_token: 'github-token',
            installation_id: 12345,
            github_username: 'octocat',
            expires_at: '2026-07-12T02:00:00Z',
            scopes: ['repo'],
          }),
          { status: 200 }
        );
      }
      if (url === 'https://api.github.com/user') {
        return new Response(JSON.stringify({ login: 'octocat', avatar_url: 'avatar' }), {
          status: 200,
        });
      }
      return new Response('{}', { status: 404 });
    }) as any;

    const service = SupabaseAuthService.getInstance();
    await service.forceCheck();

    const installationValues = (chrome.storage.local.set as any).mock.calls
      .filter(([items]: [Record<string, unknown>]) => 'githubAppInstallationId' in items)
      .map(([items]: [Record<string, unknown>]) => items.githubAppInstallationId);

    expect(installationValues).toContain(12345);
    expect(installationValues.every((value: unknown) => value === 12345)).toBe(true);
  });
});
