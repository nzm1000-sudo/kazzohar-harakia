// The App Store support URL: a static Hebrew page on the site with a contact method, the privacy policy and the app.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../public/support.html', import.meta.url), 'utf8');

test('the support page names the app and gives a contact method and the required links', () => {
  assert.match(page, /<html lang="he" dir="rtl">/);
  assert.match(page, /<h1>כזוהר הרקיע<\/h1>/);
  assert.match(page, /href="https:\/\/github\.com\/nzm1000-sudo\/kazzohar-harakia\/issues"/);
  assert.match(page, /href="\.\/privacy\.html"/);
  assert.match(page, /href="\.\/"/);
});

test('the support page loads nothing external and runs no script', () => {
  assert.doesNotMatch(page, /<script|<link |<img |<iframe|@import/);
  assert.doesNotMatch(page, /@[a-z0-9.-]+\.(com|org|net|il)\b/i, 'no email address is published');
});
