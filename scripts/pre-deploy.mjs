#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const isYes = process.argv.includes('--yes');
const skipE2E = process.argv.includes('--skip-e2e');
const forceReupload = process.argv.includes('--force');

function run(command, args, label, { omitEnvKeys = [] } = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    let env = undefined;
    if (omitEnvKeys.length > 0) {
      env = { ...process.env };
      for (const key of omitEnvKeys) delete env[key];
    }
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...(env ? { env } : {}),
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(preferredPort = 8787, maxOffset = 20) {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const candidate = preferredPort + offset;
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No available local port found between ${preferredPort} and ${preferredPort + maxOffset}`);
}

function startDevServer(port) {
  return spawn('npx', ['wrangler', 'dev', '--port', String(port)], {
    // Keep stdout/stderr visible, but prevent dev server from consuming prompt input.
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32'
  });
}

function openVisualPage(port) {
  const url = `http://localhost:${port}/visual-test-preview.html`;
  if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true });
    return;
  }
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
    return;
  }
  spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
}

function waitForDevServerBoot(devProcess, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(undefined);
    }, timeoutMs);

    const onClose = (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Dev server exited early with code ${code}`));
    };

    function cleanup() {
      clearTimeout(timer);
      devProcess.off('close', onClose);
    }

    devProcess.on('close', onClose);
  });
}

async function askYesNo(question) {
  for (;;) {
    const answer = (await ask(question)).toLowerCase();
    if (answer === 'y' || answer === 'yes') return true;
    if (answer === 'n' || answer === 'no') return false;
    console.log('Please enter y or n.');
  }
}

async function checkUrlWithRetry(url, retries = 4, delayMs = 3000) {
  // Cache-busting query param forces Cloudflare to revalidate against the asset manifest
  // rather than returning a cached response. Without this, a bad deploy (missing /-/ files)
  // can appear to pass for up to 1 hour while CDN edge caches still hold the old assets.
  const bustUrl = `${url}?_cb=${Date.now()}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(bustUrl, { method: 'HEAD' });
    if (res.ok) return res.status;
    if (attempt < retries) {
      process.stdout.write(`  ↻ ${url} → ${res.status}, retrying in ${delayMs / 1000}s (attempt ${attempt}/${retries})...\n`);
      await new Promise(r => setTimeout(r, delayMs));
    } else {
      return res.status;
    }
  }
}

async function smokeTestChapterPages() {
  // Use a spread of books, not just the popular ones — all chapter pages share the same
  // asset manifest entry mechanism, so one obscure miss = all would miss after cache expiry.
  const testUrls = [
    'https://servewell.net/-/Genesis/1',
    'https://servewell.net/-/Micah/1',
    'https://servewell.net/-/Revelation/22',
  ];
  console.log('\n== Smoke test: chapter pages ==');
  let failed = false;
  for (const url of testUrls) {
    const status = await checkUrlWithRetry(url);
    if (status === 200) {
      console.log(`  ✓ ${url} → ${status}`);
    } else {
      console.error(`  ✗ ${url} → ${status} (expected 200)`);
      failed = true;
    }
  }
  if (failed) {
    throw new Error('Chapter page smoke test failed — chapter files may not be deployed. See docs/public-chap-files-404-issue.txt.');
  }
  console.log('  All chapter page checks passed.');
}

function stampChapterFiles() {
  const stamp = `<!-- deploy: ${new Date().toISOString()} -->`;
  const stampRe = /<!--\s*(?:generated|deploy):[^-]*-->/;
  let htmlCount = 0;
  const htmlDir = path.resolve('public/-');
  if (fs.existsSync(htmlDir)) {
    function walkHtml(dirPath) {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walkHtml(full);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          let content = fs.readFileSync(full, 'utf8');
          if (stampRe.test(content)) {
            content = content.replace(stampRe, stamp);
          } else {
            content = content.trimEnd() + `\n${stamp}\n`;
          }
          fs.writeFileSync(full, content);
          htmlCount++;
        }
      }
    }
    walkHtml(htmlDir);
    console.log(`  Stamped ${htmlCount} chapter HTML files.`);
  }

  const jsStamp = `// deploy: ${new Date().toISOString()}`;
  const jsStampRe = /\/\/ deploy: [^\n]*/;
  const jsDir = path.resolve('public/js');
  let jsCount = 0;
  if (fs.existsSync(jsDir)) {
    for (const entry of fs.readdirSync(jsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const full = path.join(jsDir, entry.name);
      let content = fs.readFileSync(full, 'utf8');
      if (jsStampRe.test(content)) {
        content = content.replace(jsStampRe, jsStamp);
      } else {
        content = content.trimEnd() + `\n${jsStamp}\n`;
      }
      fs.writeFileSync(full, content);
      jsCount++;
    }
    console.log(`  Stamped ${jsCount} JS files.`);
  }
}

async function main() {
  try {
    console.log('Starting pre-deploy checks...');

    const rerunPhasing = isYes || await askYesNo('Rerun phasing (p1a-2, p1b-2, p2-3, word pages)? (y/n): ');
    if (rerunPhasing) {
      await run('npm', ['run', 'phasing'], 'Run full phasing pipeline');
    } else {
      console.log('Skipping phasing.');
    }

    await run('npm', ['run', 'generate:feature-inventory'], 'Generate feature inventory');
    await run('npm', ['run', 'generate:bible-spot-checks'], 'Generate Bible spot-check fixtures');

    await run('npm', ['run', 'test:run'], 'Run unit/integration tests');
    await run('npx', ['tsc', '--noEmit'], 'Typecheck app code');
    await run('npm', ['run', 'test:phasing'], 'Run phasing verse exact-match tests');

    if (!skipE2E) {
      await run('npm', ['run', 'test:e2e'], 'Run Playwright end-to-end tests');
    } else {
      console.log('\nSkipping e2e checks due to --skip-e2e');
    }

    console.log('\n== Visual inspection gate ==');
  const visualPort = await findAvailablePort(8787, 20);
  console.log(`Starting local dev server on http://localhost:${visualPort}`);
  const dev = startDevServer(visualPort);

  await waitForDevServerBoot(dev, 3500);
    console.log('Opening visual preview page...');
  openVisualPage(visualPort);
    console.log('Review the slideshow in browser, then return here.');

    await ask('Press Enter after visual inspection is complete... ');

    dev.kill('SIGINT');
    await new Promise((resolve) => setTimeout(resolve, 500));

    let approved = isYes;
    if (!approved) {
      approved = await askYesNo('Ready to deploy now? (y/n): ');
    }

    if (approved) {
      // Guard: .assetsignore must be non-empty so Wrangler does not fall back to
      // .gitignore and exclude public/-/ from the asset manifest.
      // A 0-byte file (e.g. after a git operation or editor save) silently breaks all chapter pages.
      const assetsIgnorePath = path.resolve('public/.assetsignore');
      const expectedContent = '.DS_Store\n';
      const currentContent = fs.existsSync(assetsIgnorePath) ? fs.readFileSync(assetsIgnorePath, 'utf8') : '';
      if (currentContent.trim() !== expectedContent.trim()) {
        console.log('  Fixing public/.assetsignore (was missing or wrong — restoring to prevent /-/ 404s)');
        fs.writeFileSync(assetsIgnorePath, expectedContent);
      }
      if (forceReupload) {
        console.log('  --force: stamping all public assets to force Cloudflare re-upload.');
        stampChapterFiles();
      }
      await run('npx', ['standard-version'], 'Bump version + update changelog');
      await run('npm', ['run', 'generate:recent-changes'], 'Generate Recent Changes page');
      await run('npx', ['wrangler', 'deploy'], 'Deploy to production');
      // Record that chapter files from this phasing run are now deployed.
      // On the next deploy (if no phasing ran), stampChapterFiles will stamp HTML files.
      const phasedFile = path.resolve('dist/.chapter-pages-phased');
      const deployedFile = path.resolve('dist/.chapter-pages-deployed');
      if (fs.existsSync(phasedFile)) {
        fs.writeFileSync(deployedFile, fs.readFileSync(phasedFile, 'utf8'));
      } else {
        fs.writeFileSync(deployedFile, new Date().toISOString());
      }
      await smokeTestChapterPages();
    } else {
      console.log('Main deployment skipped.');
    }

    // Check word pages R2 sync regardless of whether the main deploy ran.
    // dist/.words-render-fingerprint is written by p2-words-html and covers the
    // script tag URLs embedded in word pages. dist/.words-r2-synced records the
    // stamp at last R2 sync. If they differ (or synced is missing), word pages
    // need to be pushed to R2. Rebuilding the app shell alone does NOT require
    // an R2 re-sync since word pages load the shell via URL at runtime.
    const fingerprintFile = path.resolve('dist/.words-render-fingerprint');
    const r2MarkerFile = path.resolve('dist/.words-r2-synced');
    let needsR2Sync = false;
    if (fs.existsSync(fingerprintFile)) {
      const currentFingerprint = fs.readFileSync(fingerprintFile, 'utf8').trim();
      const syncedFingerprint = fs.existsSync(r2MarkerFile)
        ? fs.readFileSync(r2MarkerFile, 'utf8').trim()
        : '';
      needsR2Sync = currentFingerprint !== syncedFingerprint;
    }

    if (needsR2Sync) {
      console.log('\n⚠️  Word pages in dist/words/ are newer than the last R2 sync.');
      const deployWords = isYes || await askYesNo('Deploy word pages to R2 now? (y/n): ');
      if (deployWords) {
        await run('npm', ['run', 'deploy:words-r2'], 'Deploy word pages to R2');
      } else {
        console.log('Skipping R2 deploy. Run `npm run deploy:words-r2` when ready.');
      }
    } else if (!fs.existsSync(fingerprintFile)) {
      console.log('\nNo word pages fingerprint found — run phasing to generate word pages.');
    } else {
      console.log('\nWord pages are in sync with R2.');
    }

    // Check whether the traditional-word redirect map needs to be pushed to
    // Cloudflare Bulk Redirects.  The source file lives in src/json-Phase2/words/
    // so it's checked in and git-diffable.  dist/.trad-redirects-cf-synced holds
    // the SHA fingerprint from the last successful push.
    const tradRedirectsFile = path.resolve('src/json-Phase2/words/_traditional-redirects.json');
    const tradRedirectsMarker = path.resolve('dist/.trad-redirects-cf-synced');
    if (fs.existsSync(tradRedirectsFile)) {
      const { createHash } = await import('node:crypto');
      const currentTradFp = createHash('sha256')
        .update(fs.readFileSync(tradRedirectsFile, 'utf8'))
        .digest('hex')
        .slice(0, 16);
      const syncedTradFp = fs.existsSync(tradRedirectsMarker)
        ? fs.readFileSync(tradRedirectsMarker, 'utf8').trim()
        : '';
      if (currentTradFp !== syncedTradFp) {
        console.log('\n⚠️  Traditional word redirect map has changed since last CF Bulk Redirects sync.');
        // Only offer to sync if credentials are available (read .env for pre-deploy context)
        const envRaw = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
        const hasCreds =
          (process.env.CLOUDFLARE_ACCOUNT_ID || envRaw.includes('CLOUDFLARE_ACCOUNT_ID=')) &&
          (process.env.CF_REDIRECTS_API_TOKEN  || envRaw.includes('CF_REDIRECTS_API_TOKEN='));
        if (!hasCreds) {
          console.log('  (Skipping — CLOUDFLARE_ACCOUNT_ID / CF_REDIRECTS_API_TOKEN not set. Run `npm run deploy:trad-redirects-cf` when ready.)');
        } else {
          const deployTrad = isYes || await askYesNo('Push trad-word redirects to Cloudflare Bulk Redirects now? (y/n): ');
          if (deployTrad) {
            try {
              await run('npm', ['run', 'deploy:trad-redirects-cf'], 'Sync traditional word redirects to CF Bulk Redirects');
            } catch (e) {
              console.warn('\n⚠️  CF Bulk Redirects sync failed (non-fatal):');
              console.warn(e instanceof Error ? e.message : String(e));
              console.warn('Run `npm run deploy:trad-redirects-cf` manually when ready.');
            }
          } else {
            console.log('Skipping CF trad-redirect sync. Run `npm run deploy:trad-redirects-cf` when ready.');
          }
        }
      } else {
        console.log('\nTraditional word redirects are in sync with Cloudflare Bulk Redirects.');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\nPre-deploy failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
