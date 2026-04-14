#!/usr/bin/env node

/**
 * Generate Before/After Comparison Report
 * 
 * Usage:
 *   npm run before-after [options]
 *   node scripts/generate-before-after-report.js --file=src/phasingScripts/phase1bTo2.ts --verses=Gen1:1,Gen1:2,Gen2:1
 * 
 * This script:
 * 1. Stashes the current pending changes
 * 2. Regenerates JSON from clean HEAD as the "before" state
 * 3. Restores the stashed changes
 * 4. Regenerates JSON as the "after" state
 * 5. Compares alignment data
 * 6. Generates a markdown report
 * 
 * Generated reports are saved to reports/before-after-*.md (gitignored)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const REPORTS_DIR = 'reports';
const DEFAULT_VERSES = [
  'Gen1:1',
  'Gen1:2',
  'Gen2:1',
  'Exo1:1',
];

class BeforeAfterGenerator {
  constructor(options = {}) {
    this.targetFiles = options.file ? options.file.split(',') : ['src/phasingScripts/phase1bTo2.ts'];
    this.verses = options.verses ? options.verses.split(',') : DEFAULT_VERSES;
    this.workDir = process.cwd();
    this.timestamp = new Date().toISOString().split('T')[0];
    
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
  }

  log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  error(msg) {
    console.error(`❌ ERROR: ${msg}`);
    process.exit(1);
  }

  ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
  }

  /**
   * Stash the current pending changes so HEAD becomes the before state.
   */
  stashPendingChanges() {
    try {
      const status = execSync('git status --porcelain', { cwd: this.workDir }).toString();
      if (!status.trim()) {
        this.error('No pending changes found. There is nothing to compare against HEAD.');
      }

      this.stashRef = 'stash@{0}';
      this.stashLabel = `before-after-${Date.now()}`;
      this.log('Stashing current pending changes...');
      execSync(`git stash push -u -m "${this.stashLabel}"`, {
        cwd: this.workDir,
        stdio: 'pipe'
      });
    } catch (e) {
      this.error(`Could not stash pending changes: ${e.message}`);
    }
  }

  /**
   * Restore the stashed pending changes for the after state.
   */
  restorePendingChanges() {
    if (!this.stashRef) {
      return;
    }

    try {
      this.log('Restoring stashed changes...');
      execSync(`git stash pop ${this.stashRef}`, {
        cwd: this.workDir,
        stdio: 'pipe'
      });
      this.stashRef = null;
    } catch (e) {
      this.error(`Could not restore stashed changes: ${e.message}`);
    }
  }

  /**
   * Run npm script and capture output
   */
  runScript(script) {
    this.log(`Running: npm run ${script}`);
    try {
      const output = execSync(`npm run ${script}`, { 
        stdio: 'pipe',
        cwd: this.workDir 
      }).toString();
      this.log(`✓ ${script} completed`);
      return output;
    } catch (e) {
      this.error(`Script failed: ${e.message}`);
    }
  }

  /**
   * Find JSON chapter file for a verse reference
   */
  findChapterFile(verseName) {
      // Map book codes to directory number (e.g., Gen=01, Exo=02)
      const bookMap = {
        'Gen': '01', 'Exo': '02', 'Lev': '03', 'Num': '04', 'Deu': '05',
        'Jos': '06', 'Jdg': '07', 'Rut': '08', '1Sa': '09', '2Sa': '10',
        '1Ki': '11', '2Ki': '12', '1Ch': '13', '2Ch': '14', 'Ezr': '15',
        'Neh': '16', 'Est': '17', 'Job': '18', 'Psa': '19', 'Pro': '20',
        'Ecc': '21', 'Isa': '22', 'Jer': '23', 'Lam': '24', 'Eze': '25',
        'Dan': '26', 'Hos': '27', 'Joe': '28', 'Amo': '29', 'Oba': '30',
        'Jon': '31', 'Mic': '32', 'Nah': '33', 'Hab': '34', 'Zep': '35',
        'Hag': '36', 'Zec': '37', 'Mal': '38',
      };

      // Try to match the verse reference against known book codes
      let bookCode = null;
      let chapter = null;
      for (const knownBook of Object.keys(bookMap).sort((a, b) => b.length - a.length)) {
        if (verseName.startsWith(knownBook)) {
          const remainder = verseName.substring(knownBook.length);
          const chapterMatch = remainder.match(/^(\d+):/);
          if (chapterMatch) {
            bookCode = knownBook;
            chapter = chapterMatch[1].padStart(3, '0');
            break;
          }
        }
      }
    
      if (!bookCode || !chapter) {
        this.log(`Warning: Could not parse verse name: ${verseName}`);
        return null;
      }

    const bookNum = bookMap[bookCode];
    if (!bookNum) return null;

    const filePath = path.join(this.workDir, `src/json-Phase2/docs/${bookNum}-${bookCode}/${bookCode}${chapter}.json`);
    return fs.existsSync(filePath) ? filePath : null;
  }

  /**
   * Extract alignment data from chapter JSON
   */
  extractAlignmentData(verseName) {
    const jsonFile = this.findChapterFile(verseName);
    if (!jsonFile || !fs.existsSync(jsonFile)) {
      return { error: `File not found for ${verseName}` };
    }

    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      const snippet = data.SnippetsAndExplanations?.find(s => s.SnippetId === verseName);
      
      if (!snippet) {
        return { error: `Snippet ${verseName} not found` };
      }

      const tradWords = snippet.EnglishHeadingsAndWords || [];
      const morphemes = snippet.OriginalMorphemes || [];

      // Build cluster map
      const clusters = new Map();
      morphemes.forEach((m, idx) => {
        const wn = m.WordNumber || 0;
        if (!clusters.has(wn)) clusters.set(wn, []);
        clusters.get(wn).push({ m, idx });
      });

      // Extract article matches
      const articles = [];
      tradWords.forEach((w, idx) => {
        if (w.EnglishWord && w.EnglishWord.toLowerCase() === 'the' && !w.InsertionType) {
          const morphId = w.OriginalMorphemeId;
          articles.push({
            position: idx,
            word: w.EnglishWord,
            matchedMorphId: morphId || '(unmatched)',
            clusterInfo: morphId ? this.getClusterInfo(morphId, morphemes, clusters) : null
          });
        }
      });

      // Build traditional verse text
      let traditionalText = tradWords
        .filter(w => w.EnglishWord && !w.InsertionType)
        .map(w => w.EnglishWord)
        .join(' ');

      return {
        verseName,
        articles,
        traditionalText,
        articleCount: articles.length,
        matchedCount: articles.filter(a => a.matchedMorphId !== '(unmatched)').length
      };
    } catch (e) {
      return { error: `Failed to parse ${verseName}: ${e.message}` };
    }
  }

  /**
   * Get cluster information for a morpheme
   */
  getClusterInfo(morphId, morphemes, clusters) {
    const morpheme = morphemes.find(m => m.MorphemeId === morphId);
    if (!morpheme) return null;

    const clusterNum = morpheme.WordNumber;
    const cluster = clusters.get(clusterNum);
    
    if (!cluster) return null;

    const clusterMembers = cluster
      .map(({ m }) => `${m.EnglishMorphemeWithPunctuationInOriginalOrder}(${m.OriginalMorphemeGrammarFunction})`)
      .join(' + ');

    return {
      morphemeId: morphId,
      clusterNum,
      clusterMembers
    };
  }

  /**
   * Generate alignment data for all verses (before or after)
   */
  generateAlignmentSnapshot(label) {
    this.log(`Generating ${label} alignment snapshot...`);
    const snapshot = {
      timestamp: new Date().toISOString(),
      label,
      verses: {}
    };

    for (const verse of this.verses) {
      snapshot.verses[verse] = this.extractAlignmentData(verse);
    }

    return snapshot;
  }

  /**
   * Generate markdown report comparing before/after
   */
  generateReport(beforeSnapshot, afterSnapshot) {
    this.log('Generating comparison report...');

    let report = '# Before/After Alignment Comparison Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Files Modified:** ${this.targetFiles.join(', ')}\n\n`;

    // Summary table
    report += '## Summary\n\n';
    report += '| Verse | Before Matched | After Matched | Change |\n';
    report += '|-------|---|---|---|\n';

    let totalBefore = 0;
    let totalAfter = 0;

    for (const verse of this.verses) {
      const beforeData = beforeSnapshot.verses[verse];
      const afterData = afterSnapshot.verses[verse];

      if (beforeData.error || afterData.error) {
        report += `| ${verse} | ❌ Error | ❌ Error | N/A |\n`;
        continue;
      }

      const beforeMatched = beforeData.matchedCount;
      const afterMatched = afterData.matchedCount;
      const change = afterMatched - beforeMatched;
      const changeStr = change > 0 ? `+${change}` : change < 0 ? `${change}` : '—';
      
      totalBefore += beforeMatched;
      totalAfter += afterMatched;

      report += `| ${verse} | ${beforeMatched}/${beforeData.articleCount} | ${afterMatched}/${afterData.articleCount} | ${changeStr} |\n`;
    }

    report += `| **TOTAL** | **${totalBefore}** | **${totalAfter}** | **${totalAfter - totalBefore >= 0 ? '+' : ''}${totalAfter - totalBefore}** |\n`;

    report += '\n---\n\n';

    // Detailed comparisons
    report += '## Detailed Changes\n\n';

    for (const verse of this.verses) {
      const beforeData = beforeSnapshot.verses[verse];
      const afterData = afterSnapshot.verses[verse];

      report += `### ${verse}\n\n`;
      report += `**Traditional:** ${beforeData.traditionalText || '(N/A)'}\n\n`;

      if (beforeData.error || afterData.error) {
        report += `⚠️ Error: ${beforeData.error || afterData.error}\n\n`;
        continue;
      }

      // Compare articles
      if (beforeData.articles.length === 0 && afterData.articles.length === 0) {
        report += 'ℹ️ No "the" words in this verse\n\n';
        continue;
      }

      for (let i = 0; i < Math.max(beforeData.articles.length, afterData.articles.length); i++) {
        const beforeArticle = beforeData.articles[i];
        const afterArticle = afterData.articles[i];

        if (!beforeArticle && afterArticle) {
          report += `- **Position ${afterArticle.position}** (NEW): "${afterArticle.word}" ➔ ${afterArticle.matchedMorphId}\n`;
          if (afterArticle.clusterInfo) {
            report += `  (Cluster #${afterArticle.clusterInfo.clusterNum}: ${afterArticle.clusterInfo.clusterMembers})\n`;
          }
        } else if (beforeArticle && !afterArticle) {
          report += `- **Position ${beforeArticle.position}** (REMOVED): "${beforeArticle.word}" was ➔ ${beforeArticle.matchedMorphId}\n`;
        } else if (beforeArticle && afterArticle) {
          if (beforeArticle.matchedMorphId !== afterArticle.matchedMorphId) {
            report += `- **Position ${beforeArticle.position}** (CHANGED): "${beforeArticle.word}"\n`;
            report += `  Before: ${beforeArticle.matchedMorphId}\n`;
            report += `  After:  ${afterArticle.matchedMorphId}\n`;
            if (afterArticle.clusterInfo) {
              report += `  (Cluster #${afterArticle.clusterInfo.clusterNum}: ${afterArticle.clusterInfo.clusterMembers})\n`;
            }
          } else {
            report += `- Position ${beforeArticle.position}: "${beforeArticle.word}" ➔ ${afterArticle.matchedMorphId} (unchanged)\n`;
          }
        }
      }
      report += '\n';
    }

    return report;
  }

  /**
   * Main execution
   */
  async run() {
    try {
      this.log('Starting before/after comparison...');
      this.stashPendingChanges();

      // Generate "before" state
      this.log('\n=== GENERATING BEFORE STATE ===');
      this.runScript('p1b-2');
      this.runScript('p2-3');
      const beforeSnapshot = this.generateAlignmentSnapshot('BEFORE');

      // Restore the pending changes, then generate the after state.
      this.log('\n=== RESTORING PENDING CHANGES ===');
      this.restorePendingChanges();

      this.log('\n=== GENERATING AFTER STATE ===');
      this.runScript('p1b-2');
      this.runScript('p2-3');
      const afterSnapshot = this.generateAlignmentSnapshot('AFTER');

      // Generate report
      const report = this.generateReport(beforeSnapshot, afterSnapshot);
      
      this.ensureReportsDir();
      const reportPath = path.join(REPORTS_DIR, `before-after-${this.timestamp}.md`);
      fs.writeFileSync(reportPath, report);
      
      this.log(`\n✓ Report saved to ${reportPath}`);

      console.log('\n' + report);
      
    } catch (e) {
      if (this.stashRef) {
        try {
          this.restorePendingChanges();
        } catch (restoreError) {
          console.error(`Failed to restore stashed changes: ${restoreError.message}`);
        }
      }
      this.error(`Unexpected error: ${e.message}\n${e.stack}`);
    }
  }
}

// Parse CLI arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace(/^--/, '')] = value;
  return acc;
}, {});

const generator = new BeforeAfterGenerator(args);

// Execute async run
(async () => {
  await generator.run();
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
