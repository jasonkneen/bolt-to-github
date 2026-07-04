import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const vitestConfig = () => readFileSync(join(root, 'vitest.config.ts'), 'utf8');

describe('script Vitest harness', () => {
  it('runs script tests through the shared Vitest config when targeted directly', () => {
    expect(vitestConfig()).toContain('scripts/**/*.{test,spec}.{js,ts}');
  });

  it('keeps src test discovery while adding the scripts test glob', () => {
    const config = vitestConfig();

    expect(config).toContain('src/**/*.{test,spec}.{js,ts}');
    expect(config).toContain('scripts/**/*.{test,spec}.{js,ts}');
  });
});
