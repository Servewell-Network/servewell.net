console.info('phase1bTo2: Reading in Berean Standard Bible data and updating json-Phase2 files');

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import ancientDocNames from './phase1To2/ancientDocNames.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Chapter, Morpheme, Snippet } from './phase1To2/phase2Types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pathToPhase1b = path.join(__dirname, './phase1To2/bsb_tables.tsv');
const pathToPhase2 = path.join(__dirname, '../json-Phase2/');

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


let currentAncientDoc = '';
let ancientDocInfo: AncientDocInfo | undefined;
let ancientDocDirectory = '';
let currentChapter = '';
let currentChapterData: Chapter;
let currentChapterPath: string;
let currentVerseId: string = '';
let currentVerse = '';
let currentVerseData: Snippet | undefined;
let currentLanguage: 'Hebrew' | 'Aramaic' | 'Greek' = 'Hebrew';

async function processBSBFile(fileName: string) {
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
        if (ancientDoc !== currentAncientDoc) {
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
        if (chapter !== currentChapter) {
            if (currentChapter) {
                await writeChapter(currentChapterData, currentChapterPath);
            }
            if (ancientDoc === 'Matthew') {
                console.warn('Exiting for now until have processed STEP New Testament');
                process.exit(0);
            }
            currentChapter = chapter;
            const fileName = `${ancientDocInfo?.abbr2}${chapter.padStart(3, '0')}.json`;
            currentChapterPath = `../json-Phase2/docs/${ancientDocDirectory}/${fileName}`;
            currentChapterData = await import(currentChapterPath, {
                with: { type: 'json' }
            });
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
        }

        if (fields[BsbWord.Language] !== currentLanguage) {
            currentLanguage = fields[BsbWord.Language] as "Hebrew" | "Aramaic" | "Greek";
        }
        const heading = fields[BsbWord.Hdg].split('>')[1];
        if (heading) {
            currentVerseData?.EnglishHeadingsAndWords.push({ InsertionType: 'Heading', Text: heading });
        }
        const crossRef = fields[BsbWord.Crossref];
        if (crossRef) {
            currentVerseData?.EnglishHeadingsAndWords.push({ InsertionType: 'Cross Ref.', Text: crossRef });
        }
        if (fields[BsbWord.Par]) {
            currentVerseData?.EnglishHeadingsAndWords.push({ InsertionType: 'Paragraph Start', Text: '' });
        }
        if (fields[BsbWord.Space]) {
            currentVerseData?.EnglishHeadingsAndWords.push({ InsertionType: 'Space', Text: fields[BsbWord.Space] });
        }
        const wordString = `${fields[BsbWord.begQ].trim()
            }${fields[BsbWord.BsbVersion].trim()
            }${fields[BsbWord.pnc].trim()
            }${fields[BsbWord.endQ].trim()
            }`;
        const words = wordString.split(/\s+/).filter(Boolean);
        words.forEach(word => {
            currentVerseData?.EnglishHeadingsAndWords.push({ EnglishWord: word });
        });
        if (fields[BsbWord.footnotes]) {
            currentVerseData?.EnglishHeadingsAndWords.push({ InsertionType: 'Footnotes', Text: fields[BsbWord.footnotes] });
        }
        if (fields[BsbWord.EndText]) {
            currentVerseData?.EnglishHeadingsAndWords.push({ InsertionType: 'End Text', Text: fields[BsbWord.EndText] });
        }
        // console.log('   BSB transliteration:', fields[BsbWord.Translit]);
        // console.log('   BSB Strongs (Hebrew):', fields[BsbWord.StrHeb]);
        // console.log('   BSB Strongs (Greek):', fields[BsbWord.StrGrk]);
        // console.log('   BSB parsing info:', fields[BsbWord.Parsing1], fields[BsbWord.Parsing2]);
        // console.log('   BSB language:', fields[BsbWord.Language]);
        // console.log('   BSB Hebrew sort:', fields[BsbWord.HebSort]);
    }

    await writeChapter(currentChapterData, currentChapterPath);
    console.info('Finished processing BSB file');
}
await processBSBFile(pathToPhase1b).catch(err => {
    console.error('Error processing BSB file:', err);
});

async function writeChapter(currentChapterData: Chapter, currentChapterPath: string) {
    const absolutePath = path.resolve(__dirname, currentChapterPath);
    await fs.promises.writeFile(absolutePath, JSON.stringify(currentChapterData, null, 2)).catch((err) => {
        console.error(`Error writing chapter file for ${currentChapterPath}:`, err);
    });
}
