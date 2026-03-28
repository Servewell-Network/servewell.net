console.info('phase1bTo2: Reading in Berean Standard Bible data and updating json-Phase2 files');

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import ancientDocNames from './phase1To2/ancientDocNames.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Chapter, EnglishWordInfo, Morpheme, Snippet, EnglishInsertion } from './phase1To2/phase2Types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pathToPhase1b = path.join(__dirname, './phase1To2/bsb_tables.tsv');
const bsbSupplementPath = path.join(__dirname, './phase1To2/bsb_supplement.json');
const bsbSupplementAutoPath = path.join(__dirname, './phase1To2/bsb_supplement_auto_high.json');
const pathToPhase2 = path.join(__dirname, '../json-Phase2/');
const alignmentReportPath = path.join(pathToPhase2, 'traditional-word-alignment-report.json');
const ALIGNMENT_SAMPLE_LIMIT = 50000;
const NO_MORPHEME_ID = 'None';
const BSB_VERSE_NUMBER_MARKER_PATTERN = /<span class=\|reftext\|><a href=\|[^|]*\|><b>(\d+)<\/b><\/a><\/span>/g;

const ENGLISH_ARTICLES = new Set(['a', 'an', 'the']);
const ENGLISH_PREPOSITIONS = new Set([
    'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'as', 'at', 'before', 'behind',
    'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'during', 'except', 'for', 'from', 'in', 'into',
    'near', 'of', 'off', 'on', 'onto', 'over', 'through', 'throughout', 'to', 'toward', 'towards', 'under',
    'until', 'unto', 'up', 'upon', 'with', 'within', 'without'
]);
const ENGLISH_CONJUNCTIONS = new Set(['and', 'but', 'for', 'if', 'nor', 'or', 'so', 'yet']);

enum BsbWord {
    HebSort = 0,
    GreekSort = 1,
    BsbSort = 2,
    Verse = 3,
    Language = 4,
    WLC_NestleBase_TR_RP_WH_NE_NA_SBL = 5,
    WLC_NestleBase_TR_RP_WH_NE_NA_SBL_ECM = 6,
    Translit = 7,
    Parsing1 = 8,
    Parsing2 = 9,
    StrHeb = 10,
    StrGrk = 11,
    VerseId = 12,
    Hdg = 13,
    Crossref = 14,
    Par = 15,
    Space = 16,
    begQ = 17,
    BsbVersion = 18,
    pnc = 19,
    endQ = 20,
    footnotes = 21,
    EndText = 22
}

interface AncientDocInfo {
    "abbr1": string,
    "abbr2": string,
    "numPlusAbbr2": string,
    "name": string,
    "longName": string
}

type SupportedLanguage = 'Hebrew' | 'Aramaic' | 'Greek';
type BsbSupplementValue = string | string[];
type BsbSupplementMap = Record<string, BsbSupplementValue>;

interface MorphemeAlignmentCandidate {
    morphemeId: string;
    originalMorphemeOrdinal: number;
    isPunctuation: boolean;
    normalizedGlossTokens: Set<string>;
    normalizedGlossPhrase: string;
    bracketedGlossTokens: Set<string>;
    unbracketedGlossTokens: Set<string>;
    strongsId?: string;
    strongsBase?: string;
    grammarCode?: string;
    grammarFunction?: string;
    grammarLabel?: string;
}

interface RowAlignmentContext {
    rowLanguage: SupportedLanguage;
    rowStrongsId?: string;
    rowStrongsBase?: string;
    rowSourceToken: string;
    rowSourceNormalizedPhrase: string;
    rawSort?: number;
    normalizedSort?: number;
    candidates: MorphemeAlignmentCandidate[];
    snippetCandidates: MorphemeAlignmentCandidate[];
}

interface WordAlignmentResolution {
    originalMorphemeId?: string;
    resolvedMorphemeIds?: string[];
    candidateMorphemeIds?: string[];
    issueReason?: string;
}

interface AlignmentIssueSample {
    verseId: string;
    snippetId: string;
    language: SupportedLanguage;
    sortKey: string;
    englishWord: string;
    rowSourceToken: string;
    rowStrongsId?: string;
    candidateMorphemeIds: string[];
    reason: string;
}

interface SupplementLookupResult {
    key: string;
    morphemeIds: string[];
}


let currentAncientDoc = '';
let ancientDocInfo: AncientDocInfo | undefined;
let ancientDocDirectory = '';
let currentChapter = '';
let currentChapterData: Chapter;
let currentChapterPath: string;
let currentVerseId: string = '';
let currentVerse = '';
let currentVerseData: Snippet | undefined;
let currentTraditionalSnippetData: Snippet | undefined;
let awaitingPsalmVerseOneMarker = false;
let currentLanguage: SupportedLanguage = 'Hebrew';
let currentVerseFirstHebSort: number | null = null;
let currentVerseFirstGreekSort: number | null = null;

let totalTraditionalWords = 0;
let uniquelyAlignedWords = 0;
let unresolvedWords = 0;
let noneAssignedWords = 0;
let bsbSupplementMap: BsbSupplementMap = {};
const unusedBsbSupplementKeys = new Set<string>();
const alignmentReasonCounts: Record<string, number> = {};
const alignmentIssueSamples: AlignmentIssueSample[] = [];

async function processBSBFile(fileName: string) {
    await loadBsbSupplement();

    const fileStream = fs.createReadStream(pathToPhase1b);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const fields = line.split('\t');
        if (fields[BsbWord.VerseId]) {
            currentVerseId = fields[BsbWord.VerseId];
        }
        if (!fields[BsbWord.BsbVersion] || currentVerseId === 'VerseId') {
            continue; // skip lines without a verse (blank lines or header)
        }
        const idParts = currentVerseId.split(' ');
        const chapterVerse = idParts.pop();
        const ancientDoc = idParts.join(' ');
        if (!chapterVerse) {
            console.warn(`Warning: No chapterVerse found for ancient document ${ancientDoc}`);
            process.exit(1);
        }
        const [chapter, verse] = chapterVerse.split(':');
        const didAncientDocChange = ancientDoc !== currentAncientDoc;
        if (didAncientDocChange) {
            process.stdout.write('.');
            currentAncientDoc = ancientDoc;
            ancientDocInfo = ancientDocNames.find(doc => doc.name === ancientDoc);
            if (!ancientDocInfo) {
                if (ancientDoc === 'Psalm') {
                    ancientDocInfo = ancientDocNames.find(doc => doc.name === 'Psalms');
                } else if (ancientDoc === 'Song of Solomon') {
                    ancientDocInfo = ancientDocNames.find(doc => doc.name === 'Song of Songs');
                }
            }
            ancientDocDirectory = ancientDocInfo?.numPlusAbbr2 || '';
            if (!ancientDocDirectory) {
                console.warn(`Warning: No directory found for ancient document ${ancientDoc}`);
                process.exit(1);
            }
        }
        if (didAncientDocChange || chapter !== currentChapter) {
            if (currentChapter) {
                await writeChapter(currentChapterData, currentChapterPath);
            }
            currentChapter = chapter;
            const fileName = `${ancientDocInfo?.abbr2}${chapter.padStart(3, '0')}.json`;
            currentChapterPath = `../json-Phase2/docs/${ancientDocDirectory}/${fileName}`;
            currentChapterData = await loadChapter(currentChapterPath);
            resetChapterTraditionalWords(currentChapterData);
            currentVerse = '';
            currentVerseData = undefined;
            currentTraditionalSnippetData = undefined;
            awaitingPsalmVerseOneMarker = false;
        }
        if (verse && verse !== currentVerse) {
            if (currentVerseId !== 'Daniel 2:5') {
                currentVerseData?.OriginalMorphemes.forEach(morpheme => {
                    morpheme.OriginalLanguage = currentLanguage;
                });
            } else {
                // in Dan 2:4
                currentVerseData?.OriginalMorphemes.forEach((morpheme, idx) => {
                    if (idx < 7) {
                        morpheme.OriginalLanguage = 'Hebrew';
                    } else {
                        morpheme.OriginalLanguage = 'Aramaic';
                    }
                });
            }
            currentVerse = verse;
            currentVerseData = currentChapterData.SnippetsAndExplanations.find(snippet => snippet.SnippetNumber === parseFloat(verse));
            currentVerseFirstHebSort = null;
            currentVerseFirstGreekSort = null;
            currentTraditionalSnippetData = currentVerseData;
            awaitingPsalmVerseOneMarker = false;

            if (verse === '1' && isPsalmDocument(currentAncientDoc)) {
                const superscriptionSnippet = currentChapterData.SnippetsAndExplanations.find(snippet => snippet.SnippetNumber === 0);
                if (superscriptionSnippet) {
                    currentTraditionalSnippetData = superscriptionSnippet;
                    awaitingPsalmVerseOneMarker = true;
                }
            }
        }

        const rowLanguage = normalizeLanguage(fields[BsbWord.Language], currentLanguage);
        if (rowLanguage !== currentLanguage) {
            currentLanguage = rowLanguage;
        }
        const rowOutputTarget = resolveTraditionalRowTarget(fields);
        const targetSnippet = rowOutputTarget.targetSnippet;
        const heading = fields[BsbWord.Hdg].split('>')[1];
        if (heading) {
            targetSnippet?.EnglishHeadingsAndWords.push({ InsertionType: 'Heading', Text: heading });
        }
        const crossRef = fields[BsbWord.Crossref];
        if (crossRef) {
            targetSnippet?.EnglishHeadingsAndWords.push({ InsertionType: 'Cross Ref.', Text: crossRef });
        }
        if (fields[BsbWord.Par]) {
            targetSnippet?.EnglishHeadingsAndWords.push({ InsertionType: 'Paragraph Start', Text: '' });
        }
        if (fields[BsbWord.Space]) {
            targetSnippet?.EnglishHeadingsAndWords.push({ InsertionType: 'Space', Text: fields[BsbWord.Space] });
        }
        appendAlignedWords(fields, rowLanguage, rowOutputTarget);
        if (fields[BsbWord.footnotes]) {
            targetSnippet?.EnglishHeadingsAndWords.push({ InsertionType: 'Footnotes', Text: fields[BsbWord.footnotes] });
        }
        if (fields[BsbWord.EndText]) {
            targetSnippet?.EnglishHeadingsAndWords.push({ InsertionType: 'End Text', Text: fields[BsbWord.EndText] });
        }
        // console.log('   BSB transliteration:', fields[BsbWord.Translit]);
        // console.log('   BSB Strongs (Hebrew):', fields[BsbWord.StrHeb]);
        // console.log('   BSB Strongs (Greek):', fields[BsbWord.StrGrk]);
        // console.log('   BSB parsing info:', fields[BsbWord.Parsing1], fields[BsbWord.Parsing2]);
        // console.log('   BSB language:', fields[BsbWord.Language]);
        // console.log('   BSB Hebrew sort:', fields[BsbWord.HebSort]);
    }

    await writeChapter(currentChapterData, currentChapterPath);
    await writeAlignmentReport();
    reportUnusedBsbSupplementKeys();
    console.info('Finished processing BSB file');
}
await processBSBFile(pathToPhase1b).catch(err => {
    console.error('Error processing BSB file:', err);
});

async function writeChapter(currentChapterData: Chapter, currentChapterPath: string) {
    const absolutePath = path.resolve(__dirname, currentChapterPath);
    cleanNonLexicalTokensFromChapter(currentChapterData);
    await fs.promises.writeFile(absolutePath, JSON.stringify(currentChapterData, null, 2)).catch((err) => {
        console.error(`Error writing chapter file for ${currentChapterPath}:`, err);
    });
}

async function loadChapter(currentChapterPath: string): Promise<Chapter> {
    const absolutePath = path.resolve(__dirname, currentChapterPath);
    const raw = await fs.promises.readFile(absolutePath, 'utf8');
    return JSON.parse(raw) as Chapter;
}

async function loadBsbSupplement() {
    const autoSupplement = await loadSupplementFile(bsbSupplementAutoPath, true);
    const manualSupplement = await loadSupplementFile(bsbSupplementPath, true);

    // Manual supplement entries should win if both files define the same key.
    const combinedMap: BsbSupplementMap = {
        ...autoSupplement,
        ...manualSupplement
    };

    bsbSupplementMap = combinedMap;
    unusedBsbSupplementKeys.clear();
    Object.keys(bsbSupplementMap).forEach((key) => unusedBsbSupplementKeys.add(key));

    const autoCount = Object.keys(autoSupplement).length;
    const manualCount = Object.keys(manualSupplement).length;
    const totalCount = Object.keys(bsbSupplementMap).length;
    console.info(`Loaded BSB supplement entries: manual=${manualCount}, auto=${autoCount}, total=${totalCount}`);
}

async function loadSupplementFile(filePath: string, optional = false): Promise<BsbSupplementMap> {
    try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as unknown;

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error(`BSB supplement at ${filePath} must be a JSON object mapping keys to morpheme IDs.`);
        }

        const nextMap: BsbSupplementMap = {};
        Object.entries(parsed).forEach(([key, value]) => {
            if (typeof value === 'string') {
                nextMap[key] = value;
                return;
            }

            if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
                nextMap[key] = uniqueStrings(
                    value
                        .map((entry) => entry.trim())
                        .filter((entry) => entry.length > 0)
                );
                return;
            }

            throw new Error(
                `Invalid BSB supplement value for key ${key} in ${filePath}; expected string morpheme ID or string[] for multi-morpheme mapping.`
            );
        });

        return nextMap;
    } catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') {
            if (optional) {
                return {};
            }
        }
        throw error;
    }
}

function reportUnusedBsbSupplementKeys() {
    if (unusedBsbSupplementKeys.size === 0) {
        return;
    }

    const unusedKeys = [...unusedBsbSupplementKeys].sort();
    console.warn(`Unused BSB supplement keys (${unusedKeys.length}): ${unusedKeys.join(', ')}`);
}

function resetChapterTraditionalWords(chapterData: Chapter) {
    chapterData.SnippetsAndExplanations.forEach((snippet) => {
        snippet.EnglishHeadingsAndWords = [];
    });
}

async function writeAlignmentReport() {
    const alignmentRate = totalTraditionalWords
        ? Number(((uniquelyAlignedWords / totalTraditionalWords) * 100).toFixed(2))
        : 0;

    // Filter out non-lexical token issues from samples since they don't appear in final output
    const filteredSamples = alignmentIssueSamples.filter(
        issue => !isNonLexicalToken(issue.englishWord)
    );

    const payload = {
        generatedAt: new Date().toISOString(),
        totalTraditionalWords,
        uniquelyAlignedWords,
        unresolvedWords,
        noneAssignedWords,
        literalMorphemeAssignedWords: uniquelyAlignedWords - noneAssignedWords,
        uniqueAlignmentRatePercent: alignmentRate,
        issueReasonCounts: alignmentReasonCounts,
        sampleLimit: ALIGNMENT_SAMPLE_LIMIT,
        sampledIssues: filteredSamples
    };

    await fs.promises.writeFile(alignmentReportPath, JSON.stringify(payload, null, 2)).catch((err) => {
        console.error(`Error writing alignment report at ${alignmentReportPath}:`, err);
    });
}

function normalizeLanguage(rawLanguage: string, fallback: SupportedLanguage = 'Hebrew'): SupportedLanguage {
    const normalized = rawLanguage.trim();
    if (normalized === 'Greek' || normalized === 'Aramaic' || normalized === 'Hebrew') {
        return normalized;
    }
    return fallback;
}

function isPsalmDocument(ancientDoc: string): boolean {
    return ancientDoc === 'Psalm' || ancientDoc === 'Psalms';
}

function extractVerseNumberMarker(rawText: string): { cleanedText: string; verseNumber?: number } {
    let verseNumber: number | undefined;
    const cleanedText = rawText.replace(BSB_VERSE_NUMBER_MARKER_PATTERN, (_match, digits: string) => {
        if (verseNumber === undefined) {
            const parsed = Number.parseInt(digits, 10);
            if (!Number.isNaN(parsed)) {
                verseNumber = parsed;
            }
        }

        return ' ';
    });

    return { cleanedText, verseNumber };
}

function resolveTraditionalRowTarget(fields: string[]): { targetSnippet: Snippet | undefined; cleanedBegQ: string } {
    const verseMarker = extractVerseNumberMarker(fields[BsbWord.begQ].trim());

    if (awaitingPsalmVerseOneMarker && verseMarker.verseNumber === 1) {
        currentTraditionalSnippetData = currentVerseData;
        awaitingPsalmVerseOneMarker = false;
    }

    return {
        targetSnippet: currentTraditionalSnippetData ?? currentVerseData,
        cleanedBegQ: verseMarker.cleanedText
    };
}

function appendAlignedWords(
    fields: string[],
    rowLanguage: SupportedLanguage,
    rowOutputTarget: { targetSnippet: Snippet | undefined; cleanedBegQ: string }
) {
    const wordString = `${rowOutputTarget.cleanedBegQ
        }${fields[BsbWord.BsbVersion].trim()
        }${fields[BsbWord.pnc].trim()
        }${fields[BsbWord.endQ].trim()
        }`;
    const words = wordString.split(/\s+/).filter(Boolean);
    if (!rowOutputTarget.targetSnippet || words.length === 0) {
        return;
    }

    const targetSnippet = rowOutputTarget.targetSnippet;
    const context = buildRowAlignmentContext(fields, rowLanguage, targetSnippet);
    const normalizedRowWords = words.map((rowWord) => normalizeTokenForAlignment(rowWord));

    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
        const word = words[wordIndex];
        const entry: EnglishWordInfo = { EnglishWord: word };
        const supplement = lookupSupplementOverride(
            targetSnippet.SnippetId,
            getCurrentTraditionalOutputEntryIndex(targetSnippet),
            word
        );
        const supplementedMorphemeIds = supplement?.morphemeIds;
        if (supplement) {
            unusedBsbSupplementKeys.delete(supplement.key);
        }

        if (context.rowStrongsId) {
            entry.StrongsId = context.rowStrongsId;
        }

        // Skip metrics counting for non-lexical tokens since they will be removed from final output
        const isNonLexical = isNonLexicalToken(word);
        if (!isNonLexical) {
            totalTraditionalWords += 1;
        }

        const resolution = supplementedMorphemeIds
            ? buildSupplementResolution(supplementedMorphemeIds)
            : resolveWordAlignment(word, context, wordIndex, normalizedRowWords);
        if (resolution.originalMorphemeId) {
            entry.OriginalMorphemeId = resolution.originalMorphemeId;
            if (resolution.resolvedMorphemeIds && resolution.resolvedMorphemeIds.length > 1) {
                entry.ResolvedOriginalMorphemeIds = resolution.resolvedMorphemeIds;
            }
            if (!isNonLexical) {
                uniquelyAlignedWords += 1;
            }
            if (resolution.originalMorphemeId === NO_MORPHEME_ID) {
                if (!isNonLexical) {
                    noneAssignedWords += 1;
                }
            }
        } else {
            if (!isNonLexical) {
                unresolvedWords += 1;
            }
            recordAlignmentIssue(fields, targetSnippet.SnippetId, word, context, resolution.issueReason || 'unresolved-word', resolution.candidateMorphemeIds || []);
            if (resolution.candidateMorphemeIds && resolution.candidateMorphemeIds.length > 0) {
                entry.OriginalMorphemeIds = resolution.candidateMorphemeIds;
            }
        }

        targetSnippet.EnglishHeadingsAndWords.push(entry);
    }
}

function buildRowAlignmentContext(fields: string[], rowLanguage: SupportedLanguage, snippet: Snippet): RowAlignmentContext {
    const sortValues = getRowSortValues(fields, rowLanguage);
    const rowMorphemes = getRowMorphemeCandidates(fields, rowLanguage, snippet, sortValues.normalizedSort);
    const rowStrongsId = formatRowStrongsId(fields, rowLanguage);
    const parsedRowStrongs = parseStrongsId(rowStrongsId);
    const rowSourceToken = fields[BsbWord.BsbVersion].trim();
    const candidates = mapMorphemeCandidates(rowMorphemes);
    const snippetCandidates = mapMorphemeCandidates(snippet.OriginalMorphemes);

    return {
        rowLanguage,
        rowStrongsId: parsedRowStrongs?.canonical || rowStrongsId,
        rowStrongsBase: parsedRowStrongs?.base,
        rowSourceToken,
        rowSourceNormalizedPhrase: normalizePhraseForAlignment(rowSourceToken),
        rawSort: sortValues.rawSort,
        normalizedSort: sortValues.normalizedSort,
        candidates,
        snippetCandidates
    };
}

function resolveWordAlignment(
    word: string,
    context: RowAlignmentContext,
    rowWordIndex?: number,
    normalizedRowWords: string[] = []
): WordAlignmentResolution {
    const normalizedWord = normalizeTokenForAlignment(word);

    if (isSuppliedWord(word)) {
        return {
            originalMorphemeId: NO_MORPHEME_ID,
            issueReason: 'supplied-word-implied'
        };
    }

    if (isEnglishArticle(normalizedWord)) {
        const articleCandidates = uniqueStrings(
            context.candidates.filter(isArticleCandidate).map((candidate) => candidate.morphemeId)
        );

        if (articleCandidates.length === 1) {
            return {
                originalMorphemeId: articleCandidates[0]
            };
        }

        if (articleCandidates.length === 0) {
            return {
                originalMorphemeId: NO_MORPHEME_ID,
                issueReason: 'article-without-source-morpheme'
            };
        }

        const orderedArticleCandidates = context.candidates
            .filter(isArticleCandidate)
            .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);
        const priorOccurrenceCount = getPriorWordOccurrenceCount(normalizedWord, context.rowStrongsBase);
        const positionalArticleCandidate = orderedArticleCandidates[Math.min(priorOccurrenceCount, orderedArticleCandidates.length - 1)];

        if (positionalArticleCandidate) {
            return {
                originalMorphemeId: positionalArticleCandidate.morphemeId
            };
        }

        return {
            candidateMorphemeIds: articleCandidates,
            issueReason: 'article-match-not-unique'
        };
    }

    // High-priority: if the entire normalized morpheme gloss exactly equals the
    // normalized traditional word, prefer that over Strongs matching.  This
    // handles cases where BSB Strongs points to the root word while the
    // traditional token matches a prefix morpheme (e.g. "in" / "and" Gen 1:1).
    if (normalizedWord) {
        const exactGlossMatches = context.candidates.filter(
            (candidate) => candidate.normalizedGlossPhrase === normalizedWord
        );
        if (exactGlossMatches.length === 1) {
            return { originalMorphemeId: exactGlossMatches[0].morphemeId };
        }
        if (exactGlossMatches.length > 1) {
            const unclaimed = getUnclaimedStrongCandidates(exactGlossMatches);
            const ordered = (unclaimed.length > 0 ? [...unclaimed] : [...exactGlossMatches])
                .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);
            const priorCount = getPriorWordOccurrenceCount(normalizedWord, context.rowStrongsBase);
            const selected = ordered[Math.min(priorCount, ordered.length - 1)];
            if (selected) return { originalMorphemeId: selected.morphemeId };
        }
    }

    let matchingCandidates = context.candidates;
    if (context.rowStrongsBase) {
        const strongMatches = context.candidates.filter(
            (candidate) => candidate.strongsBase === context.rowStrongsBase
        );

        if (strongMatches.length === 1) {
            return {
                originalMorphemeId: strongMatches[0].morphemeId
            };
        }

        if (strongMatches.length > 1) {
            matchingCandidates = strongMatches;
        }
    }

    const candidateIds = uniqueStrings(matchingCandidates.map((candidate) => candidate.morphemeId));

    if (candidateIds.length === 0) {
        const snippetFallback = resolveWithSnippetCandidates(normalizedWord, context, rowWordIndex, normalizedRowWords);
        if (snippetFallback) {
            return snippetFallback;
        }
        return {
            issueReason: 'no-row-morpheme-candidates'
        };
    }

    const lexicalMatches = normalizedWord
        ? uniqueStrings(
            matchingCandidates
                .filter((candidate) => candidate.normalizedGlossTokens.has(normalizedWord))
                .map((candidate) => candidate.morphemeId)
        )
        : [];

    if (lexicalMatches.length === 1) {
        return {
            originalMorphemeId: lexicalMatches[0]
        };
    }

    if (lexicalMatches.length > 1) {
        const lexicalCandidates = matchingCandidates
            .filter((candidate) => candidate.normalizedGlossTokens.has(normalizedWord));
        const unclaimedLexicalCandidates = getUnclaimedStrongCandidates(lexicalCandidates);
        const orderedLexicalCandidates = (unclaimedLexicalCandidates.length > 0
            ? [...unclaimedLexicalCandidates]
            : [...lexicalCandidates])
            .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);

        const priorOccurrenceCount = getPriorWordOccurrenceCount(normalizedWord, context.rowStrongsBase);
        const positionalLexicalCandidate = orderedLexicalCandidates[Math.min(priorOccurrenceCount, orderedLexicalCandidates.length - 1)];

        if (positionalLexicalCandidate) {
            return {
                originalMorphemeId: positionalLexicalCandidate.morphemeId
            };
        }

        return {
            candidateMorphemeIds: lexicalMatches,
            issueReason: 'lexical-match-not-unique'
        };
    }

    const functionWordMatch = selectFunctionWordCandidate(normalizedWord, matchingCandidates);
    if (functionWordMatch) {
        return {
            originalMorphemeId: functionWordMatch
        };
    }

    if (normalizedWord && context.rowStrongsBase) {
        const rowStrongsMatches = matchingCandidates
            .filter((candidate) => candidate.strongsBase === context.rowStrongsBase)
            .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);

        if (rowStrongsMatches.length === 1) {
            return {
                originalMorphemeId: rowStrongsMatches[0].morphemeId
            };
        }

        if (rowStrongsMatches.length > 1) {
            const priorOccurrenceCount = getPriorWordOccurrenceCount(normalizedWord, context.rowStrongsBase);
            const positionalStrongCandidate = rowStrongsMatches[Math.min(priorOccurrenceCount, rowStrongsMatches.length - 1)];

            if (positionalStrongCandidate) {
                return {
                    originalMorphemeId: positionalStrongCandidate.morphemeId
                };
            }
        }
    }

    if (normalizedWord) {
        const nonPunctuationMatches = matchingCandidates.filter((candidate) => !candidate.isPunctuation);
        if (nonPunctuationMatches.length === 1) {
            return {
                originalMorphemeId: nonPunctuationMatches[0].morphemeId
            };
        }
    }

    if (candidateIds.length === 1) {
        if (context.rowStrongsBase && matchingCandidates[0]?.strongsBase !== context.rowStrongsBase) {
            const snippetFallback = resolveWithSnippetCandidates(normalizedWord, context, rowWordIndex, normalizedRowWords);
            if (snippetFallback?.originalMorphemeId) {
                return snippetFallback;
            }
        }

        return {
            originalMorphemeId: candidateIds[0]
        };
    }

    const snippetFallback = resolveWithSnippetCandidates(normalizedWord, context, rowWordIndex, normalizedRowWords);
    if (snippetFallback) {
        return snippetFallback;
    }

    if (!normalizedWord) {
        return {
            candidateMorphemeIds: candidateIds,
            issueReason: 'non-lexical-token-with-multiple-candidates'
        };
    }

    return {
        candidateMorphemeIds: candidateIds,
        issueReason: 'no-lexical-match-with-multiple-candidates'
    };
}

function getRowMorphemeCandidates(
    fields: string[],
    rowLanguage: SupportedLanguage,
    snippet: Snippet,
    normalizedSort?: number
): Morpheme[] {
    const bySort = getMorphemesBySort(rowLanguage, snippet, normalizedSort);
    if (bySort.length > 0) {
        return bySort;
    }

    const byStrongs = getMorphemesByStrongsFallback(fields, rowLanguage, snippet);
    if (byStrongs.length > 0) {
        return byStrongs;
    }

    return [];
}

function getMorphemesBySort(rowLanguage: SupportedLanguage, snippet: Snippet, normalizedSort?: number): Morpheme[] {
    if (!Number.isFinite(normalizedSort) || !normalizedSort) {
        return [];
    }

    const morphemes = rowLanguage === 'Greek'
        ? snippet.OriginalMorphemes.filter((morpheme) => morpheme.OriginalMorphemeOrdinal === normalizedSort)
        : snippet.OriginalMorphemes.filter((morpheme) => morpheme.WordNumber === normalizedSort);

    return morphemes.sort((a, b) => a.OriginalMorphemeOrdinal - b.OriginalMorphemeOrdinal);
}

function getRowSortValues(fields: string[], rowLanguage: SupportedLanguage): { rawSort?: number; normalizedSort?: number } {
    const sortRaw = rowLanguage === 'Greek' ? fields[BsbWord.GreekSort] : fields[BsbWord.HebSort];
    const rawSort = Number.parseInt(sortRaw, 10);
    if (!Number.isFinite(rawSort)) {
        return {};
    }

    if (rowLanguage === 'Greek') {
        if (currentVerseFirstGreekSort === null) {
            currentVerseFirstGreekSort = rawSort;
        }
        const normalizedSort = rawSort - currentVerseFirstGreekSort + 1;
        return normalizedSort > 0 ? { rawSort, normalizedSort } : { rawSort };
    }

    if (currentVerseFirstHebSort === null) {
        currentVerseFirstHebSort = rawSort;
    }
    const normalizedSort = rawSort - currentVerseFirstHebSort + 1;
    return normalizedSort > 0 ? { rawSort, normalizedSort } : { rawSort };
}

function getMorphemesByStrongsFallback(fields: string[], rowLanguage: SupportedLanguage, snippet: Snippet): Morpheme[] {
    const rowStrongRaw = rowLanguage === 'Greek' ? fields[BsbWord.StrGrk] : fields[BsbWord.StrHeb];
    const rowStrongDigits = getStrongDigits(rowStrongRaw);
    if (!rowStrongDigits) {
        return [];
    }

    const fallbackMorphemes = snippet.OriginalMorphemes.filter((morpheme) => {
        const morphemeDigits = getStrongDigits(morpheme.OriginalRootStrongsID || '');
        return morphemeDigits === rowStrongDigits;
    });

    return fallbackMorphemes.sort((a, b) => a.OriginalMorphemeOrdinal - b.OriginalMorphemeOrdinal);
}

function formatRowStrongsId(fields: string[], rowLanguage: SupportedLanguage): string | undefined {
    const raw = rowLanguage === 'Greek' ? fields[BsbWord.StrGrk] : fields[BsbWord.StrHeb];
    const digits = getStrongDigits(raw);
    if (!digits) {
        return undefined;
    }

    const prefix = rowLanguage === 'Greek' ? 'G' : 'H';
    const paddedDigits = digits.length < 4 ? digits.padStart(4, '0') : digits;
    return `${prefix}${paddedDigits}`;
}

function getStrongDigits(strongsId: string): string {
    const digits = strongsId.replace(/\D/g, '');
    if (!digits) {
        return '';
    }

    const asNumber = Number.parseInt(digits, 10);
    return Number.isFinite(asNumber) ? String(asNumber) : '';
}

function tokenizeMorphemeGloss(gloss: string): string[] {
    return gloss
        .split(/\s+/)
        .map((segment) => normalizeTokenForAlignment(segment))
        .filter(Boolean);
}

function normalizePhraseForAlignment(phrase: string): string {
    return phrase
        .split(/\s+/)
        .map((segment) => normalizeTokenForAlignment(segment))
        .filter(Boolean)
        .join(' ');
}

function extractBracketedGlossTokens(gloss: string): Set<string> {
    const bracketedTokens = new Set<string>();
    const matches = gloss.matchAll(/\[([^\]]+)\]/g);

    for (const match of matches) {
        const segment = match[1] || '';
        tokenizeMorphemeGloss(segment).forEach((token) => bracketedTokens.add(token));
    }

    return bracketedTokens;
}

function mapMorphemeCandidates(morphemes: Morpheme[]): MorphemeAlignmentCandidate[] {
    return morphemes
        .filter((morpheme): morpheme is Morpheme & { MorphemeId: string } => Boolean(morpheme.MorphemeId))
        .map((morpheme) => {
            const parsedCandidateStrongs = parseStrongsId(morpheme.OriginalRootStrongsID);
            const gloss = morpheme.EnglishMorphemeWithPunctuationInOriginalOrder || '';
            const normalizedGlossTokens = new Set(tokenizeMorphemeGloss(gloss));
            const bracketedGlossTokens = extractBracketedGlossTokens(gloss);
            const unbracketedGloss = gloss.replace(/\[[^\]]*\]/g, ' ');
            const unbracketedGlossTokens = new Set(tokenizeMorphemeGloss(unbracketedGloss));
            return {
                morphemeId: morpheme.MorphemeId,
                originalMorphemeOrdinal: morpheme.OriginalMorphemeOrdinal,
                isPunctuation: Boolean(morpheme.IsPunctuation),
                normalizedGlossTokens,
                normalizedGlossPhrase: normalizePhraseForAlignment(gloss),
                bracketedGlossTokens,
                unbracketedGlossTokens,
                strongsId: parsedCandidateStrongs?.canonical,
                strongsBase: parsedCandidateStrongs?.base,
                grammarCode: morpheme.OriginalMorphemeGrammarCode,
                grammarFunction: morpheme.OriginalMorphemeGrammarFunction,
                grammarLabel: morpheme.OriginalMorphemeGrammar
            };
        });
}

function resolveWithSnippetCandidates(
    normalizedWord: string,
    context: RowAlignmentContext,
    rowWordIndex?: number,
    normalizedRowWords: string[] = []
): WordAlignmentResolution | undefined {
    if (!normalizedWord || context.snippetCandidates.length === 0) {
        return undefined;
    }

    // Exact phrase match at snippet level (same priority boost as in row-level logic).
    const snippetExactMatches = context.snippetCandidates.filter(
        (candidate) => candidate.normalizedGlossPhrase === normalizedWord
    );
    if (snippetExactMatches.length === 1) {
        return { originalMorphemeId: snippetExactMatches[0].morphemeId };
    }
    if (snippetExactMatches.length > 1 && context.rowStrongsBase) {
        const strongExact = snippetExactMatches.filter(
            (candidate) => candidate.strongsBase === context.rowStrongsBase
        );
        if (strongExact.length === 1) {
            return { originalMorphemeId: strongExact[0].morphemeId };
        }
    }

    const lexicalCandidates = context.snippetCandidates
        .filter((candidate) => candidateHasLexicalSignal(candidate, normalizedWord));

    const lexicalMatches = uniqueStrings(
        lexicalCandidates.map((candidate) => candidate.morphemeId)
    );

    if (context.rowStrongsBase) {
        const strongLexicalCandidates = context.snippetCandidates
            .filter((candidate) => candidate.strongsBase === context.rowStrongsBase)
            .filter((candidate) => candidateHasLexicalSignal(candidate, normalizedWord));

        const strongLexicalMatches = uniqueStrings(
            strongLexicalCandidates.map((candidate) => candidate.morphemeId)
        );

        if (strongLexicalMatches.length === 1) {
            return {
                originalMorphemeId: strongLexicalMatches[0]
            };
        }

        if (strongLexicalMatches.length > 1) {
            const orderedStrongLexicalCandidates = [...strongLexicalCandidates]
                .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);
            const priorOccurrenceCount = getPriorWordOccurrenceCount(normalizedWord, context.rowStrongsBase);
            const positionalCandidate = orderedStrongLexicalCandidates[Math.min(priorOccurrenceCount, orderedStrongLexicalCandidates.length - 1)];

            if (positionalCandidate) {
                return {
                    originalMorphemeId: positionalCandidate.morphemeId
                };
            }

            return {
                candidateMorphemeIds: strongLexicalMatches,
                issueReason: 'snippet-lexical-strong-match-not-unique'
            };
        }

        // If strongs-filtered lexical matches are absent, fall back to lexical-only
        // snippet matches to handle data mismatches between row strongs and morpheme strongs.

        const strongCandidates = context.snippetCandidates
            .filter((candidate) => candidate.strongsBase === context.rowStrongsBase);
        const strongMatches = uniqueStrings(
            strongCandidates.map((candidate) => candidate.morphemeId)
        );

        if (strongMatches.length === 1) {
            return {
                originalMorphemeId: strongMatches[0]
            };
        }

        if (strongMatches.length > 1) {
            const unclaimedStrongCandidates = getUnclaimedStrongCandidates(strongCandidates);
            const orderedStrongCandidates = (unclaimedStrongCandidates.length > 0
                ? [...unclaimedStrongCandidates]
                : [...strongCandidates])
                .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);

            const priorOccurrenceCount = getPriorWordOccurrenceCount(normalizedWord, context.rowStrongsBase);
            const positionalCandidate = orderedStrongCandidates[Math.min(priorOccurrenceCount, orderedStrongCandidates.length - 1)];

            if (positionalCandidate) {
                return {
                    originalMorphemeId: positionalCandidate.morphemeId
                };
            }
        }
    }

    if (lexicalMatches.length === 0) {
        return undefined;
    }

    if (lexicalMatches.length === 1) {
        return {
            originalMorphemeId: lexicalMatches[0]
        };
    }

    const neighborContextResolution = resolveWithNeighborMorphemeContext(
        context,
        lexicalCandidates,
        rowWordIndex,
        normalizedRowWords
    );
    if (neighborContextResolution) {
        return neighborContextResolution;
    }

    const forwardContinuityResolution = resolveWithForwardContinuityContext(context, lexicalCandidates);
    if (forwardContinuityResolution) {
        return forwardContinuityResolution;
    }

    const rowSourceContextResolution = resolveBracketedRowSourceAmbiguity(normalizedWord, context, lexicalCandidates);
    if (rowSourceContextResolution) {
        return rowSourceContextResolution;
    }

    const positionalResolution = resolveWithPositionalTieBreaker(normalizedWord, lexicalCandidates);
    if (positionalResolution) {
        return positionalResolution;
    }

    return {
        candidateMorphemeIds: lexicalMatches,
        issueReason: 'snippet-lexical-match-not-unique'
    };
}

function resolveBracketedRowSourceAmbiguity(
    normalizedWord: string,
    context: RowAlignmentContext,
    lexicalCandidates: MorphemeAlignmentCandidate[]
): WordAlignmentResolution | undefined {
    if (!normalizedWord || !context.rowSourceNormalizedPhrase || lexicalCandidates.length === 0) {
        return undefined;
    }

    const phraseMatchedCandidates = lexicalCandidates
        .filter((candidate) => candidate.normalizedGlossPhrase === context.rowSourceNormalizedPhrase);

    if (phraseMatchedCandidates.length !== 1) {
        return undefined;
    }

    const phraseMatchedCandidate = phraseMatchedCandidates[0];

    if (phraseMatchedCandidate.bracketedGlossTokens.has(normalizedWord)) {
        return {
            originalMorphemeId: NO_MORPHEME_ID,
            issueReason: 'source-bracketed-implied-word'
        };
    }

    if (phraseMatchedCandidate.unbracketedGlossTokens.has(normalizedWord)) {
        return {
            originalMorphemeId: phraseMatchedCandidate.morphemeId
        };
    }

    return undefined;
}

function resolveWithPositionalTieBreaker(
    normalizedWord: string,
    lexicalCandidates: MorphemeAlignmentCandidate[]
): WordAlignmentResolution | undefined {
    if (lexicalCandidates.length < 2 || !normalizedWord || !currentVerseData) {
        return undefined;
    }

    const orderedCandidates = [...lexicalCandidates]
        .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);

    const priorOccurrenceCount = getPriorWordOccurrenceCount(normalizedWord);
    const indexToUse = Math.min(priorOccurrenceCount, orderedCandidates.length - 1);
    const selectedCandidate = orderedCandidates[indexToUse];

    if (selectedCandidate) {
        return {
            originalMorphemeId: selectedCandidate.morphemeId,
            issueReason: 'positional-tie-breaker-lexical'
        };
    }

    return undefined;
}

function resolveWithNeighborMorphemeContext(
    context: RowAlignmentContext,
    lexicalCandidates: MorphemeAlignmentCandidate[],
    rowWordIndex?: number,
    normalizedRowWords: string[] = []
): WordAlignmentResolution | undefined {
    if (lexicalCandidates.length < 2) {
        return undefined;
    }

    const { previousToken, nextToken } = getRowNeighborTokens(rowWordIndex, normalizedRowWords);
    if (!previousToken && !nextToken) {
        return undefined;
    }

    const candidatesByOrdinal = new Map<number, MorphemeAlignmentCandidate>();
    const candidatesById = new Map<string, MorphemeAlignmentCandidate>();
    context.snippetCandidates.forEach((candidate) => {
        candidatesByOrdinal.set(candidate.originalMorphemeOrdinal, candidate);
        candidatesById.set(candidate.morphemeId, candidate);
    });

    const previousAssignedMorphemeId = getMostRecentAssignedMorphemeId();
    const previousAssignedCandidate = previousAssignedMorphemeId
        ? candidatesById.get(previousAssignedMorphemeId)
        : undefined;

    const scoredCandidates = lexicalCandidates.map((candidate) => {
        let score = 0;
        const previousCandidate = candidatesByOrdinal.get(candidate.originalMorphemeOrdinal - 1);
        const nextCandidate = candidatesByOrdinal.get(candidate.originalMorphemeOrdinal + 1);

        if (previousToken && previousCandidate && candidateHasLexicalSignal(previousCandidate, previousToken)) {
            score += 2;
        }

        if (nextToken && nextCandidate && candidateHasLexicalSignal(nextCandidate, nextToken)) {
            score += 2;
        }

        if (previousAssignedCandidate && candidate.originalMorphemeOrdinal === previousAssignedCandidate.originalMorphemeOrdinal + 1) {
            score += 1;
        }

        return {
            candidate,
            score
        };
    });

    const maxScore = Math.max(...scoredCandidates.map((entry) => entry.score));
    if (maxScore <= 0) {
        return undefined;
    }

    const topCandidates = scoredCandidates.filter((entry) => entry.score === maxScore);
    if (topCandidates.length !== 1) {
        return undefined;
    }

    return {
        originalMorphemeId: topCandidates[0].candidate.morphemeId
    };
}

function resolveWithForwardContinuityContext(
    context: RowAlignmentContext,
    lexicalCandidates: MorphemeAlignmentCandidate[]
): WordAlignmentResolution | undefined {
    if (lexicalCandidates.length < 2) {
        return undefined;
    }

    const previousAssignedMorphemeId = getMostRecentAssignedMorphemeId();
    if (!previousAssignedMorphemeId) {
        return undefined;
    }

    const previousAssignedCandidate = context.snippetCandidates.find(
        (candidate) => candidate.morphemeId === previousAssignedMorphemeId
    );
    if (!previousAssignedCandidate) {
        return undefined;
    }

    const forwardCandidates = lexicalCandidates
        .filter((candidate) => candidate.originalMorphemeOrdinal > previousAssignedCandidate.originalMorphemeOrdinal)
        .sort((a, b) => a.originalMorphemeOrdinal - b.originalMorphemeOrdinal);

    if (forwardCandidates.length !== 1) {
        return undefined;
    }

    return {
        originalMorphemeId: forwardCandidates[0].morphemeId
    };
}

function getRowNeighborTokens(
    rowWordIndex?: number,
    normalizedRowWords: string[] = []
): { previousToken?: string; nextToken?: string } {
    if (rowWordIndex === undefined || rowWordIndex < 0 || rowWordIndex >= normalizedRowWords.length) {
        return {};
    }

    let previousToken: string | undefined;
    for (let idx = rowWordIndex - 1; idx >= 0; idx -= 1) {
        if (normalizedRowWords[idx]) {
            previousToken = normalizedRowWords[idx];
            break;
        }
    }

    let nextToken: string | undefined;
    for (let idx = rowWordIndex + 1; idx < normalizedRowWords.length; idx += 1) {
        if (normalizedRowWords[idx]) {
            nextToken = normalizedRowWords[idx];
            break;
        }
    }

    return {
        previousToken,
        nextToken
    };
}

function getMostRecentAssignedMorphemeId(): string | undefined {
    if (!currentVerseData) {
        return undefined;
    }

    for (let idx = currentVerseData.EnglishHeadingsAndWords.length - 1; idx >= 0; idx -= 1) {
        const entry = currentVerseData.EnglishHeadingsAndWords[idx];
        if (!isEnglishWordInfo(entry)) {
            continue;
        }

        const resolvedMorphemeIds = (entry.ResolvedOriginalMorphemeIds || [])
            .filter((morphemeId) => morphemeId && morphemeId !== NO_MORPHEME_ID);
        if (resolvedMorphemeIds.length > 0) {
            return resolvedMorphemeIds[resolvedMorphemeIds.length - 1];
        }

        if (entry.OriginalMorphemeId && entry.OriginalMorphemeId !== NO_MORPHEME_ID) {
            return entry.OriginalMorphemeId;
        }
    }

    return undefined;
}

function candidateHasLexicalSignal(candidate: MorphemeAlignmentCandidate, normalizedWord: string): boolean {
    if (!normalizedWord) {
        return false;
    }

    if (candidate.normalizedGlossTokens.has(normalizedWord)) {
        return true;
    }

    if (normalizedWord.length < 4) {
        return false;
    }

    for (const token of candidate.normalizedGlossTokens) {
        if (token.length < 4) {
            continue;
        }
        if (token.startsWith(normalizedWord) || normalizedWord.startsWith(token)) {
            return true;
        }
    }

    return false;
}

function getPriorWordOccurrenceCount(normalizedWord: string, strongsBase?: string): number {
    if (!normalizedWord || !currentVerseData) {
        return 0;
    }

    return currentVerseData.EnglishHeadingsAndWords.reduce((count, entry) => {
        if (!isEnglishWordInfo(entry)) {
            return count;
        }

        const entryWord = normalizeTokenForAlignment(entry.EnglishWord);
        if (entryWord !== normalizedWord) {
            return count;
        }

        if (strongsBase) {
            const entryBase = parseStrongsId(entry.StrongsId)?.base;
            if (entryBase !== strongsBase) {
                return count;
            }
        }

        return count + 1;
    }, 0);
}

function getUnclaimedStrongCandidates(candidates: MorphemeAlignmentCandidate[]): MorphemeAlignmentCandidate[] {
    if (!currentVerseData || candidates.length === 0) {
        return [];
    }

    const claimedIds = new Set<string>();
    currentVerseData.EnglishHeadingsAndWords.forEach((entry) => {
        if (!isEnglishWordInfo(entry)) {
            return;
        }

        (entry.ResolvedOriginalMorphemeIds || [])
            .filter((morphemeId) => morphemeId && morphemeId !== NO_MORPHEME_ID)
            .forEach((morphemeId) => claimedIds.add(morphemeId));

        if (entry.OriginalMorphemeId && entry.OriginalMorphemeId !== NO_MORPHEME_ID) {
            claimedIds.add(entry.OriginalMorphemeId);
        }
    });

    return candidates.filter((candidate) => !claimedIds.has(candidate.morphemeId));
}

function isEnglishWordInfo(value: unknown): value is EnglishWordInfo {
    return Boolean(value && typeof value === 'object' && 'EnglishWord' in value);
}

function buildBsbSupplementKey(snippetId: string | undefined, englishHeadingsAndWordsIndex: number, englishWord: string): string | undefined {
    if (!snippetId) {
        return undefined;
    }

    return `${snippetId}#${englishHeadingsAndWordsIndex}-${englishWord}`;
}

function lookupSupplementOverride(
    snippetId: string | undefined,
    englishHeadingsAndWordsIndex: number,
    englishWord: string
): SupplementLookupResult | undefined {
    const exactKey = buildBsbSupplementKey(snippetId, englishHeadingsAndWordsIndex, englishWord);
    const exactValue = exactKey ? bsbSupplementMap[exactKey] : undefined;
    if (exactKey && exactValue !== undefined) {
        return {
            key: exactKey,
            morphemeIds: normalizeSupplementValueToMorphemeIds(exactValue)
        };
    }

    const normalizedWord = normalizeTokenForAlignment(englishWord);
    if (!normalizedWord || normalizedWord === englishWord) {
        return undefined;
    }

    const normalizedKey = buildBsbSupplementKey(snippetId, englishHeadingsAndWordsIndex, normalizedWord);
    const normalizedValue = normalizedKey ? bsbSupplementMap[normalizedKey] : undefined;
    if (normalizedKey && normalizedValue !== undefined) {
        return {
            key: normalizedKey,
            morphemeIds: normalizeSupplementValueToMorphemeIds(normalizedValue)
        };
    }

    return undefined;
}

function buildSupplementResolution(morphemeIds: string[]): WordAlignmentResolution {
    const resolvedMorphemeIds = uniqueStrings(
        morphemeIds
            .map((morphemeId) => morphemeId.trim())
            .filter((morphemeId) => morphemeId.length > 0)
            .filter((morphemeId) => morphemeId !== NO_MORPHEME_ID)
    );

    if (resolvedMorphemeIds.length === 0) {
        return {
            originalMorphemeId: NO_MORPHEME_ID,
            resolvedMorphemeIds: []
        };
    }

    return {
        originalMorphemeId: resolvedMorphemeIds[0],
        resolvedMorphemeIds
    };
}

function normalizeSupplementValueToMorphemeIds(value: BsbSupplementValue): string[] {
    if (typeof value === 'string') {
        return buildSupplementResolution([value]).resolvedMorphemeIds || [];
    }

    return buildSupplementResolution(value).resolvedMorphemeIds || [];
}

function getCurrentTraditionalOutputEntryIndex(snippet: Snippet | undefined): number {
    if (!snippet) {
        return 0;
    }

    return snippet.EnglishHeadingsAndWords.reduce((count, entry) => {
        if (!isEnglishWordInfo(entry)) {
            return count + 1;
        }

        return isNonLexicalToken(entry.EnglishWord) ? count : count + 1;
    }, 0);
}

function normalizeTokenForAlignment(token: string): string {
    return token
        .toLowerCase()
        .replace(/[<>{}\[\]()"'“”‘’]/g, '')
        .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function isSuppliedWord(word: string): boolean {
    return word.includes('[') || word.includes(']');
}

function isEnglishArticle(normalizedWord: string): boolean {
    return ENGLISH_ARTICLES.has(normalizedWord);
}

function isArticleCandidate(candidate: MorphemeAlignmentCandidate): boolean {
    const functionName = (candidate.grammarFunction || '').toLowerCase();
    const label = (candidate.grammarLabel || '').toLowerCase();
    const grammarCode = (candidate.grammarCode || '').toLowerCase();

    if (functionName.includes('article')) {
        return true;
    }
    if (label.includes('article')) {
        return true;
    }
    return grammarCode.includes('td') && label.includes('definite');
}

function selectFunctionWordCandidate(normalizedWord: string, candidates: MorphemeAlignmentCandidate[]): string | undefined {
    if (!normalizedWord || candidates.length < 2) {
        return undefined;
    }

    let expectedFunctionKeywords: string[] = [];
    if (ENGLISH_PREPOSITIONS.has(normalizedWord)) {
        expectedFunctionKeywords = ['preposition'];
    } else if (ENGLISH_CONJUNCTIONS.has(normalizedWord)) {
        expectedFunctionKeywords = ['conjunction'];
    }

    if (expectedFunctionKeywords.length === 0) {
        return undefined;
    }

    const grammarMatches = uniqueStrings(
        candidates
            .filter((candidate) => {
                const functionName = (candidate.grammarFunction || '').toLowerCase();
                return expectedFunctionKeywords.some((keyword) => functionName.includes(keyword));
            })
            .map((candidate) => candidate.morphemeId)
    );

    return grammarMatches.length === 1 ? grammarMatches[0] : undefined;
}

function parseStrongsId(strongsId: string | undefined): { canonical: string; base: string } | undefined {
    if (!strongsId) {
        return undefined;
    }

    const trimmed = strongsId.trim().toUpperCase();
    const match = trimmed.match(/^([HG])0*(\d+)([A-Z]*)$/);
    if (!match) {
        return undefined;
    }

    const prefix = match[1];
    const numericPart = Number.parseInt(match[2], 10);
    if (!Number.isFinite(numericPart)) {
        return undefined;
    }

    const suffix = match[3] || '';
    const base = `${prefix}${numericPart}`;
    return {
        canonical: `${base}${suffix}`,
        base
    };
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values)];
}

function recordAlignmentIssue(
    fields: string[],
    snippetId: string | undefined,
    englishWord: string,
    context: RowAlignmentContext,
    reason: string,
    candidateMorphemeIds: string[]
) {
    alignmentReasonCounts[reason] = (alignmentReasonCounts[reason] || 0) + 1;
    if (alignmentIssueSamples.length >= ALIGNMENT_SAMPLE_LIMIT) {
        return;
    }

    const sortValue = context.rowLanguage === 'Greek' ? fields[BsbWord.GreekSort] : fields[BsbWord.HebSort];
    const normalizedSortValue = context.normalizedSort !== undefined ? String(context.normalizedSort) : 'n/a';
    const sortKeyName = context.rowLanguage === 'Greek' ? 'GreekSort' : 'HebSort';
    alignmentIssueSamples.push({
        verseId: currentVerseId,
        snippetId: snippetId || '',
        language: context.rowLanguage,
        sortKey: `${sortKeyName}:${sortValue}->${normalizedSortValue}`,
        englishWord,
        rowSourceToken: fields[BsbWord.BsbVersion].trim(),
        rowStrongsId: context.rowStrongsId,
        candidateMorphemeIds,
        reason
    });
}

function isNonLexicalToken(token: string): boolean {
    const normalized = normalizeTokenForAlignment(token);
    return normalized === '' || normalized === 'vvv';
}

function endsWithStandardPunctuation(token: string): boolean {
    return /[.!?;:]$/.test(token);
}

function extractTrailingPunctuation(token: string): string {
    // Extract trailing standard punctuation marks only
    const match = token.match(/[.!?;:]+$/);
    return match ? match[0] : '';
}

function isEllipsisMarkerGroup(nonLexicalGroup: string[]): boolean {
    if (nonLexicalGroup.length < 3) {
        return false;
    }

    if (nonLexicalGroup[0] !== '.' || nonLexicalGroup[1] !== '.') {
        return false;
    }

    return /^\.[,.;:!?]*$/.test(nonLexicalGroup[nonLexicalGroup.length - 1]);
}

function extractEllipsisCarryPunctuation(lastToken: string): string {
    const match = lastToken.match(/^\.([,.;:!?]+)$/);
    return match ? match[1] : '';
}

function getCarryPunctuationFromNonLexicalGroup(nonLexicalGroup: string[]): string {
    const lastToken = nonLexicalGroup[nonLexicalGroup.length - 1];

    // BSB ellipsis marker rows use ". . ."; only carry punctuation explicitly
    // attached to the marker (for example ". . .." => ".").
    if (isEllipsisMarkerGroup(nonLexicalGroup)) {
        return extractEllipsisCarryPunctuation(lastToken);
    }

    if (!endsWithStandardPunctuation(lastToken)) {
        return '';
    }

    return extractTrailingPunctuation(lastToken);
}

function cleanNonLexicalTokensFromChapter(chapter: Chapter): void {
    chapter.SnippetsAndExplanations.forEach(snippet => {
        const cleaned: (EnglishWordInfo | EnglishInsertion)[] = [];
        let i = 0;

        while (i < snippet.EnglishHeadingsAndWords.length) {
            const entry = snippet.EnglishHeadingsAndWords[i];

            if (!isEnglishWordInfo(entry)) {
                // Keep insertions as-is
                cleaned.push(entry);
                i++;
                continue;
            }

            if (!isNonLexicalToken(entry.EnglishWord)) {
                // Keep lexical words as-is
                cleaned.push(entry);
                i++;
                continue;
            }

            // Found a non-lexical token; group consecutive non-lexical tokens
            const nonLexicalGroup: string[] = [entry.EnglishWord];
            let j = i + 1;
            while (j < snippet.EnglishHeadingsAndWords.length) {
                const nextEntry = snippet.EnglishHeadingsAndWords[j];
                if (isEnglishWordInfo(nextEntry) && isNonLexicalToken(nextEntry.EnglishWord)) {
                    nonLexicalGroup.push(nextEntry.EnglishWord);
                    j++;
                } else {
                    break;
                }
            }

            // Process the non-lexical group.
            const trailingPunctuation = getCarryPunctuationFromNonLexicalGroup(nonLexicalGroup);
            if (trailingPunctuation && cleaned.length > 0) {
                const lastEntry = cleaned[cleaned.length - 1];
                if (isEnglishWordInfo(lastEntry)) {
                    lastEntry.EnglishWord += trailingPunctuation;
                }
            }
            // All non-lexical tokens are discarded

            i = j;
        }

        snippet.EnglishHeadingsAndWords = cleaned;
    });
}
