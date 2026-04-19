#!/usr/bin/env node
/**
 * generate-recent-changes.mjs
 *
 * Reads CHANGELOG.md, extracts version sections whose release date falls within
 * the last 30 days, and writes public/recent-changes.html.
 *
 * CHANGELOG.md is maintained by `npm run release` (standard-version).
 * Format expected:
 *   ### 1.2.3 (2026-04-18)
 *   #### Features
 *   * description
 *   #### Bug Fixes
 *   * description
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const OUT_PATH = path.join(ROOT, 'public/recent-changes.html');
const DAYS = 30;

// ---------------------------------------------------------------------------
// Parse CHANGELOG.md
// ---------------------------------------------------------------------------

function parseChangelog(text) {
  const sections = [];
  // Matches: ## [1.2.3] - 2026-04-18  or  ### 1.2.3 (2026-04-18)
  const versionRe = /^#{2,3}\s+\[?([^\]\s(]+)\]?(?:\s*[-–]\s*|\s+\()(\d{4}-\d{2}-\d{2})\)?/;
  const typeRe = /^#{3,4}\s+(.+)/;
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
      // Strip trailing commit hash links like ([abc1234](https://...))
      const cleaned = im[1].replace(/\s*\(\[[\da-f]+\]\([^)]+\)\)$/, '').trim();
      current.groups[currentType].push(cleaned);
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

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function renderSections(sections) {
  if (sections.length === 0) {
    return '<p class="rc-empty">No changes in the last 30 days.</p>';
  }
  return sections.map(s => {
    const groupHtml = Object.entries(s.groups).map(([type, items]) => {
      const lis = items.map(i => `<li>${escapeHtml(i)}</li>`).join('\n\t\t\t\t');
      return `\t\t\t<h3>${escapeHtml(type)}</h3>
\t\t\t<ul>
\t\t\t\t${lis}
\t\t\t</ul>`;
    }).join('\n');

    return `\t\t<section class="rc-version">
\t\t\t<h2>v${escapeHtml(s.version)} <span class="rc-date">${escapeHtml(formatDate(s.date))}</span></h2>
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
\t\t<title>Recent Changes | ServeWell.Net</title>
\t\t<meta name="description" content="Recent changes to ServeWell.Net" />
\t\t<style>
\t\t\tbody {
\t\t\t\tmargin: 2.25rem;
\t\t\t\tfont-family: sans-serif;
\t\t\t\tfont-size: large;
\t\t\t}
\t\t\tmain {
\t\t\t\tmax-width: 48rem;
\t\t\t}
\t\t\ta {
\t\t\t\tcolor: #0b57d0;
\t\t\t\ttext-underline-offset: 0.12em;
\t\t\t}
\t\t\ta:visited { color: #6a3dad; }
\t\t\ta:hover { opacity: 0.88; }
\t\t\t[data-theme="dark"] a { color: #8ec5ff; }
\t\t\t[data-theme="dark"] a:visited { color: #c4a8ff; }
\t\t\t.rc-version {
\t\t\t\tmargin-bottom: 2.5rem;
\t\t\t}
\t\t\t.rc-version h2 {
\t\t\t\tfont-size: 1.3rem;
\t\t\t\tmargin-bottom: 0.6rem;
\t\t\t\tborder-bottom: 1px solid var(--border, #d9d9de);
\t\t\t\tpadding-bottom: 0.3rem;
\t\t\t}
\t\t\t.rc-date {
\t\t\t\tfont-size: 0.9rem;
\t\t\t\tfont-weight: normal;
\t\t\t\tcolor: var(--muted, #475467);
\t\t\t\tmargin-left: 0.5rem;
\t\t\t}
\t\t\t.rc-version h3 {
\t\t\t\tfont-size: 0.95rem;
\t\t\t\ttext-transform: uppercase;
\t\t\t\tletter-spacing: 0.05em;
\t\t\t\tcolor: var(--muted, #475467);
\t\t\t\tmargin: 1rem 0 0.3rem;
\t\t\t}
\t\t\t.rc-version ul {
\t\t\t\tmargin: 0 0 0.5rem 1.25rem;
\t\t\t\tpadding: 0;
\t\t\t}
\t\t\t.rc-version li {
\t\t\t\tmargin-bottom: 0.3rem;
\t\t\t\tline-height: 1.5;
\t\t\t}
\t\t\t.rc-empty {
\t\t\t\tcolor: var(--muted, #475467);
\t\t\t\tfont-style: italic;
\t\t\t}
\t\t</style>
\t</head>
\t<body>
\t\t<main>
\t\t\t<h1>Recent Changes</h1>
\t\t\t<p>Changes from the last 30 days. For planned features, see <a href="/whats-next">What's Next</a>.</p>
\t\t\t<p>For more details on features, see the <a href="/features">Features page</a>.</p>
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
