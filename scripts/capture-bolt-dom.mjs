#!/usr/bin/env node
/**
 * Capture bolt.new DOM for selector recovery work.
 *
 * Two capture targets in one run:
 *   - Toolbar / Publish button area  (drives GitHubButtonManager injection selectors)
 *   - Project-name dropdown + Export submenu (drives DownloadService selectors)
 *
 * Usage:
 *   cd ~/projects/codefrost-dev/bolt-to-github
 *   node scripts/capture-bolt-dom.mjs
 *
 * Flow:
 *   1. Launches a real Chromium window with a persistent profile (login survives reruns).
 *   2. You: log in if needed, open any project (bolt.new/~/...).
 *   3. Press ENTER once. Script dumps the toolbar area (Publish button context).
 *   4. You: open the project-name dropdown, hover "Export" so the submenu with "Download" is fully expanded.
 *   5. Press ENTER again. Script dumps the dropdown + submenu DOM.
 *   6. Both captures land in /tmp/bolt-dom-capture/ as timestamped files.
 */

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import readline from 'node:readline';
import {
  collectStructuredToolbarCandidates,
  extractToolbarHtml,
} from './capture-bolt-dom-helpers.js';

const PROFILE_DIR = '/tmp/bolt-capture-profile';
const OUT_DIR = '/tmp/bolt-dom-capture';

const ts = new Date().toISOString().replace(/[:.]/g, '-');

async function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(prompt, () => {
      rl.close();
      resolve();
    })
  );
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(PROFILE_DIR, { recursive: true });

  console.log('[capture] launching Chromium with persistent profile at', PROFILE_DIR);
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://bolt.new/', { waitUntil: 'domcontentloaded' });

  console.log('\n[capture] STEP 1 of 2 — toolbar / Publish button context');
  console.log('  1. Log in if needed.');
  console.log('  2. Open any existing project (URL should look like bolt.new/~/...).');
  console.log(
    '  3. Make sure the page is loaded with the top-right toolbar fully visible (Publish button area).\n'
  );

  await waitForEnter(
    '[capture] Press ENTER once the project page is loaded with the toolbar visible '
  );

  console.log('[capture] capturing toolbar / publish DOM...');

  const toolbarSnapshot = await page.evaluate(collectStructuredToolbarCandidates);
  const toolbarHtml = await page.evaluate(extractToolbarHtml);

  const toolbarHtmlPath = join(OUT_DIR, `toolbar-${ts}.html`);
  const toolbarJsonPath = join(OUT_DIR, `toolbar-${ts}.json`);
  if (toolbarHtml) await writeFile(toolbarHtmlPath, toolbarHtml, 'utf8');
  await writeFile(toolbarJsonPath, JSON.stringify(toolbarSnapshot, null, 2), 'utf8');

  console.log('\n[capture] STEP 2 of 2 — project-name dropdown + Export submenu');
  console.log(
    '  1. Click the project-name dropdown (button with the chevron/caret next to the project title).'
  );
  console.log(
    '  2. Hover over the "Export" item so the submenu showing "Download" is fully expanded.'
  );
  console.log('  3. Leave that submenu open and come back here.\n');

  await waitForEnter('[capture] Press ENTER once the Export submenu (with Download) is open ');

  console.log('[capture] capturing dropdown DOM...');

  const url = page.url();
  const fullHtml = await page.content();

  const snapshot = await page.evaluate(() => {
    const collect = (sel) =>
      Array.from(document.querySelectorAll(sel)).map((el) => ({
        tag: el.tagName,
        id: el.id,
        role: el.getAttribute('role'),
        ariaHaspopup: el.getAttribute('aria-haspopup'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaLabel: el.getAttribute('aria-label'),
        dataState: el.getAttribute('data-state'),
        classes: el.className?.toString?.() ?? '',
        text: (el.textContent ?? '').trim().slice(0, 200),
        iconClasses: Array.from(el.querySelectorAll('[class*="i-"]'))
          .map((c) => Array.from(c.classList).filter((cls) => cls.startsWith('i-')))
          .flat(),
        outerHtmlPreview: el.outerHTML.slice(0, 600),
      }));

    return {
      url: window.location.href,
      menuButtons: collect('button[aria-haspopup]'),
      menus: collect('[role="menu"], [data-radix-menu-content]'),
      menuItems: collect('[role="menuitem"], [data-radix-collection-item]'),
      buttonsWithDownloadText: Array.from(document.querySelectorAll('button, [role="menuitem"]'))
        .filter((el) => /download|export/i.test(el.textContent ?? ''))
        .map((el) => ({
          tag: el.tagName,
          role: el.getAttribute('role'),
          ariaHaspopup: el.getAttribute('aria-haspopup'),
          text: (el.textContent ?? '').trim().slice(0, 200),
          classes: el.className?.toString?.() ?? '',
          iconClasses: Array.from(el.querySelectorAll('[class*="i-"]')).flatMap((c) =>
            Array.from(c.classList).filter((cls) => cls.startsWith('i-'))
          ),
          outerHtml: el.outerHTML.slice(0, 1000),
        })),
      header: document.querySelector('header')?.outerHTML?.slice(0, 8000) ?? null,
      bodyClasses: document.body.className,
      htmlLang: document.documentElement.lang,
    };
  });

  const htmlPath = join(OUT_DIR, `full-${ts}.html`);
  const jsonPath = join(OUT_DIR, `snapshot-${ts}.json`);
  const headerPath = join(OUT_DIR, `header-${ts}.html`);
  const menusPath = join(OUT_DIR, `menus-${ts}.html`);

  await writeFile(htmlPath, fullHtml, 'utf8');
  await writeFile(jsonPath, JSON.stringify({ url, ...snapshot }, null, 2), 'utf8');
  if (snapshot.header) await writeFile(headerPath, snapshot.header, 'utf8');

  const menusHtml = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        '[role="menu"], [data-radix-menu-content], [data-radix-popper-content-wrapper]'
      )
    )
      .map((el) => el.outerHTML)
      .join('\n\n<!-- next menu -->\n\n');
  });
  await writeFile(menusPath, menusHtml, 'utf8');

  console.log('\n[capture] wrote:');
  console.log('  toolbar HTML    :', toolbarHtmlPath);
  console.log('  toolbar JSON    :', toolbarJsonPath);
  console.log('  full HTML       :', htmlPath);
  console.log('  header subtree  :', headerPath);
  console.log('  open menus      :', menusPath);
  console.log('  structured JSON :', jsonPath);
  console.log('\n[capture] you can close the browser window now.');

  await ctx.close();
  process.exit(0);
})().catch((err) => {
  console.error('[capture] error:', err);
  process.exit(1);
});
