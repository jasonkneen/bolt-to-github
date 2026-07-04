import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Extension fixture type
 */
type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

/**
 * Path to the built extension
 */
const extensionPath = path.join(process.cwd(), 'dist');

const isExternalOnboardingPage = (url: string) =>
  url.startsWith('https://bolt2github.com/welcome') ||
  url.startsWith('https://bolt2github.com/onboarding');

async function closeExternalOnboardingPage(page: Page) {
  try {
    if (isExternalOnboardingPage(page.url()) && !page.isClosed()) {
      await page.close();
    }
  } catch {
    // Ignore races with Chrome closing pages during test cleanup.
  }
}

function suppressExternalOnboardingPages(context: BrowserContext) {
  const watchPage = (page: Page) => {
    page.on('framenavigated', () => {
      void closeExternalOnboardingPage(page);
    });
    page.on('load', () => {
      void closeExternalOnboardingPage(page);
    });
    void closeExternalOnboardingPage(page);
  };

  context.on('page', watchPage);
  for (const page of context.pages()) {
    watchPage(page);
  }
}

/**
 * Playwright fixture for Chrome extension testing
 *
 * This fixture:
 * - Launches Chrome with the extension loaded from the dist folder
 * - Extracts the extension ID for use in tests
 * - Provides a context with the extension pre-loaded
 *
 * Usage:
 * ```ts
 * test('my test', async ({ context, extensionId }) => {
 *   // Use context and extensionId in tests
 * });
 * ```
 */
export const test = base.extend<ExtensionFixtures>({
  // Override the context fixture to load the extension
  context: async ({}, use) => {
    // Create a unique temp directory for this test's user data
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-extension-'));

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    suppressExternalOnboardingPages(context);

    await use(context);
    await context.close();

    // Clean up temp directory
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  },

  // Extract extension ID from the Manifest V3 service worker URL
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    serviceWorker ??= await context.waitForEvent('serviceworker', { timeout: 30000 });
    const extensionId = serviceWorker.url().split('/')[2];

    if (!extensionId) {
      throw new Error('Could not find extension ID. Make sure the extension is built in dist/.');
    }

    await use(extensionId);
  },
});

export { expect } from '@playwright/test';
