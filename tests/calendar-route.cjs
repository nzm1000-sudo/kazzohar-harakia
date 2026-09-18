const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://www.hebcal.com/hebcal?**', route => route.fulfill({ json: { items: [] } }));
    await page.route('https://www.hebcal.com/zmanim?**', route => {
      const date = new URL(route.request().url()).searchParams.get('date');
      return route.fulfill({ json: { date, times: { sunset: date + 'T18:43:00+03:00' } } });
    });
    await page.goto('http://localhost:5173/kazzohar-harakia/');
    await page.getByRole('navigation', { name: 'ניווט ראשי', exact: true }).getByRole('button', { name: 'לוח שנה', exact: true }).click();
    await page.getByRole('group', { name: 'ימי החודש' }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator('.calendar-cell').count(), 42);
    await page.locator('.calendar-cell').nth(15).click();
    assert.equal(await page.locator('.calendar-cell.selected').count(), 1);
    await page.getByRole('button', { name: 'חודש הבא', exact: true }).click();
    await page.getByRole('button', { name: 'שבוע', exact: true }).click();
    assert.equal(await page.locator('.calendar-cell').count(), 7);
    assert.deepEqual(errors, []);
    console.log('PASS calendar route, month, selection, navigation, week; no runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
