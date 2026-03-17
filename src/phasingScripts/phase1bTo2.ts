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


async function processBSBFile(fileName: string) {
  const fileStream = fs.createReadStream(pathToPhase1b);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    console.log(line);
    break;
    // const fields: StepVerse = line.split('\t');
    }

  console.info('Finished processing BSB file');
}
await processBSBFile(pathToPhase1b).catch(err => {
  console.error('Error processing BSB file:', err);
});