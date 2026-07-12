export function resolveStoredGitHubAuthenticationMethod(
  storedAuthenticationMethod: unknown,
  githubAppInstallationId: unknown
): 'pat' | 'github_app' {
  const hasStableInstallationId =
    typeof githubAppInstallationId === 'number' &&
    Number.isSafeInteger(githubAppInstallationId) &&
    githubAppInstallationId > 0;

  return storedAuthenticationMethod === 'github_app' && hasStableInstallationId
    ? 'github_app'
    : 'pat';
}

export class SingleFlight<T> {
  private inFlight: Promise<T> | null = null;

  run(operation: () => Promise<T>): Promise<T> {
    if (this.inFlight) {
      return this.inFlight;
    }

    let operationPromise: Promise<T>;
    try {
      operationPromise = operation();
    } catch (error) {
      return Promise.reject(error);
    }

    const sharedPromise = operationPromise.then(
      (value) => {
        if (this.inFlight === sharedPromise) {
          this.inFlight = null;
        }
        return value;
      },
      (error: unknown) => {
        if (this.inFlight === sharedPromise) {
          this.inFlight = null;
        }
        throw error;
      }
    );

    this.inFlight = sharedPromise;
    return sharedPromise;
  }
}
