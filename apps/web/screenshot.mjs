import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const shots = [
  { url: 'http://localhost:3210',             file: '/tmp/drift-home.png' },
  { url: 'http://localhost:3210/garage',      file: '/tmp/drift-garage.png' },
  { url: 'http://localhost:3210/leaderboard', file: '/tmp/drift-leaderboard.png' },
  { url: 'http://localhost:3210/play',        file: '/tmp/drift-play.png' },
];

for (const { url, file } of shots) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: file });
  console.log('✓', file);
}

await browser.close();
