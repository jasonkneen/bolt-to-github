import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

const readText = (path: string) => readFileSync(join(root, path), 'utf8');

describe('MAID tooling bootstrap', () => {
  it('runs the MAID runner through the checked-in uvx wrapper', () => {
    const wrapper = readText('scripts/maid');

    expect(wrapper).toContain('command -v uvx');
    expect(wrapper).toContain('MAID_RUNNER_SPEC="${MAID_RUNNER_SPEC:-maid-runner[all]@latest}"');
    expect(wrapper).toContain('exec uvx --from "$MAID_RUNNER_SPEC" maid "$@"');
  });

  it('exposes pnpm aliases for the standard MAID commands', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['maid']).toBe('./scripts/maid');
    expect(packageJson.scripts['maid:schema']).toBe(
      './scripts/maid validate --manifest-dir manifests --mode schema'
    );
    expect(packageJson.scripts['maid:behavioral']).toBe(
      './scripts/maid validate --manifest-dir manifests --mode behavioral'
    );
    expect(packageJson.scripts['maid:implementation']).toBe(
      './scripts/maid validate --manifest-dir manifests --mode implementation'
    );
    expect(packageJson.scripts['maid:test']).toBe('./scripts/maid test --manifest-dir manifests');
    expect(packageJson.scripts['maid:files']).toBe('./scripts/maid files --manifest-dir manifests');
  });

  it('documents the repository MAID workflow for future agents', () => {
    const agents = readText('AGENTS.md');
    const claude = readText('CLAUDE.md');
    const manifestsReadme = readText('manifests/README.md');

    expect(agents).toContain('This repository uses MAID for AI-assisted code changes.');
    expect(agents).toContain('./scripts/maid validate --manifest-dir manifests --mode behavioral');
    expect(claude).toContain(
      'Use the checked-in wrapper so local agents and hooks run the same runner:'
    );
    expect(claude).toContain('./scripts/maid files --manifest-dir manifests');
    expect(manifestsReadme).toContain('Keep active manifests directly under `manifests/`.');
    expect(manifestsReadme).toContain(
      'For touched files that lack MAID coverage, add a manifest and focused'
    );
  });
});
