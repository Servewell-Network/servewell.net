console.info('phase1aTo2: Reading in STEP Bible data and creating json-Phase2 files');

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import ancientDocNames from './phase1To2/ancientDocNames.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Chapter, Morpheme, Snippet } from './phase1To2/phase2Types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pathToPhase1a = path.join(__dirname, '../step-Phase1a/');
const pathToPhase2 = path.join(__dirname, '../json-Phase2/');
const file1 = 'TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file2 = 'TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file3 = 'TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file4 = 'TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file5 = 'TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt';
const file6 = 'TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt';

type StepWord = string[];
// This is how the STEPBible.org "Hebrew" amalgamated data is structured
enum SemiticWord {
  Ref = 0,
  OrigScript = 1,
  Transliteration = 2,
  Translation = 3,
  dStrongs = 4,
  Grammar = 5,
  MeaningVariants = 6,
  SpellingVariants = 7,
  RootdStrongPlusInstance = 8,
  AlternativeStrongsPlusInstance = 9,
  ConjoinWord = 10,
  ExpandedStrongTags = 11
}

// This is how the STEPBible.org Greek amalgamated data is structured
enum GreekWord {
  WordAndType = 0,
  Greek = 1,
  EnglishTranslation = 2,
  dStrongsAndGrammar = 3,
  DictionaryFormAndGloss = 4,
  editions = 5,
  MeaningVariants = 6,
  SpellingVariants = 7,
  SpanishTranslation = 8,
  Submeaning = 9,
  ConjoinWord = 10,
  sStrongPlusInstance = 11,
  AltStrongs = 12
}

interface ChapterToSave {
  "chapter"?: Chapter;
  docDir: string;
}
async function main() {
  await resetDir(pathToPhase2)
  await fs.promises.mkdir(path.join(pathToPhase2, 'docs'), { recursive: true }).catch((err) => {
    console.error(`Error creating docs directory in ${pathToPhase2}:`, err);
  });
  await processStepFile(file1);
  await processStepFile(file2);
  await processStepFile(file3);
  await processStepFile(file4);
  await processStepFile(file5, 'NT');
  await processStepFile(file6, 'NT');
}

async function processStepFile(fileName: string, isNt?: string) {
  const filePath = path.join(pathToPhase1a, fileName);

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentDocNameAbbr = '';
  let currentDocDir = '';
  let currentChapter: Partial<Chapter> | null = null;
  let currentSnippet: Snippet | null = null;

  for await (const line of rl) {
    const chars1To3 = line.slice(0, 3);
    const char4 = line[3];
    const char5 = line[4];
    const newAncientDocDirName = detectNewAncientDoc(chars1To3, char4, char5);
    if (newAncientDocDirName) {
      currentDocNameAbbr = chars1To3;
      currentDocDir = path.join(pathToPhase2, 'docs', newAncientDocDirName);
      await fs.promises.mkdir(currentDocDir, { recursive: true }).catch((err) => {
        console.error(`Error creating directory for ${newAncientDocDirName}:`, err);
      });
    }
    if (currentDocNameAbbr !== chars1To3 || char4 !== '.' || !Number.isInteger(Number(char5))) {
      continue; // skip commented lines
    }
    const fields: StepWord = line.split('\t');
    const refIdx = isNt ? GreekWord.WordAndType : SemiticWord.Ref;
    const [docAbbr, chapStr, verseStr, wordIdx, source] = fields[refIdx].split(/\W/); // e.g., "Gen.1.1#01=L" or "Mat.1.1#01=NKO"
    if (currentChapter?.ChapterNumber !== Number(chapStr)) {
      // Save the previous chapter, if any, to its docDir before starting a new one
      if (currentChapter && currentChapter.DocOrBookAbbreviation) {
        currentChapter.SnippetsAndExplanations?.push(structuredClone(currentSnippet) as Snippet);
        currentSnippet = null;
        await writeChapter(currentChapter as Chapter, currentDocNameAbbr);
      }
      currentChapter = {
        DocumentOrBook: getAncientDocName(chars1To3),
        DocOrBookAbbreviation: chars1To3,
        PaddedNumWithDocAbbr: getNumberedDocAbbr(chars1To3),
        PaddedChapterNumber: `${chars1To3}${chapStr.padStart(3, '0')}`,
        ChapterId: `${chars1To3}${chapStr}`,
        ChapterNumber: Number(chapStr),
        NumPrecedingVersesToInclude: 1,
        NumFollowingVersesToInclude: 1,
        SnippetsAndExplanations: []
      };
    }
    if (!currentChapter) {
      continue; // skip lines until we have a chapter context
    }
    if (currentSnippet && currentSnippet?.SnippetNumber !== Number(verseStr)) {
      // We need to push existing snippet and start a new one
      currentChapter.SnippetsAndExplanations?.push(structuredClone(currentSnippet) as Snippet);
      currentSnippet = null;
    }
    if (!currentSnippet) {
      currentSnippet = {
        SnippetId: `${currentChapter.ChapterId}:${verseStr}`,
        SnippetNumber: Number(verseStr), // explanation can be like v17.1
        OriginalMorphemes: [],
        EnglishHeadingsAndWords: []
      };
    }
    if (isNt) {
      processGreekWord(currentChapter, currentSnippet, fields, wordIdx, source);
    } else {
      processSemiticWord(currentChapter, currentSnippet, fields, wordIdx, source);
    }
  }
  // save last stuff (no next verse to trigger save)
  currentChapter?.SnippetsAndExplanations?.push(structuredClone(currentSnippet) as Snippet);
  await writeChapter(currentChapter as Chapter, currentDocNameAbbr);
  console.log('Finished processing file:', fileName.split(' - ')[0]);
}


function processGreekWord(currentChapter: Partial<Chapter>, currentSnippet: Snippet, fields: StepWord, wordIdx: string, source: string) {
// Word & Type	Greek	English translation	dStrongs = Grammar	Dictionary form =  Gloss	editions	Meaning variants	Spelling variants	Spanish translation	Sub-meaning	Conjoin word	sStrong+Instance
// Mat.1.1#01=NKO	Βίβλος (Biblos)	[The] book	G0976=N-NSF	βίβλος=book	NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz			Libro	book	#01	G0976

    const [strongs, grammar] = fields[GreekWord.dStrongsAndGrammar].split('=');
  const engMorpheme = fields[GreekWord.EnglishTranslation].trim();
  const [origRoot, engRoot] = fields[GreekWord.DictionaryFormAndGloss].split('=');
  const [origScript, translit] = fields[GreekWord.Greek].replace(')', '').split(' (');
  const morpheme: Morpheme = {
    MorphemeId: `${currentSnippet.SnippetId}.${wordIdx}`,
    OriginalMorphemeScript: origScript,
    EnglishMorphemeWithPunctuationInOriginalOrder: engMorpheme,
    OriginalRootStrongsID: strongs,
    OriginalMorphemeOrdinal: Number(wordIdx),
    Source: getGreekSourceName(source),
    OriginalMorphemeTransliteration: translit,
    OriginalRootScript: origRoot,
    EnglishRootTranslation: engRoot,
  };

  const [senseInfo, substitution] = fields[GreekWord.Submeaning].split('|');
  if (substitution) {
    morpheme.EnglishSubstitutionInfo = substitution;
  }
  // if (fields[GreekWord.MeaningVariants]) {
  //   morpheme.MeaningVariants = fields[GreekWord.MeaningVariants];
  // }
    currentSnippet.OriginalMorphemes.push(morpheme);
}

function processSemiticWord(currentChapter: Partial<Chapter>, currentSnippet: Snippet, fields: StepWord, wordIdx: string, source: string) {
  // find number of morphemes per row (per word) and add to snippet.OriginalMorphemes
  const forwardOrBackwardSlash = /[\/\\]/; // forward is normal, back is punctuation
  const numMorphemes = fields[SemiticWord.OrigScript].split(forwardOrBackwardSlash).length;

  for (let i = 0; i < numMorphemes; i++) {
    // This works for most fields, but not for Meaning Variants
    const morphemeFields: StepWord = fields.map(field => field.split(forwardOrBackwardSlash)[i] || '');
    if (!morphemeFields[SemiticWord.OrigScript].trim()) {
      continue; // step data records blanks before paragraph end or section end markers
    }
    // examples of meaning variants (more significant variants, as opposed to spelling variants)
    // from Gen 43:28: K= va/i.yish.ta.chu (וַ/יִּשְׁתַּחוּ\׃) "and/ he bowed down" (H9001/H7812\H9016=Hc/Vvw3ms)	L= וַ/יִּֽשְׁתַּחֲוֻּֽ\׃ ¦ ;
    // from Exo 2:2: B= עֲבָדִֽ֑ים\׃ ¦ P= עֲבָדִ֑ים\׃	
    const meaningVariants = fields[SemiticWord.MeaningVariants]?.replace(';', '')
      .split('¦ ').map((v: string) => v?.trim()).filter(Boolean).map((v: string) => {
        const [src, ...rest] = v.split('=');
        const fullSrc = getSemiticSourceName(src.trim()) || src.trim();
        return `${fullSrc}: ${rest.join('=').trim()}`;
      });
    const origOrd = currentSnippet.OriginalMorphemes.length + 1;
    const sId = currentSnippet.SnippetId || '';
    const morpheme = createMorphemeFromSemiticWord(morphemeFields, origOrd, sId, Number(wordIdx), source, meaningVariants);
    currentSnippet.OriginalMorphemes.push(morpheme);
  }
}

function createMorphemeFromSemiticWord(fields: StepWord, origOrd: number, snippetId: string, wordNumber: number, source: string, mVar: string[]): Morpheme {
  const strongs = fields[SemiticWord.dStrongs].replace('{', '').replace('}', '');
  const engMorpheme = fields[SemiticWord.Translation].trim();
  const engInfo = fields[SemiticWord.ExpandedStrongTags].split('=').pop()?.replace('}', '')?.trim() || '';
  const preAndPostArrows = engInfo.split('»');
  const substitutionInfo = preAndPostArrows[1]?.includes('@') ? preAndPostArrows[1] : '';
  const postArrowSplitByColon = preAndPostArrows[1]?.split(':') || ['', ''];
  const engRoot = engInfo.startsWith(':') ? postArrowSplitByColon[0].trim() : preAndPostArrows[0].trim();
  const engSenseInfo = engInfo.startsWith(':') ? postArrowSplitByColon[1].trim() : '';
  const returnable: Morpheme = {
    MorphemeId: `${snippetId}.${origOrd}`,
    WordNumber: wordNumber,
    OriginalMorphemeScript: fields[SemiticWord.OrigScript],
    EnglishMorphemeWithPunctuationInOriginalOrder: engMorpheme,
    OriginalRootStrongsID: strongs,
    OriginalMorphemeOrdinal: origOrd,
    Source: getSemiticSourceName(source)
  };
  const isPunctuation = !fields[SemiticWord.Transliteration]; // if no transliteration, it's likely punctuation
  if (isPunctuation) {
    returnable.IsPunctuation = isPunctuation;
  }
  if (fields[SemiticWord.Transliteration]) {
    returnable.OriginalMorphemeTransliteration = fields[SemiticWord.Transliteration];
  }
  if (engRoot) {
    returnable.EnglishRootTranslation = engRoot;
  }
  if (substitutionInfo) {
    returnable.EnglishSubstitutionInfo = substitutionInfo;
  }
  if (engSenseInfo) {
    returnable.EnglishSenseInformation = engSenseInfo;
  }
  if (mVar.length) {
    returnable.MeaningVariants = mVar;
  }
  return returnable;
}


function getAncientDocName(stepVerseAbbr: string): string {
  const ancientDocName = ancientDocNames.find(doc => doc.abbr2 === stepVerseAbbr)?.name;
  if (!ancientDocName) {
    console.warn(`No ancient document name found for reference: ${stepVerseAbbr}`);
    return stepVerseAbbr; // Fallback to the original reference if no mapping is found
  }
  return ancientDocName;;
}

async function resetDir(dir: string) {
  await fs.promises.rm(dir, { recursive: true, force: true }).catch((err) => {
    console.error(`Error deleting directory ${dir}:`, err);
  });
  await fs.promises.mkdir(dir, { recursive: true }).catch((err) => {
    console.error(`Error creating directory ${dir}:`, err);
  });
  console.log(`Directory ${dir.split('/').at(-2)} has been reset`);
}

const found = {} as Record<string, number>;
function detectNewAncientDoc(chars1To3: string, char4: string, char5: string): string {
  if (!found[chars1To3]) {
    const foundIdxPlusOne = ancientDocNames.findIndex(doc => doc.abbr2.startsWith(chars1To3)) + 1;
    if (foundIdxPlusOne && chars1To3 && char4 === '.' && Number.isInteger(Number(char5))) {
      found[chars1To3] = foundIdxPlusOne;
      return ancientDocNames[foundIdxPlusOne - 1].numPlusAbbr2;
    }
  }
  return '';
}

function getNumberedDocAbbr(chars1To3: string): string | undefined {
  const doc = ancientDocNames.find(doc => doc.abbr2 === chars1To3);
  return doc ? doc.numPlusAbbr2 : undefined;
}

function getSemiticSourceName(code: string): string {
  const base = code.replace(/[\[\]\(\)]/g, ''); // strip bracket chars
  const bracket = (code.match(/[\[\(].*[\]\)]/) || [''])[0];

  const names: Record<string, string> = {
    L: 'Leningrad manuscript',
    R: 'restored text based on Leningrad parallels',
    X: 'based on Greek sources (LXX)',
    Q: 'Scribal qere corrections',
    K: 'uncorrected text (ketiv)',
    A: 'Aleppo manuscript variant',
    B: 'Biblia Hebraica Stuttgartensia variant',
    C: 'Cairensis manuscript variant',
    D: 'Dead Sea / Judean Desert manuscript variant',
    E: 'scholarly emendation of ancient sources',
    F: 'formatting variant (pointing/word division)',
    H: 'Ben Chaim edition variant',
    P: 'alternate punctuation variant',
    S: 'Scribal tradition variant',
    V: 'variant in some manuscripts'
  };

  const name = names[base] ?? base;
  return bracket ? `${name} ${bracket}` : name;
}

function getGreekSourceName(source: string): string {
  const names: Record<string, string> = {
    'NKO': 'identical in virtually all manuscripts',
    'NK(O)': 'identical in Ancient and Traditional manuscripts, different in Other manuscripts',
    'NK(o)': 'identical in Ancient and Traditional manuscripts, barely different in Other manuscripts',
    'N(K)(O)': 'found in Ancient manuscripts, different in Traditional and Other manuscripts',
    'N(k)(o)': 'found in Ancient manuscripts, barely different in Traditional and Other manuscripts',
    'K(O)': 'found in Traditional but not Ancient manuscripts and different in Other manuscripts',
    'K(o)': 'found in Traditional but not Ancient manuscripts and barely different in Other manuscripts',
    'N(O)': 'found in Ancient but not Traditional manuscripts and different in Other manuscripts',
    'N(o)': 'found in Ancient but not Traditional manuscripts and barely different in Other manuscripts',
    'O': 'not found in Ancient or Traditional manuscripts, only in Other manuscripts',
    'o': 'not found in Ancient or Traditional manuscripts, only in Other manuscripts, and does not change the meaning',
  };
  const name = names[source] ?? source;
  return name;
}

async function writeChapter(currentChapter: Chapter, currentDocNameAbbr: string) {
  const chapFileName = `${currentChapter.PaddedChapterNumber}.json`;
  const doc = currentChapter.DocOrBookAbbreviation;
  const saveDir = path.join(pathToPhase2, 'docs', getNumberedDocAbbr(doc) || doc);
  const chapterFilePath = path.join(saveDir, chapFileName);
  await fs.promises.writeFile(chapterFilePath, JSON.stringify(currentChapter, null, 2)).catch((err) => {
    console.error(`Error writing chapter file for ${currentDocNameAbbr} ${chapFileName}:`, err);
  });
}

await main();

