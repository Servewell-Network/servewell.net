# Before/After Comparison Script

Automated tool for generating before/after alignment reports when modifying phase scripts.

## Purpose

When making changes to alignment logic (e.g., in `phase1bTo2.ts`), this script:

1. Saves your current changes
2. Reverts to the previous version
3. Regenerates JSON files with the "before" state
4. Restores your changes
5. Regenerates JSON files with the "after" state
6. Compares the alignment data and generates a markdown report

This helps catch regressions like the Gen1:2 issue that was discovered after the initial cluster-aware alignment fix.

## Usage

### Basic Usage (default verses)

```bash
npm run before-after
```

Tests default verses: Gen1:1, Gen1:2, Gen2:1, Exo1:1

### Custom Verses

```bash
npm run before-after -- --verses=Gen1:1,Gen1:10,Ps27:1,Matt1:1
```

### Custom Files

```bash
npm run before-after -- --file=src/phasingScripts/phase1bTo2.ts,src/phasingScripts/phase2To3.ts
```

### Both Custom Options

```bash
npm run before-after -- --file=src/phasingScripts/phase1bTo2.ts --verses=Gen1:1,Gen1:2,Gen2:1
```

## Output

Reports are generated in `reports/` directory:

```
reports/
  before-after-2026-03-31.md
  before-after-2026-04-01.md
  ...
```

Each report shows:

- **Summary table**: Side-by-side comparison of matched articles (before/after)
- **Detailed changes**: Article-by-article comparison for each verse
- **Cluster info**: Which cluster each article belongs to

## Report Format

```markdown
| Verse | Before Matched | After Matched | Change |
|-------|---|---|---|
| Gen1:1 | 2/3 | 3/3 | +1 |
| Gen1:2 | 1/2 | 2/2 | +1 |
| Gen2:1 | 2/2 | 2/2 | — |

## Detailed Changes

### Gen1:1

Traditional: In the beginning God created the heavens and the earth.

- Position 2 (CHANGED): "the"
  Before: (unmatched)
  After:  Gen1:1.6
  (Cluster #5: THE(Particle) + HEAVENS(Noun))

- Position 7: "the" → Gen1:1.10 (unchanged)
```

## Implementation Details

**File**: `scripts/generate-before-after-report.js`

**How it works**:

1. Checks git status (stashes uncommitted changes if needed)
2. Saves current file contents as backup
3. Runs `git checkout HEAD -- <files>` to revert
4. Runs `npm run p1b-2 && npm run p2-3` to generate before JSON
5. Extracts alignment data (articles, morpheme IDs, clusters)
6. Restores backed-up files
7. Runs `npm run p1b-2 && npm run p2-3` again for after JSON
8. Extracts alignment data again
9. Generates markdown report comparing the two states
10. Saves to `reports/before-after-<DATE>.md`
11. Prints report to stdout
12. Restores any stashed changes

## Supported Verses

The script supports any verse reference in the standard format: `BOOK#:VERSE` (e.g., `Gen1:1`, `Matt28:20`)

Supported books include all 66 books of the Bible (Gen-Mal)

## Notes

- Reports are gitignored and not checked into version control
- Script handles uncommitted changes gracefully (stashes/unstashes)
- Takes ~10-15 minutes to complete (regenerates 1189 chapters twice)
- Safe to run while working—your changes are preserved
