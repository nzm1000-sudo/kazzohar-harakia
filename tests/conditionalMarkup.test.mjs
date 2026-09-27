// The edition's own conditional structure, resolved for real prayer days (Jerusalem, 5787).
import test from 'node:test';
import assert from 'node:assert/strict';
import siddurOffline from '../src/data/siddurOffline.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { dayConditionsFromContext, evaluateRubric } from '../src/services/prayer/rubricConditions.mjs';
import { resolveConditionalMarkup } from '../src/services/prayer/conditionalMarkup.mjs';
import { removeNikud } from '../src/hebrewText.mjs';

const settings = { il: true, halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } };
const DAYS = {
  weekday: '2026-10-06T08:00:00+03:00', // 25 Tishrei, Tuesday
  cholHamoed: '2026-09-27T08:00:00+03:00', // 16 Tishrei
  sheminiAtzeretShabbat: '2026-10-03T10:00:00+03:00',
  shabbat: '2026-10-10T10:00:00+03:00',
  roshChodesh: '2026-10-12T08:00:00+03:00', // 1 Cheshvan (Monday)
  chanukah: '2026-12-07T08:00:00+02:00',
  asaraBetevet: '2026-12-20T08:00:00+02:00',
};
const contextFor = (day, prayerType = 'shacharit') => JewishContextEngine({ now: new Date(DAYS[day]), settings, prayerType });
const textOf = (section, day, prayerType, range = null) => {
  const all = siddurOffline.texts[`Siddur Edot HaMizrach, ${section}`].he;
  const he = range ? all.slice(range[0], range[1] + 1) : all;
  return removeNikud(normalizeSiddurBlocks(he.map((text, source) => ({ text, source })), { title: section, markup: he, context: contextFor(day, prayerType) }).map(block => block.text).join(' '));
};

test('Birkat HaMazon: יעלה ויבוא only on its days, with the right festival — never a stray fragment on a weekday', () => {
  const weekday = textOf('Post Meal Blessing', 'weekday');
  assert.doesNotMatch(weekday, /יעלה ויבא|מקרא קדש|חג הסכות|רצה והחליצנו|לרחם בו עלינו/);
  const chmFull = textOf('Post Meal Blessing', 'cholHamoed');
  // Up to the "if one forgot" section, which prints every festival's name in parentheses by design.
  const chm = chmFull.slice(0, chmFull.indexOf('שנתן'));
  assert.match(chm, /יעלה ויבא/);
  assert.match(chm, /חג הסכות הזה, ביום מקרא קדש הזה/, 'Chol HaMoed: "ביום מקרא קדש" without "טוב"');
  assert.doesNotMatch(chm, /חג המצות|חג השבועות|הזכרון הזה|שמיני חג עצרת|ראש חדש הזה|רצה והחליצנו/);
  assert.match(chmFull, /סכת דוד הנופלת/);
  const sheminiFull = textOf('Post Meal Blessing', 'sheminiAtzeretShabbat');
  const shemini = sheminiFull.slice(0, sheminiFull.indexOf('שנתן'));
  assert.match(shemini, /רצה והחליצנו/);
  assert.match(shemini, /שמיני חג עצרת הזה, ביום טוב מקרא קדש/);
  assert.doesNotMatch(shemini, /חג הסכות הזה/);
  const rc = textOf('Post Meal Blessing', 'roshChodesh');
  assert.match(rc, /ראש חדש הזה/);
  assert.doesNotMatch(rc, /מקרא קדש/);
  const chanukah = textOf('Post Meal Blessing', 'chanukah');
  assert.doesNotMatch(chanukah, /יעלה ויבא/);
});

test('weekday Amidah: the Chol HaMoed wording on Chol HaMoed, nothing festive on an ordinary day', () => {
  const chm = textOf('Weekday Shacharit, Amida', 'cholHamoed');
  assert.match(chm, /יעלה ויבא/);
  assert.match(chm, /חג הסכות הזה/);
  assert.doesNotMatch(chm, /חג המצות הזה|ראש חדש הזה/);
  const weekday = textOf('Weekday Shacharit, Amida', 'weekday');
  assert.doesNotMatch(weekday, /יעלה ויבא|חג הסכות|על הנסים|עננו אבינו/);
  assert.match(textOf('Weekday Shacharit, Amida', 'chanukah'), /על הנסים/);
  assert.match(textOf('Weekday Shacharit, Amida', 'asaraBetevet'), /עננו/);
});

test('festival Mussaf: the day\'s own festival and Kedusha only', () => {
  const chm = textOf('Prayers for Three Festivals, Mussaf', 'cholHamoed', 'shacharit', [0, 58]); // the Mussaf itself
  assert.match(chm, /חג הסכות הזה/);
  assert.doesNotMatch(chm, /חג המצות הזה|חג השבועות הזה|שמיני חג עצרת הזה|השבת הזה/);
  assert.doesNotMatch(chm, /את יום טוב מקרא קדש הזה, זמן שמחתנו/, 'Chol HaMoed adds no "טוב"');
});

test('no decided caption survives into what is shown, on any day, in any section', () => {
  for (const day of Object.keys(DAYS)) {
    const context = contextFor(day);
    const conditions = dayConditionsFromContext(context);
    for (const [ref, value] of Object.entries(siddurOffline.texts)) {
      const he = value.he || [];
      const blocks = normalizeSiddurBlocks(he.map((text, source) => ({ text, source })), { title: ref, markup: he, context });
      for (const block of blocks) {
        // Plain-text captions ("במוצאי שבת אומרים") are resolved by the section maps of the day plan, not here.
        if (!/<small/.test(he[block.source] || '')) continue;
        const verdict = evaluateRubric(block.text, conditions);
        assert.ok(!(verdict.known && !verdict.applies && block.text.length < 90), `${day} ${ref}: "${removeNikud(block.text)}" is shown although it does not apply`);
      }
    }
  }
});

test('an unknown date resolves nothing: the edition is shown as printed', () => {
  const he = siddurOffline.texts['Siddur Edot HaMizrach, Post Meal Blessing'].he;
  assert.deepEqual(resolveConditionalMarkup(he, dayConditionsFromContext({})), he);
});
