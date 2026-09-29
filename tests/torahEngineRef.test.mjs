// Torah Engine · the canonical reference layer and the deep-link contract: every reference resolves to the exact place in
// the right reader — never the library home.
import test from 'node:test';
import assert from 'node:assert/strict';
import { workById } from '../src/data/library/registry.mjs';
import { amudOf, displayRef, resolveTorahRef, targetFor, torahRef } from '../src/services/torah/refs.mjs';

const route = query => resolveTorahRef(query)?.target?.route;

test('Tanakh: בראשית א:א in every written form', () => {
  for (const query of ['בראשית א:א', 'בראשית א א', 'בראשית א, א', 'בראשית פרק א פסוק א', 'בראשית 1:1']) assert.equal(route(query), 'books/r/Genesis/1/1', query);
  assert.equal(route('שמות כ:א'), 'books/r/Exodus/20/1');
  assert.equal(route('ויקרא א א'), 'books/r/Leviticus/1/1');
  assert.equal(route('בראשית יב:א'), 'books/r/Genesis/12/1');
});

test('Mishnah and Bavli: ברכות א:א is the mishnah; a daf with its amud (any form) is the Gemara', () => {
  assert.equal(route('ברכות א:א'), 'books/r/Mishnah_Berakhot/1/1');
  assert.equal(route('משנה ברכות ב:א'), 'books/r/Mishnah_Berakhot/2/1');
  for (const query of ['ברכות ב ע"א', 'ברכות ב ע״א', 'ברכות ב.', 'ברכות דף ב עמוד א', 'ברכות ב']) assert.equal(route(query), 'talmud/Berakhot/2a', query);
  assert.equal(route('ברכות ב:'), 'talmud/Berakhot/2b');
  assert.equal(route('שבת קיח ע"ב'), 'talmud/Shabbat/118b');
  assert.equal(resolveTorahRef('ברכות ב ע"א').ref.workId, 'Bavli_Berakhot');
});

test('Shulchan Arukh and its commentaries: siman and seif (katan), abbreviations included', () => {
  for (const query of ['שו"ע או"ח שיח א', 'שו״ע אורח חיים סימן שיח סעיף א', 'שולחן ערוך אורח חיים שיח א', 'שו"ע או"ח סי\' שיח ס"א']) assert.equal(route(query), 'books/r/Shulchan_Arukh__Orach_Chayim/318/1', query);
  assert.equal(route('שו"ע או"ח שיח'), 'books/r/Shulchan_Arukh__Orach_Chayim/318');
  assert.equal(route('שולחן ערוך יורה דעה פז ג'), 'books/r/Shulchan_Arukh__Yoreh_Deah/87/3');
  assert.equal(route('משנה ברורה שיח'), 'books/r/Mishnah_Berurah/318');
  assert.equal(route('מ"ב שיח ס"ק ג'), 'books/r/Mishnah_Berurah/318/3');
  assert.equal(route('ביאור הלכה שיח'), 'books/r/Biur_Halacha/318');
  assert.equal(route('כף החיים שיח ה'), 'books/r/Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim/318/5');
  assert.equal(route('באר היטב שיח'), 'books/r/Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim/318');
});

test('Zohar pages resolve to the exact page', () => {
  assert.equal(route('זוהר ח"א טו ע"א'), 'books/r/Zohar/29');
});

test('ordinary words and impossible places are not references', () => {
  for (const query of ['חלב ודגים', 'בשר בחלב', 'בראשית תתק', 'ברכות תתק ע"א', '', 'א']) assert.equal(resolveTorahRef(query)?.target?.route ?? null, null, query);
  assert.equal(route('בראשית'), 'books/w/Genesis', 'a book name alone opens the book');
});

test('TorahRef: one shape for every corpus, with the base place of a commentary', () => {
  const rashi = torahRef(workById('Rashi_on_Genesis'), 1, 3, { anchor: 1 });
  assert.deepEqual({ ...rashi, displayRef: undefined }, { workId: 'Rashi_on_Genesis', category: 'tanakh-commentary', section: 1, segment: 3, anchorRef: 'Genesis.1.1', commentatorId: 'Rashi_on_Genesis', baseWorkId: 'Genesis', displayRef: undefined });
  assert.equal(rashi.displayRef, 'רש״י על בראשית א׳, א׳');
  assert.equal(displayRef(workById('Mishnah_Berurah'), 318, 3), 'משנה ברורה שי״ח, ס״ק ג׳');
  assert.equal(amudOf(workById('Bavli_Berakhot'), 1), '2a');
  assert.match(displayRef(workById('Bavli_Chullin'), 204, 16), /^חולין ק״ג ע״ב, ט״ז$/);
});

test('deep links: base texts, commentaries (to the base with מפרשים open), the Talmud with its layer', () => {
  assert.deepEqual(targetFor(workById('Genesis'), 1, 1), { route: 'books/r/Genesis/1/1' });
  assert.deepEqual(targetFor(workById('Rashi_on_Genesis'), 1, 3, { anchor: 1 }), { route: 'books/r/Genesis/1/1/m/Rashi_on_Genesis.1.3' });
  assert.deepEqual(targetFor(workById('Mishnah_Berurah'), 318, 3, { anchor: 1 }), { route: 'books/r/Shulchan_Arukh__Orach_Chayim/318/1/m/Mishnah_Berurah.318.3' });
  assert.deepEqual(targetFor(workById('Mishnah_Berurah'), 318, 3), { route: 'books/r/Mishnah_Berurah/318/3' }, 'a comment with no seif opens in the book itself');
  assert.deepEqual(targetFor(workById('Bavli_Chullin'), 204, 16), { route: 'talmud/Chullin/103b/16' });
  assert.deepEqual(targetFor(workById('Rashi_on_Chullin'), 204, 3, { anchor: 16 }), { route: 'talmud/Chullin/103b/16/rashi' });
  assert.deepEqual(targetFor(workById('Tosafot_on_Shabbat'), 39, 3, { anchor: 8 }), { route: 'talmud/Shabbat/21a/8/tosafot' });
  assert.deepEqual(targetFor(workById('Yahel_Ohr_on_Zohar'), 29, 3), { route: 'books/r/Zohar/29/0/m/Yahel_Ohr_on_Zohar.29.3' });
  assert.deepEqual(targetFor(workById('Oneg_Shabbat'), 9, 21), { route: 'books/r/Oneg_Shabbat/9/21' });
});
