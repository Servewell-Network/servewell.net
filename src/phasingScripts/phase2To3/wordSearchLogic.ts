/**
 * wordSearchLogic.ts
 *
 * Pure, DOM-free logic functions for the word search feature.
 * Extracted so they can be unit-tested in a Node environment.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** _word_index.json: { "<lemma>": <fileCount> }. All lemmas present (1 = single file). */
export type WordIndex = Record<string, number>;

export type TokenResolution =
  | { kind: 'resolved'; lemma: string }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'unresolved' };

// ---------------------------------------------------------------------------
// Simple English lemmatizer
// ---------------------------------------------------------------------------

const IRREGULARS: Record<string, string> = {
  was: 'be', is: 'be', am: 'be', are: 'be', were: 'be', been: 'be',
  went: 'go', gone: 'go', goes: 'go',
  had: 'have', has: 'have', having: 'have',
  did: 'do', does: 'do', done: 'do', doing: 'do',
  said: 'say', says: 'say', saying: 'say',
  gave: 'give', given: 'give', gives: 'give', giving: 'give',
  took: 'take', taken: 'take', takes: 'take',
  came: 'come', comes: 'come', coming: 'come',
  ran: 'run', runs: 'run', running: 'run',
  saw: 'see', seen: 'see', sees: 'see', seeing: 'see',
  knew: 'know', known: 'know', knows: 'know', knowing: 'know',
  thought: 'think', thinks: 'think', thinking: 'think',
};

/**
 * Strip common English inflections to produce a canonical base form.
 * Not a full morphological analyser; good enough to map inflected queries to
 * word-index keys (which are already root-translation forms).
 * Returns the original word if no rule fires.
 *
 * NOTE: This intentionally does NOT need to match wink-lemmatizer, which is
 * used by generateWordStudyJson.ts to derive R2 file names. The two are
 * decoupled by design: resolveToken() in this file handles the gap via
 * exact-key lookup → lemmatize → prefix matching, so a user query like
 * "running" still finds the correct file even if simplelemmatize produces a
 * slightly different stem than wink would. Replacing simplelemmatize with
 * wink here would require ~1,565 R2 file renames (9% of all files) for no
 * user-visible benefit.
 */
export function simplelemmatize(word: string): string {
  const w = word.toLowerCase().trim();
  if (!w) return w;

  if (IRREGULARS[w]) return IRREGULARS[w];

  const n = w.length;

  // -ies → -y  (cities → city, carries → carry)
  if (n > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';

  // -ing: consonant doubling or silent-e drop
  if (n > 5 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    // doubled consonant: running → runn → run
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      return stem.slice(0, -1);
    }
    // silent-e was dropped: loving → lov → love
    return stem + 'e';
  }

  // -ed: consonant doubling or silent-e drop
  if (n > 4 && w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    // doubled: stopped → stopp → stop
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
      return stem.slice(0, -1);
    }
    // e-drop: loved → lov → love
    return stem + 'e';
  }

  // -s: general strip (loves → love, kings → king, churches → churche)
  // Note: -es words like "churches" become "churche"; resolveToken handles
  // the further step of dropping the trailing 'e' to find "church".
  if (n > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);

  return w;
}

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

/**
 * Given a single query token, resolve it to a word-index lemma (or ambiguous
 * candidates, or unresolved).
 *
 * Resolution order:
 *   1. Exact match in index
 *   2. Lemmatize → check index; for -ing words also try the bare stem
 *   3. Prefix match → single result = resolved; multiple = ambiguous
 */
export function resolveToken(token: string, idx: WordIndex): TokenResolution {
  const lower = token.toLowerCase().trim();
  if (!lower) return { kind: 'unresolved' };

  // 1. Exact
  if (lower in idx) return { kind: 'resolved', lemma: lower };

  // 2. Lemmatize
  const lem = simplelemmatize(lower);
  if (lem !== lower && lem in idx) return { kind: 'resolved', lemma: lem };

  // 3. Additional simple fallbacks
  // If the lemmatizer produced a word ending in 'e' that's not in the index,
  // try dropping the trailing 'e' (handles "churche" → "church", "reade" → "read")
  if (lem !== lower && lem.endsWith('e') && lem.length > 2) {
    const noE = lem.slice(0, -1);
    if (noE in idx) return { kind: 'resolved', lemma: noE };
  }
  // For -ing: also try the bare stem without e-restoration
  // (e.g. "reading" → simplelemmatize → "reade" → not found → try "read")
  if (lower.endsWith('ing') && lower.length > 5) {
    const bareStem = lower.slice(0, -3);
    if (bareStem in idx) return { kind: 'resolved', lemma: bareStem };
  }

  // 4. Prefix match
  const MAX_CANDIDATES = 40;
  const candidates: string[] = [];
  for (const k of Object.keys(idx)) {
    if (k.startsWith(lower)) {
      candidates.push(k);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  }
  if (candidates.length === 1) return { kind: 'resolved', lemma: candidates[0] };
  if (candidates.length > 1) return { kind: 'ambiguous', candidates };

  return { kind: 'unresolved' };
}

// ---------------------------------------------------------------------------
// File name helpers
// ---------------------------------------------------------------------------

/**
 * Return the list of non-overflow file names for a given lemma.
 * A lemma with count N has files: lemma, lemma_2, lemma_3, ... lemma_N
 */
export function getFileNamesForLemma(lemma: string, idx: WordIndex): string[] {
  const count = idx[lemma] ?? 1;
  if (count <= 1) return [lemma];
  return [lemma, ...Array.from({ length: count - 1 }, (_, i) => `${lemma}_${i + 2}`)];
}

// ---------------------------------------------------------------------------
// Ref helpers
// ---------------------------------------------------------------------------

/**
 * Strip the word-position suffix from a full instance ref.
 * "Gen22:2.16" → "Gen22:2"
 */
export function extractVerseRef(ref: string): string {
  const dot = ref.lastIndexOf('.');
  return dot !== -1 ? ref.slice(0, dot) : ref;
}

/**
 * Parse a verse ref into a book code, chapter, and verse number.
 * Returns null if the ref doesn't match the expected pattern.
 */
export function parseVerseRef(ref: string): { bookCode: string; chapter: number; verse: number } | null {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return null;
  return { bookCode: m[1], chapter: parseInt(m[2], 10), verse: parseInt(m[3], 10) };
}

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

/**
 * Split a raw query string into tokens (non-empty whitespace-delimited pieces).
 * Returns [] for empty/whitespace-only input.
 */
export function parseQueryTokens(query: string): string[] {
  return query.split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Rarity scoring (file count is a reasonable proxy for instance count)
// ---------------------------------------------------------------------------

/**
 * Given a set of resolved lemmas, return them sorted by ascending file count
 * (fewest files first = likely rarest = best "primary search" candidate).
 */
export function sortByRarity(lemmas: string[], idx: WordIndex): string[] {
  return [...lemmas].sort((a, b) => (idx[a] ?? 1) - (idx[b] ?? 1));
}
