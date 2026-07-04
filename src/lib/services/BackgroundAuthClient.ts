import type { AuthMessageResponse, AuthMessageType } from '../../background/AuthMessageRouter';
import type { AuthState } from '../../content/services/SupabaseAuthService';

type RuntimeAuthMessage = {
  type: AuthMessageType;
};

export class BackgroundAuthClient {
  async getAuthState(): Promise<AuthState> {
    const response = await this.sendAuthMessage('GET_AUTH_STATE');

    if (!isAuthState(response.authState)) {
      throw new Error('Background auth response was missing auth state');
    }

    return response.authState;
  }

  async forceCheck(): Promise<void> {
    await this.sendAuthMessage('FORCE_AUTH_CHECK');
  }

  async enterPostConnectionMode(): Promise<void> {
    await this.sendAuthMessage('ENTER_POST_CONNECTION_MODE');
  }

  async syncGitHubApp(): Promise<boolean> {
    return this.sendBooleanResultMessage('SYNC_GITHUB_APP');
  }

  async validateSubscription(): Promise<boolean> {
    return this.sendBooleanResultMessage('VALIDATE_SUBSCRIPTION');
  }

  async logout(): Promise<void> {
    await this.sendAuthMessage('AUTH_LOGOUT');
  }

  private async sendBooleanResultMessage(type: AuthMessageType): Promise<boolean> {
    const response = await this.sendAuthMessage(type);

    if (typeof response.result !== 'boolean') {
      throw new Error('Background auth response was missing a boolean result');
    }

    return response.result;
  }

  private async sendAuthMessage(type: AuthMessageType): Promise<AuthMessageResponse> {
    let response: unknown;

    try {
      response = await chrome.runtime.sendMessage({ type } satisfies RuntimeAuthMessage);
    } catch (error) {
      throw toBackgroundAuthError(error);
    }

    if (!isAuthMessageResponse(response)) {
      throw new Error('Background auth response was invalid');
    }

    if (!response.success) {
      throw new Error(response.error || 'Background auth operation failed');
    }

    return response;
  }
}

function isAuthMessageResponse(value: unknown): value is AuthMessageResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as { success?: unknown }).success === 'boolean';
}

function isAuthState(value: unknown): value is AuthState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as { isAuthenticated?: unknown }).isAuthenticated === 'boolean';
}

function toBackgroundAuthError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error('Background auth message failed');
}
