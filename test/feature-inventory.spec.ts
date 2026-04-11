// @vitest-environment node

import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type FeatureInventory = {
  generatedAt: string;
  featuresPageIds: string[];
  whatsNextPageIds: string[];
  allNeedIds: string[];
};

function extractNeedIdsFromRows(html: string): string[] {
  const ids = new Set<string>();
  const rowRegex = /<tr\s+id="(need-[a-z0-9-]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids).sort();
}

function extractNeedIdsFromPopoverKeys(script: string): string[] {
  const ids = new Set<string>();
  const keyRegex = /'((need-[a-z0-9-]+))'\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(script)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids).sort();
}

describe('feature inventory drift checks', () => {
  const root = process.cwd();
  const inventoryPath = path.join(root, 'src/shared/feature-inventory.json');
  const featuresHtmlPath = path.join(root, 'public/features.html');
  const whatsNextHtmlPath = path.join(root, 'public/whats-next.html');
  const popoversJsPath = path.join(root, 'public/js/features-popovers.js');

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as FeatureInventory;
  const featuresIds = extractNeedIdsFromRows(fs.readFileSync(featuresHtmlPath, 'utf8'));
  const whatsNextIds = extractNeedIdsFromRows(fs.readFileSync(whatsNextHtmlPath, 'utf8'));
  const pageUnionIds = Array.from(new Set([...featuresIds, ...whatsNextIds])).sort();
  const popoverIds = extractNeedIdsFromPopoverKeys(fs.readFileSync(popoversJsPath, 'utf8'));

  it('matches current features.html IDs with registry', () => {
    expect(featuresIds).toEqual([...inventory.featuresPageIds].sort());
  });

  it('matches current whats-next.html IDs with registry', () => {
    expect(whatsNextIds).toEqual([...inventory.whatsNextPageIds].sort());
  });

  it('matches current page union IDs with registry', () => {
    expect(pageUnionIds).toEqual([...inventory.allNeedIds].sort());
  });

  it('contains popovers for every listed page feature id', () => {
    const missingPopoverIds = pageUnionIds.filter((id) => !popoverIds.includes(id));
    expect(missingPopoverIds).toEqual([]);
  });
});
