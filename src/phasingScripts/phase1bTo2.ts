console.info('phase1bTo2: Reading in Berean Standard Bible data and updating json-Phase2 files');

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

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

async function processBSBFile(fileName: string) {
  const fileStream = fs.createReadStream(pathToPhase1b);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
let done = false;
  for await (const line of rl) {
    const fields = line.split('\t');
    console.log('   Processing line for verse:', fields[BsbWord.Verse]);
    console.log('   BSB original word:', fields[BsbWord.BsbSort]);  
    console.log('   BSB transliteration:', fields[BsbWord.Translit]);
    console.log('   BSB Strongs (Hebrew):', fields[BsbWord.StrHeb]);
    console.log('   BSB Strongs (Greek):', fields[BsbWord.StrGrk]);
    console.log('   BSB parsing info:', fields[BsbWord.Parsing1], fields[BsbWord.Parsing2]);
    console.log('   BSB language:', fields[BsbWord.Language]);
    console.log('   BSB footnotes:', fields[BsbWord.footnotes]);
    console.log('   BSB cross-references:', fields[BsbWord.Crossref]);
    console.log('   BSB paragraph info:', fields[BsbWord.Par]);
    console.log('   BSB heading info:', fields[BsbWord.Hdg]);
    console.log('   BSB version:', fields[BsbWord.BsbVersion]);
    console.log('   BSB pnc:', fields[BsbWord.pnc]);
    console.log('   BSB space:', fields[BsbWord.Space]);
    console.log('   BSB begQ:', fields[BsbWord.begQ]);
    console.log('   BSB endQ:', fields[BsbWord.endQ]);
    console.log('   BSB WLC Nestle base text:', fields[BsbWord.WLC_NestleBase_TR_RP_WH_NE_NA_SBL]);
    console.log('   BSB WLC Nestle base text with ECM:', fields[BsbWord.WLC_NestleBase_TR_RP_WH_NE_NA_SBL_ECM]);
    console.log('   BSB Hebrew sort:', fields[BsbWord.HebSort]);
    console.log('   BSB Greek sort:', fields[BsbWord.GreekSort]);
    console.log('   BSB end text:', fields[BsbWord.EndText]);
    console.log('   BSB verse ID:', fields[BsbWord.VerseId]);
if (done) {
    break;
} else {
    done = true;
}
    }

  console.info('Finished processing BSB file');
}
await processBSBFile(pathToPhase1b).catch(err => {
  console.error('Error processing BSB file:', err);
});