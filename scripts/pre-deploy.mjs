#!/usr/bin/env node
import { spawn } from 'node:child_process';
import net from 'node:net';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const isYes = process.argv.includes('--yes');
const skipE2E = process.argv.includes('--skip-e2e');

function run(command, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32'
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
      await run('npx', ['wrangler', 'deploy'], 'Deploy to production');
    } else {
      console.log('Main deployment skipped.');
    }

    // Check word pages R2 sync regardless of whether the main deploy ran.
    // dist/.words-render-fingerprint is written by p2-words-html and covers rendering inputs
    // (SCRIPT_TAG, app shell size). dist/.words-r2-synced records the stamp at last R2 sync.
    // If they differ (or synced is missing), word pages need to be pushed to R2.
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

    process.exit(0);
  } catch (error) {
    console.error('\nPre-deploy failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
