/**
 * debug-search.mts
 *
 * Runs the word search pipeline against live data and prints debug info.
 * Imports directly from TypeScript source modules (via tsx) so the logic
 * stays in sync with the browser bundle automatically.
 *
 * Usage:
 *   npx tsx scripts/debug-search.mts "love"
 *   npx tsx scripts/debug-search.mts "love neighbor"
 */

import {
  resolveToken,
  parseQueryTokens,
  sortByRarity,
  getFileNamesForLemma,
} from '../src/phasingScripts/phase2To3/wordSearchLogic.js';
import {
  WORD_INDEX_URL,
  WORDS_BASE_URL,
  loadIndex,
  fetchWordFile,
} from '../src/phasingScripts/phase2To3/wordSearchFetch.js';

const query = process.argv.slice(2).join(' ').trim();
if (!query) { console.error('Usage: npx tsx scripts/debug-search.mts "<query>"'); process.exit(1); }

// ── Run ──────────────────────────────────────────────────────────────────

console.log(`\n=== Word Search Debug ===`);
console.log(`Query: "${query}"\n`);

console.log(`[1] Fetching word index from ${WORD_INDEX_URL} ...`);
const idx = await loadIndex();
if (!idx) { console.error('  FAILED to load word index'); process.exit(1); }
console.log(`  Loaded. ${Object.keys(idx).length} lemmas.\n`);

const tokens = parseQueryTokens(query);
console.log(`[2] Tokens: ${JSON.stringify(tokens)}\n`);

const resolutions = [];
for (const token of tokens) {
  const res = resolveToken(token, idx);
  console.log(`[3] resolveToken("${token}") →`, JSON.stringify(res));
  if (res.kind === 'ambiguous') {
    console.log(`    candidates (first 10): ${res.candidates.slice(0, 10).join(', ')}`);
  }
  resolutions.push({ token, res });
}
console.log();

const resolvedLemmas = resolutions
  .filter(r => r.res.kind === 'resolved')
  .map(r => (r.res as { kind: 'resolved'; lemma: string }).lemma);

if (resolvedLemmas.length === 0) {
  console.log('No tokens resolved. Nothing to fetch.');
  process.exit(0);
}

const sorted = sortByRarity(resolvedLemmas, idx);
console.log(`[4] Resolved lemmas sorted by rarity: ${sorted.join(', ')}\n`);

// Fetch each lemma's files with verbose logging
let intersectedVerses: Set<string> | null = null;
const sampleByVerse = new Map<string, string>();

for (const lemma of sorted) {
  const fileNames = getFileNamesForLemma(lemma, idx);
  console.log(`[5] Fetching lemma "${lemma}" — files: ${fileNames.join(', ')}`);

  const verseSet = new Set<string>();
  let firstFileName = fileNames[0];
  let crossRefFileNames: string[] = [];

  for (const fileName of fileNames) {
    const url = `${WORDS_BASE_URL}/${encodeURIComponent(fileName)}`;
    console.log(`    GET ${url}`);

    const data = await fetchWordFile(fileName);
    if (!data) { console.log(`    → fetch/parse failed (skipping)`); continue; }

    if (fileName === firstFileName && data.crossRefFileNames.length) {
      crossRefFileNames = data.crossRefFileNames;
      console.log(`    crossRefs: ${crossRefFileNames.join(', ')}`);
    }

    for (const [vr, rendering] of data.byVerse) {
      verseSet.add(vr);
      if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
    }
    const overflowNote = data.hasOverflow ? ', has overflow' : '';
    console.log(`    → ${data.totalInstances} instances, ${verseSet.size} verses so far${overflowNote}`);
  }

  console.log(`  Total unique verses for "${lemma}": ${verseSet.size}`);

  if (crossRefFileNames.length > 0) {
    for (const xFile of crossRefFileNames) {
      const xUrl = `${WORDS_BASE_URL}/${encodeURIComponent(xFile)}`;
      console.log(`    crossRef GET ${xUrl}`);
      const xData = await fetchWordFile(xFile);
      if (!xData) { console.log(`    → fetch/parse failed (skipping)`); continue; }
      let count = 0;
      for (const [vr, rendering] of xData.byVerse) {
        verseSet.add(vr);
        if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
        count++;
      }
      console.log(`    → ${count} verses added from crossRef ${xFile}, verses now: ${verseSet.size}`);
    }
  }

  if (intersectedVerses === null) {
    intersectedVerses = verseSet;
  } else {
    const before = intersectedVerses.size;
    intersectedVerses = new Set([...intersectedVerses].filter(v => verseSet.has(v)));
    console.log(`  After intersection: ${before} → ${intersectedVerses.size}`);
  }
  console.log();
}

console.log(`[6] Final result: ${intersectedVerses?.size ?? 0} verse(s)\n`);
if (intersectedVerses && intersectedVerses.size > 0) {
  const verses = [...intersectedVerses].slice(0, 20);
  for (const vr of verses) {
    console.log(`  ${vr}  (rendering: "${sampleByVerse.get(vr) ?? '?'}")`);
  }
  if (intersectedVerses.size > 20) console.log(`  ... and ${intersectedVerses.size - 20} more`);
}
