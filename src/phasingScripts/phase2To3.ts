console.info('Generate HTML pages from the untracked Phase2 JSON files');

import fs from 'node:fs';
import { makeHtmlBase } from './phase2To3/makeHtmlBase';
// import { jsDomFramework } from './phase2To3/jsDomFramework';

// const jsDomFnSource = jsDomFramework
//   .toString()
//   .replace(/<\/script>/gi, '<\\/script>'); // avoid accidental script-close
// const jsRuntimeShim = `
// const __name = (fn, name) => {
//   try { Object.defineProperty(fn, "name", { value: name, configurable: true }); } catch {}
//   return fn;
// };
// `;

// const inlineScript = `<script>${jsRuntimeShim}\n${jsDomFnSource}\njsDomFramework();</script>`;
const scriptTag = `<script src="/js/servewell-app-shell.js"></script>`;

const baseDistDir = 'public/-/';
await resetDir(baseDistDir);
const html =makeHtmlBase('hey', 'This is a description of the hey page');
const heyHtml = [
  ...html.topOfHead,
  ...html.headToBody,
  `<div id="app"></div>`,
  scriptTag,
  ...html.bottom
].join('\n');
// write the html to a new file in baseDistDir
fs.writeFileSync(`${baseDistDir}/hey.html`, heyHtml, { encoding: 'utf8' });

const baseSrcDir = 'src/json-Phase2/docs';
const docList = fs.readdirSync(baseSrcDir);
docList?.forEach(async (docName) => {
    const docPath = `${baseSrcDir}/${docName}`;
    const jsonChapList = fs.readdirSync(docPath);
// console.log(docName, jsonChapList.length);
});

async function resetDir(dir: string) {
  await fs.promises.rm(dir, { recursive: true, force: true }).catch((err) => {
    console.error(`Error deleting directory ${dir}:`, err);
  });
  await fs.promises.mkdir(dir, { recursive: true }).catch((err) => {
    console.error(`Error recreating directory ${dir}:`, err);
  });
  console.log(`Directory ${dir} has been reset`);
}