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

// ---------------------------------------------------------------------------
// H1639 / "diminish" — guards against the "dimish" typo regression
// ---------------------------------------------------------------------------
//
// At Deu 12:32 the Hebrew verb תִגְרַ֖ע (H1639, ga.ra) means "diminish".
// "Dimish" (missing 'in') must never appear in the rendered chapter page or
// in the word-study JSON used to build the H1639 research page.
// ---------------------------------------------------------------------------

describe('H1639 diminish — no "dimish" typo', () => {
  const root = process.cwd();

  it('word-study JSON for H1639 (diminish.json) contains no "dimish" rendering', () => {
    const jsonPath = path.join(root, 'src/json-Phase2/words/diminish.json');
    const raw = fs.readFileSync(jsonPath, 'utf8').toLowerCase();
    // "dimish" (without the 'n') must never appear anywhere in the word-study data
    expect(raw).not.toContain('dimish');
  });

  it('Deuteronomy 12 chapter page does not contain "dimish"', () => {
    const htmlPath = path.join(root, 'public/-/Deuteronomy/12.html');
    const html = fs.readFileSync(htmlPath, 'utf8').toLowerCase();
    expect(html).not.toContain('dimish');
  });

  it('Deuteronomy 12:32 renders H1639 as "DIMINISH" in the literal pane', () => {
    const htmlPath = path.join(root, 'public/-/Deuteronomy/12.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    // The literal-pane token for H1639 at Deu12:32.23 must have
    // the correct spelling in its aria-label and occ= occurrence key.
    expect(html).toContain('aria-label="Show metadata for DIMINISH"');
    expect(html).toContain('sr=H1639');
    expect(html).toContain('occ=diminish');
  });
});
