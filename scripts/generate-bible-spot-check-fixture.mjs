#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const verseChecks = [
  { reference: 'Genesis 1:1', file: 'src/json-Phase2/docs/01-Gen/Gen001.json', snippetId: 'Gen1:1' },
  { reference: 'Genesis 1:2', file: 'src/json-Phase2/docs/01-Gen/Gen001.json', snippetId: 'Gen1:2' },
  { reference: 'Genesis 1:3', file: 'src/json-Phase2/docs/01-Gen/Gen001.json', snippetId: 'Gen1:3' },
  { reference: 'Genesis 12:1', file: 'src/json-Phase2/docs/01-Gen/Gen012.json', snippetId: 'Gen12:1' },
  { reference: 'Genesis 12:2', file: 'src/json-Phase2/docs/01-Gen/Gen012.json', snippetId: 'Gen12:2' },
  { reference: 'Genesis 12:3', file: 'src/json-Phase2/docs/01-Gen/Gen012.json', snippetId: 'Gen12:3' },
  { reference: 'Exodus 3:14', file: 'src/json-Phase2/docs/02-Exo/Exo003.json', snippetId: 'Exo3:14' },
  { reference: 'Leviticus 19:18', file: 'src/json-Phase2/docs/03-Lev/Lev019.json', snippetId: 'Lev19:18' },
  { reference: 'Numbers 6:24', file: 'src/json-Phase2/docs/04-Num/Num006.json', snippetId: 'Num6:24' },
  { reference: 'Numbers 6:25', file: 'src/json-Phase2/docs/04-Num/Num006.json', snippetId: 'Num6:25' },
  { reference: 'Numbers 6:26', file: 'src/json-Phase2/docs/04-Num/Num006.json', snippetId: 'Num6:26' },
  { reference: 'Deuteronomy 6:4', file: 'src/json-Phase2/docs/05-Deu/Deu006.json', snippetId: 'Deu6:4' },
  { reference: 'Deuteronomy 6:5', file: 'src/json-Phase2/docs/05-Deu/Deu006.json', snippetId: 'Deu6:5' },
  { reference: 'Proverbs 3:5', file: 'src/json-Phase2/docs/20-Pro/Pro003.json', snippetId: 'Pro3:5' },
  { reference: 'Proverbs 3:6', file: 'src/json-Phase2/docs/20-Pro/Pro003.json', snippetId: 'Pro3:6' },
  { reference: 'Psalm 23:1', file: 'src/json-Phase2/docs/19-Psa/Psa023.json', snippetId: 'Psa23:1' },
  { reference: 'Isaiah 53:5', file: 'src/json-Phase2/docs/23-Isa/Isa053.json', snippetId: 'Isa53:5' },
  { reference: 'Jeremiah 29:11', file: 'src/json-Phase2/docs/24-Jer/Jer029.json', snippetId: 'Jer29:11' }
];

function getSnippet(filePath, snippetId) {
  const source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const snippets = Array.isArray(source.SnippetsAndExplanations) ? source.SnippetsAndExplanations : [];
  const snippet = snippets.find((item) => item.SnippetId === snippetId);
  if (!snippet) {
    throw new Error(`Snippet not found: ${snippetId} in ${filePath}`);
  }
  if (!('EnglishHeadingsAndWords' in snippet)) {
    throw new Error(`EnglishHeadingsAndWords missing: ${snippetId} in ${filePath}`);
  }
  return snippet.EnglishHeadingsAndWords;
}

function listMissingSourceFiles() {
  const missing = [];
  const seen = new Set();

  for (const item of verseChecks) {
    if (seen.has(item.file)) {
      continue;
    }
    seen.add(item.file);

    const absolutePath = path.join(root, item.file);
    if (!fs.existsSync(absolutePath)) {
      missing.push(item.file);
    }
  }

  return missing;
}

function printMissingSourceNotice(missingFiles, outputPath) {
  console.warn('Phase2 source files are unavailable; skipping bible spot-check fixture regeneration.');
  console.warn(`Missing files: ${missingFiles.length}`);
  console.warn(missingFiles.map((file) => `  - ${file}`).join('\n'));
  console.warn(`Keeping existing fixture at ${outputPath}`);
}

const outputPath = path.join(root, 'test/fixtures/bible-spot-checks.json');
const missingSourceFiles = listMissingSourceFiles();

if (missingSourceFiles.length > 0) {
  if (fs.existsSync(outputPath)) {
    printMissingSourceNotice(missingSourceFiles, outputPath);
    process.exit(0);
  }

  console.error('Phase2 source files are unavailable and no committed fallback fixture exists.');
  console.error(`Expected fixture path: ${outputPath}`);
  process.exit(1);
}

const fixture = {
  generatedAt: 'fixture-v1',
  source: 'Phase2 canonical JSON outputs',
  spotChecks: verseChecks.map((item) => {
    const absolutePath = path.join(root, item.file);
    return {
      reference: item.reference,
      file: item.file,
      snippetId: item.snippetId,
      expectedEnglishHeadingsAndWords: getSnippet(absolutePath, item.snippetId)
    };
  })
};

fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`);

console.log(`Wrote ${fixture.spotChecks.length} verse checks to ${outputPath}`);
