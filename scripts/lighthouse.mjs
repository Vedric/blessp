// Measure the compiled app with its real API and isolated seeded database.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
const require = createRequire(import.meta.url);
const { chromium } = require('../client/node_modules/@playwright/test');
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'artifacts/lighthouse');
fs.mkdirSync(output, { recursive: true });
if (process.env.NODE_ENV !== 'test') throw new Error('Run through scripts/test-env.cjs.');
const log = fs.openSync(path.join(output, 'server.log'), 'w');
const server = spawn(process.execPath, ['scripts/start-e2e.cjs'], { cwd: root, env: process.env, stdio: ['ignore', log, log] });
let chrome;
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'blessp-lighthouse-'));
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error('Isolated server failed; see server.log');
    try { const response = await fetch('http://127.0.0.1:3107/health/ready'); ready = response.ok; } catch { /* Booting */ }
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error('Isolated server readiness timeout');
  // Launch the Linux/macOS/Windows browser through Playwright; chrome-launcher
  // otherwise converts Linux profile paths to Windows paths under WSL.
  chrome = await chromium.launchPersistentContext(chromeProfile, { headless: true, executablePath: process.env.CHROME_PATH || chromium.executablePath(), args: ['--remote-debugging-port=0', '--no-sandbox', '--disable-dev-shm-usage'] });
  const debugPort = Number(fs.readFileSync(path.join(chromeProfile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
  const results = [];
  for (const [route, mobile] of [['/', false], ['/shop', false], ['/signin', false], ['/', true]]) {
    const key = `${route === '/' ? 'home' : route.slice(1)}-${mobile ? 'mobile' : 'desktop'}`;
    const options = { port: debugPort, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
    const result = await lighthouse(`http://127.0.0.1:3107${route}`, options, mobile ? undefined : desktopConfig);
    if (!result || result.lhr.runtimeError) throw new Error(`Lighthouse failed for ${key}: ${result?.lhr.runtimeError?.message}`);
    fs.writeFileSync(path.join(output, `${key}.html`), result.report[0]);
    fs.writeFileSync(path.join(output, `${key}.json`), result.report[1]);
    const scores = Object.fromEntries(Object.entries(result.lhr.categories).map(([name, value]) => [name, Math.round(value.score * 100)]));
    const row = { page: key, ...scores, lcpMs: Math.round(result.lhr.audits['largest-contentful-paint'].numericValue), cls: result.lhr.audits['cumulative-layout-shift'].numericValue };
    results.push(row); console.log(JSON.stringify(row));
  }
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(results, null, 2));
  // Lab performance is recorded, not sold as a stable SLA. Functional a11y
  // Sign-in intentionally serves noindex; its SEO score is recorded only.
  // gates live in Playwright; these category budgets supplement those tests.
  if (results.some(r => r.accessibility < 90 || r['best-practices'] < 90 || (!r.page.startsWith('signin-') && r.seo < 85))) throw new Error('Lighthouse category budget failed; inspect the HTML artifacts.');
} finally {
  await chrome?.close();
  fs.rmSync(chromeProfile, { recursive: true, force: true });
  const stopped = new Promise(resolve => server.once('exit', resolve));
  server.kill('SIGTERM');
  await Promise.race([stopped, delay(3000)]);
  if (server.exitCode === null) server.kill('SIGKILL');
  fs.closeSync(log);
}
