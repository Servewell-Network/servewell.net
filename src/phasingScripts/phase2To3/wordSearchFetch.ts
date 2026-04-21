/**
 * wordSearchFetch.ts
 *
 * DOM-free fetch layer for word search. Works in both browser and Node (18+).
 * Extracted from createWordSearchModule.ts so Node scripts can import directly.
 */

import {
  type WordIndex,
  extractVerseRef,
  getFileNamesForLemma,
} from './wordSearchLogic';

// ---------------------------------------------------------------------------
// URL constants
// ---------------------------------------------------------------------------

// Use a relative URL when running on servewell.net or localhost (avoids CORS).
// Fall back to the absolute URL on other origins (e.g. words.servewell.net),
// which is covered by the Access-Control-Allow-Origin header on _word_index.json.
export const WORD_INDEX_URL: string = (() => {
  if (typeof location === 'undefined') return 'https://servewell.net/_word_index.json';
  const h = location.hostname;
  return (h === 'servewell.net' || h === 'localhost' || h === '127.0.0.1')
    ? '/_word_index.json'
    : 'https://servewell.net/_word_index.json';
})();
export const WORDS_BASE_URL = 'https://words.servewell.net';

// ---------------------------------------------------------------------------
// Word file types
// ---------------------------------------------------------------------------

export interface WordInstance { ref: string; trad: string; lit: string; }
export interface WordTranslation { totalInstances: number; instances: WordInstance[]; }
export interface WordSlot { grammarFull: string; totalInstances: number; translations: Record<string, WordTranslation>; }
export interface WordMeta { wordKey: string; totalInstances: number; }
export interface CrossRefEntry { fileName: string; wordKey: string; }
export interface WordFileJson {
  crossRefs?: CrossRefEntry[];
  ancientWord: {
    _meta: WordMeta;
    overflow?: Record<string, string>;
    slots: Record<string, WordSlot>;
  };
}

export interface LoadedWordData {
  lemma: string;
  fileName: string;
  totalInstances: number;
  hasOverflow: boolean;
  crossRefFileNames: string[];
  /** verse-level ref (e.g. "Gen22:2") → first matching rendering in this file */
  byVerse: Map<string, string>;
  /** verse-level ref → literal verse text (plain string) */
  litByVerse: Map<string, string>;
  /** verse-level ref → traditional verse text (plain string) */
  tradByVerse: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Index state
// ---------------------------------------------------------------------------

let indexData: WordIndex | null = null;
let indexLoading = false;
let indexLoadFailed = false;

export function getIndexSync(): WordIndex | null { return indexData; }
export function isIndexLoadFailed(): boolean { return indexLoadFailed; }

export function loadIndex(): Promise<WordIndex | null> {
  if (indexData) return Promise.resolve(indexData);
  if (indexLoadFailed) return Promise.resolve(null);
  if (indexLoading) {
    return new Promise((resolve) => {
      const id = setInterval(() => {
        if (!indexLoading) { clearInterval(id); resolve(indexData); }
      }, 50);
    });
  }
  indexLoading = true;
  return fetch(WORD_INDEX_URL)
    .then((r) => r.ok ? r.json() as Promise<WordIndex> : Promise.reject(new Error(`HTTP ${r.status}`)))
    .then((d) => { indexData = d; indexLoading = false; return d; })
    .catch(() => { indexLoadFailed = true; indexLoading = false; return null; });
}

export function prefetchIndex(): void {
  if (!indexData && !indexLoading && !indexLoadFailed) loadIndex().catch(() => {});
}

// ---------------------------------------------------------------------------
// Word file fetching
// ---------------------------------------------------------------------------

// Promise cache — avoids re-fetching the same file across searches
const fileCache = new Map<string, Promise<LoadedWordData | null>>();

export function fetchWordFile(fileName: string): Promise<LoadedWordData | null> {
  const cached = fileCache.get(fileName);
  if (cached !== undefined) return cached;

  const url = `${WORDS_BASE_URL}/${encodeURIComponent(fileName)}`;
  const p = fetch(url)
    .then((r): Promise<WordFileJson | null> => {
      if (!r.ok) return Promise.resolve(null);
      return r.text().then((html) => {
        const m = html.match(/<pre id="ws-data">([\s\S]*?)<\/pre>/);
        if (!m) return null;
        const jsonText = m[1]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        try { return JSON.parse(jsonText) as WordFileJson; } catch { return null; }
      });
    })
    .then((json): LoadedWordData | null => {
      if (!json?.ancientWord) return null;
      const { _meta, slots, overflow } = json.ancientWord;
      const byVerse = new Map<string, string>();
      const litByVerse = new Map<string, string>();
      const tradByVerse = new Map<string, string>();
      for (const slot of Object.values(slots)) {
        for (const [rendering, trans] of Object.entries(slot.translations)) {
          for (const inst of trans.instances) {
            const vr = extractVerseRef(inst.ref);
            if (!byVerse.has(vr)) byVerse.set(vr, rendering);
            if (!litByVerse.has(vr)) litByVerse.set(vr, inst.lit);
            if (!tradByVerse.has(vr)) tradByVerse.set(vr, inst.trad);
          }
        }
      }
      return {
        lemma: _meta.wordKey,
        fileName,
        totalInstances: _meta.totalInstances,
        hasOverflow: !!(overflow && Object.keys(overflow).length > 0),
        crossRefFileNames: json.crossRefs?.map(c => c.fileName) ?? [],
        byVerse,
        litByVerse,
        tradByVerse,
      };
    })
    .catch(() => null);

  fileCache.set(fileName, p);
  return p;
}

/** Fetch all non-overflow files for a lemma; return combined verse set + total instances. */
export async function fetchLemmaFiles(lemma: string, idx: WordIndex): Promise<{
  verseSet: Set<string>;
  primaryVerseSet: Set<string>;
  totalInstances: number;
  hasOverflow: boolean;
  sampleByVerse: Map<string, string>;
  litByVerse: Map<string, string>;
  tradByVerse: Map<string, string>;
}> {
  const names = getFileNamesForLemma(lemma, idx);
  const primaryResults: (LoadedWordData | null)[] = await Promise.all(names.map(fetchWordFile));

  // CrossRef file names come from the first primary file's raw data.
  // CrossRefs are files with different lemma keys whose translations overlap with this word —
  // they legitimately broaden single-word search results. However, including them in
  // multi-word intersection causes false positives (e.g. "the_2" has "STONE" as one
  // rendering but covers thousands of verses, polluting "stones jerusalem" results).
  // Solution: return both verseSet (primary + crossRefs, for single-word display) and
  // primaryVerseSet (primary only, used for multi-word intersection).
  const primaryNameSet = new Set(names);
  const crossRefNames: string[] = (primaryResults[0]?.crossRefFileNames ?? [])
    .filter(n => !primaryNameSet.has(n));
  const crossRefResults: (LoadedWordData | null)[] = crossRefNames.length > 0
    ? await Promise.all(crossRefNames.map(fetchWordFile))
    : [];

  const verseSet = new Set<string>();
  const sampleByVerse = new Map<string, string>();
  const litByVerse = new Map<string, string>();
  const tradByVerse = new Map<string, string>();
  let totalInstances = 0;
  let hasOverflow = false;

  // Add all verses from primary files unconditionally.
  for (const r of primaryResults) {
    if (!r) continue;
    totalInstances += r.totalInstances;
    if (r.hasOverflow) hasOverflow = true;
    for (const [vr, rendering] of r.byVerse) {
      verseSet.add(vr);
      if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
    }
    for (const [vr, lit] of r.litByVerse) {
      if (!litByVerse.has(vr)) litByVerse.set(vr, lit);
    }
    for (const [vr, trad] of r.tradByVerse) {
      if (!tradByVerse.has(vr)) tradByVerse.set(vr, trad);
    }
  }

  // primaryVerseSet = primary files only (used for multi-word intersection to avoid
  // crossRef breadth causing false positives).
  const primaryVerseSet = new Set(verseSet);

  // Add crossRef verses to the full verseSet (used for single-word display).
  for (const r of crossRefResults) {
    if (!r) continue;
    for (const [vr, rendering] of r.byVerse) {
      verseSet.add(vr);
      if (!sampleByVerse.has(vr)) sampleByVerse.set(vr, rendering);
      const lit = r.litByVerse.get(vr);
      if (lit && !litByVerse.has(vr)) litByVerse.set(vr, lit);
      const trad = r.tradByVerse.get(vr);
      if (trad && !tradByVerse.has(vr)) tradByVerse.set(vr, trad);
    }
  }

  return { verseSet, primaryVerseSet, totalInstances, hasOverflow, sampleByVerse, litByVerse, tradByVerse };
}
