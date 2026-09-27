// Stage 4c — every Torah reader measures study time with the same invisible timer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Library reader (Tanakh, Mishnah, Rambam, Shulchan Arukh) runs the study timer', () => {
  const page = read('../src/pages/LibraryPage.jsx');
  const reader = page.slice(page.indexOf('function LibraryReader('));
  assert.match(reader, /useStudyTimer\(\{ workId: work\.workId,[^}]*category: 'torah_study', source: 'library-reader', tzid: tzid \|\| 'Asia\/Jerusalem', enabled: Boolean\(current\) \}\)/);
  assert.match(reader, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
  assert.match(read('../src/NewApp.jsx'), /<LibraryPage [^>]*tzid=\{settings\.location\.tzid\}/);
});

test('Talmud reader runs the study timer', () => {
  const page = read('../src/pages/TalmudPage.jsx');
  const reader = page.slice(page.indexOf('function AmudReader('));
  const call = reader.slice(reader.indexOf('useStudyTimer({'), reader.indexOf('});', reader.indexOf('useStudyTimer({')));
  assert.match(call, /workId: `Bavli_\$\{tractate\.title\}`/);
  assert.match(call, /category: 'torah_study', source: 'talmud-reader', tzid, enabled: Boolean\(resource\.data\)/);
  assert.match(reader, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
  assert.match(read('../src/NewApp.jsx'), /<TalmudPage [^>]*tzid=\{settings\.location\.tzid\}/);
});

test('the timer itself is unchanged and shared: 60-second minimum, background pause', () => {
  const hooks = read('../src/hooks.jsx');
  assert.match(hooks, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(read('../src/services/studySession.mjs'), /export const MIN_ACTIVE_SECONDS = 60;/);
});
