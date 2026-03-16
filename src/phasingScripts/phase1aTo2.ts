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
  "OriginalMorphemeScript": string; // unicode of aramaic/greek chars
  "OriginalMorphemeTransliteration": string; // sounds for English readers
  "OriginalMorphemeVerbalAspect"?: 'Whole Action' | 'Progressing Action'; // whole is traditionally called perfect; is there a repeated also?
  "OriginalMorphemeVerbalTenseOrTime"?: 'Past' | 'Present' | 'Future';
  "OriginalMorphemeVerbalPerson"?: 'First Person' | 'Second Person' | 'Third Person';
  "OriginalMorphemeVerbalNumber"?: 'Singular' | 'Plural';
  "EnglishMorphemeWithPunctuationInOriginalOrder": string;
  "IsPunctuation"?: boolean; // probably lighter gray
  "EnglishMorphemeWithPunctuationInEnglishOrder"?: string; // require later
  "AlternateEnglishInOriginalOrder"?: string[];
  "AlternateEnglishInEnglishOrder"?: string[];
  "OriginalLexemeScript"?: string; // example Hiphil or Piel
  "OriginalLexemeTransliteration"?: string;
  "OriginalLexemeDetail"?: string;
  "EnglishLexemeTranslation"?: string;
  "OriginalRootScript"?: string;
  "OriginalRootTransliteration"?: string;
  "OriginalRootStrongsID": string;
  "ConstituentRootIds"?: string[];
  "OriginalRootDetail"?: string;
  "EnglishRootTranslation"?: string;
  "OriginalLanguage": "Hebrew" | "Aramaic" | "Greek";
  "OriginalMorphemeOrdinal": number; // orig position, redundant in array
  "EnglishMorphemeOrdinal"?: number; // where it's needed for English
  "Indentations"?: number; // -1 means no new line
}
interface Snippet {
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
        SnippetNumber: Number(verseStr),
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
      const morpheme = createMorphemeFromStepVerse(morphemeFields, currentSnippet.Morphemes.length + 1);
      currentSnippet.Morphemes.push(morpheme);
    }

  }
  console.log('Finished processing file:', fileName.split(' - ')[0]);
}

function createMorphemeFromStepVerse(fields: StepVerse, origOrd: number): Morpheme {
  const strongs = fields[Verse.dStrongs].replace('{', '').replace('}', '');
  let lang: 'Hebrew' | 'Aramaic' | 'Greek';
  if (strongs.startsWith('H')) {
    lang = 'Hebrew';
  } else if (fields[Verse.dStrongs].startsWith('G')) {
    lang = 'Greek';
  } else {
    lang = 'Aramaic';
  }
  const engMorpheme = fields[Verse.Translation].trim();
  const engInfo = fields[Verse.ExpandedStrongTags].split('=').pop()?.trim() || '';
  const engWithoutColon = engInfo.replace(/^:/, '').trim(); // unsure why this occurs in step data
  const [engMain, engAdditional] = engWithoutColon.split('»').map(part => part.trim());
  return {
    OriginalMorphemeScript: fields[Verse.OrigScript],
    OriginalMorphemeTransliteration: fields[Verse.Transliteration],
    EnglishMorphemeWithPunctuationInOriginalOrder: engMorpheme,
    EnglishLexemeTranslation: engAdditional,
    EnglishRootTranslation: engMain,
    IsPunctuation: !fields[Verse.Transliteration], // if no transliteration, it's likely punctuation
    OriginalRootStrongsID: strongs,
    OriginalLanguage: lang,
    OriginalMorphemeOrdinal: origOrd,
  };
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

main();

