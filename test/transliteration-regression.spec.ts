// @vitest-environment node

import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function assertApplyTransliterationsIsIdempotent(source: string): void {
  const applyStart = source.indexOf('function applyTransliterations');
  expect(applyStart).toBeGreaterThanOrEqual(0);

  const removeCall = "querySelectorAll('.word-translit').forEach((el) => el.remove())";
  const appendCall = 'wrap.appendChild(span)';

  const removeIndex = source.indexOf(removeCall, applyStart);
  const appendIndex = source.indexOf(appendCall, applyStart);

  // Re-apply paths (focus/pageshow/visibility return) must clear before append.
  expect(removeIndex).toBeGreaterThanOrEqual(0);
  expect(appendIndex).toBeGreaterThanOrEqual(0);
  expect(removeIndex).toBeLessThan(appendIndex);
}

describe('transliteration interlinear regressions', () => {
  const root = process.cwd();

  it('keeps applyTransliterations idempotent in source module', () => {
    const sourcePath = path.join(root, 'src/phasingScripts/phase2To3/createTransliterationModule.ts');
    const source = readUtf8(sourcePath);
    assertApplyTransliterationsIsIdempotent(source);
  });

  it('keeps applyTransliterations idempotent in built app shell bundle', () => {
    const bundlePath = path.join(root, 'public/js/servewell-app-shell.js');
    const bundle = readUtf8(bundlePath);

    const applyStart = bundle.indexOf('function applyTransliterations()');
    expect(applyStart).toBeGreaterThanOrEqual(0);

    const removeCall = 'querySelectorAll(".word-translit").forEach((el) => el.remove())';
    const appendCall = 'wrap.appendChild(span)';

    const removeIndex = bundle.indexOf(removeCall, applyStart);
    const appendIndex = bundle.indexOf(appendCall, applyStart);

    expect(removeIndex).toBeGreaterThanOrEqual(0);
    expect(appendIndex).toBeGreaterThanOrEqual(0);
    expect(removeIndex).toBeLessThan(appendIndex);
  });
});
