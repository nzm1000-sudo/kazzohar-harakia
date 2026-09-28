// The website must show its logo however it is saved: tab/bookmark, iPhone home screen, Android, a shared link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
test('the site declares its icons for every way it is saved, and every file exists', () => {
  assert.match(html, /<link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon\.png" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="%BASE_URL%apple-touch-icon\.png" \/>/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32"/);
  assert.match(html, /<meta property="og:image" content="https:\/\/nzm1000-sudo\.github\.io\/kazzohar-harakia\/branding\/kazzohar-icon-512\.png" \/>/);
  for (const file of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png', 'branding/kazzohar-icon-32.png', 'branding/kazzohar-icon-192.png', 'branding/kazzohar-icon-512.png', 'branding/kazzohar-icon-maskable-512.png'])
    assert.ok(existsSync(new URL(`../public/${file}`, import.meta.url)), file);
  assert.deepEqual(manifest.icons.map(icon => icon.purpose), ['any', 'any', 'maskable']);
});
