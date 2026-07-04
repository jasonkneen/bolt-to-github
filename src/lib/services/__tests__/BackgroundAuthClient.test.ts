import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../../../content/services/SupabaseAuthService';
import { BackgroundAuthClient } from '../BackgroundAuthClient';

const authenticatedState: AuthState = {
  isAuthenticated: true,
  user: {
    id: 'user-123',
    email: 'user@example.com',
    created_at: '2026-07-04T00:00:00.000Z',
    updated_at: '2026-07-04T00:00:00.000Z',
  },
  subscription: {
    isActive: true,
    plan: 'monthly',
  },
};

describe('BackgroundAuthClient', () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sendMessage = vi.fn();
    chrome.runtime.sendMessage = sendMessage as never;
  });

  it('getAuthState returns the auth state provided by the background', async () => {
    sendMessage.mockResolvedValueOnce({
      success: true,
      authState: authenticatedState,
    });
    const client = new BackgroundAuthClient();

    await expect(client.getAuthState()).resolves.toEqual(authenticatedState);

    expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_AUTH_STATE' });
  });

  it('forceCheck resolves when background acknowledges', async () => {
    sendMessage.mockResolvedValueOnce({ success: true });
    const client = new BackgroundAuthClient();

    await expect(client.forceCheck()).resolves.toBeUndefined();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'FORCE_AUTH_CHECK' });
  });

  it('enterPostConnectionMode sends the post-connection message', async () => {
    sendMessage.mockResolvedValueOnce({ success: true });
    const client = new BackgroundAuthClient();

    await expect(client.enterPostConnectionMode()).resolves.toBeUndefined();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'ENTER_POST_CONNECTION_MODE' });
  });

  it('syncGitHubApp and validateSubscription return background results', async () => {
    sendMessage.mockResolvedValueOnce({ success: true, result: false });
    sendMessage.mockResolvedValueOnce({ success: true, result: true });
    const client = new BackgroundAuthClient();

    await expect(client.syncGitHubApp()).resolves.toBe(false);
    await expect(client.validateSubscription()).resolves.toBe(true);

    expect(sendMessage).toHaveBeenNthCalledWith(1, { type: 'SYNC_GITHUB_APP' });
    expect(sendMessage).toHaveBeenNthCalledWith(2, { type: 'VALIDATE_SUBSCRIPTION' });
  });

  it('logout resolves on background acknowledgement', async () => {
    sendMessage.mockResolvedValueOnce({ success: true });
    const client = new BackgroundAuthClient();

    await expect(client.logout()).resolves.toBeUndefined();

    expect(sendMessage).toHaveBeenCalledWith({ type: 'AUTH_LOGOUT' });
  });

  it('transport failure surfaces as a thrown error not a fake state', async () => {
    sendMessage.mockRejectedValueOnce(new Error('Extension context invalidated'));
    const client = new BackgroundAuthClient();

    await expect(client.getAuthState()).rejects.toThrow('Extension context invalidated');

    expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_AUTH_STATE' });
  });

  it('background error responses are thrown with the background message', async () => {
    sendMessage.mockResolvedValueOnce({
      success: false,
      error: 'background auth failed',
    });
    const client = new BackgroundAuthClient();

    await expect(client.forceCheck()).rejects.toThrow('background auth failed');

    expect(sendMessage).toHaveBeenCalledWith({ type: 'FORCE_AUTH_CHECK' });
  });
});
