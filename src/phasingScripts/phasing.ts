import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'url';
import path from 'path';

// - phase1aTo2 reads in STEP Bible data and creates json-Phase2 files
// - phase1bTo2 reads in Berean Standard Bible data and updates json-Phase2 files
// - phase2To3 renders static chapter HTML pages
// - generateWordStudyJson generates per-word JSON files from Phase 2 data
// - generateWordStudyHtml renders per-word HTML pages

async function runNeighborScripts() {
  const phase1aTo2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './phase1aTo2.ts');
  const phase1bTo2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './phase1bTo2.ts');
  const phase2To3 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './phase2To3.ts');
  const generateWordStudyJson = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './generateWordStudyJson.ts');
  const generateWordStudyHtml = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './generateWordStudyHtml.ts');
  try {
    await tsImport(phase1aTo2, import.meta.url);
    await tsImport(phase1bTo2, import.meta.url);
    await tsImport(generateWordStudyJson, import.meta.url);
    await tsImport(phase2To3, import.meta.url);
    await tsImport(generateWordStudyHtml, import.meta.url);
  } catch (err) {
    console.error('Neighbor script failed:', err);
  }
}

await runNeighborScripts();
