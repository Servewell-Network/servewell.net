/**
 * debug-search.mjs
 *
 * Runs the word search pipeline against live data and prints debug info.
 *
 * Usage:
 *   node scripts/debug-search.mjs "love"
 *   node scripts/debug-search.mjs "love neighbor"
 */

const WORD_INDEX_URL = 'https://servewell.net/_word_index.json';
const WORDS_BASE_URL = 'https://words.servewell.net';

const query = process.argv.slice(2).join(' ').trim();
if (!query) { console.error('Usage: node scripts/debug-search.mjs "<query>"'); process.exit(1); }

// ── Inline the pure logic (mirrors wordSearchLogic.ts) ────────────────────

const IRREGULARS = {
  was:'be',is:'be',am:'be',are:'be',were:'be',been:'be',
  went:'go',gone:'go',goes:'go',
  had:'have',has:'have',having:'have',
  did:'do',does:'do',done:'do',doing:'do',
  said:'say',says:'say',saying:'say',
  gave:'give',given:'give',gives:'give',giving:'give',
  took:'take',taken:'take',takes:'take',
  came:'come',comes:'come',coming:'come',
  ran:'run',runs:'run',running:'run',
  saw:'see',seen:'see',sees:'see',seeing:'see',
  knew:'know',known:'know',knows:'know',knowing:'know',
  thought:'think',thinks:'think',thinking:'think',
};

function simplelemmatize(word) {
  const w = word.toLowerCase().trim();
  if (!w) return w;
  if (IRREGULARS[w]) return IRREGULARS[w];
  const n = w.length;
  if (n > 4 && w.endsWith('ies')) return w.slice(0,-3)+'y';
  if (n > 5 && w.endsWith('ing')) {
    const stem = w.slice(0,-3);
    if (stem.length >= 3 && stem[stem.length-1] === stem[stem.length-2]) return stem.slice(0,-1);
    return stem+'e';
  }
  if (n > 4 && w.endsWith('ed')) {
    const stem = w.slice(0,-2);
    if (stem.length >= 3 && stem[stem.length-1] === stem[stem.length-2]) return stem.slice(0,-1);
    return stem+'e';
  }
  if (n > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0,-1);
  return w;
}

function resolveToken(token, idx) {
  const lower = token.toLowerCase().trim();
  if (!lower) return { kind:'unresolved' };
  if (lower in idx) return { kind:'resolved', lemma:lower };
  const lem = simplelemmatize(lower);
  if (lem !== lower && lem in idx) return { kind:'resolved', lemma:lem };
  if (lem !== lower && lem.endsWith('e') && lem.length > 2) {
    const noE = lem.slice(0,-1);
    if (noE in idx) return { kind:'resolved', lemma:noE };
  }
  if (lower.endsWith('ing') && lower.length > 5) {
    const bareStem = lower.slice(0,-3);
    if (bareStem in idx) return { kind:'resolved', lemma:bareStem };
  }
  const candidates = [];
  for (const k of Object.keys(idx)) {
    if (k.startsWith(lower)) { candidates.push(k); if (candidates.length >= 40) break; }
  }
  if (candidates.length === 1) return { kind:'resolved', lemma:candidates[0] };
  if (candidates.length > 1) return { kind:'ambiguous', candidates };
  return { kind:'unresolved' };
}

function getFileNamesForLemma(lemma, idx) {
  const count = idx[lemma] ?? 1;
  if (count <= 1) return [lemma];
  return [lemma, ...Array.from({length: count-1}, (_,i) => `${lemma}_${i+2}`)];
}

function extractVerseRef(ref) {
  const dot = ref.indexOf('.');
  return dot === -1 ? ref : ref.slice(0, dot);
}

function sortByRarity(lemmas, idx) {
  return [...lemmas].sort((a,b) => (idx[a]??1) - (idx[b]??1));
}

function parseQueryTokens(raw) {
  return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

// ── Run ───────────────────────────────────────────────────────────────────

console.log(`\n=== Word Search Debug ===`);
console.log(`Query: "${query}"\n`);

console.log(`[1] Fetching word index from ${WORD_INDEX_URL} ...`);
const idxRes = await fetch(WORD_INDEX_URL);
if (!idxRes.ok) { console.error(`  FAILED: HTTP ${idxRes.status}`); process.exit(1); }
const idx = await idxRes.json();
console.log(`  Loaded. ${Object.keys(idx).length} lemmas.\n`);

const tokens = parseQueryTokens(query);
console.log(`[2] Tokens: ${JSON.stringify(tokens)}\n`);

const resolutions = [];
for (const token of tokens) {
  const res = resolveToken(token, idx);
  console.log(`[3] resolveToken("${token}") →`, JSON.stringify(res));
  if (res.kind === 'ambiguous') {
    console.log(`    candidates (first 10): ${res.candidates.slice(0,10).join(', ')}`);
  }
  resolutions.push({ token, res });
}
console.log();

const resolvedLemmas = resolutions
  .filter(r => r.res.kind === 'resolved')
  .map(r => r.res.lemma);

if (resolvedLemmas.length === 0) {
  console.log('No tokens resolved. Nothing to fetch.');
  process.exit(0);
}

const sorted = sortByRarity(resolvedLemmas, idx);
console.log(`[4] Resolved lemmas sorted by rarity: ${sorted.join(', ')}\n`);

// Fetch each lemma's files
let intersectedVerses = null;
const sampleByVerse = new Map();

for (const lemma of sorted) {
  const fileNames = getFileNamesForLemma(lemma, idx);
  console.log(`[5] Fetching lemma "${lemma}" — files: ${fileNames.join(', ')}`);

  const verseSet = new Set();
  const firstFileName = fileNames[0];
  let crossRefFileNames = [];
  for (const fileName of fileNames) {
    const url = `${WORDS_BASE_URL}/${encodeURIComponent(fileName)}`;
    console.log(`    GET ${url}`);
    let data;
    try {
      const r = await fetch(url);
      if (!r.ok) { console.log(`    → HTTP ${r.status} (skipping)`); continue; }
      const html = await r.text();
      const m = html.match(/<pre id="ws-data">([\s\S]*?)<\/pre>/);
      if (!m) { console.log(`    → no #ws-data island found`); continue; }
      const jsonText = m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<')
        .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
      data = JSON.parse(jsonText);
    } catch (e) { console.log(`    → fetch error: ${e.message}`); continue; }

    if (!data?.ancientWord?.slots) { console.log(`    → unexpected JSON shape`); continue; }

    // Capture crossRefs from the first (primary) file
    if (fileName === firstFileName && data.crossRefs?.length) {
      crossRefFileNames = data.crossRefs.map(c => c.fileName);
      console.log(`    crossRefs: ${crossRefFileNames.join(', ')}`);
    }

    const { slots, overflow } = data.ancientWord;
    let fileVerses = 0;
    for (const slot of Object.values(slots)) {
      for (const [rendering, trans] of Object.entries(slot.translations)) {
        for (const inst of trans.instances) {
          const vr = extractVerseRef(inst.ref);
          verseSet.add(vr);
          if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
          fileVerses++;
        }
      }
    }
    const overflowKeys = overflow ? Object.keys(overflow).length : 0;
    console.log(`    → ${fileVerses} instances, ${verseSet.size} verses so far${overflowKeys ? `, overflow: ${overflowKeys} entries` : ''}`);
  }

  console.log(`  Total unique verses for "${lemma}": ${verseSet.size}`);

  // Fetch crossRef files if any
  if (crossRefFileNames.length > 0) {
    for (const xFile of crossRefFileNames) {
      const xUrl = `${WORDS_BASE_URL}/${encodeURIComponent(xFile)}`;
      console.log(`    crossRef GET ${xUrl}`);
      let data;
      try {
        const r = await fetch(xUrl);
        if (!r.ok) { console.log(`    → HTTP ${r.status} (skipping)`); continue; }
        const html = await r.text();
        const m = html.match(/<pre id="ws-data">([\s\S]*?)<\/pre>/);
        if (!m) { console.log(`    → no #ws-data island found`); continue; }
        const jsonText = m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<')
          .replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
        data = JSON.parse(jsonText);
      } catch (e) { console.log(`    → fetch error: ${e.message}`); continue; }
      if (!data?.ancientWord?.slots) continue;
      let count = 0;
      for (const slot of Object.values(data.ancientWord.slots))
        for (const [rendering, trans] of Object.entries(slot.translations))
          for (const inst of trans.instances) {
            const vr = inst.ref.split('.')[0];
            verseSet.add(vr);
            if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
            count++;
          }
      console.log(`    → ${count} instances added from crossRef ${xFile}, verses now: ${verseSet.size}`);
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
