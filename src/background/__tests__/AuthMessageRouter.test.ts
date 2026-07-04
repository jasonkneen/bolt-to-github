import { describe, expect, it, vi } from 'vitest';
import type { AuthState } from '../../content/services/SupabaseAuthService';
import {
  AuthMessageRouter,
  type AuthMessageResponse,
  type AuthMessageType,
} from '../AuthMessageRouter';

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

const flushAsyncResponse = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const createAuthService = () => ({
  getAuthState: vi.fn(() => authenticatedState),
  forceCheck: vi.fn(async () => undefined),
  enterPostConnectionMode: vi.fn(() => undefined),
  syncGitHubApp: vi.fn(async () => true),
  validateSubscriptionStatus: vi.fn(async () => true),
  logout: vi.fn(async () => undefined),
});

const handledMessages: AuthMessageType[] = [
  'GET_AUTH_STATE',
  'FORCE_AUTH_CHECK',
  'ENTER_POST_CONNECTION_MODE',
  'SYNC_GITHUB_APP',
  'VALIDATE_SUBSCRIPTION',
  'AUTH_LOGOUT',
];

describe('AuthMessageRouter', () => {
  it('GET_AUTH_STATE responds with the background auth state', async () => {
    const authService = createAuthService();
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage({ type: 'GET_AUTH_STATE' }, sendResponse);

    expect(returnValue).toBe(true);
    await flushAsyncResponse();

    expect(authService.getAuthState).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      authState: authenticatedState,
    });
  });

  it('FORCE_AUTH_CHECK triggers a check and responds success', async () => {
    const authService = createAuthService();
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage({ type: 'FORCE_AUTH_CHECK' }, sendResponse);

    expect(returnValue).toBe(true);
    await flushAsyncResponse();

    expect(authService.forceCheck).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('SYNC_GITHUB_APP responds with the sync result', async () => {
    const authService = createAuthService();
    authService.syncGitHubApp.mockResolvedValueOnce(false);
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage({ type: 'SYNC_GITHUB_APP' }, sendResponse);

    expect(returnValue).toBe(true);
    await flushAsyncResponse();

    expect(authService.syncGitHubApp).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true, result: false });
  });

  it('VALIDATE_SUBSCRIPTION responds with the validation result', async () => {
    const authService = createAuthService();
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage({ type: 'VALIDATE_SUBSCRIPTION' }, sendResponse);

    expect(returnValue).toBe(true);
    await flushAsyncResponse();

    expect(authService.validateSubscriptionStatus).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true, result: true });
  });

  it('AUTH_LOGOUT performs full logout and responds success', async () => {
    const authService = createAuthService();
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage({ type: 'AUTH_LOGOUT' }, sendResponse);

    expect(returnValue).toBe(true);
    await flushAsyncResponse();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  it('handleMessage returns literal true synchronously for handled async messages', () => {
    const authService = createAuthService();
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValues = handledMessages.map((type) =>
      router.handleMessage({ type }, sendResponse)
    );

    expect(returnValues).toEqual([true, true, true, true, true, true]);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('handleMessage returns false for unrelated message types', () => {
    const authService = createAuthService();
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage(
      { type: 'UNRELATED_MESSAGE' as AuthMessageType },
      sendResponse
    );

    expect(returnValue).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(authService.forceCheck).not.toHaveBeenCalled();
  });

  it('auth service failures surface as error responses instead of silence', async () => {
    const authService = createAuthService();
    authService.forceCheck.mockRejectedValueOnce(new Error('auth check failed'));
    const router = new AuthMessageRouter(authService);
    const sendResponse = vi.fn<[AuthMessageResponse], void>();

    const returnValue = router.handleMessage({ type: 'FORCE_AUTH_CHECK' }, sendResponse);

    expect(returnValue).toBe(true);
    await flushAsyncResponse();

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'auth check failed',
    });

    authService.enterPostConnectionMode.mockImplementationOnce(() => {
      throw new Error('post-connection mode failed');
    });
    sendResponse.mockClear();

    const syncThrowReturnValue = router.handleMessage(
      { type: 'ENTER_POST_CONNECTION_MODE' },
      sendResponse
    );

    expect(syncThrowReturnValue).toBe(true);
    await flushAsyncResponse();

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'post-connection mode failed',
    });
  });
});
