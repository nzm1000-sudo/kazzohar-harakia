// Run with PLAYWRIGHT_MODULE pointing to an existing Playwright installation.
// No browser-test package is added to the application bundle.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5187', '--strictPort'], { cwd: root, stdio: 'ignore' });
  let browser;
  const timeout = setTimeout(() => { server.kill(); process.exit(1); }, 60000);
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch('http://127.0.0.1:5187/kazzohar-harakia/')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Vite must start');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const timezoneId of ['Asia/Jerusalem', 'America/New_York']) {
      const context = await browser.newContext({ timezoneId, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-09-18T18:42:00+03:00') });
      await page.clock.pauseAt(new Date('2026-09-18T18:42:00+03:00'));
      await page.route('https://www.hebcal.com/zmanim?**', route => {
        const url = new URL(route.request().url());
        assert.equal(url.searchParams.get('date'), '2026-09-18');
        assert.equal(url.searchParams.get('tzid'), 'Asia/Jerusalem');
        assert.equal(url.searchParams.get('latitude'), '32.0853');
        // Sunset captured from Hebcal's Tel Aviv response on 2026-09-18.
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: '2026-09-18', times: { sunset: '2026-09-18T18:43:00+03:00' } }) });
      });
      await page.goto('http://127.0.0.1:5187/kazzohar-harakia/');
      await page.waitForFunction(() => document.querySelector('[data-testid="today-hebrew"]')?.textContent === 'ז׳ תשרי תשפ״ז');
      const header = page.getByTestId('today-hebrew');
      assert.equal(await header.textContent(), 'ז׳ תשרי תשפ״ז');
      console.log('PASS', timezoneId, '18:42 before sunset');
      await page.clock.runFor(660000);
      assert.equal(await header.textContent(), 'ח׳ תשרי תשפ״ז');
      await page.getByRole('navigation', { name: 'ניווט נייד', exact: true }).getByRole('button', { name: 'לוח שנה', exact: true }).click();
      assert.equal(await page.locator('input[type=date]').inputValue(), '2026-09-18');
      assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
      assert.deepEqual(errors, []);
      console.log('PASS', timezoneId, '18:53 after sunset; civil selection preserved');
      await context.close();
    }
  } finally {
    clearTimeout(timeout);
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
