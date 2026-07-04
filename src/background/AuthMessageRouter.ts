import type { AuthState, SupabaseAuthService } from '../content/services/SupabaseAuthService';

export type AuthMessageType =
  | 'GET_AUTH_STATE'
  | 'FORCE_AUTH_CHECK'
  | 'ENTER_POST_CONNECTION_MODE'
  | 'SYNC_GITHUB_APP'
  | 'VALIDATE_SUBSCRIPTION'
  | 'AUTH_LOGOUT';

export interface AuthMessageResponse {
  success: boolean;
  authState?: AuthState;
  result?: boolean;
  error?: string;
}

type AuthServiceDependency = Pick<
  SupabaseAuthService,
  | 'getAuthState'
  | 'forceCheck'
  | 'enterPostConnectionMode'
  | 'syncGitHubApp'
  | 'validateSubscriptionStatus'
  | 'logout'
>;

export class AuthMessageRouter {
  constructor(private readonly authService: AuthServiceDependency) {}

  handleMessage(
    message: { type: AuthMessageType },
    sendResponse: (response: AuthMessageResponse) => void
  ): boolean {
    const operation = this.resolveOperation(message.type);

    if (!operation) {
      return false;
    }

    Promise.resolve()
      .then(operation)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Auth message failed',
        });
      });

    return true;
  }

  private resolveOperation(
    type: AuthMessageType
  ): (() => Promise<AuthMessageResponse>) | undefined {
    switch (type) {
      case 'GET_AUTH_STATE':
        return async () => {
          return {
            success: true,
            authState: this.authService.getAuthState(),
          };
        };
      case 'FORCE_AUTH_CHECK':
        return () => Promise.resolve(this.authService.forceCheck()).then(() => ({ success: true }));
      case 'ENTER_POST_CONNECTION_MODE':
        return () => {
          this.authService.enterPostConnectionMode();
          return Promise.resolve({ success: true });
        };
      case 'SYNC_GITHUB_APP':
        return () =>
          Promise.resolve(this.authService.syncGitHubApp()).then((result) => ({
            success: true,
            result,
          }));
      case 'VALIDATE_SUBSCRIPTION':
        return () =>
          Promise.resolve(this.authService.validateSubscriptionStatus()).then((result) => ({
            success: true,
            result,
          }));
      case 'AUTH_LOGOUT':
        return () => Promise.resolve(this.authService.logout()).then(() => ({ success: true }));
      default:
        return undefined;
    }
  }
}
