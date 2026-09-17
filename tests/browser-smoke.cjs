// Renders the real app in Chromium and exercises the new wiring end to end.
// Run with PLAYWRIGHT_MODULE pointing to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5191', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  const timeout = setTimeout(() => { console.error('SMOKE TIMEOUT'); server.kill(); process.exit(1); }, 90000);
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch('http://127.0.0.1:5191/kazzohar-harakia/')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ timezoneId: 'Asia/Jerusalem', viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-18T10:00:00+03:00') });
    await page.route('https://www.hebcal.com/zmanim?**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ date: '2026-09-18', times: { sunset: '2026-09-18T18:43:00+03:00' } }),
    }));
    await page.goto('http://127.0.0.1:5191/kazzohar-harakia/');
    await page.waitForFunction(() => document.body.innerText.includes('ז׳ תשרי תשפ״ז'), null, { timeout: 20000 });
    await page.getByText('עלות השחר').first().waitFor({ timeout: 20000 });
    console.log('PASS calendar renders with sunset-aware Hebrew date');
    await page.getByRole('button', { name: 'תהילים' }).click();
    await page.getByText('אַשְׁרֵי־הָאִישׁ').first().waitFor({ timeout: 20000 });
    console.log('PASS tehillim renders psalm 1 from public-domain data');
    await page.getByRole('button', { name: 'הבא ←' }).click();
    await page.waitForFunction(() => document.body.innerText.includes('תהילים ב'), null, { timeout: 10000 });
    console.log('PASS chapter navigation');
    await page.getByRole('button', { name: 'הלכה' }).click();
    await page.getByText('אינדקס מקורות בלבד').first().waitFor({ timeout: 10000 });
    console.log('PASS halacha library shows source-link status');
    await page.getByRole('button', { name: 'סידור' }).click();
    await page.getByText('ממתין לאימות תוכן ממקור מוסמך').first().waitFor({ timeout: 10000 });
    console.log('PASS siddur entries labeled awaiting-verification');
    await page.getByLabel('חיפוש בכל הספרייה').fill('שקיעה');
    await page.getByText('זמנים להיום').waitFor({ timeout: 10000 });
    console.log('PASS global search returns times');
    await page.getByLabel('חיפוש בכל הספרייה').fill('תהילים קכא');
    await page.getByRole('link', { name: 'תהילים קכא' }).waitFor({ timeout: 10000 });
    console.log('PASS global search returns psalm index');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.deepEqual(errors, []);
    console.log('PASS RTL preserved, no runtime errors');
    await context.close();
  } finally {
    clearTimeout(timeout);
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
