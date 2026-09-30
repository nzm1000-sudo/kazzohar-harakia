// "סיימתי" everywhere: every prayer, blessing, Tehillim chapter, study text, שניים מקרא and שלום רב entry records
// into "המצוות שלי" once a day, with the right category and type, so the spiritual circle and the journal show it.
// Shabbat and Yom Tov services never offer it (the owner's custom: the app is not used then).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  _clearAllEvents, getEvents, formatEventForDisplay, resolveSiddurCompletion, recordSiddurCompletion,
  recordStudyCompletion, recordReadingCompletion, hasRecordedToday, SIDDUR_COMPLETION, ACTIVITY_CATEGORY, ACTIVITY_TYPE,
} from '../src/services/mitzvotJournal.mjs';
import { computeCircle, lightsByDay, lightsOf } from '../src/services/spiritualCircle.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const React = require('react');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function memoryStorage() {
  const map = new Map();
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}
function withLocalStorage(run) {
  const original = globalThis.localStorage;
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { return run(storage); } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original }); }
}
function loadComponent(relative, exportName = 'default') {
  const source = fileURLToPath(new URL(`../src/components/${relative}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const mod = new Module(source);
  mod.filename = source;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(compiled, source);
  return mod.exports[exportName];
}

const AT = new Date('2026-11-03T08:00:00Z'); // a Tuesday
const TZ = 'Asia/Jerusalem';
const kindOf = (flowKey, where) => { const r = resolveSiddurCompletion(flowKey, where); return r && `${r.kind.category}/${r.kind.type}`; };

test('the blessings of every day resolve to the blessings category, in every rite', () => {
  // Edot HaMizrach (the owner's rite): על המחיה / ברכות הנהנין were missing their "סיימתי".
  assert.equal(kindOf('Al Hamihya'), 'brachot/mein_shalosh');
  assert.equal(kindOf('Blessings on Enjoyments'), 'brachot/birchot_hanehenin');
  // Ashkenaz: a collection, each blessing its own chip.
  assert.equal(kindOf('Berachot, Birkat Hanehenin', { itemEn: 'Al Hamichyah', perItem: true }), 'brachot/mein_shalosh');
  assert.equal(kindOf('Berachot, Birkat Hanehenin', { itemEn: 'Borei Nefashot', perItem: true }), 'brachot/bore_nefashot');
  assert.equal(kindOf('Berachot, Birkat Hanehenin', { itemEn: 'Barachot Rishonot', perItem: true }), 'brachot/birchot_hanehenin');
  assert.equal(kindOf('Berachot, Birkat Hanehenin', { itemEn: 'Blessings on Sights Sounds and Smells', perItem: true }), 'brachot/birchot_hareiyah');
  assert.equal(kindOf('Berachot, Tefillat HaDerech'), 'brachot/tefilat_haderech');
  // Sefard and Chabad.
  assert.equal(kindOf('Blessings', { itemEn: "Me'ein Shalosh", perItem: true }), 'brachot/mein_shalosh');
  assert.equal(kindOf('Blessings', { itemEn: 'Borei Nefashot', perItem: true }), 'brachot/bore_nefashot');
  assert.equal(kindOf('Blessings', { itemEn: 'Shehakol', perItem: true }), 'brachot/birchot_hanehenin');
  assert.equal(kindOf('Blessings', { itemEn: 'Mezuzah', perItem: true }), 'brachot/birchot_hamitzvot');
  assert.equal(kindOf('Blessings', { itemEn: 'Berakha Acharona', perItem: true }), 'brachot/bracha_achrona');
  assert.equal(kindOf('Assorted Blessings and Prayers', { itemEn: 'Rainbow', perItem: true }), 'brachot/birchot_hareiyah');
  // Birkat HaMazon keeps its own category, in every rite and reader.
  for (const flow of ['Post Meal Blessing', 'Berachot, Birkat HaMazon', 'rite:ashkenaz:birkat-hamazon', 'smart:birkat-hamazon']) assert.equal(kindOf(flow), 'birkat_hamazon/birkat_hamazon_full', flow);
  assert.equal(kindOf('Blessings', { itemEn: 'Birkat HaMazon' }), 'birkat_hamazon/birkat_hamazon_full');
});

test('every weekday service and prayer of the Siddur resolves; the same service is one entry whatever the rite', () => {
  for (const [flow, id] of [['Weekday, Shacharit', 'Weekday Shacharit'], ['Shacharit', 'Weekday Shacharit'], ['Weekday, Minchah', 'Weekday Mincha'], ['Weekday Maariv', 'Weekday Arvit'], ['Upon Arising', 'Preparatory Prayers'], ['Festivals, Rosh Chodesh', 'Rosh Hodesh'], ['Sefirat HaOmer', 'Counting of the Omer'], ['rite:sefard:omer', 'Counting of the Omer'], ['smart:maariv', 'Weekday Arvit'], ['rite:edot-hamizrach:weekday-shacharit', 'Weekday Shacharit']]) {
    assert.equal(resolveSiddurCompletion(flow).sourceId, id, flow);
  }
  assert.equal(kindOf('Sefirat HaOmer'), 'omer_count/omer_day');
  assert.equal(kindOf('Kiddush Levanah'), 'prayer/siddur_prayer');
  assert.equal(kindOf('The Midnight Rite', { flowTitle: 'תיקון חצות' }), 'prayer/siddur_prayer');
  assert.equal(resolveSiddurCompletion('The Midnight Rite', { flowTitle: 'תיקון חצות' }).title, 'תיקון חצות');
  assert.equal(kindOf('Mishnayot for a Mourner'), 'other/siddur_reading');
  // The festival shelf of Edot HaMizrach, weekday items only.
  assert.equal(kindOf('moadim:hanukkah:סיימת את חנוכה', { title: 'סדר הדלקת נרות חנוכה' }), 'other/chanukah_lights');
  assert.equal(kindOf('moadim:purim:סוף מגילת אסתר', { title: 'פרק ב' }), 'other/megillah');
  assert.equal(kindOf('moadim:pesach:סיימת את פסח', { title: 'ספירת העומר' }), 'omer_count/omer_day');
});

test('Shabbat and Yom Tov offer no "סיימתי" (the owner does not use the app then); Havdalah does', () => {
  for (const flow of ['Shabbat Arvit', 'Shabbat, Maariv', 'Kabbalat Shabbat', 'Shabbat Candle Lighting', 'Daytime Meal', 'Third Meal', 'Festivals, Shalosh Regalim', 'Prayers for Three Festivals', 'Musaf for Festivals', 'Holidays', 'Song of Songs', 'rite:ashkenaz:shabbat-shacharit', 'rite:ashkenaz:festival-musaf', 'rite:ashkenaz:shabbat-kiddush']) {
    assert.equal(resolveSiddurCompletion(flow), null, flow);
    assert.equal(recordSiddurCompletion(flow, { occurredAt: AT, tzid: TZ, storage: memoryStorage() }).created, false, flow);
  }
  for (const title of ['קידוש לליל החג', 'עמידה לשלש רגלים', 'שבת זכור']) assert.equal(resolveSiddurCompletion('moadim:x:סיימת', { title }), null, title);
  assert.equal(resolveSiddurCompletion('moadim:pesach:סוף הגדה של פסח', { title: 'כוס ראשונה' }), null);
  for (const flow of ['Havdalah', 'Shabbat, Havdalah', 'Motzaei Shabbat ']) assert.equal(resolveSiddurCompletion(flow).sourceId, 'Havdalah', flow);
});

test('a blessing is recorded once a day with its category and type; a second tap adds nothing', () => {
  const storage = memoryStorage();
  _clearAllEvents(storage);
  assert.equal(recordSiddurCompletion('Al Hamihya', { occurredAt: AT, tzid: TZ, storage }).created, true);
  assert.equal(recordSiddurCompletion('Al Hamihya', { occurredAt: AT, tzid: TZ, storage }).created, false);
  // The same blessing from another rite's page is the same entry.
  assert.equal(recordSiddurCompletion('Berachot, Birkat Hanehenin', { itemEn: 'Al Hamichyah', perItem: true, occurredAt: AT, tzid: TZ, storage }).created, false);
  assert.equal(recordSiddurCompletion('Blessings on Enjoyments', { occurredAt: AT, tzid: TZ, storage }).created, true);
  assert.equal(recordSiddurCompletion('Berachot, Birkat Hanehenin', { itemEn: 'Borei Nefashot', perItem: true, occurredAt: AT, tzid: TZ, storage }).created, true);
  const events = getEvents({}, storage);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(e => `${e.category}/${e.type}`).sort(), ['brachot/birchot_hanehenin', 'brachot/bore_nefashot', 'brachot/mein_shalosh']);
  assert.ok(events.every(e => e.source === 'siddur' && e.unit === 'count' && e.quantity === 1));
  assert.equal(hasRecordedToday({ jewishDate: '2026-11-03', source: 'siddur', sourceId: 'Al Hamihya' }, storage), true);
  // The journal names each one.
  assert.deepEqual(events.map(e => formatEventForDisplay(e).type).sort(), ['בורא נפשות', 'ברכה מעין שלוש', 'ברכות הנהנין'].sort());
  assert.equal(formatEventForDisplay(events[0]).category, 'ברכות');
  // A collection of separate blessings keeps one entry per blessing.
  recordSiddurCompletion('Blessings', { itemEn: 'Mezuzah', title: 'ברכת המזוזה', perItem: true, occurredAt: AT, tzid: TZ, storage });
  recordSiddurCompletion('Blessings', { itemEn: 'Separating Challah', title: 'הפרשת חלה', perItem: true, occurredAt: AT, tzid: TZ, storage });
  const mitzvot = getEvents({ type: ACTIVITY_TYPE.BIRCHOT_HAMITZVOT }, storage);
  assert.equal(mitzvot.length, 2);
  assert.deepEqual(mitzvot.map(e => formatEventForDisplay(e).type).sort(), ['ברכת המזוזה', 'הפרשת חלה']);
});

test('the circle lights every blessing (no daily ceiling) and a finished study unit, without mixing units into minutes', () => {
  assert.equal(lightsOf({ category: 'brachot', quantity: 1 }), 1);
  const day = '2026-11-03';
  const five = Array.from({ length: 5 }, (_, i) => ({ jewishDate: day, category: 'brachot', type: 'blessing', quantity: 1, unit: 'count', sourceId: String(i) }));
  assert.equal(lightsByDay(five).get(day), 5);
  const units = [{ jewishDate: day, category: 'torah_study', type: 'study_unit', quantity: 1, unit: 'count' }, { jewishDate: day, category: 'torah_study', type: 'custom_learning', quantity: 20, unit: 'minutes' }];
  assert.equal(lightsOf(units[0]), 1);
  const circle = computeCircle(units, day);
  assert.equal(circle.today, 1 + 4, 'a unit, and twenty active minutes (one per five)');
  assert.equal(circle.stats.studyMinutes, 20);
});

test('"סיימתי את הלימוד" records one study unit a day, titled for the journal', () => {
  const storage = memoryStorage();
  const where = { workId: 'Bavli_Berakhot', workTitle: 'תלמוד בבלי, ברכות', unitId: '2a', unitLabel: 'ב׳ ע״א', source: 'talmud-reader', occurredAt: AT, tzid: TZ, storage };
  assert.equal(recordStudyCompletion(where).created, true);
  assert.equal(recordStudyCompletion(where).created, false);
  assert.equal(recordStudyCompletion({ ...where, unitId: '2b', unitLabel: 'ב׳ ע״ב' }).created, true);
  const events = getEvents({}, storage);
  assert.equal(events.length, 2);
  assert.ok(events.every(e => e.category === ACTIVITY_CATEGORY.TORAH_STUDY && e.type === ACTIVITY_TYPE.STUDY_UNIT && e.unit === 'count'));
  assert.match(formatEventForDisplay(events[0]).type, /^סיום לימוד · תלמוד בבלי, ברכות · ב׳ ע״/);
  assert.equal(hasRecordedToday({ jewishDate: '2026-11-03', source: 'talmud-reader', sourceId: 'Bavli_Berakhot#2a' }, storage), true);
});

test('שניים מקרא and a prayer of שלום רב record in their own categories, once a day', () => {
  const storage = memoryStorage();
  const shnayim = { category: ACTIVITY_CATEGORY.SHNAYIM_MIKRA, type: ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION, source: 'shnayim-mikra', sourceId: 'bereshit', title: 'פרשת בראשית', occurredAt: AT, tzid: TZ, storage };
  assert.equal(recordReadingCompletion(shnayim).created, true);
  assert.equal(recordReadingCompletion(shnayim).created, false);
  const prayer = { category: ACTIVITY_CATEGORY.PRAYER, type: ACTIVITY_TYPE.SHALOM_RAV_PRAYER, source: 'shalom-rav', sourceId: 'parnasa', title: 'תפילה לפרנסה בשפע', occurredAt: AT, tzid: TZ, storage };
  assert.equal(recordReadingCompletion(prayer).created, true);
  const [first, second] = getEvents({}, storage).sort((a, b) => a.category.localeCompare(b.category));
  assert.equal(formatEventForDisplay(first).type, 'תפילה לפרנסה בשפע');
  assert.equal(formatEventForDisplay(second).type, 'פרשת בראשית');
  assert.equal(lightsOf(first), 1);
  assert.equal(lightsOf(second), 1);
});

test('the one completion component: button until recorded, then the confirmation — for a blessing and for Birkat HaMazon', () => {
  withLocalStorage(storage => {
    const PrayerCompletion = loadComponent('PrayerCompletion.jsx');
    const html = flowKey => renderToStaticMarkup(React.createElement(PrayerCompletion, { flowKey, tzid: TZ }));
    assert.match(html('Al Hamihya'), /class="prayer-complete-btn completion-rect"[^>]*><span class="completion-rect-label">סיימתי את הברכה</);
    assert.match(html('Blessings on Enjoyments'), /סיימתי את הברכה/);
    assert.match(html('Post Meal Blessing'), /סיימתי את הברכה/);
    assert.match(html('Weekday Shacharit'), /סיימתי את התפילה/);
    assert.match(html('Counting of the Omer'), /סיימתי את הספירה/);
    assert.equal(html('Shabbat Arvit'), '');
    recordSiddurCompletion('Al Hamihya', { occurredAt: new Date(), tzid: TZ, storage });
    assert.match(html('Al Hamihya'), /class="prayer-complete-done completion-rect is-yasher" role="status"><span class="completion-rect-label">ישר כח!<\/span>.*סיימתי את הברכה\. נרשם ב״המעגל הרוחני״/);
    assert.doesNotMatch(html('Al Hamihya').replace(/<span class="visually-hidden"[^]*?<\/span>/g, ''), /completion-rect-label">סיימתי/, 'once recorded the frame says ישר כח!, not סיימתי');
    assert.doesNotMatch(html('Al Hamihya'), /prayer-complete-btn/);
    assert.match(html('Blessings on Enjoyments'), /prayer-complete-btn/);
    const { StudyCompletion } = { StudyCompletion: loadComponent('CompletionButton.jsx', 'StudyCompletion') };
    const study = () => renderToStaticMarkup(React.createElement(StudyCompletion, { workId: 'w', workTitle: 'ספר', unitId: '1', unitLabel: 'פרק א', source: 'library-reader', tzid: TZ }));
    assert.match(study(), /class="prayer-complete-btn completion-rect"[^>]*><span class="completion-rect-label">סיימתי את הלימוד</);
    recordStudyCompletion({ workId: 'w', unitId: '1', source: 'library-reader', occurredAt: new Date(), tzid: TZ, storage });
    assert.match(study(), /prayer-complete-done/);
  });
});

test('every reader carries the same "סיימתי" (one component, one style)', () => {
  const uses = {
    '../src/components/SourceReader.jsx': [/<PrayerCompletion flowKey=\{navigation\.flowKey\}[^>]*itemEn=/, /<StudyCompletion workId=\{workId\}/],
    '../src/components/RiteServiceReader.jsx': [/<PrayerCompletion/, /omer: 'Counting of the Omer'/],
    '../src/components/DayServiceReader.jsx': [/<PrayerCompletion/],
    '../src/components/ComposedPrayerReader.jsx': [/<PrayerCompletion/],
    '../src/pages/LibraryPage.jsx': [/\{portion && <StudyCompletion/, /\{!parasha && current && <StudyCompletion/],
    '../src/pages/TalmudPage.jsx': [/<StudyCompletion workId=\{`Bavli_\$\{tractate\.title\}`\}/],
    '../src/pages/HalachaLibrary.jsx': [/<StudyCompletion \{\.\.\.studyWork\}/, /source: 'halacha-question'/],
    '../src/pages/ShalomRavPage.jsx': [/<StudyCompletion workId="shalom-rav"/, /<CompletionButton key=\{entry\.id\} source="shalom-rav"/],
    '../src/pages/ShnayimMikra.jsx': [/<CompletionButton key=\{parasha\.id\} source="shnayim-mikra"/, /source: 'shnayim-mikra'/],
    '../src/Tehillim.jsx': [/<CompletionButton source="tehillim"/],
  };
  for (const [file, patterns] of Object.entries(uses)) for (const pattern of patterns) assert.match(read(file), pattern, `${file} ${pattern}`);
  // One look: only CompletionButton draws the button.
  assert.doesNotMatch(read('../src/Tehillim.jsx'), /סיימתי את הפרק<\/button>/);
  assert.match(read('../src/components/CompletionButton.jsx'), /className="prayer-complete-btn completion-rect"/);
  // The Shabbat table stays in SIDDUR_COMPLETION's hands (untouched): no Shabbat service there.
  for (const key of Object.keys(SIDDUR_COMPLETION)) assert.doesNotMatch(key, /shabbat|festival|kiddush/i);
});

// The frame of "סיימתי" (readers only): a refined rectangle (modest rounded corners, not a pill): open, golden, the words in the theme's ink; the invitation under it before
// the tap, and after it the About lettering (slower) with the open circle as "N/72" — centred, one status line.
test('"סיימתי" is an open golden rectangle with the invitation before and "הוספת אור למעגל הרוחני" + N/72 after', () => {
  withLocalStorage(storage => {
    const Button = loadComponent('CompletionButton.jsx');
    const draw = () => renderToStaticMarkup(React.createElement(Button, { source: 'tehillim', sourceId: 'chapter-1', tzid: TZ, label: 'סיימתי את הפרק', ariaLabel: 'סימון תהילים פרק א׳ כהושלם', record: () => {} }));
    const before = draw();
    assert.match(before, /^<div class="prayer-completion-footer is-rect"><button type="button" class="prayer-complete-btn completion-rect" aria-label="סימון תהילים פרק א׳ כהושלם"><span class="completion-rect-label">סיימתי את הפרק<\/span><\/button><p class="completion-caption">להוסיף אור למעגל הרוחני\?<\/p><\/div>$/);
    assert.doesNotMatch(before, /כל סיום מוסיף אור|light-ack|מתוך/);
    recordReadingCompletion({ category: ACTIVITY_CATEGORY.TEHILLIM, type: ACTIVITY_TYPE.TEHILLIM_CHAPTER, source: 'tehillim', sourceId: 'chapter-1', quantity: 1, unit: 'chapters', occurredAt: new Date(), tzid: TZ, storage });
    const after = draw();
    assert.match(after, /<p class="prayer-complete-done completion-rect is-yasher" role="status"><span class="completion-rect-label">ישר כח!<\/span>/);
    assert.match(after, /סיימתי את הפרק\. נרשם ב״המעגל הרוחני״/, 'the item\'s own words stay for screen readers');
    assert.doesNotMatch(after, /<button/, 'recorded: nothing more to press');
    const caption = after.slice(after.indexOf('<p class="completion-caption is-added" aria-hidden="true">'));
    assert.ok(caption.length > 0);
    assert.equal(caption.replace(/<[^>]+>/g, ''), 'הוספת אור למעגל הרוחני1/72', 'the lettering, then directly below it "1/72"');
    assert.match(caption, /<span class="completion-fraction" dir="ltr">1\/72<\/span>/);
    assert.match(caption, /class="about-title-letter tone-[123]" style="animation-duration:(7[2-9]|8\d|9\d)\.\d\ds;animation-delay:-[\d.]+s"/);
  });
  const { circleFraction, slowShimmerLetters } = { circleFraction: loadComponent('CompletionButton.jsx', 'circleFraction'), slowShimmerLetters: loadComponent('CompletionButton.jsx', 'slowShimmerLetters') };
  assert.deepEqual([circleFraction(48), circleFraction(0), circleFraction(71)], ['48/72', '0/72', '71/72']);
  const letters = slowShimmerLetters();
  assert.equal(letters.map(l => l.char).join(''), 'הוספת אור למעגל הרוחני');
  for (const l of letters.filter(x => x.cycle)) assert.ok(parseFloat(l.duration) >= 72 && parseFloat(l.duration) <= 100, 'a slow, quiet drift (72–100 s)');
  const button = read('../src/components/CompletionButton.jsx');
  assert.match(button, /\{ack && `\. \$\{LIGHT_ADDED\}\. \$\{ack\.active\} מתוך \$\{WEEK_GOAL\}`\}/, 'spoken once: "הוספת אור למעגל הרוחני. 48 מתוך 72"');
  const css = read('../src/styles/base.css');
  const rule = css.match(/\n\.completion-rect\{[^}]*\}/)[0];
  assert.match(rule, /--rect-radius:12px/); assert.match(rule, /border-radius:var\(--rect-radius\)/); assert.doesNotMatch(rule, /border-radius:(50%|999px)/, 'a rectangle, not an ellipse or a pill'); assert.match(rule, /background:transparent/); assert.match(rule, /color:var\(--ink\)/); assert.match(rule, /font-weight:700/);
  assert.match(rule, /min-height:56px/, 'a comfortable touch target');
  assert.match(css, /\.completion-rect::before\{[^}]*conic-gradient\(from var\(--brand-angle\)[^}]*content-box exclude[^}]*animation:brand-turn (\d+)s linear infinite/, 'the About gold, a ring only, its light travelling');
  const turn = Number(css.match(/\.completion-rect::before\{[^}]*animation:brand-turn (\d+)s/)[1]);
  assert.ok(turn >= 40 && turn <= 60, `a slow, soft light: ${turn}s a turn`);
  assert.doesNotMatch(css.match(/\.completion-rect::before\{[^}]*\}/)[0], /#fff4cf|#f7e6b0/, 'no bright glint — a lower-contrast highlight');
  assert.match(css, /\.completion-rect::after\{[^}]*inset:5px[^}]*border-radius:calc\(var\(--rect-radius\) - 5px\)/, 'the inner frame follows the corners');
  assert.match(css, /\.prayer-complete-btn\.completion-rect:focus-visible\{outline:2px solid var\(--focus\)/);
  assert.match(css, /\.prayer-complete-done\.completion-rect\.is-yasher\{[^}]*animation:yasher-glow 7s/, 'ישר כח! glows softly around its frame');
  assert.match(css, /\.completion-added \.about-title-letter\{--t-accent:color-mix\(in srgb,var\(--gold\)/, 'muted golden tones, not the full palette');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.completion-rect::before\{animation:none\}/);
  assert.match(css, /html\[data-a11y-motion\] \.completion-rect::before\{animation:none\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.about-title-letter\{animation:none;color:var\(--accent\);text-shadow:none\}\}/, 'still letters under reduced motion');
});
