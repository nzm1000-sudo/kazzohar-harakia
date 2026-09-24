import test from 'node:test';
import assert from 'node:assert/strict';
import { browsableWorks, workById, bookOutline, unitSections, PENINEI_BOOKS } from '../src/services/halachaBooks.mjs';
import { HALACHA_QUESTIONS } from '../src/data/halachaQuestions.mjs';

const liveSefaria = process.env.RUN_LIVE_SEFARIA_TESTS === '1';

test('every approved work with a reference prefix is browsable', () => {
  const ids = browsableWorks().map(w => w.id);
  for (const id of ['shulchan-arukh-oc', 'shulchan-arukh-yd', 'ben-ish-hai', 'peninei-halakhah']) assert.ok(ids.includes(id), id);
});

test('every Peninei Halakhah book cited by questions is in the browsable list', () => {
  const cited = new Set(HALACHA_QUESTIONS.flatMap(q => q.sources.map(s => s.ref)).filter(r => r.startsWith('Peninei Halakhah, ')).map(r => r.replace('Peninei Halakhah, ', '').replace(/ [\d:]+$/, '')));
  for (const book of cited) assert.ok(PENINEI_BOOKS.some(([en]) => en === book), `missing Peninei book: ${book}`);
});

if (liveSefaria) {
  test('live: Shulchan Arukh OC outline follows the Topic alt-struct and siman ranges come from the shape', async () => {
    const work = workById('shulchan-arukh-oc');
    const units = await bookOutline(work);
    assert.ok(units.length > 20);
    assert.equal(units[0].from, 1);
    const unit = units.find(u => u.from <= 208 && u.to >= 208);
    assert.ok(unit, 'siman 208 must belong to a unit');
    const sections = await unitSections(work, unit.key);
    const s208 = sections.find(s => s.ref === 'Shulchan Arukh, Orach Chayim 208');
    assert.ok(s208 && s208.size >= 7, 'siman 208 must have at least 7 seifim so 208:7 can be highlighted');
  });

  test('live: Ben Ish Hai lists only halachot (no drashot) and opens a parasha as a full range', async () => {
    const work = workById('ben-ish-hai');
    const units = await bookOutline(work);
    assert.ok(units.every(u => /Halachot/.test(u.key)));
    const sections = await unitSections(work, units[0].key);
    const pinchas = sections.find(s => /Pinchas/.test(s.ref));
    assert.match(pinchas.ref, /Pinchas 1-\d+$/);
    assert.equal(pinchas.label, 'פנחס');
  });
}
