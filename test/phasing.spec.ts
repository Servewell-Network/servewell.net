// @vitest-environment node

import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type VerseSpotCheck = {
  reference: string;
  file: string;
  snippetId: string;
  expectedEnglishHeadingsAndWords: unknown;
};

type BibleSpotCheckFixture = {
  generatedAt: string;
  source: string;
  spotChecks: VerseSpotCheck[];
};

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getSnippetEnglishHeadingsAndWords(chapterJson: unknown, snippetId: string): unknown {
  const source = chapterJson as {
    SnippetsAndExplanations?: Array<{ SnippetId?: string; EnglishHeadingsAndWords?: unknown }>;
  };

  if (!Array.isArray(source.SnippetsAndExplanations)) {
    throw new Error('Unexpected chapter JSON shape: SnippetsAndExplanations is missing');
  }

  const snippet = source.SnippetsAndExplanations.find((item) => item.SnippetId === snippetId);
  if (!snippet) {
    throw new Error(`Missing snippet ${snippetId}`);
  }

  return snippet.EnglishHeadingsAndWords;
}

describe('phasing bible spot checks', () => {
  const root = process.cwd();
  const fixturePath = path.join(root, 'test/fixtures/bible-spot-checks.json');
  const fixture = loadJson(fixturePath) as BibleSpotCheckFixture;

  it('contains configured verse checks', () => {
    expect(fixture.spotChecks.length).toBeGreaterThan(0);
  });

  for (const check of fixture.spotChecks) {
    it(`matches EnglishHeadingsAndWords exactly for ${check.reference}`, () => {
      const chapterPath = path.join(root, check.file);
      const chapterJson = loadJson(chapterPath);
      const actual = getSnippetEnglishHeadingsAndWords(chapterJson, check.snippetId);
      expect(actual).toEqual(check.expectedEnglishHeadingsAndWords);
    });
  }
});
