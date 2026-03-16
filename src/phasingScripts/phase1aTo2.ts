/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as ancientDocNames from './phase1To2/ancientDocNames.json';

const pathToPhase1 = path.join(__dirname, '../step-Phase1a/');
const pathToPhase2 = path.join(__dirname, '../json-Phase2/');
const file1 = 'TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file2 = 'TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file3 = 'TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';
const file4 = 'TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt';

type StepVerse = string[];
// This is how the STEPBible.org amalgamated data is structured
enum Verse {
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

interface Morpheme { // unit of meaning = word or part of word
  "SimpleMorphemeId"?: string; // e.g., "Gen1:1.1"
  "WordNumber": number; // because morphemes are often grouped
  "OriginalMorphemeScript": string; // unicode of aramaic/greek chars
  "OriginalMorphemeTransliteration"?: string; // sounds for English readers
  "OriginalMorphemeVerbalAspect"?: 'Whole Action' | 'Progressing Action'; // whole is traditionally called perfect; is there a repeated also?
  "OriginalMorphemeVerbalTenseOrTime"?: 'Past' | 'Present' | 'Future';
  "OriginalMorphemeVerbalPerson"?: 'First Person' | 'Second Person' | 'Third Person';
  "OriginalMorphemeVerbalNumber"?: 'Singular' | 'Plural';
  "EnglishMorphemeWithPunctuationInOriginalOrder": string;
  "IsPunctuation"?: boolean; // probably lighter gray
  "EnglishMorphemeWithPunctuationInEnglishOrder"?: string; // require later
  "AlternateEnglishInOriginalOrder"?: string[];
  "AlternateEnglishInEnglishOrder"?: string[];
  "OriginalLexemeScript"?: string; // example binyan like Hiphil or Piel, sometimes ambiguous
  "OriginalLexemeTransliteration"?: string;
  "OriginalLexemeDetail"?: string;
  "EnglishLexemeTranslation"?: string;
  "OriginalRootScript"?: string;
  "OriginalRootTransliteration"?: string;
  "OriginalRootStrongsID": string;
  "ConstituentRootIds"?: string[];
  "OriginalRootDetail"?: string;
  "EnglishRootTranslation"?: string;
  "EnglishSenseInformation"?: string; // e.g., definition 1 with example gloss(es)
  "EnglishSubstitutionInfo"?: string; // reliably used as substitute for X in Y context
  "OriginalLanguage"?: "Hebrew" | "Aramaic" | "Greek";
  "OriginalMorphemeOrdinal": number; // orig position, redundant in array
  "EnglishMorphemeOrdinal"?: number; // where it's needed for English
  "Indentations"?: number; // -1 means no new line
  "Source"?: string; // e.g., L for Leningrad Codex
}
interface Snippet {
  "SimpleSnippetId"?: string; // e.g., "Gen1:1" for verse, "Gen1:1a" for partial verse
  "SnippetNumber": number; // verse like 12 or partial verse like 12.1 
  "CommentLinkTextsAndUrls"?: string[],
  "PreceedingComment"?: string;
  "Morphemes": Morpheme[]
}
interface Chapter {
  "DocumentOrBook": string; // e.g., "Genesis"
  "DocOrBookAbbreviation": string; // e.g., "Gen"
  "PaddedNumWithDocAbbr": string; // e.g., "01-Gen"
  "ChapterNumber": number; // e.g., 3
  "PaddedChapterNumber": string; // e.g., "003"
  "SimpleChapterId": string; // e.g., "Gen3"
  "NumPrecedingVersesToInclude": number; // link text for prev chapter
  "SnippetsAndExplanations": Snippet[]; // verses for now
  "NumFollowingVersesToInclude": number; // link text for next chapter
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
  await processStepHebrewFile(file1);
  await processStepHebrewFile(file2);
  await processStepHebrewFile(file3);
  await processStepHebrewFile(file4);
}

type DocNameAbbr = string; // e.g., "Gen" for Genesis

async function processStepHebrewFile(fileName: string) {
  const filePath = path.join(pathToPhase1, fileName);

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
    const fields: StepVerse = line.split('\t');
    // to do: record source (e.g., L = Leningrad Codex) in json
    const [docAbbr, chapStr, verseStr, word, source] = fields[Verse.Ref].split(/\W/); // (e.g., "Gen.1.1#01=L")
    if (currentChapter?.ChapterNumber !== Number(chapStr)) {
      // Save the previous chapter, if any, to its docDir before starting a new one
      if (currentChapter && currentChapter.DocOrBookAbbreviation) {
        currentChapter.SnippetsAndExplanations?.push(structuredClone(currentSnippet) as Snippet);
        currentSnippet = null;
        const chapFileName = `${currentChapter.PaddedChapterNumber}.json`;
        const doc = currentChapter.DocOrBookAbbreviation;
        const saveDir = path.join(pathToPhase2, 'docs', getNumberedDocAbbr(doc) || doc);
        const chapterFilePath = path.join(saveDir, chapFileName);
        await fs.promises.writeFile(chapterFilePath, JSON.stringify(currentChapter, null, 2)).catch((err) => {
          console.error(`Error writing chapter file for ${currentDocNameAbbr} ${chapFileName}:`, err);
        });
      }
      currentChapter = {
        DocumentOrBook: getAncientDocName(chars1To3),
        DocOrBookAbbreviation: chars1To3,
        PaddedNumWithDocAbbr: getNumberedDocAbbr(chars1To3),
        PaddedChapterNumber: `${chars1To3}${chapStr.toString().padStart(3, '0')}`,
        SimpleChapterId: `${chars1To3}${chapStr}`,
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
        SimpleSnippetId: `${currentChapter.SimpleChapterId}:${verseStr}`,
        SnippetNumber: Number(verseStr), // explanation can be like v17.1
        Morphemes: []
      };
    }
    // find number of morphemes per row (per word) and add to snippet.Morphemes
    const forwardOrBackwardSlash = /[\/\\]/; // forward is normal, back is punctuation
    const numMorphemes = fields[Verse.OrigScript].split(forwardOrBackwardSlash).length;
    for (let i = 0; i < numMorphemes; i++) {
      const morphemeFields: StepVerse = fields.map(field => field.split(forwardOrBackwardSlash)[i] || '');
      if (!morphemeFields[Verse.OrigScript].trim()) {
        continue; // step data records blanks before paragraph end or section end markers
      }
      const morpheme = createMorphemeFromStepVerse(morphemeFields, currentSnippet.Morphemes.length + 1, currentSnippet.SimpleSnippetId || '', Number(word), source);
      currentSnippet.Morphemes.push(morpheme);
    }

  }
  console.log('Finished processing file:', fileName.split(' - ')[0]);
}

function createMorphemeFromStepVerse(fields: StepVerse, origOrd: number, snippetId: string, wordNumber: number, source: string): Morpheme {
  const strongs = fields[Verse.dStrongs].replace('{', '').replace('}', '');
  const engMorpheme = fields[Verse.Translation].trim();
  const engInfo = fields[Verse.ExpandedStrongTags].split('=').pop()?.replace('}', '')?.trim() || '';
  const preAndPostArrows = engInfo.split('»');
  const substitutionInfo = preAndPostArrows[1]?.includes('@') ? preAndPostArrows[1] : '';
  const postArrowSplitByColon = preAndPostArrows[1]?.split(':') || ['', ''];
  const engRoot = engInfo.startsWith(':') ? postArrowSplitByColon[0].trim() : preAndPostArrows[0].trim();
  const engSenseInfo = engInfo.startsWith(':') ? postArrowSplitByColon[1].trim() : '';
  const returnable: Morpheme = {
    SimpleMorphemeId: `${snippetId}.${origOrd}`,
    WordNumber: wordNumber,
    OriginalMorphemeScript: fields[Verse.OrigScript],
    EnglishMorphemeWithPunctuationInOriginalOrder: engMorpheme,
    OriginalRootStrongsID: strongs,
    OriginalMorphemeOrdinal: origOrd,
    Source: getSourceName(source)
  };
  const isPunctuation = !fields[Verse.Transliteration]; // if no transliteration, it's likely punctuation
  if (isPunctuation) {
    returnable.IsPunctuation = isPunctuation;
  }
  if (fields[Verse.Transliteration]) {
    returnable.OriginalMorphemeTransliteration = fields[Verse.Transliteration];
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

function getSourceName(code: string): string {
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

main();

