import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { whatsNewContent, type WhatsNewVersion } from '../whatsNewContent';

describe('whatsNewContent', () => {
  it('keeps the 1.3.20 modal focused on final user-facing release notes', () => {
    const release: WhatsNewVersion = whatsNewContent['1.3.20'];
    const releaseText = [release.details, ...release.highlights].join(' ');

    expect(release.date).toBe('2026-07-12');
    expect(release.type).toBe('patch');
    expect(release.highlights).toEqual(
      expect.arrayContaining([
        expect.stringContaining('GitHub App'),
        expect.stringContaining('Background Checks'),
        expect.stringContaining('Pro'),
      ])
    );
    expect(releaseText).not.toMatch(/TBD|2026-XX-XX|In Development/);
    expect(releaseText).not.toMatch(
      /\b(MAID|Vitest|Playwright|Edge Function|storage listener|manifest)\b/i
    );
  });

  it('keeps the v1.3.20 changelog and README release-ready', () => {
    const Version_1_3_20_Changelog = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8');
    const Version_1_3_20_Readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');

    expect(Version_1_3_20_Changelog).toContain('## 2026-07-12 - Version 1.3.20');
    expect(Version_1_3_20_Changelog).toContain('Auth Invocation Loop Containment');
    expect(Version_1_3_20_Changelog).toContain('Post-Push Pro Teaser');
    expect(Version_1_3_20_Changelog).not.toMatch(/Version 1\.3\.20[\s\S]{0,400}\bTBD\b/);

    expect(Version_1_3_20_Readme).toContain(
      '#### Version 1.3.20 - Auth Containment & Post-Push Guidance (July 2026)'
    );
    expect(Version_1_3_20_Readme).not.toMatch(/Version 1\.3\.20 - In Development/);
    expect(Version_1_3_20_Readme).not.toMatch(/Version 1\.3\.20[\s\S]{0,300}\bTBD\b/);
  });

  it('keeps the 1.3.19 modal entry focused on user-facing release notes', () => {
    const release: WhatsNewVersion = whatsNewContent['1.3.19'];
    const releaseText = [release.details, ...release.highlights].join(' ');

    expect(release.date).toBe('2026-07-03');
    expect(release.type).toBe('patch');
    expect(release.highlights).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Clearer Push Errors'),
        expect.stringContaining('More Reliable Auth Recovery'),
        expect.stringContaining('GitHub App Stays Connected'),
        expect.stringContaining('Repository Name Validation'),
        expect.stringContaining('Reconnect Notices'),
      ])
    );
    expect(releaseText).toContain('retry right away');
    expect(releaseText).toContain('GitHub App connections survive normal re-authentication');
    expect(releaseText).toContain('page refresh is needed');
    expect(releaseText).not.toMatch(
      /\b(MAID|Vitest|Playwright|BackgroundAuthClient|AuthMessageRouter|manifest|content-script)\b/
    );
  });

  it('keeps the v1.3.19 changelog as the developer-facing release record', () => {
    const Version_1_3_19_Changelog = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8');

    expect(Version_1_3_19_Changelog).toContain('## 2026-07-03 - Version 1.3.19');
    expect(Version_1_3_19_Changelog).toContain('Auth Self-Healing Execution');
    expect(Version_1_3_19_Changelog).toContain('Background Auth Storage Recovery');
    expect(Version_1_3_19_Changelog).toContain('GitHub App Re-auth Preservation');
    expect(Version_1_3_19_Changelog).toContain('Single Background Auth Authority');
    expect(Version_1_3_19_Changelog).toContain('Orphaned Content-Script Recovery');
    expect(Version_1_3_19_Changelog).toContain('Auth Lifecycle Manifest Set');
  });
});
