import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostPushTeaserService, type PostPushTeaserDeps } from '../PostPushTeaserService';

const NOW = 1_800_000_000_000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

type ShowTeaserOptions = Parameters<PostPushTeaserDeps['showTeaser']>[0];

function createStorage(initial: Record<string, unknown> = {}) {
  const data = { ...initial };

  return {
    data,
    get: vi.fn(async (keys: string[]) =>
      keys.reduce<Record<string, unknown>>((result, key) => {
        if (key in data) {
          result[key] = data[key];
        }
        return result;
      }, {})
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
  };
}

function createService(overrides: Partial<PostPushTeaserDeps> = {}) {
  const storage = createStorage();
  const deps: PostPushTeaserDeps = {
    isPremium: vi.fn(async () => false),
    isAuthenticated: vi.fn(async () => true),
    showTeaser: vi.fn(),
    storage,
    now: vi.fn(() => NOW),
    trackUpgradeEvent: vi.fn(),
    ...overrides,
  };

  return {
    service: new PostPushTeaserService(deps),
    deps,
    storage,
  };
}

describe('PostPushTeaserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the teaser to a free user who has never seen it and persists the shown timestamp', async () => {
    const { service, deps, storage } = createService();

    await expect(service.maybeShowTeaser()).resolves.toBe(true);

    expect(deps.isAuthenticated).toHaveBeenCalledOnce();
    expect(deps.isPremium).toHaveBeenCalledOnce();
    expect(storage.set).toHaveBeenCalledWith({
      postPushProTeaserLastShownAt: NOW,
    });
    expect(deps.showTeaser).toHaveBeenCalledOnce();
    expect(deps.trackUpgradeEvent).toHaveBeenCalledWith('modal_shown', {
      context: 'post_push_teaser',
      medium: 'content',
    });
  });

  it('never shows the teaser to a premium user', async () => {
    const { service, deps, storage } = createService({
      isPremium: vi.fn(async () => true),
    });

    await expect(service.maybeShowTeaser()).resolves.toBe(false);

    expect(deps.showTeaser).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(deps.trackUpgradeEvent).not.toHaveBeenCalled();
  });

  it('never shows the teaser to a signed-out user', async () => {
    const { service, deps, storage } = createService({
      isAuthenticated: vi.fn(async () => false),
    });

    await expect(service.maybeShowTeaser()).resolves.toBe(false);

    expect(deps.isPremium).not.toHaveBeenCalled();
    expect(deps.showTeaser).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('honors the dismissed-forever flag across calls', async () => {
    const storage = createStorage();
    const { service, deps } = createService({ storage });

    await expect(service.maybeShowTeaser()).resolves.toBe(true);
    const options = vi.mocked(deps.showTeaser).mock.calls[0][0] as ShowTeaserOptions;

    await options.onDismissForever();
    await expect(service.maybeShowTeaser()).resolves.toBe(false);

    expect(storage.data.postPushProTeaserDismissedForever).toBe(true);
    expect(deps.showTeaser).toHaveBeenCalledTimes(1);
  });

  it('suppresses the teaser within the 7-day frequency window and shows again after it', async () => {
    const storage = createStorage({
      postPushProTeaserLastShownAt: NOW,
    });
    const { service, deps } = createService({
      storage,
      now: vi.fn(() => NOW + SEVEN_DAYS - 1),
    });

    await expect(service.maybeShowTeaser()).resolves.toBe(false);
    expect(deps.showTeaser).not.toHaveBeenCalled();

    vi.mocked(deps.now).mockReturnValue(NOW + SEVEN_DAYS);

    await expect(service.maybeShowTeaser()).resolves.toBe(true);
    expect(deps.showTeaser).toHaveBeenCalledOnce();
  });

  it('returns false without throwing when premium lookup storage or notification display fails', async () => {
    const premiumFailure = createService({
      isPremium: vi.fn(async () => {
        throw new Error('premium unavailable');
      }),
    });
    const storageFailure = createService({
      storage: {
        get: vi.fn(async () => {
          throw new Error('storage unavailable');
        }),
        set: vi.fn(async () => undefined),
      },
    });
    const notificationFailureStorage = createStorage();
    const notificationFailure = createService({
      storage: notificationFailureStorage,
      showTeaser: vi.fn(() => {
        throw new Error('notification unavailable');
      }),
    });

    await expect(premiumFailure.service.maybeShowTeaser()).resolves.toBe(false);
    await expect(storageFailure.service.maybeShowTeaser()).resolves.toBe(false);
    await expect(notificationFailure.service.maybeShowTeaser()).resolves.toBe(false);

    expect(premiumFailure.deps.showTeaser).not.toHaveBeenCalled();
    expect(storageFailure.deps.showTeaser).not.toHaveBeenCalled();
    expect(notificationFailureStorage.set).not.toHaveBeenCalled();
  });

  it('teaser upgrade URL carries post_push_teaser UTM attribution', async () => {
    const { service, deps } = createService();

    await expect(service.maybeShowTeaser()).resolves.toBe(true);

    const options = vi.mocked(deps.showTeaser).mock.calls[0][0] as ShowTeaserOptions;
    const upgradeUrl = new URL(options.upgradeUrl);

    expect(upgradeUrl.origin).toBe('https://bolt2github.com');
    expect(upgradeUrl.pathname).toBe('/upgrade');
    expect(upgradeUrl.searchParams.get('utm_source')).toBe('extension');
    expect(upgradeUrl.searchParams.get('utm_medium')).toBe('content');
    expect(upgradeUrl.searchParams.get('utm_campaign')).toBe('upgrade');
    expect(upgradeUrl.searchParams.get('utm_content')).toBe('post_push_teaser');

    options.onUpgrade();

    expect(deps.trackUpgradeEvent).toHaveBeenCalledWith('cta_clicked', {
      context: 'post_push_teaser',
      medium: 'content',
    });
  });
});
