const DISMISSED_FOREVER_KEY = 'postPushProTeaserDismissedForever';
const LAST_SHOWN_AT_KEY = 'postPushProTeaserLastShownAt';
const POST_PUSH_TEASER_CONTEXT = 'post_push_teaser';
const TEASER_FREQUENCY_MS = 7 * 24 * 60 * 60 * 1000;

export interface PostPushTeaserDeps {
  isPremium: () => Promise<boolean>;
  isAuthenticated: () => Promise<boolean>;
  showTeaser: (options: {
    message: string;
    upgradeUrl: string;
    onUpgrade: () => void;
    onDismissForever: () => void | Promise<void>;
  }) => void;
  storage: {
    get: (keys: string[]) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
  now: () => number;
  trackUpgradeEvent: (
    stage: 'modal_shown' | 'cta_clicked',
    metadata: { context: string; medium: 'content' }
  ) => void;
}

export class PostPushTeaserService {
  constructor(private readonly deps: PostPushTeaserDeps) {}

  async maybeShowTeaser(): Promise<boolean> {
    try {
      const isAuthenticated = await this.deps.isAuthenticated();
      if (!isAuthenticated) {
        return false;
      }

      const isPremium = await this.deps.isPremium();
      if (isPremium) {
        return false;
      }

      const state = await this.deps.storage.get([DISMISSED_FOREVER_KEY, LAST_SHOWN_AT_KEY]);
      if (state[DISMISSED_FOREVER_KEY] === true) {
        return false;
      }

      const now = this.deps.now();
      const lastShownAt = state[LAST_SHOWN_AT_KEY];
      if (typeof lastShownAt === 'number' && now - lastShownAt < TEASER_FREQUENCY_MS) {
        return false;
      }

      const upgradeUrl = this.createUpgradeUrl();
      this.deps.showTeaser({
        message: 'See exactly what changed in this push with File Changes (Pro).',
        upgradeUrl,
        onUpgrade: () => {
          this.trackUpgradeClick();
        },
        onDismissForever: async () => {
          await this.deps.storage.set({ [DISMISSED_FOREVER_KEY]: true });
        },
      });

      await this.deps.storage.set({ [LAST_SHOWN_AT_KEY]: now });
      this.trackTeaserShown();

      return true;
    } catch {
      return false;
    }
  }

  private createUpgradeUrl(): string {
    const url = new URL('https://bolt2github.com/upgrade');
    url.searchParams.set('utm_source', 'extension');
    url.searchParams.set('utm_medium', 'content');
    url.searchParams.set('utm_campaign', 'upgrade');
    url.searchParams.set('utm_content', POST_PUSH_TEASER_CONTEXT);
    return url.toString();
  }

  private trackTeaserShown(): void {
    this.deps.trackUpgradeEvent('modal_shown', {
      context: POST_PUSH_TEASER_CONTEXT,
      medium: 'content',
    });
  }

  private trackUpgradeClick(): void {
    this.deps.trackUpgradeEvent('cta_clicked', {
      context: POST_PUSH_TEASER_CONTEXT,
      medium: 'content',
    });
  }
}
