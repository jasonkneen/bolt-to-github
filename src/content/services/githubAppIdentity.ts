export function stableGitHubAppInstallationId(
  installationId: number | null | undefined
): number | undefined {
  return typeof installationId === 'number' && Number.isFinite(installationId) && installationId > 0
    ? installationId
    : undefined;
}
