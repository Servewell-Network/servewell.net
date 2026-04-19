#!/usr/bin/env node
/**
 * generate-whats-new.mjs
 *
 * Reads CHANGELOG.md, extracts version sections whose release date falls within
 * the last 30 days, and writes public/whats-new.html.
 *
 * CHANGELOG.md is maintained by `npm run release` (standard-version).
 * Format expected:
 *   ## [1.2.3] - 2026-04-18
 *   ### Features
 *   * description
 *   ### Bug Fixes
 *   * description
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const OUT_PATH = path.join(ROOT, 'public/whats-new.html');
const DAYS = 30;

// ---------------------------------------------------------------------------
// Parse CHANGELOG.md
// ---------------------------------------------------------------------------

function parseChangelog(text) {
  const sections = [];
  // Match lines like: ## [1.2.3] - 2026-04-18  or  ## [1.2.3] (2026-04-18)
  const versionRe = /^##\s+\[([^\]]+)\](?:\s*[-–]\s*|\s+\()(\d{4}-\d{2}-\d{2})\)?/;
  const typeRe = /^###\s+(.+)/;
  const itemRe = /^\*\s+(.+)/;

  let current = null;
  let currentType = null;

  for (const line of text.split('\n')) {
    const vm = versionRe.exec(line);
    if (vm) {
      if (current) sections.push(current);
      current = { version: vm[1], date: vm[2], groups: {} };
      currentType = null;
      continue;
    }
    if (!current) continue;
    const tm = typeRe.exec(line);
    if (tm) {
      currentType = tm[1];
      if (!current.groups[currentType]) current.groups[currentType] = [];
      continue;
    }
    const im = itemRe.exec(line);
    if (im && currentType) {
      current.groups[currentType].push(im[1]);
    }
  }
  if (current) sections.push(current);
  return sections;
}

// ---------------------------------------------------------------------------
// Filter to last N days
// ---------------------------------------------------------------------------

function recentSections(sections, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return sections.filter(s => new Date(s.date) >= cutoff);
}

// ---------------------------------------------------------------------------
// Render HTML
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Group label → display name + type class
const GROUP_META = {
  'Features': { label: 'Features', cls: 'wn-group-feat' },
  'Bug Fixes': { label: 'Bug fixes', cls: 'wn-group-fix' },
  'Performance Improvements': { label: 'Performance', cls: 'wn-group-perf' },
  'Reverts': { label: 'Reverts', cls: 'wn-group-revert' },
};

function renderSections(sections) {
  if (sections.length === 0) {
    return '<p class="wn-empty">No changes in the last 30 days.</p>';
  }
  return sections.map(s => {
    const groupHtml = Object.entries(s.groups).map(([type, items]) => {
      const meta = GROUP_META[type] ?? { label: escapeHtml(type), cls: 'wn-group-other' };
      const lis = items.map(i => `<li>${escapeHtml(i)}</li>`).join('\n\t\t\t\t');
      return `\t\t\t<div class="${meta.cls} wn-group">
\t\t\t\t<h3>${meta.label}</h3>
\t\t\t\t<ul>
\t\t\t\t${lis}
\t\t\t\t</ul>
\t\t\t</div>`;
    }).join('\n');

    return `\t\t<section class="wn-version">
\t\t\t<h2>v${escapeHtml(s.version)} <span class="wn-date">${escapeHtml(s.date)}</span></h2>
${groupHtml}
\t\t</section>`;
  }).join('\n');
}

function buildPage(sections) {
  const body = renderSections(sections);
  return `<!DOCTYPE html>
<html lang="en">
\t<head>
\t\t<meta charset="UTF-8" />
\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />
\t\t<title>What's New | ServeWell.Net</title>
\t\t<meta name="description" content="Recent changes to ServeWell.Net" />
\t\t<style>
\t\t\tbody {
\t\t\t\tmargin: 2.25rem;
\t\t\t\tfont-family: sans-serif;
\t\t\t\tfont-size: large;
\t\t\t}
\t\t\tmain {
\t\t\t\tmax-width: 56rem;
\t\t\t}
\t\t\ta {
\t\t\t\tcolor: #0b57d0;
\t\t\t\ttext-underline-offset: 0.12em;
\t\t\t}
\t\t\ta:visited { color: #6a3dad; }
\t\t\ta:hover { opacity: 0.88; }
\t\t\t[data-theme="dark"] a { color: #8ec5ff; }
\t\t\t[data-theme="dark"] a:visited { color: #c4a8ff; }
\t\t\t.wn-version {
\t\t\t\tmargin-bottom: 2.5rem;
\t\t\t}
\t\t\t.wn-version h2 {
\t\t\t\tfont-size: 1.4rem;
\t\t\t\tmargin-bottom: 0.75rem;
\t\t\t\tborder-bottom: 1px solid var(--border, #d9d9de);
\t\t\t\tpadding-bottom: 0.35rem;
\t\t\t}
\t\t\t.wn-date {
\t\t\t\tfont-size: 0.95rem;
\t\t\t\tfont-weight: normal;
\t\t\t\tcolor: var(--muted, #475467);
\t\t\t\tmargin-left: 0.5rem;
\t\t\t}
\t\t\t.wn-group h3 {
\t\t\t\tfont-size: 1rem;
\t\t\t\ttext-transform: uppercase;
\t\t\t\tletter-spacing: 0.04em;
\t\t\t\tmargin-bottom: 0.4rem;
\t\t\t\tcolor: var(--muted, #475467);
\t\t\t}
\t\t\t.wn-group-feat h3 { color: #1a5f1a; }
\t\t\t[data-theme="dark"] .wn-group-feat h3 { color: #5fb85f; }
\t\t\t.wn-group-fix h3 { color: #7a4000; }
\t\t\t[data-theme="dark"] .wn-group-fix h3 { color: #e09050; }
\t\t\t.wn-group ul {
\t\t\t\tmargin: 0 0 1rem 1.25rem;
\t\t\t\tpadding: 0;
\t\t\t}
\t\t\t.wn-group li {
\t\t\t\tmargin-bottom: 0.3rem;
\t\t\t\tline-height: 1.5;
\t\t\t}
\t\t\t.wn-empty {
\t\t\t\tcolor: var(--muted, #475467);
\t\t\t\tfont-style: italic;
\t\t\t}
\t\t</style>
\t</head>
\t<body>
\t\t<main>
\t\t\t<h1>What's New</h1>
\t\t\t<p>Changes from the last 30 days. For everything else, see <a href="/whats-next">What's Next</a>.</p>
${body}
\t\t</main>
\t\t<script src="/js/servewell-app-shell.js"></script>
\t</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const changelog = fs.existsSync(CHANGELOG_PATH)
  ? fs.readFileSync(CHANGELOG_PATH, 'utf8')
  : '';

const all = parseChangelog(changelog);
const recent = recentSections(all, DAYS);
const html = buildPage(recent);

fs.writeFileSync(OUT_PATH, html);
console.log(`Wrote ${OUT_PATH} (${recent.length} version section(s) in last ${DAYS} days)`);
