#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function extractNeedIds(htmlText) {
  const ids = [];
  const seen = new Set();
  const regex = /<tr\s+id="(need-[a-z0-9-]+)"/g;
  let match;
  while ((match = regex.exec(htmlText)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      ids.push(match[1]);
    }
  }
  return ids;
}

const featuresPath = path.join(root, 'public/features.html');
const whatsNextPath = path.join(root, 'public/whats-next.html');

const featuresHtml = fs.readFileSync(featuresPath, 'utf8');
const whatsNextHtml = fs.readFileSync(whatsNextPath, 'utf8');

const featuresIds = extractNeedIds(featuresHtml);
const whatsNextIds = extractNeedIds(whatsNextHtml);

const inventory = {
  generatedAt: 'fixture-v1',
  featuresPageIds: featuresIds,
  whatsNextPageIds: whatsNextIds,
  allNeedIds: Array.from(new Set([...featuresIds, ...whatsNextIds])).sort()
};

const outputPath = path.join(root, 'src/shared/feature-inventory.json');
fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);

console.log(`Wrote feature inventory to ${outputPath}`);
console.log(`features.html IDs: ${featuresIds.length}`);
console.log(`whats-next.html IDs: ${whatsNextIds.length}`);
console.log(`union IDs: ${inventory.allNeedIds.length}`);
