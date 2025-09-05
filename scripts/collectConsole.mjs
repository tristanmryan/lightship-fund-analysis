import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SERVER_URL = process.env.APP_URL || 'http://localhost:5000';
const TARGET_PATH = '/dashboard';

function makeSession() {
  const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  return {
    token: 'session_' + Math.random().toString(36).slice(2) + '_' + Date.now(),
    user: { id: 'advisor', email: 'advisor@lightship.com', role: 'advisor', name: 'Advisor' },
    expires
  };
}

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1280, height: 900 } });
  const page = await browser.newPage();
  const logs = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    logs.push(`[console.${type}] ${text}`);
  });
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.failure()?.errorText || 'error'} ${req.url()}`));

  // Navigate to root first to allow setting localStorage
  await page.goto(SERVER_URL, { waitUntil: 'domcontentloaded' });
  // Seed session to bypass login
  await page.evaluate((session) => {
    localStorage.setItem('lightship_session', JSON.stringify(session));
  }, makeSession());

  // Go to dashboard
  await page.goto(SERVER_URL + TARGET_PATH, { waitUntil: 'networkidle0', timeout: 60000 });

  // Give time for diagnostics + RPCs to run
  await new Promise((resolve) => setTimeout(resolve, 8000));

  // Write to file for full capture
  const outPath = process.env.CONSOLE_LOG_PATH || path.join('logs', 'diagnostics-dashboard-console.log');
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  const content = ['=== BEGIN BROWSER CONSOLE LOGS ===', ...logs, '=== END BROWSER CONSOLE LOGS ==='].join('\n');
  fs.writeFileSync(outPath, content, 'utf8');

  // Also echo a small tail to stdout with location
  console.log('Wrote full console logs to:', outPath);
  console.log('--- tail (last 40 lines) ---');
  for (const l of logs.slice(-40)) console.log(l);

  await browser.close();
}

run().catch((e) => {
  console.error('Collector failed:', e);
  process.exit(1);
});
