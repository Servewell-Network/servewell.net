// @vitest-environment node

import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function listHtmlFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function toRelative(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).replace(/\\/g, '/');
}

describe('global rendered HTML regressions', () => {
  const root = process.cwd();
  const renderedRoot = path.join(root, 'public/-');
  const htmlFiles = listHtmlFiles(renderedRoot);

  it('does not contain escaped closing span text in rendered chapter pages', () => {
    const offenders: Array<{ file: string; count: number }> = [];

    for (const file of htmlFiles) {
      const html = fs.readFileSync(file, 'utf8');
      const count = (html.match(/&lt;\/span&gt;/g) || []).length;
      if (count > 0) {
        offenders.push({ file: toRelative(root, file), count });
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not repeat a single footnote id more than marker/popover/close-triplet usage', () => {
    const offenders: Array<{ file: string; id: string; count: number }> = [];

    for (const file of htmlFiles) {
      const html = fs.readFileSync(file, 'utf8');
      const ids = html.match(/fn-[A-Za-z0-9-]+-\d+/g) || [];
      const counts = new Map<string, number>();

      for (const id of ids) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }

      for (const [id, count] of counts) {
        if (count > 3) {
          offenders.push({ file: toRelative(root, file), id, count });
          break;
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('word-token popover data includes OccurrencesFile (occ= key), confirming p2-words ran before p2-3', () => {
    // If generateWordStudyJson ran after phase2To3, OccurrencesFile is never written back
    // into the Phase 2 JSON in time, so no data-m attributes will contain occ=.
    // Scan a sample of files (first 20 chapter pages alphabetically) and require that
    // at least one word token per file has occ= in its data-m attribute.
    const sampleFiles = htmlFiles.slice(0, 20);
    const missing: string[] = [];

    for (const file of sampleFiles) {
      const html = fs.readFileSync(file, 'utf8');
      // data-m attributes are URL-encoded; occ= will appear literally when present
      if (!html.includes('occ=')) {
        missing.push(toRelative(root, file));
      }
    }

    expect(missing).toEqual([]);
  });
});
