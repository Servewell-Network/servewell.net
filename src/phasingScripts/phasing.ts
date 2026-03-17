import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'url';
import path from 'path';

// - phase1aTo2 reads in STEP Bible data and creates json-Phase2 files
// - phase1bTo2 reads in Berean Standard Bible data and updates json-Phase2 files

async function runNeighborScripts() {
  const phase1aTo2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './phase1aTo2.ts');
  const phase1bTo2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './phase1bTo2.ts');
  try {
    await tsImport(phase1aTo2, import.meta.url);
    await tsImport(phase1bTo2, import.meta.url);
  } catch (err) {
    console.error('Neighbor script failed:', err);
  }
}

runNeighborScripts();