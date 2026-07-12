import type { AuthState } from '../../content/services/SupabaseAuthService';
import { BackgroundAuthClient } from '../services/BackgroundAuthClient';

export type GitHubConnectionFailureReason = 'not_authenticated' | 'not_connected' | 'unavailable';

export interface GitHubConnectionResult {
  connected: boolean;
  reason?: GitHubConnectionFailureReason;
  message: string;
}

export interface GitHubConnectionAuthClient {
  getAuthState: () => Promise<AuthState>;
  syncGitHubApp: () => Promise<boolean>;
}

const CONNECTED_MESSAGE = 'GitHub is connected.';
const SIGN_IN_MESSAGE = 'Sign in to bolt2github.com before using GitHub features.';
const CONNECT_MESSAGE = 'Connect GitHub at bolt2github.com before using GitHub features.';

export async function checkGitHubConnection(
  authClient?: GitHubConnectionAuthClient
): Promise<GitHubConnectionResult> {
  try {
    const connectionAuthClient = authClient ?? new BackgroundAuthClient();
    const [localSettings, syncSettings] = await Promise.all([
      chrome.storage.local.get(['authenticationMethod']),
      chrome.storage.sync.get(['githubToken']),
    ]);

    const authenticationMethod = localSettings.authenticationMethod || 'pat';
    const githubToken = syncSettings.githubToken;
    if (
      authenticationMethod === 'pat' &&
      typeof githubToken === 'string' &&
      githubToken.trim().length > 0
    ) {
      return { connected: true, message: CONNECTED_MESSAGE };
    }

    const authState = await connectionAuthClient.getAuthState();
    if (!authState.isAuthenticated) {
      return {
        connected: false,
        reason: 'not_authenticated',
        message: SIGN_IN_MESSAGE,
      };
    }

    const hasGitHubApp = await connectionAuthClient.syncGitHubApp();
    if (!hasGitHubApp) {
      return {
        connected: false,
        reason: 'not_connected',
        message: CONNECT_MESSAGE,
      };
    }

    return { connected: true, message: CONNECTED_MESSAGE };
  } catch (error) {
    return {
      connected: false,
      reason: 'unavailable',
      message: `Unable to verify the GitHub connection: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}
