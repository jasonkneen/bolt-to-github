import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const guardedRuntimeRoots = ['content/', 'lib/', 'pages/', 'popup/'];
const runtimeAuthServiceAllowlist = new Set(['services/BoltProjectSyncService.ts']);

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

function runtimeModuleUsage(source: string, identifier: string): string[] {
  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^\\s*import\\s+['"][^'"]*${escapedIdentifier}['"];?`, 'gm'),
    /^\s*(?:import|export)\s+[^;]*?\s+from\s+['"][^'"]*['"];?/gm,
    new RegExp(`import\\s*\\(\\s*['"][^'"]*${escapedIdentifier}['"]\\s*\\)`, 'gm'),
    new RegExp(`\\b${escapedIdentifier}\\s*\\.\\s*getInstance\\s*\\(`, 'gm'),
    new RegExp(`\\bnew\\s+${escapedIdentifier}\\s*\\(`, 'gm'),
  ];

  return patterns
    .flatMap((pattern) => source.match(pattern) ?? [])
    .filter((match) => match.includes(identifier))
    .filter((match) => !isTypeOnlyStaticStatement(match))
    .map((match) => match.trim().replace(/\s+/g, ' '));
}

function runtimeSupabaseAuthUsage(source: string): string[] {
  return runtimeModuleUsage(source, 'SupabaseAuthService');
}

function runtimeBoltProjectSyncServiceUsage(source: string): string[] {
  return runtimeModuleUsage(source, 'BoltProjectSyncService');
}

function isTypeOnlyStaticStatement(statement: string): boolean {
  const normalized = statement.trim().replace(/\s+/g, ' ');

  if (/^(import|export) type\b/.test(normalized)) {
    return true;
  }

  const namedSpecifiers = normalized.match(/^(?:import|export)\s*{(.+)}\s*from\b/);
  return namedSpecifiers
    ? namedSpecifiers[1].split(',').every((specifier) => specifier.trim().startsWith('type '))
    : false;
}

describe('auth import boundaries', () => {
  it('runtime SupabaseAuthService usage detection covers multiline imports and re-exports', () => {
    const violations = runtimeSupabaseAuthUsage(`
      import {
        SupabaseAuthService,
      } from '../../content/services/SupabaseAuthService';
      export {
        SupabaseAuthService as ContentAuthService,
      } from '../../content/services/SupabaseAuthService';
      export * from '../../content/services/SupabaseAuthService';
      import type { AuthState } from '../../content/services/SupabaseAuthService';
      export type { AuthState } from '../../content/services/SupabaseAuthService';
      import { type AuthState as AuthStateAlias } from '../../content/services/SupabaseAuthService';
      const authService = SupabaseAuthService.getInstance();
      const localAuthService = new SupabaseAuthService();
      const lazyAuthService = import('../../content/services/SupabaseAuthService');
    `);

    expect(violations).toEqual([
      "import { SupabaseAuthService, } from '../../content/services/SupabaseAuthService';",
      "export { SupabaseAuthService as ContentAuthService, } from '../../content/services/SupabaseAuthService';",
      "export * from '../../content/services/SupabaseAuthService';",
      "import('../../content/services/SupabaseAuthService')",
      'SupabaseAuthService.getInstance(',
      'new SupabaseAuthService(',
    ]);

    expect(
      runtimeSupabaseAuthUsage(`
        import { createLogger } from '../../lib/utils/logger';
        import type { AuthState } from '../../content/services/SupabaseAuthService';
        export type { AuthState } from '../../content/services/SupabaseAuthService';
        import { type AuthState as AuthStateAlias } from '../../content/services/SupabaseAuthService';
      `)
    ).toEqual([]);

    expect(
      runtimeBoltProjectSyncServiceUsage(`
        import { BoltProjectSyncService } from '../../services/BoltProjectSyncService';
        import { BoltProjectSyncService as SyncService } from '../../services';
        export { BoltProjectSyncService } from '../../services/BoltProjectSyncService';
        export { BoltProjectSyncService as ExportedSyncService } from '../../services';
        const syncService = new BoltProjectSyncService();
        const lazySyncService = import('../../services/BoltProjectSyncService');
        import type { BoltProjectSyncService as SyncServiceType } from '../../services/BoltProjectSyncService';
        import { type BoltProjectSyncService as SyncServiceTypeAlias } from '../../services';
      `)
    ).toEqual([
      "import { BoltProjectSyncService } from '../../services/BoltProjectSyncService';",
      "import { BoltProjectSyncService as SyncService } from '../../services';",
      "export { BoltProjectSyncService } from '../../services/BoltProjectSyncService';",
      "export { BoltProjectSyncService as ExportedSyncService } from '../../services';",
      "import('../../services/BoltProjectSyncService')",
      'new BoltProjectSyncService(',
    ]);
  });

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

  it('src/services modules stay free of runtime SupabaseAuthService usage except the allowlisted sync service', () => {
    const violations = productionSourceFiles(join(sourceRoot, 'services')).flatMap((path) => {
      const relativePath = toSourceRelativePath(path);

      if (runtimeAuthServiceAllowlist.has(relativePath)) {
        return [];
      }

      const matches = runtimeSupabaseAuthUsage(readFileSync(path, 'utf8'));
      return matches.map((match) => `${relativePath}: ${match.trim()}`);
    });

    expect(violations).toEqual([]);
  });

  it('guarded UI contexts do not import BoltProjectSyncService at runtime', () => {
    const violations = productionSourceFiles(sourceRoot).flatMap((path) => {
      const relativePath = toSourceRelativePath(path);

      if (!guardedRuntimeRoots.some((guardedRoot) => relativePath.startsWith(guardedRoot))) {
        return [];
      }

      const matches = runtimeBoltProjectSyncServiceUsage(readFileSync(path, 'utf8'));
      return matches.map((match) => `${relativePath}: ${match.trim()}`);
    });

    expect(violations).toEqual([]);
  });
});
