// The Siddur's visual hierarchy, read from the edition's own convention (said words are pointed;
// titles, directions, sources and letter markers are not). Presentation only — no word is changed.
import test from 'node:test';
import assert from 'node:assert/strict';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { planDayService } from '../src/services/prayer/dayServicePlan.mjs';
import { composeDayService } from '../src/services/prayer/dayServiceComposer.mjs';
import { removeNikud } from '../src/hebrewText.mjs';

const settings = { il: true, halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } };
const context = JewishContextEngine({ now: new Date('2026-09-27T08:00:00+03:00'), settings });
const blocksOf = section => {
  const he = siddurOffline.texts[`Siddur Edot HaMizrach, ${section}`].he;
  return normalizeSiddurBlocks(he.map((text, source) => ({ text, source })), { title: section, markup: he, context });
};
const plain = text => removeNikud(text).replace(/[֑-֯]/g, '');

test('the ketoret spices read continuously, each letter a marker ("א:"), not a line of its own', () => {
  const blocks = blocksOf('Weekday Shacharit, Incense Offering');
  const spices = blocks.find(block => plain(block.text).includes('הצרי'));
  assert.equal(spices.display, 'prayer');
  const kinds = spices.segments.map(segment => segment.kind);
  assert.ok(kinds.filter(kind => kind === 'marker').length >= 8, 'the letters are markers');
  assert.equal(spices.segments.find(segment => segment.kind === 'marker').text, 'א:');
  assert.ok(plain(spices.segments.filter(segment => segment.kind === 'text').map(s => s.text).join(' ')).includes('הצרי'));
  assert.ok(!blocks.some(block => /^[א-ת]{1,2}:?$/.test(plain(block.text).trim())), 'no letter alone on a line');
});

test('ברכת כהנים is a heading; the Kohen\'s direction and its source are guidance; only the words said stay prayer', () => {
  const he = siddurOffline.texts['Siddur Edot HaMizrach, Prayers for Three Festivals, Mussaf'].he.slice(36, 40);
  const blocks = normalizeSiddurBlocks(he.map((text, i) => ({ text, source: 36 + i })), { title: 'מוסף', markup: he, context });
  const heading = blocks.find(block => plain(block.text).trim() === 'ברכת כהנים');
  assert.equal(heading.display, 'heading');
  const direction = blocks.find(block => plain(block.text).startsWith('כשעוקר הכהן'));
  assert.equal(direction.display, 'instruction');
  assert.ok(direction.segments.some(segment => segment.kind === 'reference' && /תצוה/.test(plain(segment.text))), '(בא״ח תצוה י״ב) is a source');
  const said = blocks.find(block => plain(block.text).startsWith('לשם יחוד'));
  assert.equal(said.display, 'prayer');
});

test('the abbreviated Name and other unpointed words inside the words said stay prayer', () => {
  const [block] = normalizeSiddurBlocks([{ text: 'שְׁמַע יִשְׂרָאֵל ה׳ אֱלֹהֵינוּ ה׳ אֶחָד׃', source: 0 }], { title: 'שמע' });
  assert.equal(block.display, 'prayer');
  assert.equal(block.segments, undefined);
});

test('every section of the Siddur: no direction is shown as prayer, no prayer as a direction (by the nikud signal)', () => {
  for (const [ref, value] of Object.entries(siddurOffline.texts)) {
    const he = value.he || [];
    const blocks = normalizeSiddurBlocks(he.map((text, source) => ({ text, source })), { title: ref, markup: he, context });
    for (const block of blocks) {
      const words = String(block.text).split(/\s+/).filter(word => /[א-ת]{2,}/.test(word));
      const pointed = words.filter(word => /[֑-ׇֽֿׁׂׅׄ]/.test(word)).length;
      if (block.display === 'prayer' && words.length >= 4) assert.ok(pointed / words.length >= 0.5, `${ref}: "${plain(block.text).slice(0, 50)}" shown as prayer`);
      if (['instruction', 'minhag', 'heading'].includes(block.display)) assert.ok(pointed / Math.max(1, words.length) < 0.5, `${ref}: "${plain(block.text).slice(0, 50)}" shown as ${block.display}`);
    }
  }
});

test('every quick link of the Smart Siddur points at a section (and words) that exist', () => {
  const cases = [['shacharit', '2026-09-27T08:00:00+03:00'], ['mincha', '2026-09-27T16:00:00+03:00'], ['maariv', '2026-09-28T20:00:00+03:00'], ['shacharit', '2026-10-02T08:00:00+03:00'], ['shacharit', '2026-10-03T08:00:00+03:00'], ['mincha', '2026-10-03T15:00:00+03:00'], ['birkat-hamazon', '2026-09-27T13:00:00+03:00']];
  for (const [prayer, iso] of cases) {
    const contextFor = type => JewishContextEngine({ now: new Date(iso), settings, prayerType: type });
    const plan = planDayService({ prayer, context: contextFor(prayer === 'birkat-hamazon' ? 'shacharit' : prayer) });
    const doc = composeDayService(plan, contextFor(prayer === 'birkat-hamazon' ? 'shacharit' : prayer), { contextFor });
    assert.ok(plan.highlights.length > 0, `${prayer} ${iso}`);
    for (const item of plan.highlights) {
      const section = doc.sections.find(entry => entry.id === item.section);
      assert.ok(section, `${prayer} ${iso}: "${item.label}" → ${item.section}`);
      if (item.find) assert.ok(section.blocks.some(block => removeNikud(block.text || '').includes(removeNikud(item.find))), `${prayer} ${iso}: "${item.label}" → "${item.find}"`);
    }
  }
});
