import { afterEach, describe, expect, it } from 'vitest';
import {
  collectStructuredToolbarCandidates,
  extractToolbarHtml,
} from '../capture-bolt-dom-helpers.js';

function loadHtml(html: string) {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Bolt DOM capture toolbar helpers', () => {
  it('extracts toolbar HTML from the current Publish anchored Bolt DOM', () => {
    loadHtml(`
      <main>
        <div class="ml-auto">
          <button aria-label="Collapse panel"></button>
        </div>
        <header class="workspace-toolbar">
          <div class="flex 2xl:gap-3 gap-2">
            <div class="flex gap-1 empty:hidden"></div>
            <div class="flex gap-1">
              <button aria-label="Connect project to GitHub"></button>
            </div>
            <button aria-haspopup="dialog">Share</button>
            <span>
              <button aria-controls="publish-menu" aria-haspopup="menu">Publish</button>
            </span>
          </div>
        </header>
      </main>
    `);

    const html = extractToolbarHtml(document);

    expect(html).toContain('workspace-toolbar');
    expect(html).toContain('aria-controls="publish-menu"');
    expect(html).toContain('Connect project to GitHub');
    expect(html).not.toContain('Collapse panel');
  });

  it('falls back to legacy ml-auto toolbar DOM', () => {
    loadHtml(`
      <div class="ml-auto">
        <div class="flex gap-3">
          <div class="flex gap-1 empty:hidden"></div>
          <div class="flex gap-1">
            <button aria-label="Connect project to GitHub"></button>
          </div>
        </div>
      </div>
    `);

    const html = extractToolbarHtml(document);

    expect(html).toContain('class="ml-auto"');
    expect(html).toContain('Connect project to GitHub');
  });

  it('records structured toolbar candidates for current and existing GitHub buttons', () => {
    loadHtml(`
      <header>
        <div class="flex gap-2">
          <button data-github-upload="true">GitHub</button>
          <button aria-haspopup="dialog">Share</button>
          <button aria-controls="publish-menu" aria-haspopup="menu">Publish</button>
        </div>
      </header>
    `);

    const snapshot = collectStructuredToolbarCandidates(document, 'https://bolt.new/~/project');

    expect(snapshot.url).toBe('https://bolt.new/~/project');
    expect(snapshot.gapContainers).toHaveLength(1);
    expect(snapshot.publishButtonByAriaControls).toHaveLength(1);
    expect(snapshot.existingGitHubButton).toHaveLength(1);
    expect(snapshot.publishCandidates.map((candidate) => candidate.text)).toEqual([
      'Share',
      'Publish',
    ]);
  });
});
