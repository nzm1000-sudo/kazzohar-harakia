import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const booksSource = readFileSync(fileURLToPath(new URL('../src/pages/BooksPage.jsx', import.meta.url)), 'utf8');
const readerSource = readFileSync(fileURLToPath(new URL('../src/components/SourceReader.jsx', import.meta.url)), 'utf8');
const appSource = readFileSync(fileURLToPath(new URL('../src/NewApp.jsx', import.meta.url)), 'utf8');

test('SiddurPage forwards a Today smart-prayer request into the existing dynamic flow, not a new one', () => {
  assert.match(booksSource, /autoOpenPrayer/);
  assert.match(booksSource, /prayerRootKey\(autoOpenPrayer, \{ isShabbat: summary\.isShabbat \}\)/);
  assert.match(booksSource, /openSource\(target\.reference, target\.title, target\.mode, flowData\.navigation\.get\(target\.reference\), \{ showCompass: true \}\)/);
});

test('SourceReader renders a small compass badge only when navigation asked for it', () => {
  assert.match(readerSource, /showCompass && settings && <CompactPrayerCompass/);
  assert.match(readerSource, /initialBearing, prayerDirectionLabel \} from '\.\.\/services\/prayerCompass\.mjs'/);
});

test('NewApp threads settings, showCompass and the prayer auto-open state end to end', () => {
  assert.match(appSource, /openPrayerFromToday=prayerType=>\{setAutoPrayer\(prayerType\);nav\('siddur'\);\}/);
  assert.match(appSource, /autoOpenPrayer=\{autoPrayer\}/);
  assert.match(appSource, /onAutoOpenHandled=\{\(\) => setAutoPrayer\(null\)\}/);
  assert.match(appSource, /<SourceReader key=\{source\.reference\} \{\.\.\.source\} settings=\{settings\}/);
});
