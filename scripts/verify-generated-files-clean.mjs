#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function run(command, args, label) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error((result.stderr || '').trim() || `Command failed: ${command} ${args.join(' ')}`);
  }
  return (result.stdout || '').trim();
}

const generatedPaths = [
  'src/shared/feature-inventory.json',
  'test/fixtures/bible-spot-checks.json'
];

try {
  run('npm', ['run', 'generate:feature-inventory'], 'Generate feature inventory');
  run('npm', ['run', 'generate:bible-spot-checks'], 'Generate Bible spot checks');

  const unstaged = capture('git', ['diff', '--name-only', '--', ...generatedPaths]);
  if (unstaged.length > 0) {
    console.error('\nGenerated files are out of date.');
    console.error('Please review and stage these files before committing:\n');
    console.error(unstaged);
    process.exit(1);
  }

  console.log('Generated files are up to date.');
} catch (error) {
  console.error('\nPre-commit generated-file check failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
