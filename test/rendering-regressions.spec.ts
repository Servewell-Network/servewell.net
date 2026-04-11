// @vitest-environment node

import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function countOccurrences(source: string, pattern: string): number {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = source.match(new RegExp(escaped, 'g'));
  return matches ? matches.length : 0;
}

describe('rendered chapter regressions', () => {
  const root = process.cwd();
  const luke11Path = path.join(root, 'public/-/Luke/11.html');
  const luke11Html = fs.readFileSync(luke11Path, 'utf8');

  it('does not emit escaped span-close text in rendered chapter HTML', () => {
    expect(luke11Html).not.toContain('&lt;/span&gt;');
  });

  it('uses unique footnote ids for both Luke 11:2 footnotes', () => {
    expect(countOccurrences(luke11Html, 'fn-Luk11-2-0')).toBe(3);
    expect(countOccurrences(luke11Html, 'fn-Luk11-2-1')).toBe(3);
  });
});
