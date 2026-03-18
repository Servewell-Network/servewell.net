console.info('Generate HTML pages from the untracked Phase2 JSON files');

import { helper } from './phase2To3/helper';

helper('hey');

import { readFileSync, readdirSync } from 'node:fs';

// Start with index.html to preserve best practice meta lines in one place
const indexHtml = readFileSync('public/index.html', { encoding: 'utf8' });
const initialHtml = indexHtml?.split('<title>')[0];
if (!initialHtml) {
    console.error(`No html`);
    process.exit(1);
}
const baseDir = 'src/json-Phase2/docs';
const docList = readdirSync(baseDir);
docList?.forEach(async (docName) => {
    const docPath = `${baseDir}/${docName}`;
    const jsonChapList = readdirSync(docPath);
console.log(docName, jsonChapList.length);
});

