import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checksum } from '../src/services/prayer/checksum.mjs';
import CHOK from '../src/data/chokLeYisrael/manifest.mjs';
import { CHOK_CREDIT, CHOK_LICENSE, CHOK_PRAYERS, chokDayKey, chokNeighbours, chokRoute, chokToday, chokWeekOf, inlineRuns, parseChokRoute, partsOfDay } from '../src/services/chokLeYisrael.mjs';
import { fixTargumJoins } from '../scripts/chok-leyisrael/parse.mjs';
import { CHOK_LEYISRAEL_EDITION, LICENSES } from '../src/data/library/registry.mjs';
import { SIDDUR_HOME_ORDER } from '../src/data/nusach/siddurLayouts.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const packText = file => gunzipSync(readFileSync(new URL(`../public/library/packs/${CHOK.packId}/${file}`, import.meta.url))).toString('utf8');
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri-night', 'fri'];
const FULL = ['torah', 'neviim', 'ketuvim', 'mishnah', 'gemara', 'zohar', 'halacha', 'mussar'];

test('parsing is complete: 54 parashot × 7 days = 378, every weekday with all eight parts, every pack verified', () => {
  assert.equal(CHOK.parashot.length, 54);
  assert.equal(CHOK.parashot.reduce((sum, parasha) => sum + parasha.days.length, 0), 378);
  for (const meta of CHOK.parashot) {
    assert.deepEqual(meta.days.map(([key]) => key), DAYS, meta.id);
    for (const [key, parts] of meta.days.slice(0, 5)) assert.deepEqual(parts, FULL, `${meta.id} ${key}`);
    const night = meta.days[5][1];
    assert.equal(night[0], 'torah', `${meta.id}: ליל שישי is Torah`);
    const friday = meta.days[6][1];
    assert.deepEqual(friday.filter(part => !['torah', 'haftarah'].includes(part)), ['mishnah', 'gemara', 'zohar', 'halacha', 'mussar'], `${meta.id} Friday`);
    const text = packText(meta.file);
    assert.equal(checksum(text), meta.checksum, `${meta.id}: checksum`);
    const data = JSON.parse(text);
    assert.equal(data.id, meta.id);
    for (const day of data.days) for (const part of day.parts) {
      assert.ok(part.s.length && part.s.every(section => section.b.length), `${meta.id} ${day.key} ${part.key}: not empty`);
      if (['torah', 'neviim', 'ketuvim'].includes(part.key)) assert.ok(part.s.flatMap(section => section.b).filter(block => block.t === 'v').every(block => block.h && block.g), `${meta.id} ${day.key} ${part.key}: every verse with its Targum`);
    }
  }
  // The edition's own shape: short parashot carry the haftarah on ליל שישי; תצוה has none.
  for (const id of ['nitzavim', 'vayeilech', 'haazinu', 'vezot-haberakhah']) assert.deepEqual(CHOK.parashot.find(p => p.id === id).days[5][1], ['torah', 'haftarah'], id);
  assert.equal(CHOK.parashot.find(p => p.id === 'tetzaveh').days[6][1].includes('haftarah'), false);
  const intro = JSON.parse(packText(CHOK.intro.file));
  assert.equal(checksum(packText(CHOK.intro.file)), CHOK.intro.checksum);
  assert.deepEqual(intro.sections.map(section => section.title), ["הקדמת מהרח''ו", "הקדמת החיד''א", 'מעשה רוקח']);
  const headings = intro.sections.flatMap(section => section.b.filter(block => block.t === 'h').map(block => block.x));
  for (const prayer of new Set(Object.values(CHOK_PRAYERS))) assert.ok(headings.includes(prayer), prayer);
});

test('only certain Targum joins are split, and every split is logged', () => {
  assert.equal(fixTargumJoins('בְּקַדְמִין בְּרָא יְיָ יָת שְׁמַיָּאוְיָת אַרְעָא:', ['בקדמין', 'ברא', 'יי', 'ית', 'שמיא', 'וית', 'ארעא']).text, 'בְּקַדְמִין בְּרָא יְיָ יָת שְׁמַיָּא וְיָת אַרְעָא:');
  assert.equal(fixTargumJoins('קֳדָםיְיָ').text, 'קֳדָם יְיָ');
  // Not provable: left as printed.
  assert.equal(fixTargumJoins('וְאַתְקִיפִיתבִּידָךְ').changes.length, 0);
  assert.equal(fixTargumJoins('שְׁמַיָּא', ['שמיא']).changes.length, 0);
  const log = JSON.parse(read('sources/torat-emet-chok-leyisrael/build-log.json'));
  assert.equal(log.joinedTargumWords.count, log.joinedTargumWords.changes.length);
  assert.ok(log.joinedTargumWords.changes.every(change => change.before.replace(/\s/g, '') === change.after.replace(/\s/g, '')), 'a split only adds a space');
});

test('the packs are current and deterministic (build --check), and the validation report is current', () => {
  const out = execFileSync(process.execPath, ['scripts/chok-leyisrael/build.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /חק לישראל current: 54 parashot, 378 days/);
  assert.match(execFileSync(process.execPath, ['scripts/chok-leyisrael/validate.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' }), /current/);
});

test('licence and credit: Torat Emet, CC BY-NC-SA 2.5, pinned source, shown in the reader and in About', () => {
  assert.equal(CHOK_CREDIT, 'חק לישראל — מאגר תורת אמת');
  assert.equal(CHOK_LICENSE.title, 'CC BY-NC-SA 2.5');
  assert.equal(CHOK_LEYISRAEL_EDITION.license, 'cc-by-nc-sa');
  assert.equal(LICENSES[CHOK_LEYISRAEL_EDITION.license].commercialUseAllowed, false);
  const provenance = JSON.parse(read('sources/torat-emet-chok-leyisrael/provenance.json'));
  assert.match(provenance.source.commit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.source.files.length, 5);
  assert.ok(provenance.source.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256)));
  assert.ok(provenance.license.verbatim.some(line => line.includes('אין לעשות בתוכן מאגר זה או בחלק ממנו שימוש מסחרי')));
  const manifest = JSON.parse(read(`public/library/packs/${CHOK.packId}/manifest.json`));
  assert.equal(manifest.license, 'cc-by-nc-sa');
  assert.equal(manifest.source.commit, provenance.source.commit);
  const page = read('src/pages/ChokLeYisraelPage.jsx');
  assert.match(page, /\{CHOK_CREDIT\} · <a href=\{CHOK_LICENSE\.url\}/);
  assert.match(read('src/pages/AboutPage.jsx'), /<AboutSection title="חק לישראל">/);
});

test('today: regular, joined (regular and leap year), festival weeks, Israel and the Diaspora', () => {
  const ids = (key, il = true) => chokWeekOf(key, il).ids;
  assert.deepEqual(ids('2026-10-07'), ['bereshit']);
  assert.deepEqual(ids('2026-04-15'), ['tazria', 'metzora'], '5786 (regular year)');
  assert.deepEqual(ids('2026-03-11'), ['vayakhel', 'pekudei'], '5786 (regular year)');
  assert.deepEqual(ids('2027-07-28'), ['matot', 'masei'], '5787 (leap year)');
  // Israel and the Diaspora apart after Shavuot on Shabbat.
  assert.deepEqual(ids('2027-07-14', true), ['balak']);
  assert.deepEqual(ids('2027-07-14', false), ['chukat', 'balak']);
  assert.deepEqual(ids('2026-05-27', true), ['behaalotcha']);
  assert.deepEqual(ids('2026-05-27', false), ['nasso']);
  // A festival's Shabbat: the reading after it; before Simchat Torah, וזאת הברכה.
  assert.deepEqual(ids('2026-04-01'), ['shmini'], 'Shabbat Chol HaMoed Pesach → שמיני');
  assert.deepEqual(ids('2026-09-09'), ['haazinu'], 'Rosh Hashana on Shabbat → האזינו');
  assert.deepEqual(ids('2026-09-23'), ['vezot-haberakhah'], 'Sukkot');
  assert.deepEqual(ids('2026-10-01', true), ['vezot-haberakhah'], 'Shemini Atzeret (Israel)');
  assert.deepEqual(ids('2026-10-01', false), ['vezot-haberakhah'], 'Shemini Atzeret (Diaspora)');
  assert.deepEqual(ids('2026-10-04', false), ['bereshit'], 'the Sunday of Simchat Torah abroad begins בראשית');
  assert.equal(chokWeekOf('2026-09-23').kind, 'vezot');
});

test('the day: weekday by the Jewish date, Thursday night is ליל שישי, Friday from dawn, Shabbat shows Friday', () => {
  assert.deepEqual(chokDayKey('2026-10-04'), { key: 'sun', shabbat: false });
  assert.deepEqual(chokDayKey('2026-10-08'), { key: 'thu', shabbat: false });
  assert.deepEqual(chokDayKey('2026-10-09', { night: true }), { key: 'fri-night', shabbat: false });
  assert.deepEqual(chokDayKey('2026-10-09'), { key: 'fri', shabbat: false });
  assert.deepEqual(chokDayKey('2026-10-10'), { key: 'fri', shabbat: true });
  const times = { alotHaShachar: '2026-10-09T02:55:00Z' };
  // Thursday 20:00 in Jerusalem, after sunset: the Jewish date is Friday.
  assert.equal(chokToday({ context: { key: '2026-10-09', civil: '2026-10-08', afterSunset: true }, times: {}, now: new Date('2026-10-08T17:00:00Z') }).day, 'fri-night');
  assert.equal(chokToday({ context: { key: '2026-10-09', civil: '2026-10-09', afterSunset: false }, times, now: new Date('2026-10-09T01:00:00Z') }).day, 'fri-night', 'before dawn');
  assert.equal(chokToday({ context: { key: '2026-10-09', civil: '2026-10-09', afterSunset: false }, times, now: new Date('2026-10-09T07:00:00Z') }).day, 'fri');
  // Saturday night after sunset: the next week's Sunday.
  const motzash = chokToday({ context: { key: '2026-10-11', civil: '2026-10-10', afterSunset: true }, times: {}, now: new Date('2026-10-10T17:30:00Z') });
  assert.deepEqual([motzash.ids, motzash.day], [['noach'], 'sun']);
});

test('joined weeks: each part over both parashot; neighbours run through the week and on to the next parasha', () => {
  assert.deepEqual(partsOfDay(['tazria', 'metzora'], 'mon'), FULL);
  assert.deepEqual(partsOfDay(['nitzavim', 'vayeilech'], 'fri'), ['mishnah', 'gemara', 'zohar', 'halacha', 'mussar']);
  const { previous, next } = chokNeighbours(['tazria', 'metzora'], 'fri');
  assert.equal(previous.route, 'chok-leyisrael/d/tazria+metzora/fri-night');
  assert.equal(next.route, 'chok-leyisrael/d/achrei-mot/sun');
  assert.equal(chokNeighbours(['vezot-haberakhah'], 'fri').next.route, 'chok-leyisrael/d/bereshit/sun');
  assert.deepEqual(inlineRuns('א<b>ב</b>\nג'), [{ text: 'א', bold: false, small: false }, { text: 'ב', bold: true, small: false }, { br: true }, { text: 'ג', bold: false, small: false }]);
});

test('the reader route: the Siddur card opens today; days, parts, introductions and the list have their routes', () => {
  assert.deepEqual(parseChokRoute('chok-leyisrael'), { view: 'today' });
  assert.deepEqual(parseChokRoute(chokRoute.day(['tazria', 'metzora'], 'fri-night', 'torah')), { view: 'day', ids: ['tazria', 'metzora'], day: 'fri-night', part: 'torah' });
  assert.deepEqual(parseChokRoute('chok-leyisrael/intro/x'), { view: 'intro', anchor: 'x' });
  assert.deepEqual(parseChokRoute('chok-leyisrael/all'), { view: 'all' });
  assert.deepEqual(parseChokRoute('chok-leyisrael/d/nothing/sun'), { view: 'missing' });
  assert.equal(SIDDUR_HOME_ORDER[1].key, 'chok');
  assert.equal(SIDDUR_HOME_ORDER[1].route, 'chok-leyisrael');
  assert.match(read('src/NewApp.jsx'), /mode==='chok-leyisrael' \|\| mode\.startsWith\('chok-leyisrael\/'\) \? <ChokLeYisraelPage /);
  assert.match(read('src/pages/BooksPage.jsx'), /const chokCategory=<button key="chok"/);
  const page = read('src/pages/ChokLeYisraelPage.jsx');
  for (const piece of ['<TitleOrnament />', '<TextSizeControl />', '<HeartToggle', '<ReaderDock', '<ReaderNavigation', 'useStudyTimer(', '<StudyCompletion']) assert.ok(page.includes(piece), piece);
  assert.match(read('src/styles/ui.css'), /\.chok-parts button\.is-on\{border-bottom:var\(--sel-under\);color:var\(--sel-ink\)\}/);
});
