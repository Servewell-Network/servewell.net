// @vitest-environment node
//
// Deploy-gating safety checks.
// These run as part of npm run test:inventory and block deployment if they fail.

import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('deploy safety', () => {
  const root = process.cwd();

  it('.env is listed in .gitignore', () => {
    const gitignorePath = path.join(root, '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    // Accept bare ".env" or a glob like ".env*"
    const covered = lines.some((l) => l === '.env' || l === '.env*' || l === '**/.env');
    expect(covered, '.env must be listed in .gitignore to prevent credential leaks').toBe(true);
  });
});
