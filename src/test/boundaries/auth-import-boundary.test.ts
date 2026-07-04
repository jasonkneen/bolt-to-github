import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const guardedRuntimeRoots = ['content/', 'lib/', 'pages/', 'popup/'];

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const relativePath = toSourceRelativePath(path);

    if (statSync(path).isDirectory()) {
      if (isSkippedDirectory(relativePath)) {
        return [];
      }
      return productionSourceFiles(path);
    }

    if (!/\.(ts|svelte)$/.test(entry) || entry.endsWith('.d.ts')) {
      return [];
    }

    return [path];
  });
}

function toSourceRelativePath(path: string): string {
  return relative(sourceRoot, path).split(sep).join('/');
}

function isSkippedDirectory(path: string): boolean {
  return (
    path === 'test' ||
    path.endsWith('/__tests__') ||
    path.includes('/test-fixtures') ||
    path.includes('/__mocks__')
  );
}

function runtimeSupabaseAuthUsage(source: string): string[] {
  const patterns = [
    /^\s*import\s+(?!type\b).+from\s+['"][^'"]*SupabaseAuthService['"]/gm,
    /import\s*\(\s*['"][^'"]*SupabaseAuthService['"]\s*\)/gm,
    /SupabaseAuthService\s*\.\s*getInstance\s*\(/gm,
    /new\s+SupabaseAuthService\s*\(/gm,
  ];

  return patterns.flatMap((pattern) => source.match(pattern) ?? []);
}

describe('auth import boundaries', () => {
  it('SupabaseAuthService is only imported from background code', () => {
    const violations = productionSourceFiles(sourceRoot).flatMap((path) => {
      const relativePath = toSourceRelativePath(path);

      if (
        !guardedRuntimeRoots.some((guardedRoot) => relativePath.startsWith(guardedRoot)) ||
        relativePath === 'content/services/SupabaseAuthService.ts'
      ) {
        return [];
      }

      const matches = runtimeSupabaseAuthUsage(readFileSync(path, 'utf8'));
      return matches.map((match) => `${relativePath}: ${match.trim()}`);
    });

    expect(violations).toEqual([]);
  });
});
