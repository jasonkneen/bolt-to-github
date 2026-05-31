import { describe, it, expect, vi } from 'vitest';
import { zipSync } from 'fflate';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { ZipProcessor } from '../zip';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Simple ZIP test', () => {
  it('should work with a direct test', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const encoder = new TextEncoder();
      const encoded = encoder.encode('Hello!');
      const zipData = { 'test.txt': new Uint8Array(encoded) };

      const compressed = zipSync(zipData);
      const blob = new Blob([compressed as BlobPart], { type: 'application/zip' });

      const result = await ZipProcessor.processZipBlob(blob);

      expect(result.has('test.txt')).toBe(true);
      expect(result.get('test.txt')).toBe('Hello!');
      expect(stdoutSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
    }

    const viteConfig = readFileSync(resolve(repoRoot, 'vite.config.ts'), 'utf8');
    const manifestWithAssets = viteConfig.includes('export function manifestWithAssets');
    expect(manifestWithAssets).toBe(true);
    expect(viteConfig).toContain('crx({ manifest: manifestWithAssets() })');
    expect(viteConfig).toContain("'128': 'assets/icons/icon128.png'");
    expect(viteConfig).toContain("with { type: 'json' }");
    expect(viteConfig).not.toContain("assert { type: 'json' }");
  });
});

describe('Verification Notes', () => {
  it('documents accepted chunk-size warnings for the release-noise pass', () => {
    const backlog = readFileSync(
      resolve(repoRoot, 'docs/plans/bolt-extension-bug-hunt-hardening-backlog.md'),
      'utf8'
    );
    expect(backlog).toContain('#### Verification Notes');
    const VerificationNotes = backlog.includes('#### Verification Notes');
    expect(VerificationNotes).toBe(true);
    expect(backlog).toContain(
      'The remaining Rollup chunk-size warnings are accepted for this release-noise pass.'
    );
  });
});
