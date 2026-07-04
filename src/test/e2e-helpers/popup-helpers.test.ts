import { describe, expect, it, vi } from 'vitest';
import type { Page } from '@playwright/test';
import {
  clickPushButton,
  fillRepositorySettings,
  getValidationError,
  waitForErrorNotification,
} from '../../../e2e/helpers/popup';
import { test as extensionTest } from '../../../e2e/fixtures/extension';

vi.mock('@playwright/test', () => ({
  test: {
    extend: vi.fn((fixtures: unknown) => ({ __fixtures: fixtures })),
  },
  chromium: {
    launchPersistentContext: vi.fn(),
  },
  expect: vi.fn(),
}));

type LocatorFake = {
  first: () => LocatorFake;
  waitFor: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  pressSequentially: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  isVisible: ReturnType<typeof vi.fn>;
  click: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  textContent: ReturnType<typeof vi.fn>;
};

function createLocator(options: { visible?: boolean; text?: string } = {}): LocatorFake {
  const locator = {} as LocatorFake;
  locator.first = () => locator;
  locator.waitFor = vi.fn().mockResolvedValue(undefined);
  locator.clear = vi.fn().mockResolvedValue(undefined);
  locator.pressSequentially = vi.fn().mockResolvedValue(undefined);
  locator.fill = vi.fn().mockResolvedValue(undefined);
  locator.isVisible = vi.fn().mockResolvedValue(options.visible ?? true);
  locator.click = vi.fn().mockResolvedValue(undefined);
  locator.filter = vi.fn().mockReturnValue(locator);
  locator.textContent = vi.fn().mockResolvedValue(options.text ?? null);

  return locator;
}

describe('popup E2E helper characterization', () => {
  it('fills only visible repository settings controls', async () => {
    const repoInput = createLocator();
    const branchInput = createLocator({ visible: true });
    const visibilityInput = createLocator({ visible: true });
    const keyboardPress = vi.fn().mockResolvedValue(undefined);
    const selectors: string[] = [];

    const page = {
      locator: vi.fn((selector: string) => {
        selectors.push(selector);
        if (selector.includes('branch')) {
          return branchInput;
        }
        if (selector.includes('radio')) {
          return visibilityInput;
        }
        return repoInput;
      }),
      keyboard: {
        press: keyboardPress,
      },
    } as unknown as Page;

    await fillRepositorySettings(page, {
      repoName: 'codefrost.bolt-to-github',
      branch: 'dev',
      visibility: 'private',
    });

    expect(selectors).toEqual([
      'input[placeholder*="repository" i]:visible, input[name*="repo" i]:visible, #repoName:visible',
      'input[placeholder*="branch" i]:visible, input[name*="branch" i]:visible, #branch:visible',
      'input[type="radio"][value="private"]:visible',
    ]);
    expect(repoInput.clear).toHaveBeenCalledTimes(1);
    expect(repoInput.pressSequentially).toHaveBeenCalledWith('codefrost.bolt-to-github');
    expect(keyboardPress).toHaveBeenCalledWith('Tab');
    expect(branchInput.fill).toHaveBeenCalledWith('dev');
    expect(visibilityInput.click).toHaveBeenCalledTimes(1);
  });

  it('clicks the visible push button and confirmation after the hook', async () => {
    const pushButton = createLocator();
    const confirmButton = createLocator({ visible: true });
    const beforeClick = vi.fn().mockResolvedValue(undefined);
    const page = {
      locator: vi.fn(() => pushButton),
      context: vi.fn(() => ({
        pages: () => [
          {
            getByRole: vi.fn(() => confirmButton),
          },
        ],
      })),
    } as unknown as Page;

    await clickPushButton(page, beforeClick);

    expect(pushButton.waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 5000 });
    expect(beforeClick.mock.invocationCallOrder[0]).toBeLessThan(
      pushButton.click.mock.invocationCallOrder[0]
    );
    expect(pushButton.click).toHaveBeenCalledTimes(1);
    expect(confirmButton.click).toHaveBeenCalledTimes(1);
  });

  it('reads visible validation errors from alert surfaces', async () => {
    const errorMessage = createLocator({
      visible: true,
      text: 'Invalid repository name',
    });
    const page = {
      locator: vi.fn(() => errorMessage),
    } as unknown as Page;

    await expect(getValidationError(page)).resolves.toBe('Invalid repository name');
  });

  it('waits for visible error notifications', async () => {
    const errorMessage = createLocator({
      text: 'No active Bolt tab found',
    });
    const page = {
      locator: vi.fn(() => errorMessage),
    } as unknown as Page;

    await expect(waitForErrorNotification(page)).resolves.toBe('No active Bolt tab found');
    expect(errorMessage.filter).toHaveBeenCalledWith({
      hasText: /Error|Failed|Invalid|No active Bolt tab|content script|no content/i,
    });
    expect(errorMessage.waitFor).toHaveBeenCalledWith({ state: 'visible', timeout: 10000 });
  });

  it('exports the extension Playwright fixture', () => {
    expect(extensionTest).toMatchObject({
      __fixtures: expect.objectContaining({
        context: expect.any(Function),
        extensionId: expect.any(Function),
      }),
    });
  });
});
