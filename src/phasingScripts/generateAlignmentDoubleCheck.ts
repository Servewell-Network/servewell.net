console.info('phase1b-review: Building unresolved alignment double-check file');

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Chapter, EnglishInsertion, EnglishWordInfo, Morpheme, Snippet } from './phase1To2/phase2Types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docsRoot = path.resolve(__dirname, '../json-Phase2/docs');
const outputPath = path.resolve(__dirname, '../json-Phase2/traditional-word-alignment-double-check.txt');
const noRowOutputPath = path.resolve(__dirname, '../json-Phase2/traditional-word-alignment-no-row-double-check.txt');
const alignmentReportPath = path.resolve(__dirname, '../json-Phase2/traditional-word-alignment-report.json');
const autoSupplementPath = path.resolve(__dirname, './phase1To2/bsb_supplement_auto_high.json');
const NO_MORPHEME_ID = 'None';

type BsbSupplementValue = string | string[];

type Confidence = 'high' | 'medium' | 'low';

interface TraditionalToken {
    text: string;
    entryIndex: number;
    entry: EnglishWordInfo;
}

interface LiteralToken {
    text: string;
    morphemeId?: string;
}

interface ReviewEntry {
    snippetId: string;
    entryIndex: number;
    supplementKey: string;
    confidence: Confidence;
    bestGuessMorphemeId: string;
    candidateMorphemeIds: string[];
    englishWord: string;
    literal: string;
    traditional: string;
}

interface ScoredCandidate {
    morpheme: Morpheme;
    score: number;
}

interface AlignmentIssueReportItem {
    snippetId: string;
    englishWord: string;
    rowSourceToken: string;
    reason: string;
}

interface AlignmentReportFile {
    sampledIssues: AlignmentIssueReportItem[];
}

const PRONOUN_LIKE_WORDS = new Set([
    'i', 'me', 'my', 'mine',
    'you', 'your', 'yours',
    'he', 'him', 'his',
    'she', 'her', 'hers',
    'it', 'its',
    'we', 'us', 'our', 'ours',
    'they', 'them', 'their', 'theirs'
]);

const PREPOSITION_LIKE_WORDS = new Set([
    'to', 'for', 'from', 'in', 'into', 'on', 'upon', 'over', 'under', 'with', 'without', 'by', 'of', 'at'
]);

async function main() {
    const jsonFiles = await listJsonFiles(docsRoot);
    const reviewEntries: ReviewEntry[] = [];
    const snippetById = new Map<string, Snippet>();

    for (const jsonFile of jsonFiles) {
        const raw = await fs.readFile(jsonFile, 'utf8');
        const chapter = JSON.parse(raw) as Chapter;

        for (const snippet of chapter.SnippetsAndExplanations) {
            if (snippet.SnippetId) {
                snippetById.set(snippet.SnippetId, snippet);
            }

            const traditionalTokens = getTraditionalTokens(snippet);
            const morphemeById = new Map(
                snippet.OriginalMorphemes
                    .filter((morpheme) => Boolean(morpheme.MorphemeId))
                    .map((morpheme) => [morpheme.MorphemeId as string, morpheme])
            );

            for (const token of traditionalTokens) {
                const candidateMorphemeIds = token.entry.OriginalMorphemeIds || [];
                if (candidateMorphemeIds.length < 2) {
                    continue;
                }

                if (isNonLexicalToken(token.text)) {
                    continue;
                }

                const scored = scoreCandidates(snippet, token, candidateMorphemeIds, morphemeById);
                if (scored.length === 0) {
                    continue;
                }

                const sorted = [...scored].sort((a, b) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }

                    return (a.morpheme.OriginalMorphemeOrdinal || Number.MAX_SAFE_INTEGER)
                        - (b.morpheme.OriginalMorphemeOrdinal || Number.MAX_SAFE_INTEGER);
                });

                const best = sorted[0];
                const second = sorted[1];
                const confidence = determineConfidence(best.score, second?.score);
                const bestMorphemeId = best.morpheme.MorphemeId;

                if (!bestMorphemeId) {
                    continue;
                }

                reviewEntries.push({
                    snippetId: snippet.SnippetId || '',
                    entryIndex: token.entryIndex,
                    supplementKey: buildSupplementKey(snippet.SnippetId || '', token.entryIndex, token.text),
                    confidence,
                    bestGuessMorphemeId: bestMorphemeId,
                    candidateMorphemeIds,
                    englishWord: token.text,
                    literal: buildLiteralVerse(snippet, bestMorphemeId),
                    traditional: buildTraditionalVerse(snippet, token.entryIndex)
                });
            }
        }
    }

    reviewEntries.sort((a, b) => {
        if (a.snippetId !== b.snippetId) {
            return a.snippetId.localeCompare(b.snippetId, undefined, { numeric: true });
        }

        if (a.confidence !== b.confidence) {
            const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
            return rank[a.confidence] - rank[b.confidence];
        }

        return a.englishWord.localeCompare(b.englishWord, undefined, { numeric: true });
    });

    const byConfidence = reviewEntries.reduce((acc, entry) => {
        acc[entry.confidence] = (acc[entry.confidence] || 0) + 1;
        return acc;
    }, {} as Record<Confidence, number>);

    const autoSupplementSuggestions = buildAutoSupplementSuggestions(reviewEntries);

    const lines: string[] = [];
    lines.push('# Traditional Alignment Double-Check');
    lines.push(`generatedAt: ${new Date().toISOString()}`);
    lines.push(`entries: ${reviewEntries.length}`);
    lines.push(`confidence.low: ${byConfidence.low || 0}`);
    lines.push(`confidence.medium: ${byConfidence.medium || 0}`);
    lines.push(`confidence.high: ${byConfidence.high || 0}`);
    lines.push('');
    lines.push('Each block includes a best guess and full literal/traditional verse text with significant words marked by a leading __ marker.');
    lines.push('Review workflow: edit literal-line markers only. Add or move __ before one or more literal morphemes to map this traditional word.');
    lines.push('If you want NONE, leave no literal morpheme marked with __; p1b-apply-review stores that as an empty array.');
    lines.push('Traditional-line edits are ignored by p1b-apply-review.');
    lines.push('');

    for (const entry of reviewEntries) {
        lines.push(`${entry.snippetId}#${entry.entryIndex} | confidence: ${entry.confidence} | guess: ${entry.bestGuessMorphemeId} | key: ${entry.supplementKey} | candidates: ${entry.candidateMorphemeIds.join(', ')}`);
        lines.push(`literal: ${entry.literal}`);
        lines.push(`traditional: ${entry.traditional}`);
        lines.push('');
    }

    await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');

    const existingAutoSuggestions = await readAutoSupplementSuggestions(autoSupplementPath);
    const mergedAutoSuggestions: Record<string, BsbSupplementValue> = {
        ...existingAutoSuggestions,
        ...autoSupplementSuggestions
    };

    const sortedAutoKeys = Object.keys(mergedAutoSuggestions).sort();
    const sortedAutoSuggestions: Record<string, BsbSupplementValue> = {};
    sortedAutoKeys.forEach((key) => {
        sortedAutoSuggestions[key] = mergedAutoSuggestions[key];
    });
    await fs.writeFile(autoSupplementPath, `${JSON.stringify(sortedAutoSuggestions, null, 2)}\n`, 'utf8');

    const noRowCount = await writeNoRowDoubleCheckFile(snippetById);

    console.info(`phase1b-review: Wrote ${reviewEntries.length} entries to ${outputPath}`);
    console.info(`phase1b-review: Added ${Object.keys(autoSupplementSuggestions).length} high-confidence suggestions (${sortedAutoKeys.length} total) to ${autoSupplementPath}`);
    console.info(`phase1b-review: Wrote ${noRowCount} no-row entries to ${noRowOutputPath}`);
}

async function writeNoRowDoubleCheckFile(snippetById: Map<string, Snippet>): Promise<number> {
    const reportRaw = await fs.readFile(alignmentReportPath, 'utf8');
    const report = JSON.parse(reportRaw) as AlignmentReportFile;
    const noRowIssues = report.sampledIssues.filter((issue) => issue.reason === 'no-row-morpheme-candidates');

    const perWordCursor = new Map<string, number>();
    const lines: string[] = [];
    lines.push('# Traditional Alignment No-Row Double-Check');
    lines.push(`generatedAt: ${new Date().toISOString()}`);
    lines.push(`entries: ${noRowIssues.length}`);
    lines.push('');
    lines.push('These are unresolved words with no row-level morpheme candidates.');
    lines.push('Best guess is NONE; literal highlight is selected from row-source overlap for manual review.');
    lines.push('Review workflow: edit literal-line markers only. Add or move __ before one or more literal morphemes to map this traditional word.');
    lines.push('If you want NONE, leave no literal morpheme marked with __; p1b-apply-review stores that as an empty array.');
    lines.push('Traditional-line edits are ignored by p1b-apply-review.');
    lines.push('');

    for (const issue of noRowIssues) {
        const snippet = snippetById.get(issue.snippetId);
        if (!snippet) {
            continue;
        }

        const normalizedIssueWord = normalizeTokenForAlignment(issue.englishWord);
        const unresolvedTraditionalTokens = getTraditionalTokens(snippet)
            .filter((token) => !token.entry.OriginalMorphemeId && !token.entry.OriginalMorphemeIds)
            .filter((token) => normalizeTokenForAlignment(token.text) === normalizedIssueWord);

        const cursorKey = `${issue.snippetId}|${normalizedIssueWord}`;
        const cursor = perWordCursor.get(cursorKey) || 0;
        const selectedToken = unresolvedTraditionalTokens[cursor]
            || unresolvedTraditionalTokens[unresolvedTraditionalTokens.length - 1]
            || getTraditionalTokens(snippet).find((token) => normalizeTokenForAlignment(token.text) === normalizedIssueWord);
        perWordCursor.set(cursorKey, cursor + 1);

        const highlightEntryIndex = selectedToken ? selectedToken.entryIndex : -1;
        const literalHighlightMorphemeId = pickLiteralHighlightForNoRowIssue(snippet, issue.rowSourceToken);

        lines.push(`${issue.snippetId}${highlightEntryIndex >= 0 ? `#${highlightEntryIndex}` : ''} | guess: NONE | word: ${issue.englishWord} | rowSourceToken: ${issue.rowSourceToken}`);
        lines.push(`literal: ${buildLiteralVerse(snippet, literalHighlightMorphemeId)}`);
        lines.push(`traditional: ${buildTraditionalVerse(snippet, highlightEntryIndex)}`);
        lines.push('');
    }

    await fs.writeFile(noRowOutputPath, `${lines.join('\n')}\n`, 'utf8');
    return noRowIssues.length;
}

function pickLiteralHighlightForNoRowIssue(snippet: Snippet, rowSourceToken: string): string {
    const sourceTokens = normalizePhraseForAlignment(rowSourceToken)
        .split(/\s+/)
        .filter(Boolean);
    const sourceSet = new Set(sourceTokens);

    let bestMorphemeId: string | undefined;
    let bestScore = -1;

    snippet.OriginalMorphemes.forEach((morpheme) => {
        if (!morpheme.MorphemeId) {
            return;
        }

        const gloss = morpheme.EnglishMorphemeWithPunctuationInOriginalOrder || '';
        const normalizedGlossTokens = normalizePhraseForAlignment(gloss)
            .split(/\s+/)
            .filter(Boolean);

        if (normalizedGlossTokens.length === 0) {
            return;
        }

        const overlap = normalizedGlossTokens.reduce((score, token) => score + (sourceSet.has(token) ? 1 : 0), 0);
        if (overlap > bestScore) {
            bestScore = overlap;
            bestMorphemeId = morpheme.MorphemeId;
        }
    });

    if (bestMorphemeId) {
        return bestMorphemeId;
    }

    return snippet.OriginalMorphemes.find((morpheme) => Boolean(morpheme.MorphemeId))?.MorphemeId || '';
}

function buildAutoSupplementSuggestions(reviewEntries: ReviewEntry[]): Record<string, BsbSupplementValue> {
    const suggestions: Record<string, BsbSupplementValue> = {};

    reviewEntries
        .filter((entry) => entry.confidence === 'high')
        .forEach((entry) => {
            if (!entry.supplementKey) {
                return;
            }

            // Keep first suggestion for a key to avoid churn when repeated rows map to same token.
            if (!suggestions[entry.supplementKey]) {
                suggestions[entry.supplementKey] = entry.bestGuessMorphemeId;
            }
        });

    return suggestions;
}

async function readAutoSupplementSuggestions(filePath: string): Promise<Record<string, BsbSupplementValue>> {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        const next: Record<string, BsbSupplementValue> = {};
        Object.entries(parsed).forEach(([key, value]) => {
            if (typeof value === 'string') {
                const keyWord = key.split('-').slice(1).join('-');
                if (keyWord.includes(' ')) {
                    return;
                }
                next[key] = value;
                return;
            }

            if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
                const keyWord = key.split('-').slice(1).join('-');
                if (keyWord.includes(' ')) {
                    return;
                }

                next[key] = [...new Set(
                    value
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0)
                        .filter((entry) => entry !== NO_MORPHEME_ID)
                )];
            }
        });

        return next;
    } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

function determineConfidence(bestScore: number, secondScore?: number): Confidence {
    if (secondScore === undefined) {
        return bestScore >= 3 ? 'high' : 'medium';
    }

    const margin = bestScore - secondScore;
    if (margin >= 3) {
        return 'high';
    }

    if (margin >= 1.5) {
        return 'medium';
    }

    return 'low';
}

function scoreCandidates(
    snippet: Snippet,
    token: TraditionalToken,
    candidateMorphemeIds: string[],
    morphemeById: Map<string, Morpheme>
): ScoredCandidate[] {
    const previousAssignedOrdinal = getPreviousAssignedOrdinal(snippet, token.entryIndex, morphemeById);
    const normalizedWord = normalizeTokenForAlignment(token.text);

    return candidateMorphemeIds
        .map((candidateId) => morphemeById.get(candidateId))
        .filter((morpheme): morpheme is Morpheme => Boolean(morpheme))
        .map((morpheme) => {
            const grammarFunction = (morpheme.OriginalMorphemeGrammarFunction || '').toLowerCase();
            const gloss = morpheme.EnglishMorphemeWithPunctuationInOriginalOrder || '';
            const normalizedGloss = normalizePhraseForAlignment(gloss);
            const strongsBase = parseStrongsBase(morpheme.OriginalRootStrongsID);

            let score = 0;

            if (!morpheme.IsPunctuation) {
                score += 3;
            }

            if (normalizedGloss) {
                score += 2;
            }

            if (strongsBase && !isLikelyPunctuationStrongs(strongsBase)) {
                score += 1;
            }

            if (PRONOUN_LIKE_WORDS.has(normalizedWord)) {
                if (grammarFunction === 'pronoun' || grammarFunction === 'suffix') {
                    score += 3;
                }

                if (/\b(them|him|her|his|its|you|your|our|my|us|me)\b/i.test(gloss)) {
                    score += 2;
                }
            }

            if (normalizedWord.startsWith('own')) {
                if (grammarFunction === 'preposition') {
                    score += 2;
                }

                if (/belongs|to|for/i.test(gloss)) {
                    score += 1;
                }
            }

            if (PREPOSITION_LIKE_WORDS.has(normalizedWord) && grammarFunction === 'preposition') {
                score += 2;
            }

            if (previousAssignedOrdinal !== undefined && morpheme.OriginalMorphemeOrdinal !== undefined) {
                const delta = morpheme.OriginalMorphemeOrdinal - previousAssignedOrdinal;
                if (delta === 1) {
                    score += 1;
                } else if (delta > 0) {
                    score += 0.5;
                }
            }

            return {
                morpheme,
                score
            };
        });
}

function getPreviousAssignedOrdinal(
    snippet: Snippet,
    entryIndex: number,
    morphemeById: Map<string, Morpheme>
): number | undefined {
    for (let i = entryIndex - 1; i >= 0; i -= 1) {
        const entry = snippet.EnglishHeadingsAndWords[i];
        if (!isEnglishWordInfo(entry)) {
            continue;
        }

        const resolvedMorphemeIds = (entry.ResolvedOriginalMorphemeIds || [])
            .filter((morphemeId) => morphemeId && morphemeId !== NO_MORPHEME_ID);
        if (resolvedMorphemeIds.length > 0) {
            for (let idx = resolvedMorphemeIds.length - 1; idx >= 0; idx -= 1) {
                const morpheme = morphemeById.get(resolvedMorphemeIds[idx]);
                if (morpheme?.OriginalMorphemeOrdinal !== undefined) {
                    return morpheme.OriginalMorphemeOrdinal;
                }
            }
        }

        const morphemeId = entry.OriginalMorphemeId;
        if (!morphemeId || morphemeId === NO_MORPHEME_ID) {
            continue;
        }

        const morpheme = morphemeById.get(morphemeId);
        if (morpheme?.OriginalMorphemeOrdinal !== undefined) {
            return morpheme.OriginalMorphemeOrdinal;
        }
    }

    return undefined;
}

function buildLiteralVerse(snippet: Snippet, highlightMorphemeId: string): string {
    const tokens: string[] = [];

    snippet.OriginalMorphemes.forEach((morpheme) => {
        const text = morpheme.EnglishMorphemeWithPunctuationInOriginalOrder?.trim() || '';
        if (!text || isNonLexicalToken(text)) {
            return;
        }

        const baselineText = toReviewBaselineToken(text);
        tokens.push(morpheme.MorphemeId === highlightMorphemeId ? markReviewToken(baselineText) : baselineText);
    });

    return formatVerse(tokens);
}

function buildTraditionalVerse(snippet: Snippet, highlightEntryIndex: number): string {
    const traditionalTokens = getTraditionalTokens(snippet);

    const tokens = traditionalTokens
        .map((token, tokenIndex) => {
            const nextTokenText = traditionalTokens[tokenIndex + 1]?.text;
            const cleanedTokenText = normalizeTraditionalTokenPunctuation(token.text, nextTokenText);
            const baselineText = toReviewBaselineToken(cleanedTokenText);
            return token.entryIndex === highlightEntryIndex ? markReviewToken(baselineText) : baselineText;
        });

    return formatVerse(tokens);
}

function getTraditionalTokens(snippet: Snippet): TraditionalToken[] {
    return snippet.EnglishHeadingsAndWords
        .map((entry, entryIndex) => ({ entry, entryIndex }))
        .filter(({ entry }) => isEnglishWordInfo(entry))
        .map(({ entry, entryIndex }) => ({
            text: (entry as EnglishWordInfo).EnglishWord,
            entryIndex,
            entry: entry as EnglishWordInfo
        }))
        .filter(({ text }) => text.trim().length > 0);
}

function formatVerse(tokens: string[]): string {
    return tokens
        .join(' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function toReviewBaselineToken(token: string): string {
    return token.toLowerCase();
}

function markReviewToken(token: string): string {
    return `__${token}`;
}

function normalizeTraditionalTokenPunctuation(token: string, nextToken: string | undefined): string {
    let normalized = token
        .replace(/,\.+/g, ',')
        .replace(/\.{2,}/g, '.');

    if (/\.$/.test(normalized) && startsWithLowercaseLetter(nextToken || '')) {
        normalized = normalized.replace(/\.+$/, '');
    }

    return normalized;
}

function startsWithLowercaseLetter(token: string): boolean {
    const firstLetter = token.match(/[A-Za-z]/)?.[0];
    if (!firstLetter) {
        return false;
    }

    return firstLetter === firstLetter.toLowerCase();
}

function normalizePhraseForAlignment(phrase: string): string {
    return phrase
        .split(/\s+/)
        .map((segment) => normalizeTokenForAlignment(segment))
        .filter(Boolean)
        .join(' ');
}

function normalizeTokenForAlignment(token: string): string {
    const normalized = token
        .toLowerCase()
        .replace(/^\[[^\]]+\]$/, '')
        .replace(/^\[[^\]]+/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    return normalized;
}

function buildSupplementKey(snippetId: string, entryIndex: number, englishWord: string): string {
    const normalizedWord = normalizeTokenForAlignment(englishWord) || englishWord.trim();

    if (!normalizedWord || normalizedWord.includes(' ')) {
        return '';
    }

    return `${snippetId}#${entryIndex}-${normalizedWord}`;
}

function isNonLexicalToken(token: string): boolean {
    const normalized = normalizeTokenForAlignment(token);
    return normalized === '' || normalized === 'vvv';
}

function parseStrongsBase(strongsId: string | undefined): string | undefined {
    if (!strongsId) {
        return undefined;
    }

    const trimmed = strongsId.trim().toUpperCase();
    const match = trimmed.match(/^([HG])0*(\d+)/);
    if (!match) {
        return undefined;
    }

    const prefix = match[1];
    const numericPart = Number.parseInt(match[2], 10);
    if (!Number.isFinite(numericPart)) {
        return undefined;
    }

    return `${prefix}${numericPart}`;
}

function isLikelyPunctuationStrongs(strongsBase: string): boolean {
    return strongsBase === 'H9014'
        || strongsBase === 'H9015'
        || strongsBase === 'H9016'
        || strongsBase === 'H9012';
}

function isEnglishWordInfo(value: EnglishWordInfo | EnglishInsertion): value is EnglishWordInfo {
    return Boolean(value && typeof value === 'object' && 'EnglishWord' in value);
}

async function listJsonFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const nested = await listJsonFiles(fullPath);
            files.push(...nested);
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(fullPath);
        }
    }

    return files;
}

await main().catch((error) => {
    console.error('phase1b-review: Failed to build review file', error);
    process.exit(1);
});
