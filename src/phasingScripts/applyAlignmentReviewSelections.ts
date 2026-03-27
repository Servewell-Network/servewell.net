console.info('phase1b-apply-review: Applying manual supplement updates from review-file literal-marker edits');

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Chapter, Snippet } from './phase1To2/phase2Types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const docsRoot = path.resolve(__dirname, '../json-Phase2/docs');
const defaultReviewPath = path.resolve(__dirname, '../json-Phase2/traditional-word-alignment-double-check.txt');
const defaultNoRowReviewPath = path.resolve(__dirname, '../json-Phase2/traditional-word-alignment-no-row-double-check.txt');
const defaultManualSupplementPath = path.resolve(__dirname, './phase1To2/bsb_supplement.json');
const NO_MORPHEME_ID = 'None';
const PROGRESS_MARKER_PATTERN = /^\|{5,}$/;

type BsbSupplementValue = string | string[];

interface ApplyReviewOptions {
    reviewPath: string;
    noRowReviewPath: string;
    includeNoRow: boolean;
    includeUnchangedMainAsGuess: boolean;
    manualSupplementPath: string;
}

interface ParsedRef {
    snippetId: string;
    entryIndex: number;
}

interface ReviewDecision {
    source: 'main' | 'no-row';
    key: string;
    snippetId: string;
    entryIndex: number;
    selectedMorphemeIds: string[];
}

interface LiteralSegment {
    morphemeId: string;
    baselineText: string;
}

async function main() {
    const options = parseCliOptions();
    console.info(`phase1b-apply-review: literal review path -> ${options.reviewPath}`);
    if (options.includeNoRow) {
        console.info(`phase1b-apply-review: no-row review path -> ${options.noRowReviewPath}`);
    } else {
        console.info('phase1b-apply-review: no-row review path disabled via --skip-no-row');
    }

    const snippetById = await loadSnippetsById(docsRoot);

    const rawMainText = await fs.readFile(options.reviewPath, 'utf8');
    const rawNoRowText = options.includeNoRow
        ? await readOptionalTextFile(options.noRowReviewPath, 'no-row review file')
        : '';

    const mainText = truncateReviewTextAtProgressMarker(rawMainText, 'literal review file');
    const noRowText = truncateReviewTextAtProgressMarker(rawNoRowText, 'no-row review file');

    const mainDecisions = parseMainReviewDecisions(
        mainText,
        snippetById,
        options.includeUnchangedMainAsGuess
    );
    const noRowDecisions = options.includeNoRow
        ? parseNoRowReviewDecisions(noRowText, snippetById)
        : [];
    const allDecisions = [...mainDecisions, ...noRowDecisions];

    if (allDecisions.length === 0) {
        console.info('phase1b-apply-review: No literal-marker edits detected in literal lines; manual supplement unchanged.');
        return;
    }

    const existingSupplement = await readSupplementMap(options.manualSupplementPath);

    let updatedCount = 0;
    let addedCount = 0;
    let unchangedCount = 0;
    let singleCount = 0;
    let multiCount = 0;
    let noneCount = 0;

    allDecisions.forEach((decision) => {
        const nextValue = normalizeSupplementValueForStorage(decision.selectedMorphemeIds);
        const priorValue = existingSupplement[decision.key];

        if (supplementValuesEqual(priorValue, nextValue)) {
            unchangedCount += 1;
            return;
        }

        if (priorValue === undefined) {
            addedCount += 1;
        }

        existingSupplement[decision.key] = nextValue;
        updatedCount += 1;

        if (Array.isArray(nextValue)) {
            if (nextValue.length === 0) {
                noneCount += 1;
            } else {
                multiCount += 1;
            }
            return;
        }

        singleCount += 1;
    });

    if (updatedCount === 0) {
        console.info('phase1b-apply-review: Parsed edits matched existing supplement values; no file write needed.');
        return;
    }

    await writeSupplementMap(options.manualSupplementPath, existingSupplement);

    console.info(`phase1b-apply-review: Parsed ${allDecisions.length} edited decisions (${mainDecisions.length} main, ${noRowDecisions.length} no-row).`);
    console.info(
        `phase1b-apply-review: Applied ${updatedCount} updates (${addedCount} new, ${unchangedCount} unchanged ignored).`
    );
    console.info(
        `phase1b-apply-review: Value mix -> single=${singleCount}, multi=${multiCount}, none=${noneCount}.`
    );
    console.info('phase1b-apply-review: Traditional-line edits are ignored; only literal-line markers are interpreted.');
}

function parseCliOptions(): ApplyReviewOptions {
    const args = process.argv.slice(2);
    const options: ApplyReviewOptions = {
        reviewPath: defaultReviewPath,
        noRowReviewPath: defaultNoRowReviewPath,
        includeNoRow: true,
        includeUnchangedMainAsGuess: false,
        manualSupplementPath: defaultManualSupplementPath
    };

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];

        if (arg === '--review-path') {
            i += 1;
            options.reviewPath = parseCliPathValue(args[i], '--review-path');
            continue;
        }

        if (arg === '--no-row-review-path') {
            i += 1;
            options.noRowReviewPath = parseCliPathValue(args[i], '--no-row-review-path');
            continue;
        }

        if (arg === '--manual-supplement-path') {
            i += 1;
            options.manualSupplementPath = parseCliPathValue(args[i], '--manual-supplement-path');
            continue;
        }

        if (arg === '--skip-no-row') {
            options.includeNoRow = false;
            continue;
        }

        if (arg === '--include-unchanged-main-as-guess') {
            options.includeUnchangedMainAsGuess = true;
            continue;
        }

        if (arg === '--help' || arg === '-h') {
            printCliHelp();
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return options;
}

function parseCliPathValue(rawPath: string | undefined, flagName: string): string {
    if (!rawPath || rawPath.startsWith('--')) {
        throw new Error(`Expected a file path after ${flagName}.`);
    }

    return path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath);
}

async function readOptionalTextFile(filePath: string, label: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
            console.warn(`phase1b-apply-review: ${label} not found at ${filePath}; skipping.`);
            return '';
        }

        throw error;
    }
}

function printCliHelp() {
    console.info('phase1b-apply-review usage:');
    console.info('  tsx src/phasingScripts/applyAlignmentReviewSelections.ts [options]');
    console.info('');
    console.info('options:');
    console.info(`  --review-path <path>            Default: ${defaultReviewPath}`);
    console.info(`  --no-row-review-path <path>     Default: ${defaultNoRowReviewPath}`);
    console.info('  --skip-no-row                   Ignore no-row file and ingest only main review file');
    console.info('  --include-unchanged-main-as-guess  Treat unchanged main-review entries as accepted guess decisions');
    console.info(`  --manual-supplement-path <path> Default: ${defaultManualSupplementPath}`);
    console.info('  --help, -h                      Show this help text');
}

function truncateReviewTextAtProgressMarker(fileText: string, label: string): string {
    const lines = fileText.split(/\r?\n/);
    const markerIndex = lines.findIndex((line) => PROGRESS_MARKER_PATTERN.test(line.trim()));

    if (markerIndex === -1) {
        return fileText;
    }

    console.info(`phase1b-apply-review: ${label} truncated at progress marker on line ${markerIndex + 1}.`);
    return lines.slice(0, markerIndex).join('\n');
}

function parseMainReviewDecisions(
    fileText: string,
    snippetById: Map<string, Snippet>,
    includeUnchangedAsGuess: boolean
): ReviewDecision[] {
    const lines = fileText.split(/\r?\n/);
    const decisions: ReviewDecision[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const header = lines[index];
        const headerMatch = header.match(/^([^|]+?)\s+\|\s+confidence:\s+[^|]+\|\s+guess:\s+([^|]+)\|\s+key:\s+([^|]+)\|\s+candidates:\s*(.*)$/);
        if (!headerMatch) {
            continue;
        }

        const parsedRef = parseSnippetEntryRef(headerMatch[1].trim());
        if (!parsedRef) {
            continue;
        }

        const snippet = snippetById.get(parsedRef.snippetId);
        if (!snippet) {
            continue;
        }

        const key = headerMatch[3].trim();
        if (!key) {
            continue;
        }

        const literalLine = lines[index + 1] || '';
        if (!literalLine.startsWith('literal: ')) {
            continue;
        }

        const editedLiteral = literalLine.slice('literal: '.length).trim();
        const guessMorphemeIds = parseMorphemeIdList(headerMatch[2].trim());
        const baselineLiteral = buildLiteralVerse(snippet, guessMorphemeIds);

        if (normalizeWhitespace(editedLiteral) === normalizeWhitespace(baselineLiteral)) {
            if (!includeUnchangedAsGuess) {
                continue;
            }

            decisions.push({
                source: 'main',
                key,
                snippetId: parsedRef.snippetId,
                entryIndex: parsedRef.entryIndex,
                selectedMorphemeIds: guessMorphemeIds
            });
            continue;
        }

        decisions.push({
            source: 'main',
            key,
            snippetId: parsedRef.snippetId,
            entryIndex: parsedRef.entryIndex,
            selectedMorphemeIds: detectMarkedSelectedMorphemeIds(snippet, editedLiteral)
        });
    }

    return decisions;
}

function parseNoRowReviewDecisions(fileText: string, snippetById: Map<string, Snippet>): ReviewDecision[] {
    const lines = fileText.split(/\r?\n/);
    const decisions: ReviewDecision[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const header = lines[index];
        const headerMatch = header.match(/^([^|]+?)\s+\|\s+guess:\s+([^|]+)\|\s+word:\s+([^|]+)\|\s+rowSourceToken:\s*(.+)$/);
        if (!headerMatch) {
            continue;
        }

        const parsedRef = parseSnippetEntryRef(headerMatch[1].trim());
        if (!parsedRef) {
            continue;
        }

        const key = buildSupplementKey(parsedRef.snippetId, parsedRef.entryIndex, headerMatch[3].trim());
        if (!key) {
            continue;
        }

        const snippet = snippetById.get(parsedRef.snippetId);
        if (!snippet) {
            continue;
        }

        const literalLine = lines[index + 1] || '';
        if (!literalLine.startsWith('literal: ')) {
            continue;
        }

        const editedLiteral = literalLine.slice('literal: '.length).trim();
        const baselineHighlightId = pickLiteralHighlightForNoRowIssue(snippet, headerMatch[4].trim());
        const baselineLiteral = buildLiteralVerse(snippet, baselineHighlightId ? [baselineHighlightId] : []);

        if (normalizeWhitespace(editedLiteral) === normalizeWhitespace(baselineLiteral)) {
            continue;
        }

        decisions.push({
            source: 'no-row',
            key,
            snippetId: parsedRef.snippetId,
            entryIndex: parsedRef.entryIndex,
            selectedMorphemeIds: detectMarkedSelectedMorphemeIds(snippet, editedLiteral)
        });
    }

    return decisions;
}

function parseSnippetEntryRef(raw: string): ParsedRef | undefined {
    const match = raw.match(/^(.+?)#(\d+)$/);
    if (!match) {
        return undefined;
    }

    const snippetId = match[1].trim();
    const entryIndex = Number.parseInt(match[2], 10);
    if (!snippetId || !Number.isFinite(entryIndex)) {
        return undefined;
    }

    return {
        snippetId,
        entryIndex
    };
}

function detectMarkedSelectedMorphemeIds(snippet: Snippet, editedLiteral: string): string[] {
    const segments = getLiteralSegments(snippet);
    const normalizedEdited = normalizeWhitespace(editedLiteral);
    const lowerEdited = normalizedEdited.toLowerCase();

    const selectedIds: string[] = [];
    let searchStart = 0;

    segments.forEach((segment) => {
        const baseText = normalizeWhitespace(segment.baselineText);
        if (!baseText) {
            return;
        }

        const matchIndex = lowerEdited.indexOf(baseText.toLowerCase(), searchStart);
        if (matchIndex === -1) {
            return;
        }

        if (hasLeadingMarker(normalizedEdited, matchIndex, searchStart)) {
            selectedIds.push(segment.morphemeId);
        }

        searchStart = matchIndex + baseText.length;
    });

    return uniqueStrings(selectedIds);
}

function hasLeadingMarker(editedLiteral: string, matchIndex: number, searchStart: number): boolean {
    if (matchIndex >= 2 && editedLiteral.slice(matchIndex - 2, matchIndex) === '__') {
        return true;
    }

    if (matchIndex >= 1 && editedLiteral[matchIndex - 1] === '*') {
        return true;
    }

    const gap = editedLiteral.slice(searchStart, matchIndex);
    return /(__|\*)\s*$/.test(gap);
}

function getLiteralSegments(snippet: Snippet): LiteralSegment[] {
    return snippet.OriginalMorphemes
        .filter((morpheme) => Boolean(morpheme.MorphemeId))
        .map((morpheme) => ({
            morphemeId: morpheme.MorphemeId as string,
            baselineText: toReviewBaselineToken(morpheme.EnglishMorphemeWithPunctuationInOriginalOrder?.trim() || '')
        }))
        .filter((segment) => segment.baselineText.length > 0)
        .filter((segment) => !isNonLexicalToken(segment.baselineText));
}

function buildLiteralVerse(snippet: Snippet, highlightMorphemeIds: string[]): string {
    const highlightSet = new Set(
        highlightMorphemeIds
            .map((morphemeId) => morphemeId.trim())
            .filter((morphemeId) => morphemeId.length > 0)
    );

    const tokens: string[] = [];
    snippet.OriginalMorphemes.forEach((morpheme) => {
        const text = morpheme.EnglishMorphemeWithPunctuationInOriginalOrder?.trim() || '';
        if (!text || isNonLexicalToken(text)) {
            return;
        }

        const morphemeId = morpheme.MorphemeId || '';
        const baselineText = toReviewBaselineToken(text);
        tokens.push(highlightSet.has(morphemeId) ? markReviewToken(baselineText) : baselineText);
    });

    return formatVerse(tokens);
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

function buildSupplementKey(snippetId: string, entryIndex: number, englishWord: string): string {
    const normalizedWord = normalizeTokenForSupplementKey(englishWord) || englishWord.trim();

    if (!normalizedWord || normalizedWord.includes(' ')) {
        return '';
    }

    return `${snippetId}#${entryIndex}-${normalizedWord}`;
}

function normalizeTokenForSupplementKey(token: string): string {
    return token
        .toLowerCase()
        .replace(/^\[[^\]]+\]$/, '')
        .replace(/^\[[^\]]+/, '')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

function parseMorphemeIdList(raw: string): string[] {
    if (!raw || raw.trim().toUpperCase() === NO_MORPHEME_ID.toUpperCase()) {
        return [];
    }

    return uniqueStrings(
        raw
            .split(',')
            .map((segment) => segment.trim())
            .filter((segment) => segment.length > 0)
            .filter((segment) => segment.toUpperCase() !== NO_MORPHEME_ID.toUpperCase())
    );
}

function normalizeSupplementValueForStorage(morphemeIds: string[]): BsbSupplementValue {
    const normalized = uniqueStrings(
        morphemeIds
            .map((morphemeId) => morphemeId.trim())
            .filter((morphemeId) => morphemeId.length > 0)
            .filter((morphemeId) => morphemeId.toUpperCase() !== NO_MORPHEME_ID.toUpperCase())
    );

    if (normalized.length === 0) {
        return [];
    }

    if (normalized.length === 1) {
        return normalized[0];
    }

    return normalized;
}

function supplementValuesEqual(left: BsbSupplementValue | undefined, right: BsbSupplementValue): boolean {
    if (left === undefined) {
        return false;
    }

    const leftNormalized = normalizeSupplementValueForCompare(left);
    const rightNormalized = normalizeSupplementValueForCompare(right);

    if (leftNormalized.length !== rightNormalized.length) {
        return false;
    }

    return leftNormalized.every((entry, index) => entry === rightNormalized[index]);
}

function normalizeSupplementValueForCompare(value: BsbSupplementValue): string[] {
    const rawValues = typeof value === 'string' ? [value] : value;
    return uniqueStrings(
        rawValues
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
            .filter((entry) => entry.toUpperCase() !== NO_MORPHEME_ID.toUpperCase())
    );
}

async function readSupplementMap(filePath: string): Promise<Record<string, BsbSupplementValue>> {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Manual supplement at ${filePath} must be a JSON object mapping keys to values.`);
    }

    const map: Record<string, BsbSupplementValue> = {};
    Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'string') {
            map[key] = value;
            return;
        }

        if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
            map[key] = value;
            return;
        }

        throw new Error(`Invalid manual supplement value for key ${key}; expected string or string[].`);
    });

    return map;
}

async function writeSupplementMap(filePath: string, map: Record<string, BsbSupplementValue>) {
    const sortedKeys = Object.keys(map).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const sorted: Record<string, BsbSupplementValue> = {};

    sortedKeys.forEach((key) => {
        const normalizedValue = normalizeSupplementValueForStorage(normalizeSupplementValueForCompare(map[key]));
        sorted[key] = normalizedValue;
    });

    await fs.writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

async function loadSnippetsById(rootDir: string): Promise<Map<string, Snippet>> {
    const files = await listJsonFiles(rootDir);
    const snippetById = new Map<string, Snippet>();

    for (const filePath of files) {
        const raw = await fs.readFile(filePath, 'utf8');
        const chapter = JSON.parse(raw) as Chapter;

        chapter.SnippetsAndExplanations.forEach((snippet) => {
            if (snippet.SnippetId) {
                snippetById.set(snippet.SnippetId, snippet);
            }
        });
    }

    return snippetById;
}

async function listJsonFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listJsonFiles(fullPath)));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(fullPath);
        }
    }

    return files;
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

function isNonLexicalToken(token: string): boolean {
    const normalized = normalizeTokenForAlignment(token);
    return normalized === '' || normalized === 'vvv';
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

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values)];
}

await main().catch((error) => {
    console.error('phase1b-apply-review: Failed', error);
    process.exit(1);
});
