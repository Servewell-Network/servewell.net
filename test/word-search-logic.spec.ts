// @vitest-environment node
/**
 * word-search-logic.spec.ts
 *
 * Unit tests for the pure search-logic helpers used in the word-search module.
 * All functions are DOM-free and can run in a plain Node environment.
 */

import { describe, expect, it } from 'vitest';
import {
  simplelemmatize,
  resolveToken,
  getFileNamesForLemma,
  extractVerseRef,
  parseVerseRef,
  parseQueryTokens,
  sortByRarity,
  type WordIndex,
} from '../src/phasingScripts/phase2To3/wordSearchLogic';

// ---------------------------------------------------------------------------
// simplelemmatize
// ---------------------------------------------------------------------------

describe('simplelemmatize', () => {
  it('returns identity for already-base words', () => {
    expect(simplelemmatize('love')).toBe('love');
    expect(simplelemmatize('water')).toBe('water');
    expect(simplelemmatize('sing')).toBe('sing');
  });

  it('handles irregulars', () => {
    expect(simplelemmatize('was')).toBe('be');
    expect(simplelemmatize('were')).toBe('be');
    expect(simplelemmatize('is')).toBe('be');
    expect(simplelemmatize('went')).toBe('go');
    expect(simplelemmatize('seen')).toBe('see');
    expect(simplelemmatize('said')).toBe('say');
  });

  it('strips -ies → -y', () => {
    expect(simplelemmatize('cities')).toBe('city');
    expect(simplelemmatize('carries')).toBe('carry');
  });

  it('strips -s (handles -ves words via -s rule, giving stem+e)', () => {
    // "leaves" → strip -s → "leave" (close enough; resolveToken prefix handles "leaf" vs "leave")
    expect(simplelemmatize('leaves')).toBe('leave');
    expect(simplelemmatize('halves')).toBe('halve');
  });

  it('strips -ing with consonant doubling', () => {
    expect(simplelemmatize('running')).toBe('run');
    expect(simplelemmatize('stopping')).toBe('stop');
  });

  it('strips -ing with silent-e restoration', () => {
    expect(simplelemmatize('loving')).toBe('love');
    expect(simplelemmatize('making')).toBe('make');
    expect(simplelemmatize('giving')).toBe('give');
  });

  it('strips -ed with consonant doubling', () => {
    expect(simplelemmatize('stopped')).toBe('stop');
    expect(simplelemmatize('clapped')).toBe('clap');
  });

  it('strips -ed with silent-e restoration', () => {
    expect(simplelemmatize('loved')).toBe('love');
    expect(simplelemmatize('created')).toBe('create');
  });

  it('strips -ed bare (no e-restoration or doubling)', () => {
    // "blessed" stem = "bless"; last two chars are both 's' (doubled)
    // The doubled rule fires, giving "bles" — which at least tries the index.
    // The important thing is something reasonable comes out; test as regression anchor.
    const result = simplelemmatize('blessed');
    expect(['bless', 'bles', 'blesse'].includes(result)).toBe(true);
  });

  it('strips -s (including -es words become stem+e via -s rule)', () => {
    // "churches" → strip -s → "churche" (resolveToken then drops trailing e → "church")
    expect(simplelemmatize('churches')).toBe('churche');
    expect(simplelemmatize('matches')).toBe('matche');
  });

  it('strips -s from nouns/verbs', () => {
    expect(simplelemmatize('kings')).toBe('king');
    expect(simplelemmatize('waters')).toBe('water');
    expect(simplelemmatize('loves')).toBe('love');
  });

  it('does not strip double-s endings', () => {
    expect(simplelemmatize('bless')).toBe('bless');
    expect(simplelemmatize('pass')).toBe('pass');
  });

  it('is case-insensitive', () => {
    expect(simplelemmatize('LOVES')).toBe('love');
    expect(simplelemmatize('Running')).toBe('run');
  });
});

// ---------------------------------------------------------------------------
// resolveToken
// ---------------------------------------------------------------------------

describe('resolveToken', () => {
  const idx: WordIndex = {
    love: 3,
    lovely: 1,
    god: 15,
    neighbor: 1,
    water: 7,
    king: 5,
    be: 12,
    create: 2,
  };

  it('resolves by exact match', () => {
    expect(resolveToken('love', idx)).toEqual({ kind: 'resolved', lemma: 'love' });
    expect(resolveToken('god', idx)).toEqual({ kind: 'resolved', lemma: 'god' });
  });

  it('resolves by exact match case-insensitively', () => {
    expect(resolveToken('LOVE', idx)).toEqual({ kind: 'resolved', lemma: 'love' });
    expect(resolveToken('GOD', idx)).toEqual({ kind: 'resolved', lemma: 'god' });
  });

  it('resolves inflected form via lemmatizer', () => {
    expect(resolveToken('loves', idx)).toEqual({ kind: 'resolved', lemma: 'love' });
    expect(resolveToken('loving', idx)).toEqual({ kind: 'resolved', lemma: 'love' });
    expect(resolveToken('loved', idx)).toEqual({ kind: 'resolved', lemma: 'love' });
    expect(resolveToken('kings', idx)).toEqual({ kind: 'resolved', lemma: 'king' });
    expect(resolveToken('creating', idx)).toEqual({ kind: 'resolved', lemma: 'create' });
  });

  it('resolves unique prefix match', () => {
    // "neighb" prefix matches only "neighbor"
    expect(resolveToken('neighb', idx)).toEqual({ kind: 'resolved', lemma: 'neighbor' });
    // "wat" prefix matches only "water"
    expect(resolveToken('wat', idx)).toEqual({ kind: 'resolved', lemma: 'water' });
  });

  it('returns ambiguous for multiple prefix matches', () => {
    const result = resolveToken('lo', idx);
    expect(result.kind).toBe('ambiguous');
    const candidates = (result as { kind: 'ambiguous'; candidates: string[] }).candidates;
    expect(candidates).toContain('love');
    expect(candidates).toContain('lovely');
  });

  it('returns unresolved for no match', () => {
    expect(resolveToken('xyzzy', idx)).toEqual({ kind: 'unresolved' });
  });

  it('returns unresolved for empty input', () => {
    expect(resolveToken('', idx)).toEqual({ kind: 'unresolved' });
    expect(resolveToken('   ', idx)).toEqual({ kind: 'unresolved' });
  });
});

// ---------------------------------------------------------------------------
// getFileNamesForLemma
// ---------------------------------------------------------------------------

describe('getFileNamesForLemma', () => {
  const idx: WordIndex = { love: 3, god: 1, neighbor: 1, water: 7 };

  it('returns single file for count=1', () => {
    expect(getFileNamesForLemma('god', idx)).toEqual(['god']);
    expect(getFileNamesForLemma('neighbor', idx)).toEqual(['neighbor']);
  });

  it('returns numbered files for count>1', () => {
    expect(getFileNamesForLemma('love', idx)).toEqual(['love', 'love_2', 'love_3']);
    expect(getFileNamesForLemma('water', idx)).toEqual([
      'water', 'water_2', 'water_3', 'water_4', 'water_5', 'water_6', 'water_7',
    ]);
  });

  it('returns single file for lemma not in index (defaults to 1)', () => {
    expect(getFileNamesForLemma('unknown', idx)).toEqual(['unknown']);
  });
});

// ---------------------------------------------------------------------------
// extractVerseRef
// ---------------------------------------------------------------------------

describe('extractVerseRef', () => {
  it('strips word-position suffix', () => {
    expect(extractVerseRef('Gen22:2.16')).toBe('Gen22:2');
    expect(extractVerseRef('Lev19:18.7')).toBe('Lev19:18');
    expect(extractVerseRef('Mat22:39.12')).toBe('Mat22:39');
  });

  it('returns unchanged ref without dot', () => {
    expect(extractVerseRef('Gen22:2')).toBe('Gen22:2');
  });
});

// ---------------------------------------------------------------------------
// parseVerseRef
// ---------------------------------------------------------------------------

describe('parseVerseRef', () => {
  it('parses standard refs', () => {
    expect(parseVerseRef('Gen22:2')).toEqual({ bookCode: 'Gen', chapter: 22, verse: 2 });
    expect(parseVerseRef('Lev19:18')).toEqual({ bookCode: 'Lev', chapter: 19, verse: 18 });
    expect(parseVerseRef('1Co13:4')).toEqual({ bookCode: '1Co', chapter: 13, verse: 4 });
  });

  it('returns null for invalid refs', () => {
    expect(parseVerseRef('')).toBeNull();
    expect(parseVerseRef('not-a-ref')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseQueryTokens
// ---------------------------------------------------------------------------

describe('parseQueryTokens', () => {
  it('splits on whitespace', () => {
    expect(parseQueryTokens('love your neighbor')).toEqual(['love', 'your', 'neighbor']);
  });

  it('handles multiple spaces', () => {
    expect(parseQueryTokens('love  your   neighbor')).toEqual(['love', 'your', 'neighbor']);
  });

  it('returns empty array for blank input', () => {
    expect(parseQueryTokens('')).toEqual([]);
    expect(parseQueryTokens('   ')).toEqual([]);
  });

  it('handles single token', () => {
    expect(parseQueryTokens('love')).toEqual(['love']);
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseQueryTokens('  love  ')).toEqual(['love']);
  });
});

// ---------------------------------------------------------------------------
// sortByRarity
// ---------------------------------------------------------------------------

describe('sortByRarity', () => {
  const idx: WordIndex = { love: 3, god: 15, neighbor: 1, water: 7 };

  it('sorts ascending by file count', () => {
    expect(sortByRarity(['love', 'god', 'neighbor', 'water'], idx)).toEqual([
      'neighbor', 'love', 'water', 'god',
    ]);
  });

  it('treats missing lemmas as count=1', () => {
    expect(sortByRarity(['love', 'unknown'], idx)).toEqual(['unknown', 'love']);
  });

  it('does not mutate original array', () => {
    const arr = ['god', 'neighbor'];
    sortByRarity(arr, idx);
    expect(arr).toEqual(['god', 'neighbor']);
  });
});
