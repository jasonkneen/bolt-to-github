import { BackgroundAuthClient } from '$lib/services/BackgroundAuthClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PremiumService } from '../PremiumService';
import { SupabaseAuthService } from '../SupabaseAuthService';

vi.mock('$lib/services/BackgroundAuthClient', () => ({
  BackgroundAuthClient: vi.fn(),
}));

vi.mock('../SupabaseAuthService', () => ({
  SupabaseAuthService: {
    getInstance: vi.fn(() => ({
      validateSubscriptionStatus: vi.fn().mockResolvedValue(true),
    })),
  },
}));

type MockBackgroundAuthClient = {
  validateSubscription: ReturnType<typeof vi.fn>;
};

const premiumFeatures = {
  viewFileChanges: true,
  pushReminders: true,
  branchSelector: true,
  githubIssues: true,
};

function installChromeMocks(): void {
  (chrome.storage as unknown as { onChanged: typeof chrome.storage.onChanged }).onChanged = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as typeof chrome.storage.onChanged;
  chrome.storage.local.get = vi.fn().mockResolvedValue({});
  chrome.storage.local.set = vi.fn().mockResolvedValue(undefined);
  chrome.storage.sync.get = vi.fn().mockResolvedValue({});
  chrome.storage.sync.set = vi.fn().mockResolvedValue(undefined);
}

function useBackgroundAuthClient(
  validateSubscription: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(true)
): MockBackgroundAuthClient {
  const client = { validateSubscription };
  vi.mocked(BackgroundAuthClient).mockImplementation(() => client as never);
  return client;
}

async function markPremium(service: PremiumService): Promise<void> {
  await service.updatePremiumStatus({
    isAuthenticated: true,
    isPremium: true,
    features: premiumFeatures,
  });
  await Promise.resolve();
}

describe('PremiumService background auth client migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installChromeMocks();
    useBackgroundAuthClient();
  });

  it('subscription validation asks the background instead of creating a local auth service', async () => {
    const authClient = useBackgroundAuthClient(vi.fn().mockResolvedValue(true));
    const service = new PremiumService();
    await markPremium(service);

    await expect(service.isPremium()).resolves.toBe(true);

    expect(BackgroundAuthClient).toHaveBeenCalledTimes(1);
    expect(authClient.validateSubscription).toHaveBeenCalledTimes(1);
    expect(SupabaseAuthService.getInstance).not.toHaveBeenCalled();
  });

  it('invalid subscription from background triggers downgrade handling', async () => {
    useBackgroundAuthClient(vi.fn().mockResolvedValue(false));
    const service = new PremiumService();
    await markPremium(service);

    await expect(service.isPremium()).resolves.toBe(false);
    await Promise.resolve();

    expect(service.getStatus()).toMatchObject({
      isAuthenticated: false,
      isPremium: false,
      features: {
        viewFileChanges: false,
        pushReminders: false,
        branchSelector: false,
        githubIssues: false,
      },
    });
    expect(SupabaseAuthService.getInstance).not.toHaveBeenCalled();
  });

  it('messaging failure falls back to cached premium status with a visible warning', async () => {
    const warningSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    useBackgroundAuthClient(vi.fn().mockRejectedValue(new Error('Extension context invalidated')));
    const service = new PremiumService();
    await markPremium(service);

    await expect(service.isPremium()).resolves.toBe(true);

    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PremiumService]'),
      'Failed to validate subscription with server:',
      expect.any(Error)
    );
    expect(SupabaseAuthService.getInstance).not.toHaveBeenCalled();
    warningSpy.mockRestore();
  });
});
