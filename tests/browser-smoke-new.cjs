// Smoke test for the NEW shell in real Chromium.
// Run with PLAYWRIGHT_MODULE pointing to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5193', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  const timeout = setTimeout(() => { console.error('SMOKE TIMEOUT'); server.kill(); process.exit(1); }, 90000);
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch('http://127.0.0.1:5193/kazzohar-harakia/')).ok) { ready = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ready, 'vite must start');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ timezoneId: 'Asia/Jerusalem', viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date('2026-09-18T17:30:00+03:00') });
    await page.route('https://www.hebcal.com/zmanim?**', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ date: '2026-09-18', times: {
        sunset: '2026-09-18T18:43:00+03:00',
        alotHaShachar: '2026-09-18T05:14:00+03:00',
        misheyakir: '2026-09-18T05:36:00+03:00',
        sunrise: '2026-09-18T06:26:00+03:00',
        sofZmanShma: '2026-09-18T09:31:00+03:00',
        sofZmanTfilla: '2026-09-18T10:32:00+03:00',
        chatzot: '2026-09-18T12:35:00+03:00',
        minchaGedola: '2026-09-18T13:06:00+03:00',
        minchaKetana: '2026-09-18T16:10:00+03:00',
        plagHaMincha: '2026-09-18T17:26:00+03:00',
        tzeit85deg: '2026-09-18T19:19:00+03:00',
        tzeit72min: '2026-09-18T19:55:00+03:00',
      } }),
    }));
    await page.goto('http://127.0.0.1:5193/kazzohar-harakia/');
    await page.waitForFunction(() => document.querySelector('[data-testid="today-hebrew"]')?.textContent?.includes('תשרי'), null, { timeout: 20000 });
    console.log('PASS today hebrew date renders');
    await page.getByTestId('next-zman').getByText('שקיעה').waitFor({ timeout: 10000 });
    console.log('PASS next zman = שקיעה at 17:30');
    await page.getByRole('navigation', { name: 'ניווט ראשי', exact: true }).getByRole('button', { name: 'תהילים', exact: true }).click();
    await page.locator('article p').first().waitFor({ timeout: 20000 });
    assert.ok((await page.locator('article p').first().textContent()).normalize('NFC').startsWith('אַשְׁרֵי'.normalize('NFC')));
    console.log('PASS tehillim opens from new nav');
    await page.getByRole('navigation', { name: 'ניווט ראשי', exact: true }).getByRole('button', { name: 'הלכה', exact: true }).click();
    await page.getByText('שולחן ערוך ומקורות לעיון').first().waitFor({ timeout: 10000 });
    console.log('PASS halacha library in new shell');
    await page.getByRole('button', { name: 'היום' }).click();
    await page.getByTestId('today-hebrew').waitFor({ timeout: 10000 });
    console.log('PASS back to today');
    const hasEmoji = await page.evaluate(() => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.innerText));
    assert.ok(!hasEmoji, 'no emoji in UI');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.deepEqual(errors, []);
    console.log('PASS no emoji, RTL, no runtime errors');
    await context.close();
  } finally {
    clearTimeout(timeout);
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
